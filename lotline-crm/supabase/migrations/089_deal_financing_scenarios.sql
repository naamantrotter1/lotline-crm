-- ─────────────────────────────────────────────────────────────────────────────
-- 089 · deal_financing_scenarios — dedicated per-deal financing table
--
-- Purpose: Replaces storing financing data as JSONB in deals.scenario_data with
-- a proper relational table. Each deal can have one row per scenario_type.
-- This enables reliable Supabase Realtime, structured queries, and per-scenario
-- restore-on-switch behaviour.
--
-- Also ensures migrations 086/087/088 columns exist (idempotent IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure prerequisite columns on deals table (safe if already applied)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS scenario_data          jsonb,
  ADD COLUMN IF NOT EXISTS capital_deployed_date  date,
  ADD COLUMN IF NOT EXISTS capital_returned_date  date,
  ADD COLUMN IF NOT EXISTS investor_paid_out       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_url            text,
  ADD COLUMN IF NOT EXISTS contract_signed_at     timestamptz;

-- ── Main table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_financing_scenarios (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid,
  deal_id          text        NOT NULL,
  scenario_type    text        NOT NULL,
    -- matches FINANCING_SCENARIOS dbType: 'cash' | 'hard_money_loan' |
    -- 'hard_money_land_home' | 'line_of_credit' | 'profit_split' |
    -- 'committed_capital_partner' | 'pooled_loan' | 'hard_money_construction_holdback'

  -- Lender / Loan Terms
  lender_name                  text,
  annual_interest_rate         numeric,
  hold_period_months           integer,
  total_loan_amount            numeric,
  capital_deployed_date        date,
  capital_returned_date        date,

  -- Extension Option
  extension_option_enabled     boolean  DEFAULT false,
  extension_period_months      integer,
  extension_fee_percent        numeric,

  -- Fees (Hard Money specific)
  origination_fee_percent      numeric,
  servicing_fee                numeric,
  draw_fee_per_draw            numeric,
  underwriting_admin_fee       numeric,
  attorney_doc_prep_fee        numeric,

  -- Cash
  cash_source                  text,

  -- Line of Credit
  credit_limit                 numeric,
  draw_amount                  numeric,
  annual_fee_pct               numeric,

  -- Investor Assignment (shared across scenarios)
  investor_name                text,
  investor_capital_contributed numeric,
  investor_return_type         text,
  investor_projected_payout_date date,
  investor_assignment_status   text     DEFAULT 'Committed',
  investor_profit_split_pct    numeric,

  -- Overflow JSON for CCP, HMCB, and future scenario fields
  extra_data                   jsonb,

  created_at  timestamptz  DEFAULT now(),
  updated_at  timestamptz  DEFAULT now(),

  UNIQUE (deal_id, scenario_type)
);

CREATE INDEX IF NOT EXISTS idx_dfs_deal_id
  ON public.deal_financing_scenarios (deal_id);

CREATE INDEX IF NOT EXISTS idx_dfs_org
  ON public.deal_financing_scenarios (organization_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.deal_financing_scenarios ENABLE ROW LEVEL SECURITY;

-- Any active org member can read financing scenarios for deals in their org
CREATE POLICY "dfs_select" ON public.deal_financing_scenarios
  FOR SELECT USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Any active org member can insert (not just owner/admin)
CREATE POLICY "dfs_insert" ON public.deal_financing_scenarios
  FOR INSERT WITH CHECK (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Any active org member can update
CREATE POLICY "dfs_update" ON public.deal_financing_scenarios
  FOR UPDATE USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM public.memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime publication so the frontend subscription fires on changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_financing_scenarios;

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS dfs_updated_at ON public.deal_financing_scenarios;
CREATE TRIGGER dfs_updated_at
  BEFORE UPDATE ON public.deal_financing_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
