-- ═══════════════════════════════════════════════════════════════════════
-- 009 · Financing Scenario Type + CCP deal_allocations columns
-- Requires: 005_capital_stack.sql, 006_draw_schedules.sql, 008_legacy_commitment_fix.sql
--
-- Changes:
--   1. deals.financing_scenario_type — enum column for dashboard filtering.
--      Does NOT duplicate capital-stack data; it is the deal-level label only.
--   2. deal_allocations.pref_payment_timing — timing for preferred return payment.
--   3. deal_allocations.source_scenario — marks which allocations were created
--      via a financing scenario panel (e.g. 'committed_capital_partner') so the
--      Capital Stack module can show them as managed vs. manually created.
--   4. deal_allocations.status CHECK — extend to include 'orphaned_scenario_change'.
--   5. Seed: set deal-004 financing_scenario_type = 'committed_capital_partner'.
--
-- Reversible: see DOWN section at bottom.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. deals.financing_scenario_type
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS financing_scenario_type TEXT
  CHECK (financing_scenario_type IN (
    'cash',
    'hard_money_loan',
    'hard_money_land_home',
    'line_of_credit',
    'profit_split',
    'committed_capital_partner'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 2. deal_allocations.pref_payment_timing
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_allocations
  ADD COLUMN IF NOT EXISTS pref_payment_timing TEXT NOT NULL DEFAULT 'at_exit'
  CHECK (pref_payment_timing IN ('at_exit', 'monthly', 'deferred'));

-- ─────────────────────────────────────────────────────────────────────
-- 3. deal_allocations.source_scenario
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_allocations
  ADD COLUMN IF NOT EXISTS source_scenario TEXT
  CHECK (source_scenario IN (
    'committed_capital_partner',
    'hard_money_loan',
    'hard_money_land_home',
    'line_of_credit',
    'profit_split'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 4. deal_allocations.status — extend CHECK to include orphaned_scenario_change
--    PostgreSQL requires DROP + re-ADD for CHECK constraints.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing status CHECK constraint name
  SELECT constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name   = 'deal_allocations'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%status%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.deal_allocations DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.deal_allocations
  ADD CONSTRAINT deal_allocations_status_check
  CHECK (status IN ('planned', 'committed', 'funded', 'returned', 'orphaned_scenario_change'));

-- ─────────────────────────────────────────────────────────────────────
-- 5. Seed: mark deal-004 as committed_capital_partner scenario
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.deals
SET financing_scenario_type = 'committed_capital_partner'
WHERE id = 'deal-004';

-- ─────────────────────────────────────────────────────────────────────
-- End of 009_financing_scenario_type.sql
-- ─────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- DOWN (reversible — run manually if needed)
-- ═══════════════════════════════════════════════════════════════════════
-- ALTER TABLE public.deals DROP COLUMN IF EXISTS financing_scenario_type;
-- ALTER TABLE public.deal_allocations DROP COLUMN IF EXISTS pref_payment_timing;
-- ALTER TABLE public.deal_allocations DROP COLUMN IF EXISTS source_scenario;
-- ALTER TABLE public.deal_allocations DROP CONSTRAINT IF EXISTS deal_allocations_status_check;
-- ALTER TABLE public.deal_allocations ADD CONSTRAINT deal_allocations_status_check
--   CHECK (status IN ('planned','committed','funded','returned'));
