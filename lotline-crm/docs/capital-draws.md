# Capital Draw Schedules — LotLine CRM

## Overview

The Draw Schedule system models the reality that an investor rarely wires the full allocation up front. Capital moves through four lifecycle layers:

```
Committed → Scheduled → Funded → Disbursed
```

| Layer | What it means | Table |
|---|---|---|
| **Committed** | Allocation exists; investor has agreed | `deal_allocations` |
| **Scheduled** | Split into tranches with triggers and due dates | `draw_tranches` |
| **Funded** | Investor actually wired the money (confirmed) | `funding_events` |
| **Disbursed** | Money spent from deal account on real expense | `realized_expenses` (deal fields) |

---

## Tables

### `draw_schedules`
One per allocation. Contains the named plan of tranches.

| Column | Type | Description |
|---|---|---|
| `allocation_id` | UUID | Parent `deal_allocations` row |
| `name` | TEXT | e.g. "Atium 4-Tranche Construction Draw" |
| `total_scheduled` | NUMERIC | Cached SUM of active tranches |
| `status` | TEXT | `draft → finalized → in_progress → completed` |
| `version` | INTEGER | Bumped whenever a finalized schedule is edited |
| `edit_reason` | TEXT | Required when editing a finalized schedule |

### `draw_tranches`
Individual funding steps within a schedule.

| Column | Type | Description |
|---|---|---|
| `sequence` | INTEGER | Order within the schedule |
| `amount` | NUMERIC | Dollar amount for this tranche |
| `trigger_type` | TEXT | `date` / `milestone` / `manual_call` |
| `trigger_date` | DATE | Trigger date (when `trigger_type = date`) |
| `trigger_milestone_key` | TEXT | Milestone key (when `trigger_type = milestone`) |
| `due_date` | DATE | When investor must wire by |
| `status` | TEXT | `pending → called → funded` (or `late`, `skipped`) |
| `called_at` | TIMESTAMPTZ | When the capital call was issued |
| `funded_at` | TIMESTAMPTZ | When the wire was confirmed |
| `funding_event_id` | UUID | FK to the `funding_events` row (required for funded) |

### `funding_events`
Source of truth for every dollar that moves.

| Column | Type | Description |
|---|---|---|
| `deal_id` | UUID | Deal |
| `allocation_id` | UUID | Allocation |
| `tranche_id` | UUID | Linked tranche (NULL = unmatched wire) |
| `investor_id` | UUID | Investor who wired |
| `amount` | NUMERIC | Amount wired |
| `direction` | TEXT | `inbound` (investor → deal) / `outbound` (distribution) |
| `occurred_at` | TIMESTAMPTZ | Wire date |
| `wire_reference` | TEXT | Wire reference / memo |
| `reconciled` | BOOLEAN | Operator confirmed receipt |

### `capital_calls`
Formal call document batching one or more tranches.

| Column | Type | Description |
|---|---|---|
| `tranche_ids` | UUID[] | Array of `draw_tranches.id` |
| `issued_at` | TIMESTAMPTZ | When the call was sent |
| `due_date` | DATE | When investor must fund by |
| `total_amount` | NUMERIC | Sum of all tranches in this call |
| `status` | TEXT | `draft → sent → acknowledged → funded / overdue / canceled` |

---

## Business Rules

1. **A tranche cannot be marked `funded` without an associated `funding_events` row.** That row is the source of truth. Use `recordFunding()` — never update `draw_tranches.status` directly.

2. **Schedule totals must equal allocation amount before finalizing.** `finalizeSchedule()` enforces `SUM(tranches.amount) === allocation.amount` within $0.01.

3. **Editing a finalized schedule requires an `edit_reason` and bumps `version`.** The original schedule content is preserved in ledger entries. Use `updateDrawSchedule(id, fields, editReason)`.

4. **Milestone completion auto-flips linked tranches `pending → called`** — never to `funded`. Call `triggerMilestone(dealId, milestoneKey)` when a milestone is marked complete. This fires notifications but requires a separate wire confirmation to reach `funded`.

5. **Preferred return / interest accrues from `funded_at`, not from allocation creation date.** Use `computeAccruedReturn(allocationId)` — it iterates each funded tranche's `funded_at` independently.

6. **Every tranche status transition appends a `commitment_ledger_entries` row** with reason: `tranche_scheduled / tranche_called / tranche_funded / tranche_skipped / capital_call_issued`.

