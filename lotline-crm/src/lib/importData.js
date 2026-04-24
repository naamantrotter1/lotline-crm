/**
 * importData.js
 * Phase 5: CSV import — parser + bulk Supabase insert for contacts and deals.
 */
import { supabase } from './supabase';

// ── CSV parser ────────────────────────────────────────────────────────────────

/** Parse a CSV string into { headers: string[], rows: object[] }. */
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const fields = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        fields.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1)
    .map(l => {
      const vals = parseRow(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g, ''); });
      return obj;
    })
    .filter(r => Object.values(r).some(v => v.trim()));  // skip blank rows

  return { headers, rows };
}

// ── Auto-detect column mapping ────────────────────────────────────────────────

const CONTACT_ALIASES = {
  full_name:       ['fullname','full name','name','contact name','contactname'],
  first_name:      ['firstname','first name','first','fname','given name'],
  last_name:       ['lastname','last name','last','lname','surname','family name'],
  email:           ['email','e-mail','email address','emailaddress'],
  phone:           ['phone','phone number','mobile','cell','telephone','phonenumber'],
  company:         ['company','organization','organisation','firm','employer','business'],
  title:           ['title','role','position','jobtitle','job title'],
  lead_source:     ['lead source','leadsource','source'],
  lifecycle_stage: ['lifecycle','stage','status','lifecycle stage'],
  notes:           ['notes','note','comments','description'],
};

const DEAL_ALIASES = {
  address:     ['address','property address','street','location','propertyaddress'],
  county:      ['county','county name'],
  state:       ['state','st','province'],
  zip:         ['zip','zip code','postal code','postcode'],
  acreage:     ['acreage','acres','lot size','lotsize','lot'],
  arv:         ['arv','after repair value','value','price'],
  stage:       ['stage','status','deal stage','pipeline stage'],
  pipeline:    ['pipeline'],
  seller_name: ['seller','seller name','sellername','owner','owner name'],
  notes:       ['notes','note','comments','description'],
};

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function autoDetect(headers, entityType) {
  const aliases = entityType === 'deals' ? DEAL_ALIASES : CONTACT_ALIASES;
  const map = {};
  for (const [field, aliasList] of Object.entries(aliases)) {
    const match = headers.find(h => aliasList.some(a => normalize(h) === normalize(a)));
    if (match) map[field] = match;
  }
  return map;
}

// ── Contact import ────────────────────────────────────────────────────────────

export const CONTACT_FIELDS = [
  { key: 'full_name',       label: 'Full Name',              hint: 'Split into first + last automatically' },
  { key: 'first_name',      label: 'First Name',             hint: '' },
  { key: 'last_name',       label: 'Last Name',              hint: '' },
  { key: 'email',           label: 'Email',                  hint: '' },
  { key: 'phone',           label: 'Phone',                  hint: '' },
  { key: 'company',         label: 'Company',                hint: '' },
  { key: 'title',           label: 'Title / Role',           hint: '' },
  { key: 'lead_source',     label: 'Lead Source',            hint: '' },
  { key: 'lifecycle_stage', label: 'Lifecycle Stage',        hint: 'new / working / qualified / customer / dormant' },
  { key: 'notes',           label: 'Notes',                  hint: '' },
];

const VALID_LIFECYCLE = new Set(['new','working','qualified','customer','dormant']);

function buildContactRecord(row, colMap, orgId) {
  let firstName = colMap.first_name ? (row[colMap.first_name] || '').trim() : '';
  let lastName  = colMap.last_name  ? (row[colMap.last_name]  || '').trim() : '';

  if (colMap.full_name) {
    const full = (row[colMap.full_name] || '').trim();
    if (full) {
      const parts = full.split(/\s+/);
      if (!firstName) firstName = parts[0] || '';
      if (!lastName)  lastName  = parts.slice(1).join(' ') || '';
    }
  }

  const email = colMap.email    ? (row[colMap.email]    || '').trim() || null : null;
  const phone = colMap.phone    ? (row[colMap.phone]    || '').trim() || null : null;

  // Skip rows with no identifying info at all
  if (!firstName && !lastName && !email && !phone) return null;

  const rawStage = colMap.lifecycle_stage ? (row[colMap.lifecycle_stage] || '').trim().toLowerCase() : '';

  return {
    organization_id: orgId,
    first_name:      firstName || null,
    last_name:       lastName  || null,
    email,
    phone,
    company:         colMap.company     ? (row[colMap.company]     || '').trim() || null : null,
    title:           colMap.title       ? (row[colMap.title]       || '').trim() || null : null,
    lead_source:     colMap.lead_source ? (row[colMap.lead_source] || '').trim() || null : null,
    notes:           colMap.notes       ? (row[colMap.notes]       || '').trim() || null : null,
    lifecycle_stage: VALID_LIFECYCLE.has(rawStage) ? rawStage : 'new',
  };
}

