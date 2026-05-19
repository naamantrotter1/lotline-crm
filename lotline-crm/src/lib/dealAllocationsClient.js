/**
 * dealAllocationsClient.js
 *
 * Helper layer over `deal_allocations` for the operator-facing UI. The
 * investor-facing portal already reads allocations directly via
 * `fetchMyAllocations` in investorPortalData.js — these helpers expose the
 * same data to the operator side so the legacy `deals.investor` text field
 * can be deprecated.
 *
 * Filtering convention (matches investor portal):
 *   • status != 'returned'  → not returned to the investor
 *   • amount > 0            → not a $0 placeholder
 */
import { supabase } from './supabase';

/**
 * Bulk-fetch active allocations for a list of deal IDs.
 *
 * @param {string[]} dealIds
 * @returns {Promise<Record<string, Array>>} { [dealId]: [{ id, investorId, investorName, amount, position, status, fundingStatus, preferredReturnPct, profitSharePct, allocatedAt }, ...] }
 */
export async function fetchAllocationsForDeals(dealIds) {
  if (!supabase) return {};
  if (!Array.isArray(dealIds) || dealIds.length === 0) return {};

  const { data, error } = await supabase
    .from('deal_allocations')
    .select(
      'id, deal_id, investor_id, amount, position, status, funding_status, preferred_return_pct, profit_share_pct, allocated_at, investors(name)'
    )
    .in('deal_id', dealIds)
    .neq('status', 'returned')
    .gt('amount', 0)
    .order('allocated_at', { ascending: true });

  if (error) {
    console.error('[dealAllocationsClient] fetchAllocationsForDeals error:', error.message);
    return {};
  }

  const byDealId = {};
  for (const row of data ?? []) {
    if (!byDealId[row.deal_id]) byDealId[row.deal_id] = [];
    byDealId[row.deal_id].push({
      id:                 row.id,
      investorId:         row.investor_id,
      investorName:       row.investors?.name ?? null,
      amount:             Number(row.amount) || 0,
      position:           row.position,
      status:             row.status,
      fundingStatus:      row.funding_status,
      preferredReturnPct: row.preferred_return_pct != null ? Number(row.preferred_return_pct) : null,
      profitSharePct:     row.profit_share_pct != null ? Number(row.profit_share_pct) : null,
      allocatedAt:        row.allocated_at,
    });
  }
  return byDealId;
}

/**
 * Pick the canonical "primary" investor for a deal's allocations.
 * Order of preference: 1st Position first, then highest amount, then earliest allocated_at.
 *
 * @param {Array} allocations
 * @returns {string | null} investor name, or null if no allocations
 */
export function primaryInvestorName(allocations) {
  const primary = primaryAllocation(allocations);
  return primary?.investorName ?? null;
}

/**
 * Find the canonical primary allocation row for a deal.
 *
 * @param {Array} allocations
 * @returns {object | null}
 */
export function primaryAllocation(allocations) {
  if (!Array.isArray(allocations) || allocations.length === 0) return null;
  const sorted = [...allocations].sort((a, b) => {
    const posA = a.position === '1st Position' ? 0 : 1;
    const posB = b.position === '1st Position' ? 0 : 1;
    if (posA !== posB) return posA - posB;
    if ((b.amount || 0) !== (a.amount || 0)) return (b.amount || 0) - (a.amount || 0);
    return new Date(a.allocatedAt || 0) - new Date(b.allocatedAt || 0);
  });
  return sorted[0];
}

/**
 * Summarize allocations for a one-line UI ("Atium +2 more").
 *
 * @param {Array} allocations
 * @returns {{ primary: string | null, extraCount: number, total: number }}
 */
export function summarizeInvestors(allocations) {
  const list = Array.isArray(allocations) ? allocations : [];
  const primary = primaryInvestorName(list);
  // Count unique investors (a deal can have multiple allocations to the same investor — tranches)
  const uniqueNames = new Set(list.map(a => a.investorName).filter(Boolean));
  const total = uniqueNames.size;
  const extraCount = Math.max(0, total - (primary ? 1 : 0));
  return { primary, extraCount, total };
}

/**
 * True iff a deal has at least one active, non-$0 allocation.
 * Used to detect "needs funding" deals.
 *
 * @param {Array} allocations
 */
export function isFunded(allocations) {
  return Array.isArray(allocations) && allocations.length > 0;
}

// ── Investor lookup ─────────────────────────────────────────────────────────

/**
 * Find an investor row by name within an organization (case-insensitive).
 * Returns null if not found.
 */
