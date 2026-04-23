# Capital Stack — LotLine CRM

## Overview

The capital stack tracks how each deal is funded: which investors are allocating capital, from which commitments, and whether the deal's full capital requirement is covered.

```
Investor → Capital Commitment → Deal Allocation → Deal
```

| Layer | What it means | Table |
|---|---|---|
| **Investor** | The funding entity (fund, individual, LLC) | `investors` |
| **Commitment** | An investor's declared capacity: how much they're willing to deploy | `capital_commitments` |
| **Allocation** | A slice of a commitment assigned to a specific deal | `deal_allocations` |
| **Deal** | The land deal with a known capital requirement | `deals` |

---

## Commitment Types

Every commitment has a `commitment_type` that controls where it appears in the UI and whether new allocations can be drawn from it.

| Type | Meaning | New allocations allowed? |
|---|---|---|
| `legacy` | Historical commitment migrated from pre-CRM records. Fully deployed; closed to new allocations. | No |
| `active` | Forward-looking commitment with available headroom. | Yes |
| `topup` | Additional capital added on top of an existing active commitment. | Yes |
| `oneoff` | Single-deal commitment. | Yes |

**Rule:** The Add Allocation modal and Auto-Fund only offer `active`, `topup`, and `oneoff` commitments. Legacy commitments are never presented as options.

---

## Allocation Guardrails

Adding or updating an allocation runs two independent capacity checks, in order:

### 1. Deal-level capacity check

`deal_capacity_remaining = deal.total_capital_required − SUM(existing active allocations)`

- If the new amount would push the total above `total_capital_required`, the server rejects with `DEAL_CAPACITY_EXCEEDED`.
- This check is also evaluated client-side in the Add Allocation modal to show a proactive warning before submission.
- If `total_capital_required` is NULL or 0, the deal is unconstrained — no deal-level check is applied.

### 2. Commitment-level headroom check

`headroom = commitment.committed_amount − SUM(allocations against this commitment)`

- If the commitment doesn't have enough remaining headroom, the server rejects with `INSUFFICIENT_HEADROOM`.
- Available headroom for each commitment is shown inline in the modal's commitment dropdown: `"Atium $500K — $326,550 remaining"`.

### Override reason

If either guardrail triggers, the operator can supply an override reason to push past it. The reason is stored in `deal_allocations.override_reason` and logged to `commitment_ledger_entries`. Override reason is only shown when needed — it is not a permanent field on the form.

---

## Deal Page: Health Indicators

The deal page header shows two independent status pills:

### Deal Funding Badge

Scoped to the deal's `total_capital_required` vs. `SUM(deal_allocations.amount)`.

| Status | Condition |
|---|---|
| Draft | No allocations |
| Partially Allocated | `total_allocated < total_capital_required` |
| Fully Allocated | `total_allocated == total_capital_required` |
| Over-Allocated | `total_allocated > total_capital_required` |

### Commitment Health Badge

Scoped only to the investors who have allocations on *this* deal. Flags any commitment where the allocation on this deal exceeds that commitment's remaining headroom.

| Status | Condition |
|---|---|
| Commitments OK | All allocations within headroom |
| N commitment(s) over limit | One or more allocations exceed commitment headroom |

These two badges are independent — a deal can be "Fully Allocated" (good deal coverage) while also showing "1 commitment over limit" (an investor's overall fund is strained), or vice versa.

---

## Deal Page: Funding Sources

Below the allocation table, a chip list shows the distinct investors funding this deal:

```
Atium Build Group LLC — 100%
```

Each chip shows the investor name and their pro-rata share of `total_allocated` on this deal. Chips are read-only; they update automatically as allocations change.

**Commitment headroom is not shown on the deal page.** It appears only in the Add Allocation modal's commitment dropdown (see above). This keeps the deal page focused on deal-level funding, not investor-level capacity.

---

## Fix Button: Over-Allocated Allocations

When an allocation exceeds the deal's capacity, the allocation row shows a Fix button — unless there is no remaining capacity for that slot, in which case it shows "Remove this allocation instead."

| Condition | UI |
|---|---|
| `deal_remaining_for_slot > 0` | "Fix: set amount to $X" — opens modal pre-filled with the correct amount |
| `deal_remaining_for_slot <= 0` | Fix button is hidden; "Remove this allocation instead" shown |

`deal_remaining_for_slot = total_capital_required − SUM(all other active allocations)`

Clicking "Fix" opens the Add Allocation modal with `amount` pre-filled to `deal_remaining_for_slot`. The operator can adjust before saving.

---

## Auto-Fund

Auto-Fund (`autoFundDeal`) distributes a deal's `total_capital_required` across available commitments ranked by `priority_rank`. It only draws from `active`, `topup`, and `oneoff` commitments — legacy commitments are excluded. Each allocation is subject to the same two-layer guardrail as manual additions.

---

## Legacy Commitment Migration

Migration `005_capital_stack.sql` created legacy commitments by summing historical cost fields. Due to a bug, the `committed_amount` on each legacy commitment did not match the actual sum of allocations inserted.

Migration `008_legacy_commitment_fix.sql` corrects this:
- Resets `committed_amount = SUM(deal_allocations.amount)` for every legacy commitment.
- Marks all legacy commitments `status = 'fully_deployed'`.
- Appends a corrective ledger entry per commitment explaining the change.

See `docs/capital-stack-audit.md` for the full audit report and the outstanding deal-004 over-allocation that requires manual operator correction.

---

## Related Docs

- `docs/capital-draws.md` — Draw schedules, tranches, and funding events
- `docs/capital-stack-audit.md` — Audit report: allocations exceeding deal requirements, legacy sizing errors
- `supabase/audit/capital_stack_audit.sql` — Read-only SQL queries to verify allocation integrity
- `supabase/migrations/008_legacy_commitment_fix.sql` — Legacy commitment corrective migration
