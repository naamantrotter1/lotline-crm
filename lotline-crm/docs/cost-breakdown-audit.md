# Cost Breakdown V2 — Stale Consumer Audit

**Date:** 2026-04-25
**Author:** Claude (automated audit)
**Status:** PR 1 of 6 — audit only, no behavior changes

## Root Cause

`DealsContext` loads deals via `loadAllDeals()` in `dealsSync.js`, which fetches
`deals.*` (the flat legacy cost columns). It does **not** enrich deal objects with
`deal_cost_summary_view.total_actual`. Every downstream consumer therefore computes
costs from ~22 stale legacy columns (`land`, `mobile_home`, `hud_engineer`, etc.)
rather than the canonical `deal_cost_lines` table.

`DealDetail.jsx` is the **only** surface that calls `fetchCostSummary(deal.id)` and
uses `costSummary.total_actual` as its all-in figure. Every other page is stale.

## Correct Data Sources

| Layer | Function | Returns |
|---|---|---|
| Per-line | `fetchCostLines(dealId)` | `deal_cost_resolved_view` — resolves actual per line |
| Per-deal totals | `fetchCostSummary(dealId)` | `deal_cost_summary_view` — `total_actual`, `total_estimated` |
| Org-wide batch | `fetchCostSummariesForOrg(orgId)` | `deal_cost_summary_view` — all deals for an org |

`fetchCostSummariesForOrg` already exists in `src/lib/costBreakdownData.js` but is
**never called** by `DealsContext`. The fix is to call it in `loadAllDeals` and merge
`total_actual` → `deal.totalActual` on every deal object.

## Legacy Cost Fields (Stale)

These columns exist on the `deals` table but are never updated after initial deal
creation. They diverge from `deal_cost_lines` as soon as any cost line is edited.

```
land, mobile_home, hud_engineer, perc_test, survey, footers, setup, clear_land,
water_cost, septic, electric, hvac, underpinning, decks, driveway, landscaping,
water_sewer, mailbox, gutters, photos, mobile_tax, staging
```

## `calcNetProfit` in `src/data/deals.js`

```js
// Current (stale for all callers)
export function calcNetProfit(deal, totalActualOverride) {
  const allIn = totalActualOverride ?? (
    (deal.land ?? 0) + (deal.mobileHome ?? 0) + (deal.hudEngineer ?? 0) + ...
  );
  return (deal.listingPrice || deal.arv || 0) - allIn - sellingCosts - holdingCosts;
}
```

The signature already supports a `totalActualOverride` parameter. **No caller passes
it**, so all consumers use the stale legacy sum. Fix: read `deal.totalActual` when
present.

---

## Stale Consumer Sites — 16 Total

### 1. `src/data/deals.js` — `calcNetProfit`
- **Status:** ❌ stale
- **Issue:** Falls back to summing ~22 legacy flat columns
- **Fix:** Use `deal.totalActual ?? <legacy-sum>` as the fallback chain

---

### 2. `src/pages/Dashboard.jsx`
- **Status:** ❌ stale
- **Reads:** `calcNetProfit(d)` (no override) for:
  - `pipelineProfit`, `closedProfit`, `doCompleteProfit`, `doAllProfit`, `closedThisYearProfit`
  - Per-deal rows in profit modals
- **Fix:** Once `d.totalActual` is set by `DealsContext`, `calcNetProfit` uses it automatically

---

### 3. `src/pages/PnlDashboard.jsx`
- **Status:** ❌ stale
- **Reads:**
  - `calcNetProfit(d)` for `pipelineProfit`
  - Direct field reads: `d.land`, `d.mobileHome`, `d.hudEngineer`, `d.percTest`,
    `d.survey`, `d.footers`, `d.setup` for `totalBuildCosts` and `costBreakdown` array
- **Fix:** Use `d.totalActual` for the all-in total; compute group breakdowns from cost lines

---

### 4. `src/pages/Analytics.jsx`
- **Status:** ❌ stale
- **Reads:** `calcNetProfit(d)` for `totalPipelineProfit`, `avgProfit`, per-stage profit
- **Fix:** Once `d.totalActual` is set, `calcNetProfit` uses it automatically

---

