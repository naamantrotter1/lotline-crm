-- ═══════════════════════════════════════════════════════════════════════
-- 008 · Legacy Commitment Corrective Sizing + commitment_type field
-- Requires: 005_capital_stack.sql, 006_draw_schedules.sql
--
-- Problems fixed:
--   1. Legacy commitments' committed_amount was set from historical cost fields
--      (total_capital_required / investor_capital_contributed), which differ from
--      the actual allocation amounts inserted. This migration resets each legacy
--      commitment's committed_amount to exactly SUM(deal_allocations.amount).
--   2. Adds commitment_type column so UI can distinguish historical legacy
--      commitments from forward-looking active ones.
--
-- Reversible: see DOWN section at bottom.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. Add commitment_type column
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.capital_commitments
  ADD COLUMN IF NOT EXISTS commitment_type TEXT NOT NULL DEFAULT 'active'
  CHECK (commitment_type IN ('legacy', 'active', 'topup', 'oneoff'));

-- ─────────────────────────────────────────────────────────────────────
-- 2. Classify existing rows before correcting amounts
--    Forward-looking named commitments: type = 'active'
--    Auto-created legacy rows: type = 'legacy'
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.capital_commitments
SET commitment_type = 'active'
WHERE name NOT LIKE 'Legacy Commitment%';

UPDATE public.capital_commitments
SET commitment_type = 'legacy'
WHERE name LIKE 'Legacy Commitment%';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Correct committed_amount on every legacy commitment
--    New value = SUM(deal_allocations.amount) for non-returned allocations.
--    Appends a corrective ledger entry per commitment.
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
    -- Actual sum of non-returned allocations against this commitment
    SELECT COALESCE(SUM(da.amount), 0) INTO v_actual_sum
    FROM public.deal_allocations da
    WHERE da.commitment_id = r.id
      AND da.status != 'returned';

    v_delta  := v_actual_sum - COALESCE(r.committed_amount, 0);
    v_reason := CASE WHEN v_delta >= 0 THEN 'commitment_increased' ELSE 'commitment_decreased' END;

    -- Correct the amount and mark as fully deployed (historical, closed to new allocations)
    UPDATE public.capital_commitments
    SET committed_amount = v_actual_sum,
        commitment_type  = 'legacy',
        status           = 'fully_deployed',
        updated_at       = now()
    WHERE id = r.id;

    -- Append corrective ledger entry
    INSERT INTO public.commitment_ledger_entries (
      commitment_id, delta_amount, reason, override_reason
    ) VALUES (
      r.id,
      v_delta,
      v_reason,
      'Migration 008: legacy committed_amount corrected to equal actual allocation sum. '
        || 'Original committed_amount: ' || COALESCE(r.committed_amount::TEXT, 'NULL')
        || ', corrected to: ' || v_actual_sum::TEXT
        || ', delta: ' || v_delta::TEXT
    );

    RAISE NOTICE 'Legacy commitment "%" (%): % → % (delta: %)',
      r.name, r.id,
      COALESCE(r.committed_amount, 0),
      v_actual_sum,
      v_delta;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Update investor_commitment_summary view to expose commitment_type
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.investor_commitment_summary AS
SELECT
  i.id                                                          AS investor_id,
  i.name                                                        AS investor_name,
  cc.id                                                         AS commitment_id,
  cc.name                                                       AS commitment_name,
  cc.committed_amount,
  cc.revolving,
  cc.commitment_type,
  cc.status                                                     AS commitment_status,
  cc.priority_rank,
  cc.commitment_date,
  cc.expiration_date,
  COALESCE(
    SUM(da.amount)
      FILTER (WHERE da.status IN ('planned','committed','funded')),
    0
  )                                                             AS total_allocated,
  CASE
    WHEN cc.committed_amount IS NULL THEN NULL
    ELSE cc.committed_amount
       - COALESCE(
           SUM(da.amount)
             FILTER (WHERE da.status IN ('planned','committed','funded')),
           0
         )
  END                                                           AS remaining_headroom,
  COUNT(DISTINCT da.deal_id)
    FILTER (WHERE da.status IN ('planned','committed','funded'))
                                                                AS active_deals_count
FROM public.investors i
JOIN public.capital_commitments cc ON cc.investor_id = i.id
LEFT JOIN public.deal_allocations da ON da.commitment_id = cc.id
GROUP BY i.id, i.name,
         cc.id, cc.name, cc.committed_amount, cc.revolving, cc.commitment_type,
         cc.status, cc.priority_rank, cc.commitment_date, cc.expiration_date;

-- ─────────────────────────────────────────────────────────────────────
-- End of 008_legacy_commitment_fix.sql
-- ─────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- DOWN (reversible — run manually if needed)
-- ═══════════════════════════════════════════════════════════════════════
-- To reverse:
--   1. Find the migration-008 ledger entries:
--      SELECT * FROM commitment_ledger_entries
--      WHERE override_reason LIKE 'Migration 008:%'
--      ORDER BY created_at;
--   2. For each entry, restore original committed_amount from override_reason text.
--   3. ALTER TABLE public.capital_commitments DROP COLUMN IF EXISTS commitment_type;
--   4. Re-run CREATE OR REPLACE VIEW for investor_commitment_summary without commitment_type.