/**
 * Bulk-insert contacts.
 * Returns { imported, skipped, errors }.
 */
export async function importContacts(orgId, rows, colMap, onProgress) {
  if (!supabase) return { imported: 0, skipped: 0, errors: 1 };

  const records = rows.map(r => buildContactRecord(r, colMap, orgId)).filter(Boolean);
  const skipped = rows.length - records.length;

  const BATCH = 200;
  let imported = 0;
  let errors   = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase.from('contacts').insert(batch);
    if (error) {
      console.error('importContacts batch error', error);
      errors += batch.length;
    } else {
      imported += batch.length;
    }
    onProgress && onProgress(Math.min(i + BATCH, records.length), records.length);
  }

  return { imported, skipped, errors };
}

// ── Deal import ───────────────────────────────────────────────────────────────

export const DEAL_FIELDS = [
  { key: 'address',     label: 'Address',       hint: 'Required' },
  { key: 'county',      label: 'County',         hint: '' },
  { key: 'state',       label: 'State',          hint: '' },
  { key: 'zip',         label: 'Zip Code',       hint: '' },
  { key: 'acreage',     label: 'Acreage',        hint: '' },
  { key: 'arv',         label: 'ARV ($)',         hint: '' },
  { key: 'stage',       label: 'Stage',          hint: 'e.g. New Lead, Contacted…' },
  { key: 'pipeline',    label: 'Pipeline',       hint: 'land-acquisition or deal-overview' },
  { key: 'seller_name', label: 'Seller Name',    hint: '' },
  { key: 'notes',       label: 'Notes',          hint: '' },
];

function buildDealRecord(row, colMap, orgId) {
  const address = colMap.address ? (row[colMap.address] || '').trim() : '';
  if (!address) return null;

  const rawPipeline = (colMap.pipeline ? (row[colMap.pipeline] || '').trim().toLowerCase() : '');
  const pipeline = rawPipeline.includes('deal') ? 'deal-overview' : 'land-acquisition';

  return {
    organization_id: orgId,
    id:              crypto.randomUUID(),
    address,
    county:          colMap.county      ? (row[colMap.county]      || '').trim() || null : null,
    state:           colMap.state       ? (row[colMap.state]       || '').trim() || null : null,
    zip:             colMap.zip         ? (row[colMap.zip]         || '').trim() || null : null,
    acreage:         colMap.acreage     ? parseFloat(row[colMap.acreage]) || null : null,
    arv:             colMap.arv         ? parseFloat(row[colMap.arv])     || null : null,
    stage:           colMap.stage       ? (row[colMap.stage]       || '').trim() || 'New Lead' : 'New Lead',
    pipeline,
    seller_name:     colMap.seller_name ? (row[colMap.seller_name] || '').trim() || null : null,
    notes:           colMap.notes       ? (row[colMap.notes]       || '').trim() || null : null,
  };
}

/**
 * Bulk-insert deals.
 * Returns { imported, skipped, errors }.
 */
export async function importDeals(orgId, rows, colMap, onProgress) {
  if (!supabase) return { imported: 0, skipped: 0, errors: 1 };

  const records = rows.map(r => buildDealRecord(r, colMap, orgId)).filter(Boolean);
  const skipped = rows.length - records.length;

  const BATCH = 200;
  let imported = 0;
  let errors   = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase.from('deals').insert(batch);
    if (error) {
      console.error('importDeals batch error', error);
      errors += batch.length;
    } else {
      imported += batch.length;
    }
    onProgress && onProgress(Math.min(i + BATCH, records.length), records.length);
  }

  return { imported, skipped, errors };
}
