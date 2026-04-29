/**
 * Cost Breakdown V2 data layer.
 *
 * All reads go through deal_cost_resolved_view (per-line) or
 * deal_cost_summary_view (totals). All writes hit deal_cost_lines directly.
 *
 * Key contract:
 *   actual_amount_resolved  = actual_amount   when actual_overridden = TRUE
 *                           = estimated_amount when actual_overridden = FALSE
 *
 * Downstream consumers (Dashboard, P&L, Analytics, Investor Portal, Capital
 * Stack, Deal Calculator) must use total_actual from deal_cost_summary_view —
 * never raw estimated_amount — for net profit, ROI, and any cost math.
 */
import { supabase } from './supabase';

// ── Structured write-audit logger ─────────────────────────────────────────────
// Emits a consistent JSON-structured log for every mutating operation so that
// cost drift can be traced back to specific write events. Logs are visible in
// browser DevTools > Console and can be forwarded to an external sink later.
//
// Format: [costBreakdown:write] { action, lineId, dealId?, userId?, ... }

function logWrite(action, fields) {
  try {
    console.info('[costBreakdown:write]', JSON.stringify({ action, ts: new Date().toISOString(), ...fields }));
  } catch (_) { /* never throw from logger */ }
}

// ── Fetch all resolved lines for a deal (ordered by sort_order) ───────────────

export async function fetchCostLines(dealId) {
  if (!supabase || !dealId) return [];
  const { data, error } = await supabase
    .from('deal_cost_resolved_view')
    .select('*')
    .eq('deal_id', dealId)
    .order('sort_order');
  if (error) { console.error('[costBreakdown] fetchCostLines error', error); return []; }
  return data || [];
}

// ── Fetch summary totals for one deal ─────────────────────────────────────────

export async function fetchCostSummary(dealId) {
  if (!supabase || !dealId) return null;
  const { data, error } = await supabase
    .from('deal_cost_summary_view')
    .select('*')
    .eq('deal_id', dealId)
    .maybeSingle();
  if (error) { console.error('[costBreakdown] fetchCostSummary error', error); return null; }
  return data;
}

// ── Fetch summaries for many deals at once (Dashboard / P&L rollup) ──────────

export async function fetchCostSummariesForOrg(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from('deal_cost_summary_view')
    .select('deal_id, total_estimated, total_actual, total_difference, override_count, line_count')
    .eq('org_id', orgId);
  if (error) { console.error('[costBreakdown] fetchCostSummariesForOrg error', error); return []; }
  return data || [];
}

// ── Update estimated_amount on a single line ──────────────────────────────────

export async function updateEstimated(lineId, estimatedAmount, userId) {
  if (!supabase) return { error: 'No Supabase client' };
  logWrite('updateEstimated', { lineId, estimatedAmount, userId: userId || null });
  const { error } = await supabase
    .from('deal_cost_lines')
    .update({
      estimated_amount: estimatedAmount,
      estimated_updated_at: new Date().toISOString(),
      estimated_updated_by_user_id: userId || null,
    })
    .eq('id', lineId);
  if (error) logWrite('updateEstimated:error', { lineId, error: error.message });
  return error ? { error: error.message } : { ok: true };
}

// ── Set actual override on a single line (flips actual_overridden = TRUE) ────

export async function overrideActual(lineId, actualAmount, userId) {
  if (!supabase) return { error: 'No Supabase client' };
  logWrite('overrideActual', { lineId, actualAmount, userId: userId || null });
  const { error } = await supabase
    .from('deal_cost_lines')
    .update({
      actual_amount: actualAmount,
      actual_overridden: true,
      actual_overridden_at: new Date().toISOString(),
      actual_overridden_by_user_id: userId || null,
    })
    .eq('id', lineId);
  if (error) logWrite('overrideActual:error', { lineId, error: error.message });
  return error ? { error: error.message } : { ok: true };
}

// ── Reset a line to mirror its estimate (nulls actual, clears override flag) ──

