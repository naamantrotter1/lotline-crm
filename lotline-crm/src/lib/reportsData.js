/**
 * reportsData.js
 * Phase 9: Fetch aggregated data for the Reports page.
 */
import { supabase } from './supabase';

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
