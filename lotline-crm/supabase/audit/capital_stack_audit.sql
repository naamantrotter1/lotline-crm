-- ═══════════════════════════════════════════════════════════════════════
-- Capital Stack Audit: allocations that exceed deal.total_capital_required
-- READ-ONLY — safe to run at any time, no writes.
--
-- Usage: paste into Supabase SQL editor and run.
-- Output: one row per offending allocation.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Query 1: Allocations where a single allocation > deal.total_capital_required
-- ─────────────────────────────────────────────────────────────────────
SELECT
  d.id                                          AS deal_id,
  d.address,
  d.total_capital_required                      AS deal_required,
  da.id                                         AS allocation_id,
  i.name                                        AS investor_name,
  cc.name                                       AS commitment_name,
  cc.commitment_type,
  da.amount                                     AS allocation_amount,
  da.amount - d.total_capital_required          AS over_by_single,
  da.status                                     AS alloc_status
FROM public.deal_allocations da
JOIN public.deals d            ON d.id  = da.deal_id
JOIN public.investors i        ON i.id  = da.investor_id
JOIN public.capital_commitments cc ON cc.id = da.commitment_id
WHERE da.amount > d.total_capital_required
  AND da.status != 'returned'
  AND d.total_capital_required IS NOT NULL
  AND d.total_capital_required > 0
ORDER BY (da.amount - d.total_capital_required) DESC;

-- ─────────────────────────────────────────────────────────────────────
-- Query 2: Deals where SUM(allocations) > total_capital_required
-- ─────────────────────────────────────────────────────────────────────
SELECT
  d.id                              AS deal_id,
  d.address,
  d.total_capital_required          AS deal_required,
  SUM(da.amount)                    AS total_allocated,
  SUM(da.amount) - d.total_capital_required AS over_by_total,
  COUNT(da.id)                      AS num_allocations
FROM public.deal_allocations da
JOIN public.deals d ON d.id = da.deal_id
WHERE da.status != 'returned'
  AND d.total_capital_required IS NOT NULL
  AND d.total_capital_required > 0
GROUP BY d.id, d.address, d.total_capital_required
HAVING SUM(da.amount) > d.total_capital_required
ORDER BY (SUM(da.amount) - d.total_capital_required) DESC;

-- ─────────────────────────────────────────────────────────────────────
-- Query 3: Legacy commitment sizing check
--   Shows each legacy commitment's committed_amount vs actual allocation sum.
--   After migration 008, these should be equal (delta = 0).
-- ─────────────────────────────────────────────────────────────────────
SELECT
  cc.id                                       AS commitment_id,
  cc.name                                     AS commitment_name,
  i.name                                      AS investor_name,
  cc.committed_amount,
  COALESCE(SUM(da.amount) FILTER (WHERE da.status != 'returned'), 0) AS actual_alloc_sum,
  cc.committed_amount
    - COALESCE(SUM(da.amount) FILTER (WHERE da.status != 'returned'), 0) AS delta,
  cc.status                                   AS commitment_status
FROM public.capital_commitments cc
JOIN public.investors i ON i.id = cc.investor_id
LEFT JOIN public.deal_allocations da ON da.commitment_id = cc.id
WHERE cc.name LIKE 'Legacy Commitment%'
GROUP BY cc.id, cc.name, i.name, cc.committed_amount, cc.status
ORDER BY ABS(cc.committed_amount
  - COALESCE(SUM(da.amount) FILTER (WHERE da.status != 'returned'), 0)) DESC;
