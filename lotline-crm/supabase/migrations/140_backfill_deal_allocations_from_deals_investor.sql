-- ═══════════════════════════════════════════════════════════════════════════════
-- 140 · Safety-net backfill: deals.investor → deal_allocations
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Context
-- -------
-- We are deprecating `deals.investor` (text) in favor of the richer
-- `deal_allocations` table. Migration 005 did the original backfill, but the
-- legacy `AssignFunderModal` and HMCB lender flows have since continued
-- writing to the text field without always creating allocations. This leaves
-- the operator CRM and the investor portal showing different things.
--
-- This migration is an IDEMPOTENT safety net: for any deal whose text field
-- names a resolvable investor but who has no active allocation for that
-- investor, insert one. Existing allocations (active or returned) are left
-- untouched.
--
-- After app reads/writes cut over to `deal_allocations` (Phases 2 and 3), the
-- text field stops being written. This migration captures any final stragglers.
--
-- Skips:
--   • d.investor IS NULL / '' / 'None'                    (no assignment)
--   • d.investor = 'Cash' but the deal has no org Cash row (no investor row)
--   • Names that don't resolve to an investor row in the same org (RAISE NOTICE)
--   • Deal+investor pairs that already have any allocation (idempotent)
--
-- Idempotent: safe to re-run.

DO $$
DECLARE
  r                 RECORD;
  v_investor_id     UUID;
  v_commitment_id   UUID;
  v_allocation_id   UUID;
  v_amount          NUMERIC;
  v_funding_status  TEXT;
  v_created_count   INT := 0;
  v_skipped_count   INT := 0;
BEGIN
  FOR r IN
    SELECT
      d.id,
      d.investor,
      d.organization_id,
      d.investor_capital_contributed,
      d.financing_scenario_type
    FROM public.deals d
    WHERE d.investor IS NOT NULL
      AND trim(d.investor) NOT IN ('', 'None')
      AND d.organization_id IS NOT NULL
    ORDER BY d.organization_id, d.investor
  LOOP
    -- ── Resolve investor in the deal's organization ─────────────────────────
    SELECT id INTO v_investor_id
    FROM public.investors
    WHERE name = trim(r.investor)
      AND organization_id = r.organization_id
      AND is_archived = false
    LIMIT 1;

    IF v_investor_id IS NULL THEN
      RAISE NOTICE 'Migration 140: investor "%" not found in org %; skipping deal %',
                   r.investor, r.organization_id, r.id;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- ── Skip if any allocation already exists (active or returned) ─────────
    IF EXISTS (
      SELECT 1 FROM public.deal_allocations
      WHERE deal_id = r.id AND investor_id = v_investor_id
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- ── Find or create the legacy commitment for this investor ─────────────
    -- Matches the convention introduced in migration 005.
    SELECT id INTO v_commitment_id
    FROM public.capital_commitments
    WHERE investor_id = v_investor_id
      AND status = 'active'
    ORDER BY created_at
    LIMIT 1;

    IF v_commitment_id IS NULL THEN
      INSERT INTO public.capital_commitments (
        investor_id, name, committed_amount, priority_rank, status, revolving, notes
      ) VALUES (
        v_investor_id,
        'Legacy Commitment — migrated ' || to_char(now(), 'YYYY-MM-DD'),
        NULL,                       -- unlimited; safer for backfill than guessing
        1, 'active', true,
        'Auto-created by migration 140 (deals.investor backfill safety net)'
      ) RETURNING id INTO v_commitment_id;
    END IF;

    -- ── Compute allocation amount (never $0; uses >0 filter convention) ────
    v_amount := COALESCE(r.investor_capital_contributed, 1);
    IF v_amount <= 0 THEN v_amount := 1; END IF;

    v_funding_status := CASE
      WHEN COALESCE(r.investor_capital_contributed, 0) > 0 THEN 'fully_funded'
      ELSE 'not_started'
    END;

    -- ── Insert allocation ──────────────────────────────────────────────────
    INSERT INTO public.deal_allocations (
      deal_id, commitment_id, investor_id, organization_id,
      amount, position, status, funding_status,
      source_scenario, notes
    ) VALUES (
      r.id, v_commitment_id, v_investor_id, r.organization_id,
      v_amount, '1st Position', 'committed', v_funding_status,
      r.financing_scenario_type,
      'Backfilled from deals.investor by migration 140 on ' || to_char(now(), 'YYYY-MM-DD')
    ) RETURNING id INTO v_allocation_id;

    -- ── Append ledger entry for the audit log ──────────────────────────────
    INSERT INTO public.commitment_ledger_entries (
      commitment_id, delta_amount, reason, deal_id, allocation_id
    ) VALUES (
      v_commitment_id, v_amount, 'migration', r.id, v_allocation_id
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  RAISE NOTICE 'Migration 140: created % allocations, skipped % deals',
               v_created_count, v_skipped_count;
END $$;
