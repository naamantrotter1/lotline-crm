-- ═══════════════════════════════════════════════════════════════════════════════
-- 141 · Backfill: ensure every deals.investor assignment has an ACTIVE allocation
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Context
-- -------
-- Migration 140 created allocations for deals.investor values that had NO
-- allocation at all. It deliberately skipped any (deal, investor) pair that
-- already had a row — even if that row was 'returned' or had amount = 0.
-- That preserved historical audit trails, but it also left some deals
-- without an *active* allocation visible to the investor portal (e.g.
-- deals where a previous allocation was returned, then the operator
-- reassigned the same investor via the legacy text dropdown).
--
-- This migration repairs that: for any deal whose .investor text resolves
-- to a real investor and has NO active (status != 'returned', amount > 0)
-- allocation for that investor, insert a new active allocation. Returned
-- and $0 rows are left alone so audit history is preserved.
--
-- Also covers HMCB deals where scenario_data.hmcb.lenderName names an
-- investor but no allocation exists. After this migration ships, the
-- transition fallbacks in the operator UI become defensive only — they
-- shouldn't actually match anything for current data.
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
  v_source_name     TEXT;
  v_created_count   INT := 0;
  v_skipped_count   INT := 0;
BEGIN
  FOR r IN
    SELECT
      d.id,
      d.organization_id,
      d.investor                                          AS text_investor,
      d.scenario_data->'hmcb'->>'lenderName'              AS hmcb_lender,
      d.investor_capital_contributed,
      d.financing_scenario_type,
      d.scenario_data->>'interestRate'                    AS scenario_rate,
      d.scenario_data->>'investorProfitSplitPct'          AS scenario_profit_split
    FROM public.deals d
    WHERE d.organization_id IS NOT NULL
      AND (
            (d.investor IS NOT NULL AND trim(d.investor) NOT IN ('', 'None'))
         OR (d.scenario_data->'hmcb'->>'lenderName') IS NOT NULL
          )
    ORDER BY d.organization_id, d.id
  LOOP
    -- Prefer text field, fall back to HMCB lender name.
    v_source_name := COALESCE(
      NULLIF(trim(r.text_investor), ''),
      NULLIF(trim(r.hmcb_lender),  '')
    );
    IF v_source_name IS NULL OR v_source_name IN ('None', 'Cash') THEN
      -- 'Cash' deliberately skipped — Cash deals don't appear in investor portal
      -- and the Cash 'investor' record is internal-only.
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_investor_id
    FROM public.investors
    WHERE name = v_source_name
      AND organization_id = r.organization_id
      AND is_archived = false
    LIMIT 1;

    IF v_investor_id IS NULL THEN
      RAISE NOTICE 'Migration 141: investor "%" not found in org %; skipping deal %',
                   v_source_name, r.organization_id, r.id;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Skip ONLY if an active, amount>0 allocation already exists for this pair.
    IF EXISTS (
      SELECT 1 FROM public.deal_allocations
      WHERE deal_id     = r.id
        AND investor_id = v_investor_id
        AND status     != 'returned'
        AND amount      > 0
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Find or create the legacy commitment for this investor.
    SELECT id INTO v_commitment_id
    FROM public.capital_commitments
    WHERE investor_id = v_investor_id AND status = 'active'
    ORDER BY created_at
    LIMIT 1;

    IF v_commitment_id IS NULL THEN
      INSERT INTO public.capital_commitments (
        investor_id, organization_id, name, committed_amount,
        priority_rank, status, revolving, notes
      ) VALUES (
        v_investor_id, r.organization_id,
        'Legacy Commitment — migrated ' || to_char(now(), 'YYYY-MM-DD'),
        NULL, 1, 'active', true,
        'Auto-created by migration 141 (deals.investor → deal_allocations backfill)'
      ) RETURNING id INTO v_commitment_id;
    END IF;

    -- Compute allocation amount. Never $0 — would be filtered out by the
    -- portal's amount > 0 rule. Fall back to $1 placeholder when no
    -- investor_capital_contributed is set.
    v_amount := COALESCE(r.investor_capital_contributed, 1);
    IF v_amount <= 0 THEN v_amount := 1; END IF;

    v_funding_status := CASE
      WHEN COALESCE(r.investor_capital_contributed, 0) > 0 THEN 'fully_funded'
      ELSE 'not_started'
    END;

    INSERT INTO public.deal_allocations (
      deal_id, commitment_id, investor_id, organization_id,
      amount, position, status, funding_status,
      preferred_return_pct, profit_share_pct,
      source_scenario, notes
    ) VALUES (
      r.id, v_commitment_id, v_investor_id, r.organization_id,
      v_amount, '1st Position', 'committed', v_funding_status,
      NULLIF(r.scenario_rate, '')::NUMERIC,
      NULLIF(r.scenario_profit_split, '')::NUMERIC,
      r.financing_scenario_type,
      'Backfilled by migration 141 from deals.investor / hmcb.lenderName on ' || to_char(now(), 'YYYY-MM-DD')
    ) RETURNING id INTO v_allocation_id;

    INSERT INTO public.commitment_ledger_entries (
      commitment_id, organization_id, delta_amount, reason, deal_id, allocation_id
    ) VALUES (
      v_commitment_id, r.organization_id, v_amount, 'migration', r.id, v_allocation_id
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  RAISE NOTICE 'Migration 141: created % allocations, skipped %', v_created_count, v_skipped_count;
END $$;
