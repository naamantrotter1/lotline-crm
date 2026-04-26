-- ═══════════════════════════════════════════════════════════════════════
-- 054 · Hard Money – Construction Holdback (HMCB) financing scenario
--
-- Changes:
--   1. Add 'hard_money_construction_holdback' to deals.financing_scenario_type CHECK
--   2. Add 'hard_money_construction_holdback' to deal_allocations.source_scenario CHECK
--   3. Create hmcb_draws table  (draw schedule per deal)
--   4. Create hmcb_checklist_items table (required-before-closing checklist per deal)
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. Extend deals.financing_scenario_type CHECK
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'deals'
      AND constraint_type = 'CHECK' AND constraint_name LIKE '%financing_scenario_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_financing_scenario_type_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_financing_scenario_type_check
  CHECK (financing_scenario_type IN (
    'cash',
    'hard_money_loan',
    'hard_money_land_home',
    'line_of_credit',
    'profit_split',
    'committed_capital_partner',
    'pooled_loan',
    'hard_money_construction_holdback'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 2. Extend deal_allocations.source_scenario CHECK
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'deal_allocations'
      AND constraint_type = 'CHECK' AND constraint_name LIKE '%source_scenario%'
  LOOP
    EXECUTE format('ALTER TABLE public.deal_allocations DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.deal_allocations
  ADD CONSTRAINT deal_allocations_source_scenario_check
  CHECK (source_scenario IN (
    'committed_capital_partner',
    'hard_money_loan',
    'hard_money_land_home',
    'line_of_credit',
    'profit_split',
    'hard_money_construction_holdback'
  ));

-- ─────────────────────────────────────────────────────────────────────
-- 3. hmcb_draws — draw schedule for construction holdback loans
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hmcb_draws (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          TEXT NOT NULL,
  draw_number      INTEGER NOT NULL,
  date_requested   DATE,
  amount_requested NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','paid')),
  date_paid        DATE,
  draw_fee         NUMERIC(10,2) NOT NULL DEFAULT 115,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hmcb_draws_deal_id_idx ON public.hmcb_draws (deal_id);

ALTER TABLE public.hmcb_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hmcb_draws_select" ON public.hmcb_draws FOR SELECT
  USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "hmcb_draws_insert" ON public.hmcb_draws FOR INSERT
  WITH CHECK (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

CREATE POLICY "hmcb_draws_update" ON public.hmcb_draws FOR UPDATE
  USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

CREATE POLICY "hmcb_draws_delete" ON public.hmcb_draws FOR DELETE
  USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- 4. hmcb_checklist_items — required-before-closing checklist
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hmcb_checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    TEXT NOT NULL,
  label      TEXT NOT NULL,
  checked    BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hmcb_checklist_deal_id_idx ON public.hmcb_checklist_items (deal_id);

ALTER TABLE public.hmcb_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hmcb_checklist_select" ON public.hmcb_checklist_items FOR SELECT
  USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "hmcb_checklist_insert" ON public.hmcb_checklist_items FOR INSERT
  WITH CHECK (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

CREATE POLICY "hmcb_checklist_update" ON public.hmcb_checklist_items FOR UPDATE
  USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );

CREATE POLICY "hmcb_checklist_delete" ON public.hmcb_checklist_items FOR DELETE
  USING (
    deal_id IN (
      SELECT id::text FROM public.deals
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('owner','admin','operator')
      )
    )
  );