export async function resetActualToMirror(lineId) {
  if (!supabase) return { error: 'No Supabase client' };
  logWrite('resetActualToMirror', { lineId });
  const { error } = await supabase
    .from('deal_cost_lines')
    .update({
      actual_amount: null,
      actual_overridden: false,
      actual_overridden_at: null,
      actual_overridden_by_user_id: null,
    })
    .eq('id', lineId);
  if (error) logWrite('resetActualToMirror:error', { lineId, error: error.message });
  return error ? { error: error.message } : { ok: true };
}

// ── Bulk upsert actuals (CSV paste flow) ─────────────────────────────────────
// rows: [{ lineId, actualAmount }]

export async function bulkOverrideActuals(rows, userId) {
  if (!supabase || !rows.length) return { ok: true };
  logWrite('bulkOverrideActuals', { rowCount: rows.length, userId: userId || null });
  const now = new Date().toISOString();
  const updates = rows.map(r => ({
    id: r.lineId,
    actual_amount: r.actualAmount,
    actual_overridden: true,
    actual_overridden_at: now,
    actual_overridden_by_user_id: userId || null,
  }));
  const { error } = await supabase
    .from('deal_cost_lines')
    .upsert(updates, { onConflict: 'id' });
  if (error) logWrite('bulkOverrideActuals:error', { rowCount: rows.length, error: error.message });
  return error ? { error: error.message } : { ok: true };
}

// ── Bulk-update estimated amounts from calculator import ──────────────────────
// costMap: { category_key: amount }
// Called after a deal is inserted so the seeded default_amounts are replaced
// with the actual values the user entered in the Deal Calculator.

export async function updateCostLinesFromCalc(dealId, costMap) {
  if (!supabase || !dealId || !costMap) return;
  const entries = Object.entries(costMap).filter(([, v]) => v != null);
  if (!entries.length) return;
  await Promise.all(
    entries.map(([category_key, estimated_amount]) =>
      supabase
        .from('deal_cost_lines')
        .update({ estimated_amount })
        .eq('deal_id', dealId)
        .eq('category_key', category_key)
    )
  );
}

// ── Update notes on a line ────────────────────────────────────────────────────

export async function updateLineNotes(lineId, notes) {
  if (!supabase) return { error: 'No Supabase client' };
  logWrite('updateLineNotes', { lineId, notesLength: (notes || '').length });
  const { error } = await supabase
    .from('deal_cost_lines')
    .update({ notes })
    .eq('id', lineId);
  if (error) logWrite('updateLineNotes:error', { lineId, error: error.message });
  return error ? { error: error.message } : { ok: true };
}

// ── Fetch all categories (global + org-specific) for the org ──────────────────

export async function fetchCategories(orgId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cost_breakdown_categories')
    .select('*')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .eq('is_active', true)
    .order('sort_order');
  if (error) { console.error('[costBreakdown] fetchCategories error', error); return []; }
  return data || [];
}

// ── Add a custom org-scoped category ─────────────────────────────────────────

export async function addCustomCategory(orgId, { key, label, groupName, sortOrder }) {
  if (!supabase) return { error: 'No Supabase client' };
  const { data, error } = await supabase
    .from('cost_breakdown_categories')
    .insert({ org_id: orgId, key, label, group_name: groupName || 'Other', sort_order: sortOrder || 999 })
    .select()
    .single();
  if (error) return { error: error.message };
  return { data };
}

// ── Mirror-parity helper ──────────────────────────────────────────────────────
// Resolves the actual cost client-side (same logic as the DB view).
// Use when you have a cost line object and need the resolved actual locally.

export function resolveActual(line) {
  if (!line) return 0;
  if (line.actual_overridden) return Number(line.actual_amount ?? 0);
  return Number(line.estimated_amount ?? 0);
}

export function resolveDifference(line) {
  return resolveActual(line) - Number(line.estimated_amount ?? 0);
}

// ── Compute total_actual from an array of cost lines (client-side) ────────────

export function computeTotalActual(lines) {
  return (lines || []).reduce((sum, l) => sum + resolveActual(l), 0);
}

export function computeTotalEstimated(lines) {
  return (lines || []).reduce((sum, l) => sum + Number(l.estimated_amount ?? 0), 0);
}
