# Deal Page — Financing Tab

**Last updated:** 2026-04-25
**Status:** Complete (PRs 1–6). Feature-flag gated: `deal_page.financing_tab`.

---

## What Changed

All financing-related UI that previously lived inline in the **Deal Details** tab (OverviewTab) has been moved to a dedicated **Financing** tab. This is a pure layout relocation — zero behavioral change, zero data-flow change.

| Before | After |
|---|---|
| Financing Scenario section in Deal Details tab | Financing tab (all content) |
| Scenario dropdown + scenario panels in OverviewTab | `FinancingScenarioPanel` component in Financing tab |
| Cost of Capital Summary in OverviewTab | `FinancingScenarioPanel` → Financing tab |
| Capital Tracking in OverviewTab | `FinancingScenarioPanel` → Financing tab |
| Investor Portal Position Data in OverviewTab | `FinancingScenarioPanel` → Financing tab |
| Capital Stack module in OverviewTab | `FinancingScenarioPanel` → Financing tab |
| Scenario Comparison table in OverviewTab | `FinancingScenarioPanel` → Financing tab |

---

## Feature Flag

The Financing tab is gated behind `deal_page.financing_tab`. When the flag is off:
- The **Financing** tab is hidden from the tab strip.
- `FinancingScenarioPanel` is not rendered anywhere.
- The deal page behaves exactly as it did before this feature.

To enable the flag for an org, insert into `org_feature_flags`:

```sql
INSERT INTO org_feature_flags (org_id, flag_key, enabled)
VALUES ('<org_id>', 'deal_page.financing_tab', true)
ON CONFLICT (org_id, flag_key) DO UPDATE SET enabled = true;
```

To roll back, set `enabled = false` — no code changes needed.

---

## Component Map

```
DealDetail.jsx (DealDetailContent)
  │
  ├── All financing state lives here (unchanged):
  │     selectedScenario, interestRate, originationFeeType/Pct/Flat,
  │     servicingFeeType/Flat/Pct, balloonTerm, holdPeriod, monthlyHoldCost,
  │     profitSharePct, capitalDeployedDate, capitalReturnedDate,
  │     investorCapitalContributed, investorEquityPct, projectedPayoutDate,
  │     creditLimit, drawPct, annualFeePct, investorProfitSplitPct,
  │     loanAmountOverride, ccpInvestorId, ccpCommitmentId, ccpAllocationAmount,
  │     ccpPrefReturnPct, ccpProfitSharePct, ccpPrefPaymentTiming,
  │     ccpPosition, ccpTranches
  │
  ├── OverviewTab (Deal Details tab)
  │     Still computes derived financing values for its own ARV/Profit Summary:
  │       activeFinancing, allIn, totalLent, effectiveLoanAmount,
  │       monthlyInterest, originationFee, servicingFee, totalCostOfCapital,
  │       hasFinancing, profitBeforeShare, profitShareAmount, netProfit, roi
  │     These values are NOT displayed in OverviewTab anymore — they feed
  │     the ARV/Profit/ROI summary block at the top of Deal Details.
  │
  └── Financing tab → FinancingScenarioPanel
        Receives all financing state + setters as props.
        Computes the same derived values internally for display.
        readOnly={fromInvestorPortal || !canEdit}
```

---

## FinancingScenarioPanel

**Location:** `src/pages/DealDetail.jsx` (defined before `OverviewTab`, ~line 211)

**What it renders (in order):**
1. Financing Scenario dropdown (`FINANCING_SCENARIOS`)
2. Hard Money panel (when `selectedScenario === 'hard_money'`)
3. Line of Credit panel (when `selectedScenario === 'loc'`)
4. Profit Split / JV panel (when `selectedScenario === 'profit_split'`)
5. Committed Capital Partner panel (`CommittedCapitalPartnerPanel`, when `selectedScenario === 'committed_capital_partner'`)
6. Cost of Capital Summary (when `hasFinancing`)
7. Capital Tracking section
8. Investor Portal Position Data section
9. `CapitalStackModule`
10. Scenario Comparison table

**Props:** All financing state values and their setters, plus `deal`, `costs`, `arv`, `applyScenario`, `readOnly`.

---

## Data Flow (Unchanged)

Auto-save is unchanged. All state lives in `DealDetailContent`. The `useEffect` auto-save fires on any field change and calls `saveDeal(deal, updatedFields)`. No field bindings were modified.

```
User edits a field in FinancingScenarioPanel
         │
         ▼
setter (e.g. setInterestRate) → state in DealDetailContent
         │
         ▼
auto-save useEffect → saveDeal() → Supabase deals table
         │
         ▼
All deal pages update via DealsContext realtime subscription
```

---

## Financing Scenarios

Defined in `FINANCING_SCENARIOS` (module-level constant in `DealDetail.jsx`):

| id | label | financingType | dbType |
|---|---|---|---|
| `hard_money` | Hard Money Loan | `hard_money` | `hard_money` |
| `loc` | Line of Credit | `loc` | `loc` |
| `profit_split` | Profit Split / JV | `profit_split` | `profit_split` |
| `committed_capital_partner` | Committed Capital Partner | `committed_capital_partner` | `committed_capital_partner` |

### Adding a New Scenario

1. Add an entry to `FINANCING_SCENARIOS` in `DealDetail.jsx`.
2. Add a panel block inside `FinancingScenarioPanel` guarded by `selectedScenario === 'your_new_id'`.
3. If new fields are needed, add state in `DealDetailContent` and thread them as props through `FinancingScenarioPanel`.
4. Add the new `dbType` to the `deals` table schema if it needs to be persisted.
5. No tab-strip changes needed — the scenario lives inside the existing Financing tab.

---

## Rollback

1. Set `deal_page.financing_tab` flag to `false` in `org_feature_flags`.
2. The Financing tab disappears immediately — no deploy needed.
3. To fully revert the code: remove `FinancingScenarioPanel` from `DealDetail.jsx`, restore the inline financing block in `OverviewTab`, and remove the `financing` entry from `DealMiddleColumn.ALL_TABS`.

---

## Changelog

| Commit | PR | Description |
|---|---|---|
| `76f50f1` | PR 1 | Add Financing tab to tab strip in `DealMiddleColumn`; feature-flag gate in `DealDetail`; placeholder content |
| `660cb92` | PRs 2–5 | Extract `FinancingScenarioPanel`; render in Financing tab; replace OverviewTab inline block with panel |
| *(current)* | PR 6 | Remove `FinancingScenarioPanel` from OverviewTab — financing now lives exclusively in the Financing tab |
| *(current)* | PR 7 | Add this documentation file |
