-- 120_investor_standard_terms.sql
-- Add structured "Standard Terms" columns to investors table.
-- These auto-populate a deal's Financing tab when the investor is selected.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS default_scenario_type        text,
  ADD COLUMN IF NOT EXISTS default_interest_rate        numeric,
  ADD COLUMN IF NOT EXISTS default_hold_period_months   integer,
  ADD COLUMN IF NOT EXISTS default_term_months          integer,
  ADD COLUMN IF NOT EXISTS default_origination_fee_pct  numeric,
  ADD COLUMN IF NOT EXISTS default_origination_fee_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS default_origination_fee_flat numeric,
  ADD COLUMN IF NOT EXISTS default_position             text DEFAULT '1st Position',
  ADD COLUMN IF NOT EXISTS default_preferred_return_pct numeric,
  ADD COLUMN IF NOT EXISTS default_profit_share_pct     numeric,
  ADD COLUMN IF NOT EXISTS default_payment_timing       text DEFAULT 'at_exit',
  ADD COLUMN IF NOT EXISTS default_payment_due_day      text,
  ADD COLUMN IF NOT EXISTS default_draw_fee             numeric,
  ADD COLUMN IF NOT EXISTS default_servicing_fee        numeric,
  ADD COLUMN IF NOT EXISTS default_ltc_pct              numeric,
  ADD COLUMN IF NOT EXISTS default_max_loan_amount      numeric,
  ADD COLUMN IF NOT EXISTS default_extension_available  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_extension_months     integer,
  ADD COLUMN IF NOT EXISTS default_extension_fee_points numeric,
  ADD COLUMN IF NOT EXISTS terms_notes                  text;

-- ── Pre-populate known investors with their existing term sheets ─────────────
-- Low Tide Private Lending — HMCB scenario
UPDATE public.investors SET
  default_scenario_type        = 'hmcb',
  default_interest_rate        = 13.5,
  default_term_months          = 9,
  default_origination_fee_pct  = 2.75,
  default_origination_fee_type = 'percentage',
  default_draw_fee             = 115,
  default_servicing_fee        = 400,
  default_payment_due_day      = '1st',
  default_extension_available  = true,
  default_extension_months     = 3,
  default_extension_fee_points = 1,
  default_position             = '1st Position',
  terms_notes                  = 'Requires MCO, property inspection, insurance with Low Tide as mortgagee, clear title.'
WHERE name ILIKE '%Low Tide%'
  AND organization_id = '2de44796-6002-4379-909d-943892cc25e4';

-- Louis Isom — Hard Money (Land + Home)
UPDATE public.investors SET
  default_scenario_type        = 'hard-money-land-home',
  default_interest_rate        = 13,
  default_hold_period_months   = 6,
  default_origination_fee_pct  = 3,
  default_origination_fee_type = 'percentage',
  default_servicing_fee        = 750,
  default_position             = '1st Position'
WHERE name ILIKE '%Louis Isom%'
  AND organization_id = '2de44796-6002-4379-909d-943892cc25e4';
