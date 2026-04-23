/**
 * drawScheduleData.js
 * Data-access layer for the Draw Schedule / Funding Lifecycle feature.
 *
 * Tables:  draw_schedules, draw_tranches, funding_events, capital_calls
 * Views:   deal_draw_schedule_view
 *
 * Funding lifecycle:
 *   Committed (allocation) → Scheduled (tranche created) → Called (capital call issued)
 *     → Funded (wire confirmed via funding_event) → Disbursed (tracked in expenses)
 *
 * Business rules enforced here:
 *   1. A tranche cannot be marked funded without a funding_events row.
 *   2. Editing a finalized schedule requires an edit_reason + bumps version.
 *   3. Preferred return accrues from funded_at, not allocated_at.
 *   4. amount_funded / amount_scheduled on deal_allocations are cached and kept in sync.
 */
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function guard(data, error, fallback = []) {
  if (error) {
    console.warn('[drawScheduleData]', error.message ?? error);
    return fallback;
  }
  return data ?? fallback;
}

function ok(data, error) {
  if (error) {
    console.warn('[drawScheduleData]', error.message ?? error);
    return { data: null, error };
  }
  return { data, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw Schedules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch draw schedule + tranches for one allocation.
 * Returns { schedule, tranches } or { schedule: null, tranches: [] } if none.
 */
export async function fetchDrawSchedule(allocationId) {
  if (!supabase) return { schedule: null, tranches: [] };

  const { data: schedule, error: se } = await supabase
    .from('draw_schedules')
    .select('*')
    .eq('allocation_id', allocationId)
    .single();

  if (se || !schedule) return { schedule: null, tranches: [] };

  const { data: tranches, error: te } = await supabase
    .from('draw_tranches')
    .select('*')
    .eq('draw_schedule_id', schedule.id)
    .order('sequence');

  return { schedule, tranches: guard(tranches, te) };
}

/**
 * Fetch all draw schedules + tranches for a deal (flattened via view).
 * Returns rows from deal_draw_schedule_view ordered by allocation / sequence.
 */
export async function fetchDealDrawSchedules(dealId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('deal_draw_schedule_view')
    .select('*')
    .eq('deal_id', dealId)
    .order('sequence');
  return guard(data, error);
}

/**
 * Create a new draw schedule for an allocation.
 * Returns { schedule, error }.
 */
export async function createDrawSchedule(allocationId, name = 'Draw Schedule') {
  if (!supabase) return { schedule: null, error: new Error('No Supabase client') };
  const { data, error } = await supabase
    .from('draw_schedules')
    .insert({ allocation_id: allocationId, name, total_scheduled: 0, status: 'draft' })
    .select()
    .single();
  return ok(data, error);
}

/**
 * Update schedule metadata (name, status, edit_reason).
 * If the schedule is finalized, editReason is required.
 * Returns { error }.
 */
export async function updateDrawSchedule(scheduleId, fields, editReason = null) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: existing } = await supabase
    .from('draw_schedules')
    .select('status, version')
    .eq('id', scheduleId)
    .single();

  const wasFinalized = existing?.status === 'finalized';
  if (wasFinalized && !editReason) {
    return { error: new Error('edit_reason is required when modifying a finalized schedule.') };
  }

  const patch = {
    ...fields,
    updated_at: new Date().toISOString(),
    ...(wasFinalized && editReason
      ? { version: (existing.version ?? 1) + 1, edit_reason: editReason }
      : {}),
  };

  const { error } = await supabase
    .from('draw_schedules')
    .update(patch)
    .eq('id', scheduleId);
  return { error: error ?? null };
}

/**
 * Finalize a schedule.
 * Validates that sum(tranches.amount) === allocation.amount before finalizing.
 * Returns { error } or { error: null } on success.
 */
