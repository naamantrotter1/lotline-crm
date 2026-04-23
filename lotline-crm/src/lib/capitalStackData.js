/**
 * capitalStackData.js
 * Data-access layer for the Capital Stack feature.
 *
 * Tables:  capital_commitments, deal_allocations, commitment_ledger_entries
 * Views:   investor_commitment_summary, deal_capital_stack_view
 *
 * All writes go through Supabase (no localStorage mirror — capital data must
 * always be authoritative). Reads fall back gracefully to empty arrays.
 */
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function guard(data, error, fallback = []) {
  if (error) {
    console.warn('[capitalStackData]', error.message ?? error);
    return fallback;
  }
  return data ?? fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Investors (operators only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all investors ordered by name.
 * Returns [{ id, name, contact, email, phone, type, preferred_financing, notes }]
 */
export async function fetchInvestors() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('investors')
    .select('id, name, contact, email, phone, type, preferred_financing, standard_terms, notes')
    .order('name');
  return guard(data, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capital Commitments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all capital commitments joined with the summary view.
 * Returns the investor_commitment_summary view rows, ordered by priority_rank.
 */
export async function fetchCommitmentSummaries() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('investor_commitment_summary')
    .select('*')
    .order('priority_rank');
  return guard(data, error);
}

/**
 * Fetch all active commitments for a given investor.
 */
export async function fetchCommitmentsForInvestor(investorId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('capital_commitments')
    .select('*')
    .eq('investor_id', investorId)
    .order('priority_rank');
  return guard(data, error);
}

/**
 * Create a new capital commitment.
 * @param {object} fields — { investor_id, name, committed_amount, commitment_date,
 *                            expiration_date, priority_rank, notes, revolving }
 * Returns { commitment, error }
 */
export async function createCommitment(fields) {
  if (!supabase) return { commitment: null, error: new Error('No Supabase client') };
  const { data, error } = await supabase
    .from('capital_commitments')
    .insert(fields)
    .select()
    .single();
  return { commitment: data ?? null, error: error ?? null };
}

/**
 * Update a capital commitment.
 */
export async function updateCommitment(id, fields) {
  if (!supabase) return { error: new Error('No Supabase client') };
  const { error } = await supabase
    .from('capital_commitments')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal Allocations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the full capital stack for a single deal (via view).
 * Returns [{ allocation_id, investor_id, investor_name, commitment_name,
 *             amount, percent_of_deal, position, preferred_return_pct,
 *             profit_share_pct, status, running_total, notes }]
 */
export async function fetchDealStack(dealId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('deal_capital_stack_view')
    .select('*')
    .eq('deal_id', dealId);
  return guard(data, error);
}

/**
 * Fetch all allocations across all deals for a commitment.
 */
export async function fetchAllocationsByCommitment(commitmentId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('deal_allocations')
    .select('*, deals(id, address, stage)')
    .eq('commitment_id', commitmentId)
    .neq('status', 'returned')
    .order('allocated_at');
  return guard(data, error);
}

/**
 * Add a new allocation to a deal.
 *
 * Guardrail: checks that amount ≤ remaining headroom on the commitment.
 * Pass `overrideReason` to bypass (logs it in the ledger).
 *
 * Returns { allocation, error, blocked, headroom }
 *   blocked=true means the headroom check failed and no overrideReason was given.
 */
export async function addAllocation({
  dealId,
  commitmentId,
  investorId,
  amount,
  position = 'pari_passu',
  preferredReturnPct = null,
  profitSharePct = null,
  status = 'planned',
  notes = '',
  overrideReason = null,
}) {
  if (!supabase) return { allocation: null, error: new Error('No Supabase client') };

  // ── Headroom check ──────────────────────────────────────────────────────────
  const { data: summary } = await supabase
    .from('investor_commitment_summary')
    .select('remaining_headroom, committed_amount')
    .eq('commitment_id', commitmentId)
    .single();

  const headroom = summary?.remaining_headroom;
  const isUnlimited = summary?.committed_amount == null; // Cash / NULL cap

  if (!isUnlimited && headroom != null && amount > headroom && !overrideReason) {
    return {
      allocation: null,
      error: null,
      blocked: true,
      headroom,
    };
  }

  // ── Insert allocation ───────────────────────────────────────────────────────
  const { data: allocation, error } = await supabase
    .from('deal_allocations')
    .insert({
      deal_id: dealId,
      commitment_id: commitmentId,
      investor_id: investorId,
      amount,
      position,
      preferred_return_pct: preferredReturnPct,
      profit_share_pct: profitSharePct,
      status,
      notes,
    })
    .select()
    .single();

  if (error) return { allocation: null, error, blocked: false };

  // Recompute percent_of_deal for all allocations on this deal
  await _recomputePercentOfDeal(dealId);

  // ── Ledger entry ────────────────────────────────────────────────────────────
  await supabase.from('commitment_ledger_entries').insert({
    commitment_id: commitmentId,
    delta_amount: amount,
    reason: 'allocation_added',
    deal_id: dealId,
    allocation_id: allocation.id,
    override_reason: overrideReason ?? null,
  });

  return { allocation, error: null, blocked: false };
}

/**
 * Update an existing allocation (amount, status, notes, etc.).
 * When amount changes, logs an allocation_reduced/added entry and recomputes percents.
 */
export async function updateAllocation(allocationId, fields) {
  if (!supabase) return { error: new Error('No Supabase client') };

  // Fetch current to detect amount delta
  const { data: current } = await supabase
    .from('deal_allocations')
    .select('amount, deal_id, commitment_id')
    .eq('id', allocationId)
    .single();

  const { error } = await supabase
    .from('deal_allocations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', allocationId);

  if (error) return { error };

  if (current && fields.amount != null && fields.amount !== current.amount) {
    const delta = fields.amount - current.amount;
    await supabase.from('commitment_ledger_entries').insert({
      commitment_id: current.commitment_id,
      delta_amount: delta,
      reason: delta > 0 ? 'allocation_added' : 'allocation_reduced',
      deal_id: current.deal_id,
      allocation_id: allocationId,
    });
    await _recomputePercentOfDeal(current.deal_id);
  }

  return { error: null };
}

/**
 * Mark an allocation as "returned" (capital back to investor).
 * For revolving commitments, this restores headroom automatically via the view.
 */
export async function returnAllocation(allocationId, { notes = '' } = {}) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: alloc } = await supabase
    .from('deal_allocations')
    .select('amount, deal_id, commitment_id')
    .eq('id', allocationId)
    .single();

  const { error } = await supabase
    .from('deal_allocations')
    .update({ status: 'returned', notes, updated_at: new Date().toISOString() })
    .eq('id', allocationId);

  if (error) return { error };

  if (alloc) {
    await supabase.from('commitment_ledger_entries').insert({
      commitment_id: alloc.commitment_id,
      delta_amount: -alloc.amount,
      reason: 'capital_returned',
      deal_id: alloc.deal_id,
      allocation_id: allocationId,
    });
    await _recomputePercentOfDeal(alloc.deal_id);
  }

  return { error: null };
}

/**
 * Remove an allocation entirely (only valid for 'planned' status).
 */
export async function removeAllocation(allocationId) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: alloc } = await supabase
    .from('deal_allocations')
    .select('amount, deal_id, commitment_id, status')
    .eq('id', allocationId)
    .single();

  if (alloc && alloc.status !== 'planned') {
    return { error: new Error('Only planned allocations can be deleted. Use returnAllocation() for funded capital.') };
  }

  const { error } = await supabase
    .from('deal_allocations')
    .delete()
    .eq('id', allocationId);

  if (error) return { error };

  if (alloc) {
    await supabase.from('commitment_ledger_entries').insert({
      commitment_id: alloc.commitment_id,
      delta_amount: -alloc.amount,
      reason: 'allocation_reduced',
      deal_id: alloc.deal_id,
      allocation_id: allocationId,
    });
    await _recomputePercentOfDeal(alloc.deal_id);
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Fund
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Auto-fund a deal: walk active commitments by priority_rank and fill each
 * up to its remaining headroom until the deal's total_capital_required is met.
 *
 * Returns { allocations: [...], totalFunded, gap }
 *   gap > 0 means not enough headroom across all commitments.
 */
export async function autoFundDeal(dealId, totalCapitalRequired) {
  if (!supabase) return { allocations: [], totalFunded: 0, gap: totalCapitalRequired };

  // Fetch existing funded amount
  const { data: existing } = await supabase
    .from('deal_allocations')
    .select('amount')
    .eq('deal_id', dealId)
    .neq('status', 'returned');

  const alreadyFunded = (existing ?? []).reduce((s, r) => s + Number(r.amount), 0);
  let remaining = totalCapitalRequired - alreadyFunded;
  if (remaining <= 0) return { allocations: [], totalFunded: alreadyFunded, gap: 0 };

  // Walk commitments by priority
  const summaries = await fetchCommitmentSummaries();
  const active = summaries.filter(s => s.commitment_status === 'active');

  const created = [];
  for (const s of active) {
    if (remaining <= 0) break;

    const headroom = s.remaining_headroom; // null = unlimited
    const slice = headroom == null ? remaining : Math.min(remaining, headroom);
    if (slice <= 0) continue;

    const { allocation, error } = await addAllocation({
      dealId,
      commitmentId: s.commitment_id,
      investorId: s.investor_id,
      amount: slice,
      status: 'planned',
      notes: 'Auto-funded',
    });

    if (!error && allocation) {
      created.push(allocation);
      remaining -= slice;
    }
  }

  return {
    allocations: created,
    totalFunded: totalCapitalRequired - remaining,
    gap: remaining,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ledger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch ledger entries for a commitment (most recent first).
 */
export async function fetchLedger(commitmentId, limit = 50) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('commitment_ledger_entries')
    .select('*, deals(address), profiles(full_name)')
    .eq('commitment_id', commitmentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return guard(data, error);
}

/**
 * Fetch all ledger entries across all commitments for an investor.
 */
export async function fetchLedgerForInvestor(investorId, limit = 100) {
  if (!supabase) return [];
  const { data: commitments } = await supabase
    .from('capital_commitments')
    .select('id')
    .eq('investor_id', investorId);
  const ids = (commitments ?? []).map(c => c.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('commitment_ledger_entries')
    .select('*, deals(address), capital_commitments(name)')
    .in('commitment_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);
  return guard(data, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Deal capital_stack_status helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recompute and persist capital_stack_status for a deal.
 * Called internally after every allocation mutation.
 */
export async function refreshDealStackStatus(dealId) {
  if (!supabase) return;
  const { data: deal } = await supabase
    .from('deals')
    .select('total_capital_required')
    .eq('id', dealId)
    .single();

  const required = deal?.total_capital_required;
  if (!required) return;

  const { data: allocs } = await supabase
    .from('deal_allocations')
    .select('amount')
    .eq('deal_id', dealId)
    .neq('status', 'returned');

  const total = (allocs ?? []).reduce((s, r) => s + Number(r.amount), 0);

  let status = 'draft';
  if (total > 0 && total < required) status = 'partially_funded';
  else if (total >= required) status = 'fully_funded';
  if (total > required) status = 'over_committed';

  await supabase
    .from('deals')
    .update({ capital_stack_status: status })
    .eq('id', dealId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────────────────────────────────────

async function _recomputePercentOfDeal(dealId) {
  const { data: allocs } = await supabase
    .from('deal_allocations')
    .select('id, amount')
    .eq('deal_id', dealId)
    .neq('status', 'returned');

  const total = (allocs ?? []).reduce((s, r) => s + Number(r.amount), 0);
  if (total === 0) return;

  for (const a of allocs ?? []) {
    await supabase
      .from('deal_allocations')
      .update({ percent_of_deal: (Number(a.amount) / total) * 100 })
      .eq('id', a.id);
  }

  await refreshDealStackStatus(dealId);
}
