import { INVESTORS } from '../data/investors';
import { supabase } from './supabase';

function lsKey(orgId) {
  return orgId ? `lotline_investors_${orgId}` : 'lotline_investors';
}

/**
 * Load investors from org-scoped localStorage.
 * Only seeds from static INVESTORS data for the LotLine Homes org (orgSlug === 'lotline-homes').
 * New tenants get an empty list.
 */
export function loadInvestors(orgId, orgSlug) {
  try {
    const saved = JSON.parse(localStorage.getItem(lsKey(orgId)));
    if (saved && saved.length) return saved;
  } catch {}
  // Only seed static LotLine investor data for the LotLine org
  if (orgSlug === 'lotline-homes') {
    const seeded = INVESTORS.map(inv => ({ ...inv }));
    localStorage.setItem(lsKey(orgId), JSON.stringify(seeded));
    return seeded;
  }
  return [];
}

export function saveInvestors(investors, orgId) {
  localStorage.setItem(lsKey(orgId), JSON.stringify(investors));
}

export function addInvestor(newInv, orgId, orgSlug) {
  const all = loadInvestors(orgId, orgSlug);
  const investor = {
    id: `inv-${Date.now()}`,
    name: newInv.name || '',
    contact: newInv.contact || '',
    email: newInv.email || '',
    phone: newInv.phone || '',
    type: newInv.type || 'Private Lender',
    activeDeals: 0,
    capitalInvested: 0,
    totalReturns: 0,
    roiPct: 0,
    roiDollars: 0,
    avgAnnualizedRoi: 0,
    preferredFinancing: newInv.preferredFinancing || '',
    standardTerms: newInv.standardTerms || '',
    notes: newInv.notes || '',
    deals: [],
  };
  const updated = [...all, investor];
  saveInvestors(updated, orgId);

  // Also persist to Supabase so new investors are visible to all org members
  if (supabase && orgId) {
    supabase.from('investors').insert({
      organization_id:    orgId,
      name:               investor.name,
      contact:            investor.contact,
      email:              investor.email,
      phone:              investor.phone,
      type:               investor.type,
      preferred_financing: investor.preferredFinancing,
      standard_terms:     investor.standardTerms,
      notes:              investor.notes,
    }).then(() => {});
  }

  return updated;
}

/**
 * Update an investor by id. Patches localStorage cache + Supabase row.
 * Returns the new array of investors.
 */
export async function updateInvestor(id, patch, orgId) {
  const all = loadInvestors(orgId);
  const updated = all.map(inv => String(inv.id) === String(id) ? { ...inv, ...patch } : inv);
  saveInvestors(updated, orgId);
  if (supabase && orgId) {
    const dbPatch = {};
    if (patch.name !== undefined)               dbPatch.name = patch.name;
    if (patch.contact !== undefined)            dbPatch.contact = patch.contact;
    if (patch.email !== undefined)              dbPatch.email = patch.email;
    if (patch.phone !== undefined)              dbPatch.phone = patch.phone;
    if (patch.type !== undefined)               dbPatch.type = patch.type;
    if (patch.preferredFinancing !== undefined) dbPatch.preferred_financing = patch.preferredFinancing;
    if (patch.standardTerms !== undefined)      dbPatch.standard_terms = patch.standardTerms;
    if (patch.notes !== undefined)              dbPatch.notes = patch.notes;
    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabase
        .from('investors')
        .update(dbPatch)
        .eq('id', id)
        .eq('organization_id', orgId);
      if (error) console.error('[investorsStore] updateInvestor failed:', error.message);
    }
  }
  return updated;
}

/**
 * Delete an investor entirely. Removes from localStorage cache and Supabase
 * (FKs cascade to allocations, distributions, capital_calls, payment_schedule).
 * Also clears deal.investor (text field) on any deal that referenced this
 * investor by name, so the directory remains consistent across the CRM.
 */
export async function deleteInvestor(investor, orgId) {
  const id = investor?.id;
  const name = investor?.name;
  const all = loadInvestors(orgId);
  const next = all.filter(i => String(i.id) !== String(id));
  saveInvestors(next, orgId);

  if (supabase && orgId) {
    if (id) {
      const { error } = await supabase
        .from('investors')
        .delete()
        .eq('id', id)
        .eq('organization_id', orgId);
      if (error) console.error('[investorsStore] deleteInvestor failed:', error.message);
    }
    if (name) {
      const { error: clearErr } = await supabase
        .from('deals')
        .update({ investor: null })
        .eq('investor', name)
        .eq('organization_id', orgId);
      if (clearErr) console.warn('[investorsStore] could not clear deal.investor refs:', clearErr.message);
    }
  }
  return next;
}