export async function finalizeSchedule(scheduleId) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: ds } = await supabase
    .from('draw_schedules')
    .select('allocation_id, total_scheduled')
    .eq('id', scheduleId)
    .single();

  if (!ds) return { error: new Error('Schedule not found') };

  const { data: alloc } = await supabase
    .from('deal_allocations')
    .select('amount')
    .eq('id', ds.allocation_id)
    .single();

  const allocAmount = Number(alloc?.amount ?? 0);
  const scheduled   = Number(ds.total_scheduled ?? 0);

  if (Math.abs(scheduled - allocAmount) > 0.01) {
    return {
      error: new Error(
        `Cannot finalize: tranche total ($${scheduled.toLocaleString()}) does not equal ` +
        `allocation amount ($${allocAmount.toLocaleString()}). Adjust tranches first.`
      ),
    };
  }

  const { error } = await supabase
    .from('draw_schedules')
    .update({ status: 'finalized', updated_at: new Date().toISOString() })
    .eq('id', scheduleId);
  return { error: error ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tranches
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a tranche to a schedule.
 * Returns { tranche, error }.
 */
export async function addTranche(scheduleId, {
  sequence,
  amount,
  triggerType = 'manual_call',
  triggerDate = null,
  triggerMilestoneKey = null,
  dueDate = null,
  notes = '',
}) {
  if (!supabase) return { tranche: null, error: new Error('No Supabase client') };

  const { data, error } = await supabase
    .from('draw_tranches')
    .insert({
      draw_schedule_id:      scheduleId,
      sequence,
      amount,
      trigger_type:          triggerType,
      trigger_date:          triggerDate,
      trigger_milestone_key: triggerMilestoneKey,
      due_date:              dueDate,
      notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return { tranche: null, error };

  await _refreshScheduleTotal(scheduleId);
  await _refreshAllocationFromSchedule(scheduleId);

  return { tranche: data, error: null };
}

/**
 * Update a tranche (amount, dates, notes — not status).
 * Returns { error }.
 */
export async function updateTranche(trancheId, fields) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: existing } = await supabase
    .from('draw_tranches')
    .select('draw_schedule_id, status')
    .eq('id', trancheId)
    .single();

  if (!existing) return { error: new Error('Tranche not found') };
  if (['funded', 'returned'].includes(existing.status)) {
    return { error: new Error('Cannot edit a funded tranche.') };
  }

  const { error } = await supabase
    .from('draw_tranches')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', trancheId);

  if (!error) {
    await _refreshScheduleTotal(existing.draw_schedule_id);
    await _refreshAllocationFromSchedule(existing.draw_schedule_id);
  }

  return { error: error ?? null };
}

/**
 * Remove a tranche (only allowed when status = 'pending').
 * Returns { error }.
 */
export async function removeTranche(trancheId) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: existing } = await supabase
    .from('draw_tranches')
    .select('draw_schedule_id, status')
    .eq('id', trancheId)
    .single();

  if (!existing) return { error: new Error('Tranche not found') };
  if (existing.status !== 'pending') {
    return { error: new Error('Only pending tranches can be removed.') };
  }

  const { error } = await supabase
    .from('draw_tranches')
    .delete()
    .eq('id', trancheId);

  if (!error) {
    await _refreshScheduleTotal(existing.draw_schedule_id);
    await _refreshAllocationFromSchedule(existing.draw_schedule_id);
  }

  return { error: error ?? null };
}

/**
 * Mark a tranche as skipped.
 * Returns { error }.
 */
