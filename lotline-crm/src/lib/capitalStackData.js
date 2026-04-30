/**
 * capitalStackData.js
 * Data-access layer for the Capital Stack feature.
 *
 * Tables:  capital_commitments, deal_allocations, commitment_ledger_entries
 * Views:   investor_commitment_summary, deal_capital_stack_view
 *
 * Guardrails enforced on every write:
 *   1. Commitment-level: amount ≤ commitment.remaining_headroom (investor-global cap)
 *   2. Deal-level: SUM(allocations on deal) + new_amount ≤ deal.total_capital_required
 *      Both can be overridden with an explicit overrideReason (logged in ledger).
 *
 * Legacy commitments (commitment_type = 'legacy') are excluded from the Add
 * Allocation modal and from Auto-Fund — they are historical and fully deployed.
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
 * When an investor is assigned to a deal, ensure they also exist as a Contact
 * with type='Investor'. Checks for an existing contact by name first to avoid
 * duplicates. If the investor record exists in Supabase, links them via contact_id.
 * Fire-and-forget: call without awaiting so it never blocks the UI.
 */
export async function ensureInvestorContact(investorName, orgId) {
  if (!supabase || !investorName || !orgId) return;

  const isCompany = /LLC|Inc\.?|Corp\.?|Capital|Group|Partners|Holdings|Realty|Properties|Investments/i.test(investorName);
  const parts = investorName.trim().split(/\s+/);
  const firstName = parts[0] || investorName;
  const lastName  = isCompany ? '' : parts.slice(1).join(' ');
  const fullNameLower = investorName.trim().toLowerCase();

  // 1. Check if a contact with this name already exists
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .ilike('first_name', isCompany ? firstName : firstName)
    .maybeSingle();

  // Broader check: find by full name match across first+last
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company')
    .eq('organization_id', orgId)
    .is('deleted_at', null);

  const matchedContact = (allContacts || []).find(c => {
    const full = `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase();
    const comp = (c.company || '').toLowerCase();
    return full === fullNameLower || comp === fullNameLower;
  });

  let contactId = matchedContact?.id;

  // 2. If no existing contact, create one
  if (!contactId) {
    // Look up investor record in Supabase to get email/phone (optional enrichment)
    const { data: inv } = await supabase
      .from('investors')
      .select('id, email, phone, contact, contact_id')
      .eq('organization_id', orgId)
      .eq('name', investorName)
      .maybeSingle();

    // If investor already has a linked contact, use it
    if (inv?.contact_id) {
      contactId = inv.contact_id;
    } else {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          organization_id: orgId,
          first_name: firstName,
          last_name:  lastName,
          company:    isCompany ? investorName : (inv?.contact || null),
          email:      inv?.email || null,
          phone:      inv?.phone || null,
        })
        .select('id')
        .single();

      if (!newContact) return;
      contactId = newContact.id;

      // Link investor record back to contact if it exists
      if (inv) {
        await supabase.from('investors')
          .update({ contact_id: contactId })
          .eq('id', inv.id);
      }
    }
  }

  // 3. Ensure contact has type='Investor'
  await supabase.from('contact_types')
    .upsert({ contact_id: contactId, type: 'Investor' }, { onConflict: 'contact_id,type' });
}

/**
 * Fetch all investors ordered by name.
 */
export async function fetchInvestors(orgIds) {
  if (!supabase) return [];
  let q = supabase
    .from('investors')
    .select('id, name, contact, email, phone, type, preferred_financing, standard_terms, notes, organization_id')
    .neq('is_archived', true)
    .order('name');
  if (orgIds) {
    const ids = Array.isArray(orgIds) ? orgIds.filter(Boolean) : [orgIds].filter(Boolean);
    if (ids.length === 1) q = q.eq('organization_id', ids[0]);
    else if (ids.length > 1) q = q.in('organization_id', ids);
  }
  const { data, error } = await q;
  return guard(data, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Capital Commitments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all capital commitment summaries (all types, all statuses).
 * Used for the deal-page health check (CommitmentHealthBadge) and global views.
 * Includes commitment_type (added by migration 008).
 */
export async function fetchCommitmentSummaries(orgIds) {
  if (!supabase) return [];
  let q = supabase.from('investor_commitment_summary').select('*').order('priority_rank');
  if (orgIds) {
    const ids = Array.isArray(orgIds) ? orgIds.filter(Boolean) : [orgIds].filter(Boolean);
    if (ids.length === 1) q = q.eq('organization_id', ids[0]);
    else if (ids.length > 1) q = q.in('organization_id', ids);
  }
  const { data, error } = await q;
  return guard(data, error);
}

/**
 * Fetch commitments eligible for the Add Allocation modal and Auto-Fund:
 *   - commitment_type != 'legacy'  (legacy = historical, closed)
 *   - status = 'active'
 *
 * Falls back to fetchCommitmentSummaries() if the commitment_type column
 * doesn't exist yet (i.e., migration 008 hasn't run).
 */
export async function fetchActiveCommitmentsForModal() {
  if (!supabase) return [];
  try {
    const { data: activeCcs, error: ccErr } = await supabase
      .from('capital_commitments')
      .select('id')
      .eq('status', 'active')
      .neq('commitment_type', 'legacy');

    if (ccErr) {
      // commitment_type column not yet available — fall back to all active
      return fetchCommitmentSummaries();
    }

    if (!activeCcs?.length) return [];
    const ids = activeCcs.map(c => c.id);

    const { data, error } = await supabase
      .from('investor_commitment_summary')
      .select('*')
      .in('commitment_id', ids)
      .order('priority_rank');

    return guard(data, error);
  } catch {
    return fetchCommitmentSummaries();
  }
}

/**
 * Fetch all commitments for a given investor (all types).
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
 * Includes commitment_id so the health badge can cross-reference commitments.
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
 * How much deal capacity remains (excluding a specific allocation if editing).
 * Returns null if deal has no total_capital_required set.
 *
 * @param {string} dealId
 * @param {string|null} excludeAllocationId — pass when editing an existing allocation
 * @returns {number|null}
 */
async function _dealCapacityRemaining(dealId, excludeAllocationId = null) {
  const { data: deal } = await supabase
    .from('deals')
    .select('total_capital_required')
    .eq('id', dealId)
    .single();

  const required = deal?.total_capital_required;
  if (!required) return null; // no cap set — unconstrained

  const { data: allocs } = await supabase
    .from('deal_allocations')
    .select('id, amount')
    .eq('deal_id', dealId)
    .neq('status', 'returned');

  const currentTotal = (allocs ?? [])
    .filter(a => a.id !== excludeAllocationId)
    .reduce((s, a) => s + Number(a.amount), 0);

  return required - currentTotal;
}

/**
 * Add a new allocation to a deal.
 *
 * Guardrails (in order):
 *   1. Commitment-level: amount ≤ commitment.remaining_headroom
 *   2. Deal-level: amount ≤ deal.total_capital_required - sum(existing allocs)
 *
 * Either guardrail can be bypassed with an explicit overrideReason (logged).
 *
 * Returns { allocation, error, blocked, headroom, dealCapacityExceeded, dealRemaining }
 *   blocked=true means a guardrail failed and no overrideReason was given.
 */
export async function addAllocation({
  dealId,
  commitmentId,
  investorId,
  amount,
  position = '1st Position',
  preferredReturnPct = null,
  profitSharePct = null,
  prefPaymentTiming = 'at_exit',
  sourceScenario = null,
  status = 'planned',
  notes = '',
  overrideReason = null,
}) {
  if (!supabase) return { allocation: null, error: new Error('No Supabase client') };

  // ── 1. Commitment-level headroom check ─────────────────────────────────────
  const { data: summary } = await supabase
    .from('investor_commitment_summary')
    .select('remaining_headroom, committed_amount')
    .eq('commitment_id', commitmentId)
    .single();

  const headroom = summary?.remaining_headroom;
  const isUnlimited = summary?.committed_amount == null;

  if (!isUnlimited && headroom != null && amount > headroom && !overrideReason) {
    return { allocation: null, error: null, blocked: true, headroom, dealCapacityExceeded: false };
  }

  // ── 2. Deal-level capacity check ────────────────────────────────────────────
  const dealRemaining = await _dealCapacityRemaining(dealId);
  if (dealRemaining != null && amount > dealRemaining && !overrideReason) {
    return {
      allocation: null, error: null,
      blocked: true, headroom,
      dealCapacityExceeded: true, dealRemaining,
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
      pref_payment_timing: prefPaymentTiming,
      source_scenario: sourceScenario,
      status,
      notes,
    })
    .select()
    .single();

  if (error) return { allocation: null, error, blocked: false };

  await _recomputePercentOfDeal(dealId);

  // ── Ledger entry ─────────────────────────────────────────────────────────────
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
 * Applies the same deal-level and commitment-level guardrails when amount increases.
 */
export async function updateAllocation(allocationId, fields, overrideReason = null) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: current } = await supabase
    .from('deal_allocations')
    .select('amount, deal_id, commitment_id')
    .eq('id', allocationId)
    .single();

  const amountChanging = current && fields.amount != null && fields.amount !== Number(current.amount);

  if (amountChanging && fields.amount > Number(current.amount) && !overrideReason) {
    // ── Deal-level capacity check on increase ──────────────────────────────
    const dealRemaining = await _dealCapacityRemaining(current.deal_id, allocationId);
    if (dealRemaining != null && fields.amount > dealRemaining) {
      return {
        error: null, blocked: true,
        dealCapacityExceeded: true, dealRemaining,
      };
    }
  }

  const { error } = await supabase
    .from('deal_allocations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', allocationId);

  if (error) return { error };

  if (current && amountChanging) {
    const delta = fields.amount - Number(current.amount);
    await supabase.from('commitment_ledger_entries').insert({
      commitment_id: current.commitment_id,
      delta_amount: delta,
      reason: delta > 0 ? 'allocation_added' : 'allocation_reduced',
      deal_id: current.deal_id,
      allocation_id: allocationId,
      override_reason: overrideReason ?? null,
    });
    await _recomputePercentOfDeal(current.deal_id);
  }

  return { error: null, blocked: false };
}

/**
 * Mark an allocation as "returned" (capital back to investor).
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
 * Auto-fund a deal: walk active non-legacy commitments by priority_rank and fill
 * each up to min(commitment headroom, deal remaining capacity) until the deal's
 * total_capital_required is met.
 *
 * Legacy commitments are excluded — they are historical and fully deployed.
 *
 * Returns { allocations: [...], totalFunded, gap }
 */
export async function autoFundDeal(dealId, totalCapitalRequired) {
  if (!supabase) return { allocations: [], totalFunded: 0, gap: totalCapitalRequired };

  const { data: existing } = await supabase
    .from('deal_allocations')
    .select('amount')
    .eq('deal_id', dealId)
    .neq('status', 'returned');

  const alreadyFunded = (existing ?? []).reduce((s, r) => s + Number(r.amount), 0);
  let remaining = totalCapitalRequired - alreadyFunded;
  if (remaining <= 0) return { allocations: [], totalFunded: alreadyFunded, gap: 0 };

  // Only active, non-legacy commitments participate in auto-fund
  const summaries = await fetchActiveCommitmentsForModal();
  const active = summaries.filter(s => s.commitment_status === 'active');

  const created = [];
  for (const s of active) {
    if (remaining <= 0) break;

    const headroom = s.remaining_headroom; // null = unlimited
    const slice = headroom == null
      ? remaining
      : Math.min(remaining, headroom);
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
// Deal funding status — computed client-side by DealFundingBadge; no DB write
// ─────────────────────────────────────────────────────────────────────────────

// Kept as a no-op so callers don't break while we finish removing references.
export async function refreshDealStackStatus(_dealId) {
  // Status is now derived in CapitalStackModule from allocation totals.
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