### 5. `src/pages/DealOverview.jsx`
- **Status:** ❌ stale
- **Reads:** `calcNetProfit(deal)` (line 54) for deal card net profit
- **Fix:** Automatic via `calcNetProfit` fix

---

### 6. `src/pages/DueDiligence.jsx`
- **Status:** ❌ stale
- **Reads:** `calcNetProfit(deal)` (line 99) for deal card net profit
- **Fix:** Automatic via `calcNetProfit` fix

---

### 7. `src/pages/Development.jsx`
- **Status:** ❌ stale
- **Reads:** `calcNetProfit(deal)` for deal card net profit
- **Fix:** Automatic via `calcNetProfit` fix

---

### 8. `src/pages/LandAcquisition.jsx`
- **Status:** ❌ stale
- **Reads:**
  - `calcNetProfit(deal)` for card net profit
  - Direct reads of `costs.mobileHome`, individual cost fields for `totalBuild`
- **Fix:** `calcNetProfit` fix covers profit; `totalBuild` needs to use `deal.totalActual`

---

### 9. `src/pages/ArchivedDeals.jsx`
- **Status:** ⚠ stored value
- **Reads:** `deal.netProfit` directly (pre-stored field, not recomputed)
- **Note:** Archived deals may be acceptable to leave as-is since they are snapshots

---

### 10. `src/pages/InvestorPortal.jsx`
- **Status:** ❌ stale
- **Reads:** `d.land`, `d.mobileHome`, `d.permits`, `d.sitework`, `d.utilities`, `d.other`
  for `totalCapital` computation
- **Fix:** Use `d.totalActual` from enriched deal object

---

### 11. `src/pages/investor/InvestorDeals.jsx`
- **Status:** ❌ stale
- **Reads:** `deal.land + deal.mobile_home + deal.permits + ...` for `totalCost`
- **Fix:** Use `deal.totalActual`

---

### 12. `src/pages/investor/InvestorHome.jsx`
- **Status:** ❌ stale
- **Reads:** `d.land + d.mobile_home + ...` for cost computation
- **Fix:** Use `d.totalActual`

---

### 13. `src/pages/investor/InvestorOpportunities.jsx`
- **Status:** ❌ stale
- **Reads:** `deal.land + deal.mobile_home + ...` for `totalCost`
- **Fix:** Use `deal.totalActual`

---

### 14. `src/components/investor/DealMetrics.jsx`
- **Status:** ❌ stale
- **Reads:**
  ```js
  totalCost = (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
    (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
    (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.water_cost ?? 0) +
    (deal.footers ?? 0) + (deal.underpinning ?? 0) + (deal.decks ?? 0) +
    (deal.driveway ?? 0) + (deal.landscaping ?? 0) + (deal.water_sewer ?? 0)
  ```
  Displays "Build Cost" and "Projected Profit" to investors
- **Fix:** Use `deal.total_actual` (snake_case from DB fetch in investor routes)

---

### 15. `src/components/investor/YourPosition.jsx`
- **Status:** ❌ stale
- **Reads:** Partial legacy field sum for `totalCost` used in profit split math
  (drives "Projected Return" shown to investor)
- **Fix:** Use `deal.total_actual`

---

### 16. `src/lib/investorPortalData.js` — `computePortfolioMetrics`
- **Status:** ❌ stale
- **Reads:** `d.land + d.mobile_home + d.permits + d.setup + ...` for `deployed` metric
- **Fix:** Use `d.total_actual` (investor fetches go through separate DB calls, need
  own cost summary fetch)

---

## Fix Plan (PRs 2–5)

### PR 2 — Switch all consumers to `total_actual`

1. **`src/lib/dealsSync.js`** — In `loadAllDeals`, after fetching deals, call
   `fetchCostSummariesForOrg(orgId)` and merge `total_actual` → `deal.totalActual`
   on every deal object.

2. **`src/lib/DealsContext.jsx`** — Add Supabase Realtime subscription on
   `deal_cost_lines` → on INSERT/UPDATE/DELETE, re-fetch the cost summary for
   `payload.new.deal_id` (or `payload.old.deal_id`) and update that deal in state.