export async function skipTranche(trancheId, reason = '') {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { data: existing } = await supabase
    .from('draw_tranches')
    .select('draw_schedule_id, status, draw_schedules(allocation_id, deal_allocations(commitment_id, deal_id))')
    .eq('id', trancheId)
    .single();

  if (!existing || existing.status === 'funded') {
    return { error: new Error('Cannot skip a funded tranche.') };
  }

  const { error } = await supabase
    .from('draw_tranches')
    .update({ status: 'skipped', notes: reason, updated_at: new Date().toISOString() })
    .eq('id', trancheId);

  if (!error) {
    await _refreshScheduleTotal(existing.draw_schedule_id);
    await _refreshAllocationFromSchedule(existing.draw_schedule_id);

    // Ledger entry
    const alloc = existing.draw_schedules?.deal_allocations;
    if (alloc) {
      await supabase.from('commitment_ledger_entries').insert({
        commitment_id: alloc.commitment_id,
        delta_amount:  0,
        reason:        'tranche_skipped',
        deal_id:       alloc.deal_id,
        allocation_id: existing.draw_schedules.allocation_id,
      });
    }
  }

  return { error: error ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Capital Calls (issuing a call — pending → called)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Issue a capital call for one or more tranches.
 * Marks each tranche as 'called', creates a capital_calls row,
 * and appends ledger entries.
 *
 * Returns { call, error }.
 */
export async function issueCalls({ dealId, investorId, trancheIds, dueDate, notes = '' }) {
  if (!supabase) return { call: null, error: new Error('No Supabase client') };

  if (!trancheIds?.length) return { call: null, error: new Error('No tranches selected') };

  // Fetch tranche amounts
  const { data: tranches } = await supabase
    .from('draw_tranches')
    .select('id, amount, draw_schedule_id, status, draw_schedules(allocation_id, deal_allocations(commitment_id))')
    .in('id', trancheIds);

  if (!tranches?.length) return { call: null, error: new Error('Tranches not found') };

  const callableTranches = tranches.filter(t => t.status === 'pending');
  if (!callableTranches.length) {
    return { call: null, error: new Error('All selected tranches are already called or funded.') };
  }

  const totalAmount = callableTranches.reduce((s, t) => s + Number(t.amount), 0);
  const calledAt    = new Date().toISOString();

  // Mark tranches as called
  await supabase
    .from('draw_tranches')
    .update({ status: 'called', called_at: calledAt, updated_at: calledAt })
    .in('id', callableTranches.map(t => t.id));

  // Create capital_calls record
  const { data: call, error: ce } = await supabase
    .from('capital_calls')
    .insert({
      deal_id:      dealId,
      investor_id:  investorId,
      tranche_ids:  callableTranches.map(t => t.id),
      due_date:     dueDate,
      total_amount: totalAmount,
      status:       'sent',
      notes,
    })
    .select()
    .single();

  if (ce) return { call: null, error: ce };

  // Ledger entries
  const uniqueAllocIds = [...new Set(
    callableTranches.map(t => t.draw_schedules?.allocation_id).filter(Boolean)
  )];
  for (const allocId of uniqueAllocIds) {
    const t = callableTranches.find(t => t.draw_schedules?.allocation_id === allocId);
    const commitmentId = t?.draw_schedules?.deal_allocations?.commitment_id;
    if (commitmentId) {
      await supabase.from('commitment_ledger_entries').insert({
        commitment_id: commitmentId,
        delta_amount:  0,
        reason:        'capital_call_issued',
        deal_id:       dealId,
        allocation_id: allocId,
      });
    }
  }

  // Refresh allocation caches
  for (const allocId of uniqueAllocIds) {
    await _refreshAllocationCache(allocId);
  }

  return { call, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Recording Funding (called → funded)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record that an investor wired money in.
 * Creates a funding_events row, links it to the tranche,
 * marks tranche as funded, and updates all cached columns.
 *
 * @param {object} p
 * @param {string}  p.dealId
 * @param {string}  p.allocationId
 * @param {string}  p.trancheId      — null for unmatched wires
 * @param {string}  p.investorId
 * @param {number}  p.amount
 * @param {string}  p.occurredAt     — ISO string (wire date)
 * @param {string}  p.wireReference
 * @param {string}  p.notes
 * @param {string}  p.proofDocumentId — optional
 *
 * Returns { event, error }.
 */
export async function recordFunding({
  dealId,
  allocationId,
  trancheId = null,
  investorId,
  amount,
  occurredAt = new Date().toISOString(),
  wireReference = '',
  notes = '',
  proofDocumentId = null,
}) {
  if (!supabase) return { event: null, error: new Error('No Supabase client') };

  if (!amount || amount <= 0) return { event: null, error: new Error('Amount must be > 0') };

  // ── Create funding_events row ──────────────────────────────────────
  const { data: event, error: fe } = await supabase
    .from('funding_events')
    .insert({
      deal_id:           dealId,
      allocation_id:     allocationId,
      tranche_id:        trancheId,
      investor_id:       investorId,
      amount,
      direction:         'inbound',
      occurred_at:       occurredAt,
      wire_reference:    wireReference || null,
      proof_document_id: proofDocumentId || null,
      notes,
      reconciled:        false,
    })
    .select()
    .single();

  if (fe) return { event: null, error: fe };

  // ── If tranche provided: mark it funded ───────────────────────────
  if (trancheId) {
    const { data: tranche } = await supabase
      .from('draw_tranches')
      .select('draw_schedule_id, status')
      .eq('id', trancheId)
      .single();

    if (tranche && tranche.status !== 'funded') {
      await supabase
        .from('draw_tranches')
        .update({
          status:           'funded',
          funded_at:        occurredAt,
          funding_event_id: event.id,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', trancheId);

      // Refresh schedule status
      await _refreshScheduleStatus(tranche.draw_schedule_id);
    }
  }

  // ── Update allocation cached columns ──────────────────────────────
  await _refreshAllocationCache(allocationId);

  // ── Ledger entry ──────────────────────────────────────────────────
  const { data: alloc } = await supabase
    .from('deal_allocations')
    .select('commitment_id')
    .eq('id', allocationId)
    .single();

  if (alloc) {
    await supabase.from('commitment_ledger_entries').insert({
      commitment_id: alloc.commitment_id,
      delta_amount:  amount,
      reason:        'tranche_funded',
      deal_id:       dealId,
      allocation_id: allocationId,
    });
  }

  // ── Refresh deal-level aggregates ─────────────────────────────────
  await _refreshDealFundingCache(dealId);

  return { event, error: null };
}

/**
 * Confirm / reconcile an existing funding event (operator review).
 * Returns { error }.
 */
export async function confirmFundingEvent(eventId) {
  if (!supabase) return { error: new Error('No Supabase client') };
  const { error } = await supabase
    .from('funding_events')
    .update({ reconciled: true })
    .eq('id', eventId);
  return { error: error ?? null };
}

/**
 * Match an unmatched funding event to a tranche.
 * Returns { error }.
 */
export async function matchFundingEventToTranche(eventId, trancheId) {
  if (!supabase) return { error: new Error('No Supabase client') };

  const { error } = await supabase
    .from('funding_events')
    .update({ tranche_id: trancheId })
    .eq('id', eventId);

  if (error) return { error };

  // Mark the tranche funded using this event's date
  const { data: ev } = await supabase
    .from('funding_events')
    .select('occurred_at, allocation_id, deal_id')
    .eq('id', eventId)
    .single();

  if (ev) {
    await supabase
      .from('draw_tranches')
      .update({
        status:           'funded',
        funded_at:        ev.occurred_at,
        funding_event_id: eventId,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', trancheId);

    const { data: tranche } = await supabase
      .from('draw_tranches')
      .select('draw_schedule_id')
      .eq('id', trancheId)
      .single();
    if (tranche) await _refreshScheduleStatus(tranche.draw_schedule_id);

    await _refreshAllocationCache(ev.allocation_id);
    await _refreshDealFundingCache(ev.deal_id);
  }

  return { error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Capital Calls queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all capital calls for a deal.
 */
export async function fetchCapitalCalls(dealId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('capital_calls')
    .select('*, investors(name)')
    .eq('deal_id', dealId)
    .order('issued_at', { ascending: false });
  return guard(data, error);
}

/**
 * Fetch all open capital calls across all deals (for the workbench).
 * Returns calls ordered by due_date asc (most urgent first).
 */
export async function fetchOpenCapitalCalls() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('capital_calls')
    .select('*, investors(name), deals(address, stage)')
    .in('status', ['draft', 'sent', 'acknowledged', 'overdue'])
    .order('due_date');
  return guard(data, error);
}

/**
 * Update a capital call (status, pdf_url, notes).
 */
export async function updateCapitalCall(callId, fields) {
  if (!supabase) return { error: new Error('No Supabase client') };
  const { error } = await supabase
    .from('capital_calls')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', callId);
  return { error: error ?? null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Funding Events queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all funding events for a deal (inbound + outbound).
 */
export async function fetchFundingEvents(dealId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('funding_events')
    .select('*, investors(name), draw_tranches(sequence, amount)')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false });
  return guard(data, error);
}

/**
 * Fetch unmatched funding events across all deals (tranche_id IS NULL).
 * Used by the Capital Calls Workbench for reconciliation.
 */
export async function fetchUnmatchedFundingEvents() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('funding_events')
    .select('*, investors(name), deals(address)')
    .is('tranche_id', null)
    .eq('direction', 'inbound')
    .order('occurred_at', { ascending: false });
  return guard(data, error);
}

/**
 * Fetch recent inbound events for workbench right column (last N).
 */
export async function fetchRecentFundingEvents(limit = 50) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('funding_events')
    .select('*, investors(name), deals(address)')
    .eq('direction', 'inbound')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  return guard(data, error);
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone → Tranche trigger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a milestone is marked complete.
 * Finds all pending tranches with trigger_milestone_key = milestoneKey on this deal,
 * marks them 'called', and returns the affected tranches.
 *
 * Returns { calledTranches, error }.
 */
export async function triggerMilestone(dealId, milestoneKey) {
  if (!supabase) return { calledTranches: [], error: null };

  // Find pending tranches linked to this milestone on this deal
  const { data: rows } = await supabase
    .from('deal_draw_schedule_view')
    .select('tranche_id, allocation_id, investor_id')
    .eq('deal_id', dealId)
    .eq('trigger_milestone_key', milestoneKey)
    .eq('tranche_status', 'pending');

  if (!rows?.length) return { calledTranches: [], error: null };

  const trancheIds = rows.map(r => r.tranche_id).filter(Boolean);
  const calledAt   = new Date().toISOString();

  await supabase
    .from('draw_tranches')
    .update({ status: 'called', called_at: calledAt, updated_at: calledAt })
    .in('id', trancheIds);

  // Ledger entries
  for (const row of rows) {
    const { data: alloc } = await supabase
      .from('deal_allocations')
      .select('commitment_id')
      .eq('id', row.allocation_id)
      .single();
    if (alloc) {
      await supabase.from('commitment_ledger_entries').insert({
        commitment_id: alloc.commitment_id,
        delta_amount:  0,
        reason:        'tranche_called',
        deal_id:       dealId,
        allocation_id: row.allocation_id,
      });
    }
  }

  return { calledTranches: rows, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferred Return / Interest helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute accrued preferred return for an allocation.
 * Interest accrues from each tranche's funded_at (not allocation date).
 * Returns { totalAccrued, breakdown: [{ trancheId, amount, fundedAt, days, accrued }] }
 */
export async function computeAccruedReturn(allocationId, asOfDate = new Date()) {
  if (!supabase) return { totalAccrued: 0, breakdown: [] };

  const { data: alloc } = await supabase
    .from('deal_allocations')
    .select('preferred_return_pct, amount')
    .eq('id', allocationId)
    .single();

  if (!alloc?.preferred_return_pct) return { totalAccrued: 0, breakdown: [] };

  const annualRate = Number(alloc.preferred_return_pct) / 100;

  const { data: tranches } = await supabase
    .from('draw_tranches')
    .select('id, amount, funded_at, draw_schedules!inner(allocation_id)')
    .eq('draw_schedules.allocation_id', allocationId)
    .eq('status', 'funded')
    .not('funded_at', 'is', null);

  const breakdown = (tranches ?? []).map(t => {
    const fundedAt = new Date(t.funded_at);
    const days     = Math.max(0, (asOfDate - fundedAt) / (1000 * 60 * 60 * 24));
    const accrued  = Number(t.amount) * annualRate * (days / 365);
    return { trancheId: t.id, amount: Number(t.amount), fundedAt: t.funded_at, days, accrued };
  });

  const totalAccrued = breakdown.reduce((s, r) => s + r.accrued, 0);
  return { totalAccrued, breakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private helpers — cache refresh
// ─────────────────────────────────────────────────────────────────────────────

/** Recompute draw_schedules.total_scheduled from its tranches. */
async function _refreshScheduleTotal(scheduleId) {
  const { data } = await supabase
    .from('draw_tranches')
    .select('amount')
    .eq('draw_schedule_id', scheduleId)
    .neq('status', 'skipped');

  const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);
  await supabase
    .from('draw_schedules')
    .update({ total_scheduled: total, updated_at: new Date().toISOString() })
    .eq('id', scheduleId);
}

/** Update draw_schedule.status based on its tranches. */
async function _refreshScheduleStatus(scheduleId) {
  const { data: tranches } = await supabase
    .from('draw_tranches')
    .select('status')
    .eq('draw_schedule_id', scheduleId);

  if (!tranches?.length) return;

  const all     = tranches;
  const anyFund = all.some(t => t.status === 'funded');
  const allFund = all.every(t => ['funded', 'skipped'].includes(t.status));
  const anyCall = all.some(t => t.status === 'called');

  let status = 'draft';
  if (allFund)       status = 'completed';
  else if (anyFund)  status = 'in_progress';
  else if (anyCall)  status = 'in_progress';

  await supabase
    .from('draw_schedules')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', scheduleId);
}

/** Recompute amount_funded, amount_scheduled, and funding_status on an allocation. */
export async function _refreshAllocationCache(allocationId) {
  // Fetch all non-skipped tranches for schedules belonging to this allocation
  const { data: schedules } = await supabase
    .from('draw_schedules')
    .select('id')
    .eq('allocation_id', allocationId);

  const scheduleIds = (schedules ?? []).map(s => s.id);
  if (!scheduleIds.length) return;

  const { data: tranches } = await supabase
    .from('draw_tranches')
    .select('amount, status')
    .in('draw_schedule_id', scheduleIds)
    .neq('status', 'skipped');

  const amountFunded    = (tranches ?? [])
    .filter(t => t.status === 'funded')
    .reduce((s, t) => s + Number(t.amount), 0);

  const amountScheduled = (tranches ?? [])
    .reduce((s, t) => s + Number(t.amount), 0);

  const { data: alloc } = await supabase
    .from('deal_allocations')
    .select('amount')
    .eq('id', allocationId)
    .single();

  const total = Number(alloc?.amount ?? 0);
  let fundingStatus = 'not_started';
  if (amountFunded >= total && total > 0) fundingStatus = 'fully_funded';
  else if (amountFunded > 0)              fundingStatus = 'partially_funded';
  else if (amountScheduled > 0)          fundingStatus = 'scheduled';

  await supabase
    .from('deal_allocations')
    .update({
      amount_funded:    amountFunded,
      amount_scheduled: amountScheduled,
      funding_status:   fundingStatus,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', allocationId);
}

/** Shortcut: refresh allocation cache starting from a schedule (no allocationId needed). */
async function _refreshAllocationFromSchedule(scheduleId) {
  const { data } = await supabase
    .from('draw_schedules')
    .select('allocation_id')
    .eq('id', scheduleId)
    .single();
  if (data) await _refreshAllocationCache(data.allocation_id);
}

/** Recompute funded_to_date and scheduled_to_date on the deals row. */
async function _refreshDealFundingCache(dealId) {
  const { data: allocs } = await supabase
    .from('deal_allocations')
    .select('amount_funded, amount_scheduled')
    .eq('deal_id', dealId)
    .neq('status', 'returned');

  const funded    = (allocs ?? []).reduce((s, a) => s + Number(a.amount_funded    ?? 0), 0);
  const scheduled = (allocs ?? []).reduce((s, a) => s + Number(a.amount_scheduled ?? 0), 0);

  await supabase
    .from('deals')
    .update({ funded_to_date: funded, scheduled_to_date: scheduled })
    .eq('id', dealId);
}
