-- 115_deals_widen_financing_scenario_check.sql
-- Widens the deals_financing_scenario_type_check constraint to include all
-- 8 scenario db types defined in FINANCING_SCENARIOS (DealDetail.jsx).
--
-- Symptom this fixes: picking certain scenarios (e.g. profit_split,
-- committed_capital_partner, pooled_loan, hard_money_construction_holdback)
-- produced a silent "23514 violates check constraint" Supabase error and the
-- save never persisted — refresh would revert the dropdown to whatever was
-- last allowed.
--
-- Safe to re-run.

BEGIN;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_financing_scenario_type_check;

ALTER TABLE public.deals ADD CONSTRAINT deals_financing_scenario_type_check
  CHECK (financing_scenario_type IS NULL OR financing_scenario_type IN (
    'cash',
    'hard_money_loan',
    'hard_money_land_home',
    'line_of_credit',
    'profit_split',
    'committed_capital_partner',
    'pooled_loan',
    'hard_money_construction_holdback'
  ));

COMMIT;
