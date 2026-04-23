-- ═══════════════════════════════════════════════════════════════════════
-- 008-adapted · Legacy Commitment Fix (applied AFTER migrations 009 and 010)
--
-- Key differences from original 008:
--  · investor_commitment_summary view uses DROP+CREATE (not CREATE OR REPLACE)
--    because 010 already created it with organization_id; CREATE OR REPLACE
--    cannot change column structure.
--  · View includes organization_id (from 010) AND commitment_type (added here).
--  · View uses orphaned_scenario_change filter from 010's version.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. Add commitment_type column
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.capital_commitments
  ADD COLUMN IF NOT EXISTS commitment_type TEXT NOT NULL DEFAULT 'active'
  CHECK (commitment_type IN ('legacy', 'active', 'topup', 'oneoff'));


-- ─────────────────────────────────────────────────────────────────────
-- 2. Classify existing rows
-- ─────────────────────────────────────────────────────────────────────

UPDATE public.capital_commitments
SET commitment_type = 'active'
WHERE name NOT LIKE 'Legacy Commitment%';

UPDATE public.capital_commitments
SET commitment_type = 'legacy'
WHERE name LIKE 'Legacy Commitment%';


-- ─────────────────────────────────────────────────────────────────────
-- 3. Correct committed_amount on every legacy commitment
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r            RECORD;
  v_actual_sum NUMERIC;
  v_delta      NUMERIC;
  v_reason     TEXT;
BEGIN
  FOR r IN
    SELECT cc.id, cc.name, cc.committed_amount
    FROM public.capital_commitments cc
    WHERE cc.commitment_type = 'legacy'
  LOOP
    SELECT COALESCE(SUM(da.amount), 0) INTO v_actual_sum
    FROM public.deal_allocations da
    WHERE da.commitment_id = r.id
      AND da.status NOT IN ('returned', 'orphaned_scenario_change');

    v_delta  := v_actual_sum - COALESCE(r.committed_amount, 0);
    v_reason := CASE WHEN v_delta >= 0 THEN 'commitment_increased' ELSE 'commitment_decreased' END;

    UPDATE public.capital_commitments
    SET committed_amount = v_actual_sum,
        commitment_type  = 'legacy',
        status           = 'fully_deployed',
        updated_at       = now()
    WHERE id = r.id;

    -- Append corrective ledger entry.
    -- organization_id is set explicitly to avoid trigger failure in migration context.
    INSERT INTO public.commitment_ledger_entries (
      organization_id, commitment_id, delta_amount, reason, override_reason
    )
    SELECT
      cc.organization_id,
      r.id,
      v_delta,
      v_reason,
      'Migration 008: legacy committed_amount corrected to equal actual allocation sum. '
        || 'Original committed_amount: ' || COALESCE(r.committed_amount::TEXT, 'NULL')
        || ', corrected to: ' || v_actual_sum::TEXT
        || ', delta: ' || v_delta::TEXT
    FROM public.capital_commitments cc WHERE cc.id = r.id;

    RAISE NOTICE 'Legacy commitment "%" (%): % → % (delta: %)',
      r.name, r.id,
      COALESCE(r.committed_amount, 0),
      v_actual_sum,
      v_delta;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- 4. Recreate investor_commitment_summary view with:
--    · organization_id (from migration 010)
--    · commitment_type (added in this migration)
--    · orphaned_scenario_change filter (from migration 010)
--
--    Cannot use CREATE OR REPLACE because column structure changed
--    (adding commitment_type) relative to 010's version.
-- ─────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.investor_commitment_summary CASCADE;
CREATE VIEW public.investor_commitment_summary AS
SELECT
  i.organization_id,
  i.id                                                             AS investor_id,
  i.name                                                           AS investor_name,
  cc.id                                                            AS commitment_id,
  cc.name                                                          AS commitment_name,
  cc.committed_amount,
  cc.revolving,
  cc.commitment_type,
  cc.status                                                        AS commitment_status,
  cc.priority_rank,
  cc.commitment_date,
  cc.expiration_date,
  COALESCE(SUM(da.amount) FILTER (
    WHERE da.status NOT IN ('returned','orphaned_scenario_change')
  ), 0)                                                            AS total_allocated,
  CASE
    WHEN cc.committed_amount IS NULL THEN NULL
    ELSE GREATEST(0,
      cc.committed_amount
      - COALESCE(SUM(da.amount) FILTER (
          WHERE da.status NOT IN ('returned','orphaned_scenario_change')
        ), 0)
    )
  END                                                              AS remaining_headroom,
  COUNT(DISTINCT da.deal_id) FILTER (
    WHERE da.status NOT IN ('returned','orphaned_scenario_change')
  )                                                                AS active_deals_count
FROM  public.investors i
JOIN  public.capital_commitments cc ON cc.investor_id = i.id
LEFT JOIN public.deal_allocations da ON da.commitment_id = cc.id
GROUP BY
  i.organization_id, i.id, i.name,
  cc.id, cc.name, cc.committed_amount, cc.revolving, cc.commitment_type,
  cc.status, cc.priority_rank, cc.commitment_date, cc.expiration_date;
