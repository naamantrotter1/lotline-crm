# Capital Stack Audit Report
*Generated: 2026-04-23 — flagged allocations for operator review*
*No corrective writes have been made. This report is read-only.*

---

## Purpose

This report identifies allocations where `deal_allocations.amount > deals.total_capital_required`, meaning a single allocation slice was sized larger than the entire deal's capital requirement. It also flags legacy commitments whose `committed_amount` did not match the actual sum of their allocations (the bug introduced by migration 005).

To re-run the queries that produced this data, see [`supabase/audit/capital_stack_audit.sql`](../supabase/audit/capital_stack_audit.sql).

---

## Issue 1 — Allocations Exceeding Deal Capital Requirement

These allocations have `amount > deal.total_capital_required`. The allocation amount grabbed the investor's total commitment ceiling instead of the deal's actual capital need.

**Root cause:** `addAllocation()` in `capitalStackData.js` only checked commitment headroom (investor-level), not deal capacity (deal-level). No guardrail existed for the per-deal cap.

| Deal | Address | Required | Allocation | Investor | Over By | Action |
|------|---------|----------|-----------|----------|---------|--------|
| deal-004 | Blue Newkirk Rd, Magnolia NC | $173,450 | $500,000 | Atium Build Group LLC (Legacy) | $326,550 | **Awaiting review** |

### Recommended corrective write (run manually after review)

```sql
-- Correct deal-004 Atium legacy allocation to match deal requirement
-- Run ONLY after confirming deal.total_capital_required = 173450 is correct.
UPDATE public.deal_allocations
SET amount  = 173450,
    notes   = notes || ' | Amount corrected from $500,000 → $173,450 by operator on 2026-04-23 (migration 005 bug)',
    updated_at = now()
WHERE deal_id = 'deal-004'
  AND investor_id = 'aaaaaaaa-0000-0000-0000-000000000001'   -- Atium Build Group LLC
  AND amount = 500000;

-- Log the correction
INSERT INTO public.commitment_ledger_entries (
  commitment_id, delta_amount, reason, deal_id, override_reason
)
SELECT
  commitment_id,
  173450 - 500000,                 -- delta = -326550
  'allocation_reduced',
  'deal-004',
  'Operator correction 2026-04-23: allocation was set to investor commitment total ($500K) instead of deal requirement ($173,450). Bug introduced by migration 005.'
FROM public.deal_allocations
WHERE deal_id = 'deal-004'
  AND investor_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND amount = 173450              -- after the UPDATE above
LIMIT 1;
```

---

## Issue 2 — Legacy Commitment Sizing Errors

Migration 005 computed each legacy commitment's `committed_amount` as `SUM(COALESCE(investor_capital_contributed, total_capital_required))` across deals. This differed from the actual allocation amounts inserted (which used `GREATEST(investor_capital_contributed, total_capital_required)`), causing the discrepancies below.

**Migration 008** (`supabase/migrations/008_legacy_commitment_fix.sql`) corrects these automatically: `committed_amount` is reset to `SUM(deal_allocations.amount)` and each commitment is marked `fully_deployed`.

| Investor | Commitment | Old committed_amount | Actual alloc sum | Delta |
|----------|-----------|---------------------|-----------------|-------|
| Atium Build Group LLC | Legacy Commitment — migrated 2026-04-23 | $527,900 | $1,057,300 | +$529,400 |
| Louis Isom | Legacy Commitment — migrated 2026-04-23 | $414,350 | $520,343 | +$105,993 |
| Blue Bay Capital | Legacy Commitment — migrated 2026-04-23 | $152,500 | $202,350 | +$49,850 |
| Windstone | Legacy Commitment — migrated 2026-04-23 | $287,000 | $386,700 | +$99,700 |

> **Note:** After migration 008 runs, re-run `capital_stack_audit.sql` Query 3 — all deltas should be 0.

---

## Checklist Before Running Corrective Writes

- [ ] Confirm `deal.total_capital_required = 173,450` for deal-004 is correct
- [x] Run migration 008 to fix legacy commitment sizing — **applied 2026-04-23**
- [ ] Run the manual deal-004 correction SQL above
- [ ] Re-run `capital_stack_audit.sql` Query 1 and Query 2 — expect 0 rows
- [ ] Re-run Query 3 — expect all deltas = 0
- [ ] Verify deal-004 page shows "Fully Allocated" after correction

## Migration Status (2026-04-23)

| Migration | Status | Notes |
|-----------|--------|-------|
| 005 — Capital Stack | ✅ Applied | |
| 006 — Draw Schedules | ✅ Applied | 11 draw schedules created; Blue Newkirk 4-tranche seed applied |
| 008 — Legacy Commitment Fix | ✅ Applied | commitment_type column added; legacy commitments corrected |
| 009 — Financing Scenario Type | ✅ Applied | |
| 010 — Multi-Tenant Foundation | ✅ Applied | |

Views updated 2026-04-23:
- `deal_capital_stack_view` — includes `funding_status`, `amount_scheduled`, `amount_funded`, `amount_outstanding`, `pref_payment_timing`, `source_scenario`
- `investor_commitment_summary` — includes `organization_id`, `commitment_type`
- `deal_draw_schedule_view` — created; joins draw_schedules → draw_tranches → funding_events

---

*Forward-looking commitments (Atium $500K 2026, Louis Isom $400K 2026) are NOT affected — they are `commitment_type = 'active'` and correctly sized.*
