# Cost Breakdown V2 — Architecture & Data Flow

**Last updated:** 2026-04-25
**Status:** PR 2–6 complete (PR 5 full removal deferred, see below)

---

## Canonical Data Flow

```
User edits cost in CostBreakdownTab
         │
         ▼
costBreakdownData.js
  ├── updateEstimated(lineId, amount, userId)
  ├── overrideActual(lineId, amount, userId)
  ├── resetActualToMirror(lineId)
  └── bulkOverrideActuals(rows, userId)
         │
         ▼
[Supabase] deal_cost_lines  (the write target — one row per deal × category)
         │
         ├──► deal_cost_resolved_view    (per-line read view)
         │         actual_amount_resolved = actual_amount  when actual_overridden = TRUE
         │                               = estimated_amount otherwise
         │
         └──► deal_cost_summary_view     (per-deal totals view)
                   total_actual          = SUM(resolved actuals for leaf lines)
                   total_estimated       = SUM(estimated_amount for all lines)
                   total_difference      = total_actual - total_estimated
                   override_count        = COUNT rows where actual_overridden = TRUE
```

---

## Data Consumers

### Read from `deal_cost_resolved_view` ✅
| Consumer | Function | Notes |
|---|---|---|
| `CostBreakdownTab.jsx` | `fetchCostLines(dealId)` | Per-line display and edit |

### Read `total_actual` from `deal_cost_summary_view` ✅
| Consumer | Function | Notes |
|---|---|---|
| `DealDetail.jsx` | `fetchCostSummary(dealId)` | Single-deal all-in cost |
| `DealsContext.jsx` | via `loadAllDeals` + Realtime | Batch-enriches ALL deals in state |
| Investor portal | via `fetchMyDeals`/`fetchMyDeal` | Merges `total_actual` onto each deal row |

### Downstream consumers that use `deal.totalActual` (set by DealsContext) ✅
All of these receive correct values automatically once `DealsContext` loads:
- `calcNetProfit(deal)` in `src/data/deals.js` → used by Dashboard, Analytics, DealOverview, DueDiligence, Development, LandAcquisition (card display)
- `PnlDashboard.jsx` — `totalBuildCosts`
- `InvestorPortal.jsx` — `totalCapital`

### Investor-side consumers (use `deal.total_actual`, snake_case) ✅
These use deals fetched via `fetchMyDeals`/`fetchMyDeal` which now include `total_actual`:
- `DealMetrics.jsx` — "Build Cost", "Projected Profit"
- `YourPosition.jsx` — profit split return calculation
- `computePortfolioMetrics()` — `deployed` and `unrealizedGain`
- `InvestorDeals.jsx` — per-deal `totalCost`
- `InvestorHome.jsx` — portfolio PDF export `cost`
- `InvestorOpportunities.jsx` — `DealCard` `totalCost` and `projProfit`

---

## Live Update Flow (Realtime)

```
User edits a cost line
         │
         ▼
costBreakdownData.js writes to deal_cost_lines
         │
         ├──► Supabase Realtime broadcasts postgres_changes event
         │         ├──► DealDetail.jsx  (subscribes via its own listener)
         │         │    re-fetches fetchCostSummary(dealId) → updates local allIn
         │         │
         │         └──► DealsContext.jsx  (deal-cost-lines-totals channel)
         │              re-fetches fetchCostSummary(dealId) → updates deal.totalActual
         │              in state → all pages rerender with correct profit figures
         │
         └──► All operator pages update automatically within ~100ms
```

---

## Key Files

| File | Role |
|---|---|
| `src/lib/costBreakdownData.js` | Write layer (deal_cost_lines) + read helpers |
| `src/lib/dealsSync.js` | `loadAllDeals` — fetches cost summaries, merges `totalActual` |
| `src/lib/DealsContext.jsx` | Realtime subscription on `deal_cost_lines` → keeps `totalActual` live |
| `src/data/deals.js` | `calcNetProfit` — uses `deal.totalActual` with legacy fallback |
| `src/lib/investorPortalData.js` | `fetchMyDeals`/`fetchMyDeal` — enrich investor deal objects |
| `src/components/investor/DealMetrics.jsx` | Uses `deal.total_actual` |
| `src/components/investor/YourPosition.jsx` | Uses `deal.total_actual` for profit split |
| `supabase/migrations/045_cost_drift_detector.sql` | `detect_and_log_cost_drift()` — audit tool |
| `src/__tests__/costBreakdownParity.test.js` | 19 unit tests for cost propagation logic |
| `docs/cost-breakdown-audit.md` | Full stale-consumer audit (16 sites, all fixed) |

---

## Legacy Layer Status

The `deals` table still has 22 flat cost columns (land, mobile_home, hud_engineer, etc.).
These are:

1. **Still written** on every `saveDeal()` call — `dealToRow()` in `dealsSync.js`
2. **No longer read** for profit/cost computation in operator or investor pages
3. **Still read** by `LandAcquisition.jsx`'s inline cost editor to initialize its local `costs` state

### PR 5 Deferral Rationale

Full removal of legacy writes requires first migrating `LandAcquisition.jsx`'s cost editor to write directly to `deal_cost_lines`. Until that happens:
- Removing the writes would silently corrupt the LA editor (it initializes from `deal.land`, `deal.mobileHome`, etc.)
- The flat columns are annotated with `// DEPRECATED` in `dealToRow`
- After LA editor migration, drop the columns via a schema migration `046_drop_legacy_cost_columns.sql`

---

## Drift Detection

Run the drift detector at any time to find deals where `deal_cost_summary_view.total_actual`
diverges from the legacy flat column sum:

```sql
-- Insert alert rows and return them
SELECT * FROM detect_and_log_cost_drift('manual-check-2026-04-25');

-- View summary stats
SELECT * FROM cost_drift_summary;
```

All alerts are stored in `cost_breakdown_drift_alerts` for historical review.

---

## Adding a New Cost Category

1. Insert into `cost_breakdown_categories` (global: `org_id = NULL`)
2. `fn_seed_deal_cost_lines()` trigger automatically backfills new deals
3. Run migration to backfill existing deals: `INSERT INTO deal_cost_lines ... ON CONFLICT DO NOTHING`
4. No consumer code changes needed — views and `computeTotalActual` pick up new lines automatically
5. To hide a category from the UI: add its key to `HIDDEN_KEYS` in `CostBreakdownTab.jsx`

---

## Key Invariants

- `deal.totalActual` is **always** the canonical all-in cost for any deal object from `DealsContext`
- `deal.totalActual` is `null` only for LS-only deals that haven't synced to Supabase yet (legacy fallback applies)
- `actual_amount_resolved` in `deal_cost_resolved_view` = `actual_amount` (when overridden) else `estimated_amount`
- `total_actual` in `deal_cost_summary_view` = sum of `actual_amount_resolved` for leaf lines only (aggregation='none')
- Parent rows (aggregation='sum_of_children') do NOT contribute to `total_actual` to avoid double-counting