3. **`src/data/deals.js`** — `calcNetProfit`: change fallback to
   `deal.totalActual ?? <legacy-sum>` so all callers (Dashboard, Analytics, etc.)
   automatically get the correct value once `DealsContext` enriches deals.

4. **`src/pages/PnlDashboard.jsx`** — Replace per-field breakdown reads with
   `d.totalActual`; remove direct legacy field reads.

5. **`src/pages/LandAcquisition.jsx`** — Replace `totalBuild` direct-read with
   `deal.totalActual`.

6. **`src/pages/InvestorPortal.jsx`** + **`src/pages/investor/*.jsx`** —
   Replace direct legacy field sums with `deal.totalActual` (or `deal.total_actual`).

7. **`src/components/investor/DealMetrics.jsx`** + **`YourPosition.jsx`** —
   Replace `totalCost` legacy sum with `deal.total_actual`.

8. **`src/lib/investorPortalData.js`** — `computePortfolioMetrics`:
   Accept cost summaries map as argument and use `total_actual`; update all callers
   to pass the map. For the investor-portal `fetchMyDeal`/`fetchMyDeals` path,
   also fetch cost summaries and merge.

### PR 3 — Cache invalidation (Realtime)

Add `deal_cost_lines` Realtime subscription in `DealsContext` (see PR 2 step 2).
Ensure `CostBreakdownTab` also re-triggers when cost lines change (already handled
by its own subscription in `DealDetail`).

### PR 4 — End-to-end parity test

Compare `calcNetProfit(deal)` (from enriched deal) vs. `fetchCostSummary(deal.id).total_actual`
for every deal in dev. Confirm zero drift.

### PR 5 — Remove legacy field writes

Once all reads are migrated, stop writing to the flat legacy cost columns on `deals`.
Remove legacy field mappings from `rowToDeal` in `dealsSync.js`.

### PR 6 — Architecture docs

Update `docs/cost-breakdown-architecture.md` with the authoritative data flow diagram.

---

## Summary Table

| # | File | Surface | Reads | Status |
|---|---|---|---|---|
| 1 | `src/data/deals.js` | `calcNetProfit` | 22 legacy columns | ❌ |
| 2 | `src/pages/Dashboard.jsx` | Pipeline/closed profit | via `calcNetProfit` | ❌ |
| 3 | `src/pages/PnlDashboard.jsx` | P&L breakdown | legacy fields + `calcNetProfit` | ❌ |
| 4 | `src/pages/Analytics.jsx` | Profit metrics | via `calcNetProfit` | ❌ |
| 5 | `src/pages/DealOverview.jsx` | Deal card profit | via `calcNetProfit` | ❌ |
| 6 | `src/pages/DueDiligence.jsx` | Deal card profit | via `calcNetProfit` | ❌ |
| 7 | `src/pages/Development.jsx` | Deal card profit | via `calcNetProfit` | ❌ |
| 8 | `src/pages/LandAcquisition.jsx` | Deal card + totalBuild | legacy fields + `calcNetProfit` | ❌ |
| 9 | `src/pages/ArchivedDeals.jsx` | Archived profit | `deal.netProfit` stored | ⚠ |
| 10 | `src/pages/InvestorPortal.jsx` | totalCapital | legacy fields | ❌ |
| 11 | `src/pages/investor/InvestorDeals.jsx` | totalCost | legacy fields | ❌ |
| 12 | `src/pages/investor/InvestorHome.jsx` | cost display | legacy fields | ❌ |
| 13 | `src/pages/investor/InvestorOpportunities.jsx` | totalCost | legacy fields | ❌ |
| 14 | `src/components/investor/DealMetrics.jsx` | Build cost / profit | legacy fields | ❌ |
| 15 | `src/components/investor/YourPosition.jsx` | Projected return | legacy fields | ❌ |
| 16 | `src/lib/investorPortalData.js` | `deployed` metric | legacy fields | ❌ |

**Correct surfaces (no change needed):**
- `src/pages/DealDetail.jsx` — calls `fetchCostSummary`, uses `total_actual` ✅
- `src/components/deal/CostBreakdownTab.jsx` — reads `deal_cost_resolved_view` ✅
- `src/lib/costBreakdownData.js` — write layer goes directly to `deal_cost_lines` ✅