export async function findInvestorByName(name, organizationId) {
  if (!supabase || !name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  let q = supabase
    .from('investors')
    .select('id, name, organization_id')
    .ilike('name', trimmed)
    .eq('is_archived', false);
  if (organizationId) q = q.eq('organization_id', organizationId);
  const { data } = await q.limit(1).maybeSingle();
  return data ?? null;
}

// ── Write path: upsert + clear primary investor allocations ─────────────────

async function findOrCreateLegacyCommitment(investorId, organizationId) {
  // Reuse the most recent active commitment if any; otherwise create a
  // "Legacy" unlimited commitment matching migrations 005/140 convention.
  const { data: existing } = await supabase
    .from('capital_commitments')
    .select('id')
    .eq('investor_id', investorId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('capital_commitments')
    .insert({
      investor_id:      investorId,
      organization_id:  organizationId,
      name:             'Legacy Commitment — created ' + new Date().toISOString().slice(0, 10),
      committed_amount: null,           // unlimited
      priority_rank:    1,
      status:           'active',
      revolving:        true,
      notes:            'Auto-created by dealAllocationsClient.upsertPrimaryAllocation',
    })
    .select('id')
    .single();
  if (error) {
    console.error('[dealAllocationsClient] commitment create failed:', error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Upsert the active 1st Position allocation for an investor on a deal.
 *
 * Behavior:
 *   • If an active (non-returned) allocation already exists for
 *     (deal_id, investor_id), update it in place with new amount + terms.
 *   • Else, find-or-create a commitment for the investor and INSERT.
 *   • Optionally, mark any OTHER active 1st Position allocations on the deal
 *     as 'returned' so the deal has a single primary investor (the typical
 *     operator UX). Pass replacePrimary=false to disable this (e.g. for
 *     multi-investor capital stacks added via the Capital Stack panel).
 *
 * Returns the created/updated allocation row or null on failure.
 */
export async function upsertPrimaryAllocation({
  dealId,
  organizationId,
  investorId,
  amount,
  position = '1st Position',
  preferredReturnPct = null,
  profitSharePct = null,
  sourceScenario = null,
  status = 'committed',
  fundingStatus = null,
  notes = null,
  replacePrimary = true,
}) {
  if (!supabase) return null;
  if (!dealId || !investorId || !organizationId) {
    console.warn('[dealAllocationsClient] upsertPrimaryAllocation missing required fields', { dealId, investorId, organizationId });
    return null;
  }
  const safeAmount = Math.max(1, Number(amount) || 1);
  const fundingStatusValue = fundingStatus ?? (safeAmount > 1 ? 'fully_funded' : 'not_started');

  // 1) If a non-returned allocation already exists for (deal, investor), update it.
  const { data: existing } = await supabase
    .from('deal_allocations')
    .select('id')
    .eq('deal_id', dealId)
    .eq('investor_id', investorId)
    .neq('status', 'returned')
    .order('allocated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('deal_allocations')
      .update({
        amount:               safeAmount,
        position,
        status,
        funding_status:       fundingStatusValue,
        preferred_return_pct: preferredReturnPct,
        profit_share_pct:     profitSharePct,
        source_scenario:      sourceScenario,
        ...(notes ? { notes } : {}),
        updated_at:           new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) {
      console.error('[dealAllocationsClient] allocation update failed:', error.message);
      return null;
    }
    if (replacePrimary && position === '1st Position') {
      await returnOtherPrimaryAllocations(dealId, investorId);
    }
    return data;
  }

  // 2) Otherwise insert a new allocation, creating a commitment if needed.
  const commitmentId = await findOrCreateLegacyCommitment(investorId, organizationId);
  if (!commitmentId) return null;

  const { data, error } = await supabase
    .from('deal_allocations')
    .insert({
      deal_id:              dealId,
      commitment_id:        commitmentId,
      investor_id:          investorId,
      organization_id:      organizationId,
      amount:               safeAmount,
      position,
      status,
      funding_status:       fundingStatusValue,
      preferred_return_pct: preferredReturnPct,
      profit_share_pct:     profitSharePct,
      source_scenario:      sourceScenario,
      notes:                notes ?? 'Created by operator UI on ' + new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single();
  if (error) {
    console.error('[dealAllocationsClient] allocation insert failed:', error.message);
    return null;
  }
  if (replacePrimary && position === '1st Position') {
    await returnOtherPrimaryAllocations(dealId, investorId);
  }
  return data;
}

/**
 * Mark every active 1st Position allocation on a deal as 'returned' EXCEPT the
 * given investor's. Used when assigning a primary investor that replaces a
 * previous one.
 */
async function returnOtherPrimaryAllocations(dealId, keepInvestorId) {
  if (!supabase) return;
  await supabase
    .from('deal_allocations')
    .update({
      status:     'returned',
      notes:      'Auto-returned: primary investor replaced via operator UI',
      updated_at: new Date().toISOString(),
    })
    .eq('deal_id', dealId)
    .eq('position', '1st Position')
    .neq('status', 'returned')
    .neq('investor_id', keepInvestorId);
}

/**
 * Mark every active 1st Position allocation on a deal as 'returned'. Used
 * when the operator clears the investor field on a deal.
 */
export async function returnAllPrimaryAllocations(dealId) {
  if (!supabase || !dealId) return;
  await supabase
    .from('deal_allocations')
    .update({
      status:     'returned',
      notes:      'Auto-returned: investor cleared via operator UI',
      updated_at: new Date().toISOString(),
    })
    .eq('deal_id', dealId)
    .eq('position', '1st Position')
    .neq('status', 'returned');
}
