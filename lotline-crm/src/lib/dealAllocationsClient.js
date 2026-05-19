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
