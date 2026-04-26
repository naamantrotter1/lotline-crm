/**
 * Contacts data layer — all reads/writes go through Supabase RLS.
 * No localStorage layer; contacts are a first-class Supabase-native feature.
 */
import { supabase } from './supabase';

const SELECT_FIELDS = `
  id, organization_id, first_name, last_name, email, phone, secondary_phone,
  company, title, address, lead_source, owner_user_id, tags, custom_fields,
  lifecycle_stage, do_not_contact, notes, last_contacted_at, states_serviced,
  created_at, updated_at,
  contact_types(type),
  contact_deals(deal_id, role)
`.trim();

function toStr(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v || null;
  return null; // drop JSONB objects stored in text-like fields
}

function mapRow(r) {
  return {
    ...r,
    // Normalize fields that should be strings but may be stored as JSONB {}
    first_name: toStr(r.first_name),
    last_name:  toStr(r.last_name),
    email:      toStr(r.email),
    phone:      toStr(r.phone),
    company:    toStr(r.company),
    title:      toStr(r.title),
    address:    toStr(r.address),
    notes:      toStr(r.notes),
    types:       (r.contact_types || []).map(t => t.type).filter(t => typeof t === 'string'),
    linkedDeals: (r.contact_deals  || []),
    fullName:    [r.first_name, r.last_name].filter(v => typeof v === 'string' && v).join(' ') || toStr(r.email) || 'Unnamed',
  };
}

/** List all non-deleted contacts for the active org. */
export async function fetchContacts(orgId, { search = '', lifecycle = null } = {}) {
  if (!supabase || !orgId) return [];
  let q = supabase
    .from('contacts')
    .select(SELECT_FIELDS)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('last_name')
    .order('first_name');

  if (lifecycle) q = q.eq('lifecycle_stage', lifecycle);

  const { data, error } = await q;
  if (error) { console.error('[contacts] fetch error', error); return []; }

  let rows = (data || []).map(mapRow);

  if (search) {
    const q2 = search.toLowerCase();
    rows = rows.filter(c =>
      c.fullName.toLowerCase().includes(q2) ||
      (c.email || '').toLowerCase().includes(q2) ||
      (c.company || '').toLowerCase().includes(q2) ||
      (c.phone || '').includes(q2)
    );
  }
  return rows;
}

/** Get a single contact by id. */
export async function fetchContact(id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase
    .from('contacts')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) return null;
  return mapRow(data);
}

/** Create a contact + its types in one shot. Returns the new contact. */
export async function createContact({ orgId, types = [], ...fields }) {
  if (!supabase) return { error: 'No Supabase client' };

  const { data, error } = await supabase
    .from('contacts')
    .insert({ organization_id: orgId, ...fields })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (types.length) {
    const { error: typesErr } = await supabase.from('contact_types').insert(
      types.map(type => ({ contact_id: data.id, type }))
    );
    if (typesErr) console.error('contact_types insert failed:', typesErr.message);
  }

  return { data: await fetchContact(data.id) };
}

/** Update a contact's fields + replace its types. */
export async function updateContact(id, { types, ...fields }) {
  if (!supabase) return { error: 'No Supabase client' };

  const { error } = await supabase
    .from('contacts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  if (types !== undefined) {
    await supabase.from('contact_types').delete().eq('contact_id', id);
    if (types.length) {
      await supabase.from('contact_types').insert(
        types.map(type => ({ contact_id: id, type }))
      );
    }
  }

  return { data: await fetchContact(id) };
}

/** Delete a contact (hard delete — cascades to contact_types, contact_deals). */
export async function deleteContact(id) {
  if (!supabase) return { error: 'No Supabase client' };
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/** Link a contact to a deal. */
export async function linkContactDeal(contactId, dealId, role = 'other') {
  if (!supabase) return;
  await supabase.from('contact_deals').upsert(
    { contact_id: contactId, deal_id: dealId, role },
    { onConflict: 'contact_id,deal_id,role' }
  );
}

/** Fetch contacts linked to a deal. */
export async function fetchDealContacts(dealId) {
  if (!supabase || !dealId) return [];
  const { data } = await supabase
    .from('contact_deals')
    .select(`role, contacts(${SELECT_FIELDS})`)
    .eq('deal_id', dealId);
  return (data || []).map(r => ({ role: r.role, ...mapRow(r.contacts) }));
}

export const LIFECYCLE_STAGES = ['new', 'working', 'qualified', 'customer', 'dormant'];
export const CONTACT_TYPE_OPTIONS = [
  'Buyer','Closing Attorney','Contractor','Home Dealer','Home Manufacturer',
  'Investor','Land Clearing Contractor','Land Surveyor','Real Estate Agent',
  'Septic Installer','Set-up Contractor','Soil Scientist','Well Installer','Wholesaler',
];
export const LEAD_SOURCES = ['Direct','Referral','Website','Cold Call','Social Media','Email Campaign','Conference','Driving for Dollars','MLS','Wholesaler','Other'];