7. **Headroom on commitments remains based on `deal_allocations.amount` (committed)**, not `amount_funded`. Separate metrics: Committed (headroom guardrail) and Cash Deployed (`amount_funded`).

---

## Funding Lifecycle — Step by Step

### 1. Create the allocation
```js
await addAllocation({ dealId, commitmentId, investorId, amount, position })
```
This creates a `deal_allocations` row with `funding_status = 'not_started'`.

### 2. Build the draw schedule
```js
const { schedule } = await createDrawSchedule(allocationId, 'Construction Draw')

await addTranche(schedule.id, {
  sequence: 1, amount: 50000,
  triggerType: 'milestone', triggerMilestoneKey: 'contract_signed',
  dueDate: '2026-04-01',
})
await addTranche(schedule.id, {
  sequence: 2, amount: 75000,
  triggerType: 'milestone', triggerMilestoneKey: 'site_prep',
  dueDate: '2026-05-15',
})
// ... more tranches

await finalizeSchedule(schedule.id)
// → validates SUM === allocation.amount
// → schedule.status = 'finalized'
// → allocation.funding_status = 'scheduled'
```

### 3. Milestone completes → tranche auto-called
When operator marks a milestone complete, call:
```js
const { calledTranches } = await triggerMilestone(dealId, 'contract_signed')
// → tranche.status = 'called', tranche.called_at = now()
// → investor notified: "Capital call: $50,000 due Apr 1 — wire instructions below"
```

### 4. Investor wires → operator records funding
```js
const { event } = await recordFunding({
  dealId, allocationId, trancheId,
  investorId, amount: 50000,
  occurredAt: '2026-04-01T09:00:00Z',
  wireReference: 'WIRE-ATIUM-001',
  notes: 'Contract signing draw'
})
// → funding_events row created (reconciled = false)
// → tranche.status = 'funded', tranche.funded_at set
// → allocation.amount_funded updated
// → deal.funded_to_date updated
// → ledger entry appended
```

### 5. Operator confirms receipt
```js
await confirmFundingEvent(event.id)
// → funding_events.reconciled = true
```

### 6. Unmatched wires
If a wire arrives without a tranche match:
```js
const unmatched = await fetchUnmatchedFundingEvents()
// → shown in Capital Calls Workbench
await matchFundingEventToTranche(eventId, trancheId)
```

---

## Editing a Finalized Schedule

Finalized schedules are locked. To edit:
1. Operator clicks "Edit Schedule" in the UI.
2. A confirmation modal asks for an `edit_reason`.
3. The reason is passed to `updateDrawSchedule(id, fields, editReason)`.
4. `version` increments, `edit_reason` is stored on the schedule.
5. Original tranche data is preserved in ledger history.

---

## Cached Columns (kept in sync automatically)

| Table | Column | Updated by |
|---|---|---|
| `draw_schedules` | `total_scheduled` | `_refreshScheduleTotal()` after any tranche change |
| `deal_allocations` | `amount_funded` | `_refreshAllocationCache()` after any funding event |
| `deal_allocations` | `amount_scheduled` | `_refreshAllocationCache()` |
| `deal_allocations` | `funding_status` | `_refreshAllocationCache()` |
| `deals` | `funded_to_date` | `_refreshDealFundingCache()` |
| `deals` | `scheduled_to_date` | `_refreshDealFundingCache()` |

Never update these manually — use the functions in `drawScheduleData.js`.

---

## Wire Instructions Memo Format

Every tranche gets a recommended memo line: `LotLine-DEAL-{dealNum}-T{sequence}`

Example: `LotLine-DEAL-004-T2` for Blue Newkirk Rd, Tranche 2.

This is generated in the UI from `deal.id` + `tranche.sequence`.

---

## Seed Data

Blue Newkirk Rd (deal-004) ships with a realistic 4-tranche Atium schedule:

| # | Name | Amount | Trigger | Status |
|---|---|---|---|---|
| 1 | Contract Draw | $50,000 | contract_signed | ✓ Funded Apr 1 |
| 2 | Foundation Draw | $75,000 | site_prep | 📞 Called (due May 15) |
| 3 | Framing Draw | $100,000 | setup milestone | ⏳ Pending |
| 4 | Finishing Draw | $75,000 | finishing milestone | ⏳ Pending |

Total: $300,000 committed · $50,000 funded · $225,000 outstanding
