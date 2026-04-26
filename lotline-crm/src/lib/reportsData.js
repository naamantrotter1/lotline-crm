/**
 * reportsData.js
 * Phase 9: Fetch aggregated data for the Reports page.
 */
import { supabase } from './supabase';

// Columns available after the dead_deal migration. We try with them first and
// fall back to the base set if Supabase returns a column-not-found error.
const ADV_SELECT_FULL = [
  'id', 'stage', 'pipeline', 'arv', 'lead_source',
  'is_archived', 'archived_at', 'created_at', 'contract_signed_at',
  'investor', 'investor_capital_contributed', 'projected_irr',
  'dead_deal', 'dead_deal_date',
].join(', ');

const ADV_SELECT_BASE = [
  'id', 'stage', 'pipeline', 'arv', 'lead_source',
  'is_archived', 'archived_at', 'created_at', 'contract_signed_at',
  'investor', 'investor_capital_contributed', 'projected_irr',
].join(', ');

async function fetchDeals(orgId, isArchived, since, selectStr) {
  let q = supabase.from('deals').select(selectStr)
    .eq('organization_id', orgId).eq('is_archived', isArchived);
  if (since) q = isArchived ? q.gte('archived_at', since) : q.gte('created_at', since);
  const { data, error } = await q;
  return { data, error };
}

/**
 * Fetch richer deal data for the advanced analytics sections.
 * Returns { allDeals, investors }.
 * Gracefully falls back to the base SELECT if dead_deal columns don't exist yet.
 */
export async function fetchAdvancedReportsData(orgId, since = null) {
  if (!supabase || !orgId) return { allDeals: [], investors: [] };

  const iq = supabase.from('investors').select('id, name')
    .eq('organization_id', orgId).order('name');

  // Try full select (with dead_deal)
  const [activeRes, archivedRes, { data: investors }] = await Promise.all([
    fetchDeals(orgId, false, since, ADV_SELECT_FULL),
    fetchDeals(orgId, true,  since, ADV_SELECT_FULL),
    iq,
  ]);

  // If dead_deal column doesn't exist yet, fall back to base select
  const needsFallback = activeRes.error || archivedRes.error;
  if (needsFallback) {
    const [a2, r2] = await Promise.all([
      fetchDeals(orgId, false, since, ADV_SELECT_BASE),
      fetchDeals(orgId, true,  since, ADV_SELECT_BASE),
    ]);
    return {
      allDeals:  [...(a2.data || []), ...(r2.data || [])],
      investors: investors || [],
    };
  }

  return {
    allDeals:  [...(activeRes.data || []), ...(archivedRes.data || [])],
    investors: investors || [],
  };
}

/** Fetch all deals, contacts, and tasks for the org, optionally filtered by a start date. */
export async function fetchReportsData(orgId, since = null) {
  if (!supabase || !orgId) return { deals: [], contacts: [], tasks: [] };

  let dq = supabase
    .from('deals')
    .select('id, stage, pipeline, arv, county, state, created_at')
    .eq('organization_id', orgId);

  let cq = supabase
    .from('contacts')
    .select('id, created_at')
    .eq('organization_id', orgId);

  let tq = supabase
    .from('tasks')
    .select('id, status, created_at')
    .eq('organization_id', orgId);

  if (since) {
    dq = dq.gte('created_at', since);
    cq = cq.gte('created_at', since);
    tq = tq.gte('created_at', since);
  }

  const [d, c, t] = await Promise.all([dq, cq, tq]);
  return {
    deals:    d.data || [],
    contacts: c.data || [],
    tasks:    t.data || [],
  };
}

/** Group an array of { created_at } objects by month → [{ month: 'Jan 25', count }] */
export function groupByMonth(rows, valueKey = null) {
  const map = {};
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!map[key]) map[key] = { month: label, count: 0, value: 0 };
    map[key].count += 1;
    if (valueKey && r[valueKey]) map[key].value += parseFloat(r[valueKey]) || 0;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

/** Count occurrences of a field across an array → [{ name, value }] sorted desc */
export function countBy(rows, field, limit = 8) {
  const map = {};
  for (const r of rows) {
    const k = r[field] || 'Unknown';
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
