-- ═══════════════════════════════════════════════════════════════════════
-- 006-adapted · Draw Schedules (applied AFTER migrations 009 and 010)
--
-- Key differences from original 006:
--  · Tables include organization_id NOT NULL (010's ALTER TABLE failed
--    because these tables didn't exist yet when 010 ran)
--  · Indexes from 010 §3 added here
--  · Auto-fill trigger (trg_auto_org_id) installed on new tables
--  · RLS uses org-scoped helper functions from 010 §7 (not current_role_is)
--  · RLS policies match 010 §8v-8y patterns
--  · Data migration DO blocks include explicit organization_id
--  · Views updated: deal_capital_stack_view uncomments funding columns,
--    deal_draw_schedule_view created (tables now exist)
--  · DROP VIEW for deal_capital_stack_view cascades to downstream views
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. Extend CHECK constraints on existing tables
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_capital_stack_status_check;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_capital_stack_status_check
  CHECK (capital_stack_status IN (
    'draft','partially_funded','fully_funded','over_committed','funding_in_progress'
  ));

ALTER TABLE public.commitment_ledger_entries
  DROP CONSTRAINT IF EXISTS commitment_ledger_entries_reason_check;
ALTER TABLE public.commitment_ledger_entries
  ADD CONSTRAINT commitment_ledger_entries_reason_check
  CHECK (reason IN (
    'allocation_added','allocation_reduced','capital_returned',
    'commitment_increased','commitment_decreased','migration',
    'tranche_scheduled','tranche_called','tranche_funded',
    'tranche_skipped','capital_call_issued'
  ));


-- ─────────────────────────────────────────────────────────────────────
-- 2. Add funding-tracking columns to deal_allocations
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.deal_allocations
  ADD COLUMN IF NOT EXISTS amount_scheduled NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_funded    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funding_status   TEXT          NOT NULL DEFAULT 'not_started'
    CHECK (funding_status IN ('not_started','scheduled','partially_funded','fully_funded'));


-- ─────────────────────────────────────────────────────────────────────
-- 3. Add deal-level funding aggregates
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS funded_to_date    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_to_date NUMERIC(14,2) NOT NULL DEFAULT 0;


-- ─────────────────────────────────────────────────────────────────────
-- 4. draw_schedules
--    organization_id included here because migration 010's ALTER TABLE
--    failed (table didn't exist when 010 ran).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.draw_schedules (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  allocation_id   UUID          NOT NULL REFERENCES public.deal_allocations(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  total_scheduled NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','finalized','in_progress','completed')),
  version         INTEGER       NOT NULL DEFAULT 1,
  edit_reason     TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draw_schedules_org_idx ON public.draw_schedules (organization_id);
ALTER TABLE public.draw_schedules ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────
-- 5. draw_tranches
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.draw_tranches (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  draw_schedule_id      UUID          NOT NULL REFERENCES public.draw_schedules(id) ON DELETE CASCADE,
  sequence              INTEGER       NOT NULL,
  amount                NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  trigger_type          TEXT          NOT NULL DEFAULT 'manual_call'
                                      CHECK (trigger_type IN ('date','milestone','manual_call')),
  trigger_date          DATE,
  trigger_milestone_key TEXT,
  due_date              DATE,
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending','called','funded','late','skipped')),
  called_at             TIMESTAMPTZ,
  funded_at             TIMESTAMPTZ,
  funding_event_id      UUID,         -- FK added below after funding_events exists
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS draw_tranches_org_idx ON public.draw_tranches (organization_id);
ALTER TABLE public.draw_tranches ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────
-- 6. funding_events
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.funding_events (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  deal_id           TEXT          NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  allocation_id     UUID          NOT NULL REFERENCES public.deal_allocations(id) ON DELETE CASCADE,
  tranche_id        UUID,         -- FK added below after draw_tranches exists
  investor_id       UUID          NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  direction         TEXT          NOT NULL CHECK (direction IN ('inbound','outbound')),
  occurred_at       TIMESTAMPTZ   NOT NULL,
  wire_reference    TEXT,
  proof_document_id UUID          REFERENCES public.documents(id) ON DELETE SET NULL,
  notes             TEXT,
  reconciled        BOOLEAN       NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funding_events_org_idx ON public.funding_events (organization_id);
ALTER TABLE public.funding_events ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────
-- 7. capital_calls
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.capital_calls (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  deal_id         TEXT          NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  investor_id     UUID          NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  tranche_ids     UUID[]        NOT NULL,
  issued_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  due_date        DATE          NOT NULL,
  total_amount    NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  status          TEXT          NOT NULL DEFAULT 'draft'
                                CHECK (status IN (
                                  'draft','sent','acknowledged','funded','overdue','canceled'
                                )),
  pdf_url         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capital_calls_org_idx ON public.capital_calls (organization_id);
ALTER TABLE public.capital_calls ENABLE ROW LEVEL SECURITY;


-- Cross-FKs (now that both tables exist)
ALTER TABLE public.draw_tranches
  ADD CONSTRAINT draw_tranches_funding_event_id_fkey
  FOREIGN KEY (funding_event_id) REFERENCES public.funding_events(id) ON DELETE SET NULL;

ALTER TABLE public.funding_events
  ADD CONSTRAINT funding_events_tranche_id_fkey
  FOREIGN KEY (tranche_id) REFERENCES public.draw_tranches(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────
-- Install auto-fill trigger on new tables.
-- Migration 010's trigger loop tried to install trg_auto_org_id on
-- draw_schedules, draw_tranches, funding_events, capital_calls — but
-- those tables didn't exist yet, so the loop failed for them.
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'draw_schedules', 'draw_tranches', 'funding_events', 'capital_calls'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_org_id ON public.%I;
       CREATE TRIGGER trg_auto_org_id
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public._auto_set_org_id();',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- RLS policies: org-scoped (matching 010 §8v-8y)
-- 010 already ran DROP POLICY IF EXISTS for old single-tenant names.
-- ─────────────────────────────────────────────────────────────────────

-- draw_schedules
CREATE POLICY "draw_schedules_org_select" ON public.draw_schedules FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND allocation_id IN (
          SELECT id FROM public.deal_allocations
          WHERE  investor_id     = public.current_investor_id()
            AND  organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "draw_schedules_org_insert" ON public.draw_schedules FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_schedules_org_update" ON public.draw_schedules FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_schedules_org_delete" ON public.draw_schedules FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- draw_tranches
CREATE POLICY "draw_tranches_org_select" ON public.draw_tranches FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND draw_schedule_id IN (
          SELECT ds.id FROM public.draw_schedules ds
          JOIN   public.deal_allocations da ON da.id = ds.allocation_id
          WHERE  da.investor_id     = public.current_investor_id()
            AND  da.organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "draw_tranches_org_insert" ON public.draw_tranches FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_tranches_org_update" ON public.draw_tranches FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_tranches_org_delete" ON public.draw_tranches FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- funding_events
CREATE POLICY "funding_events_org_select" ON public.funding_events FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "funding_events_org_insert" ON public.funding_events FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "funding_events_org_update" ON public.funding_events FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "funding_events_org_delete" ON public.funding_events FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- capital_calls
CREATE POLICY "capital_calls_org_select" ON public.capital_calls FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "capital_calls_org_insert" ON public.capital_calls FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "capital_calls_org_update" ON public.capital_calls FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "capital_calls_org_delete" ON public.capital_calls FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ─────────────────────────────────────────────────────────────────────
-- Data migration: create draw_schedules for all existing allocations.
-- Includes explicit organization_id (auto-fill trigger would fail in
-- migration context since auth.uid() is NULL).
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r              RECORD;
  v_schedule_id  UUID;
  v_tranche_id   UUID;
  v_fe_id        UUID;
  v_org_id       UUID;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'lotline-homes' LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Migration 006: LotLine Homes organization not found. Ensure migration 010 ran first.';
  END IF;

  FOR r IN
    SELECT
      da.id            AS allocation_id,
      da.deal_id,
      da.commitment_id,
      da.investor_id,
      da.amount,
      da.status,
      da.allocated_at,
      i.name           AS investor_name
    FROM public.deal_allocations da
    JOIN public.investors i ON i.id = da.investor_id
    WHERE da.amount > 0
  LOOP
    -- Idempotent: skip if schedule already exists for this allocation
    IF EXISTS (
      SELECT 1 FROM public.draw_schedules WHERE allocation_id = r.allocation_id
    ) THEN CONTINUE; END IF;

    INSERT INTO public.draw_schedules (
      organization_id, allocation_id, name, total_scheduled, status
    ) VALUES (
      v_org_id,
      r.allocation_id,
      r.investor_name || ' — Draw Schedule',
      r.amount,
      CASE WHEN r.status = 'funded' THEN 'completed' ELSE 'draft' END
    ) RETURNING id INTO v_schedule_id;

    INSERT INTO public.draw_tranches (
      organization_id, draw_schedule_id, sequence, amount, trigger_type,
      status, funded_at
    ) VALUES (
      v_org_id, v_schedule_id, 1, r.amount, 'manual_call',
      CASE WHEN r.status = 'funded' THEN 'funded' ELSE 'pending' END,
      CASE WHEN r.status = 'funded' THEN r.allocated_at ELSE NULL END
    ) RETURNING id INTO v_tranche_id;

    IF r.status = 'funded' THEN
      INSERT INTO public.funding_events (
        organization_id, deal_id, allocation_id, tranche_id, investor_id,
        amount, direction, occurred_at, wire_reference, notes, reconciled
      ) VALUES (
        v_org_id, r.deal_id, r.allocation_id, v_tranche_id, r.investor_id,
        r.amount, 'inbound',
        COALESCE(r.allocated_at, now()),
        'LEGACY-MIGRATED',
        'Auto-created by migration 006',
        true
      ) RETURNING id INTO v_fe_id;

      UPDATE public.draw_tranches
        SET funding_event_id = v_fe_id
        WHERE id = v_tranche_id;

      UPDATE public.deal_allocations
        SET amount_funded    = r.amount,
            amount_scheduled = r.amount,
            funding_status   = 'fully_funded'
        WHERE id = r.allocation_id;

      INSERT INTO public.commitment_ledger_entries (
        organization_id, commitment_id, delta_amount, reason, deal_id, allocation_id
      ) VALUES (
        v_org_id, r.commitment_id, r.amount, 'tranche_funded', r.deal_id, r.allocation_id
      );

    ELSE
      UPDATE public.deal_allocations
        SET amount_scheduled = r.amount,
            funding_status   = 'scheduled'
        WHERE id = r.allocation_id;

      INSERT INTO public.commitment_ledger_entries (
        organization_id, commitment_id, delta_amount, reason, deal_id, allocation_id
      ) VALUES (
        v_org_id, r.commitment_id, r.amount, 'tranche_scheduled', r.deal_id, r.allocation_id
      );
    END IF;

  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- Backfill deal-level funding aggregates
-- ─────────────────────────────────────────────────────────────────────

UPDATE public.deals d
SET
  funded_to_date    = COALESCE(agg.funded,    0),
  scheduled_to_date = COALESCE(agg.scheduled, 0)
FROM (
  SELECT
    deal_id,
    SUM(amount_funded)    AS funded,
    SUM(amount_scheduled) AS scheduled
  FROM public.deal_allocations
  GROUP BY deal_id
) agg
WHERE d.id = agg.deal_id;


-- ─────────────────────────────────────────────────────────────────────
-- Seed: Blue Newkirk Rd — 4-tranche Atium schedule
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_deal_id        TEXT;
  v_alloc_id       UUID;
  v_schedule_id    UUID;
  v_t1_id          UUID;
  v_t2_id          UUID;
  v_t3_id          UUID;
  v_t4_id          UUID;
  v_fe_id          UUID;
  v_org_id         UUID;
  v_commitment_id  UUID  := 'cccccccc-0000-0000-0000-000000000001';
  v_investor_id    UUID  := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'lotline-homes' LIMIT 1;

  SELECT id::TEXT INTO v_deal_id
  FROM public.deals
  WHERE address ILIKE '%Blue Newkirk%'
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    RAISE NOTICE 'Seed 006: Blue Newkirk Rd deal not found — skipping draw schedule seed.';
    RETURN;
  END IF;

  SELECT id INTO v_alloc_id
  FROM public.deal_allocations
  WHERE deal_id = v_deal_id
    AND investor_id = v_investor_id
  LIMIT 1;

  IF v_alloc_id IS NULL THEN
    INSERT INTO public.deal_allocations (
      organization_id, deal_id, commitment_id, investor_id,
      amount, percent_of_deal, position,
      preferred_return_pct, status,
      amount_funded, amount_scheduled, funding_status, notes
    ) VALUES (
      v_org_id, v_deal_id, v_commitment_id, v_investor_id,
      300000, 100, '1st Position',
      13, 'committed',
      50000, 225000, 'partially_funded',
      'Seeded by migration 006 — realistic 4-tranche draw schedule'
    ) RETURNING id INTO v_alloc_id;
  ELSE
    UPDATE public.deal_allocations
    SET amount_funded    = 50000,
        amount_scheduled = 225000,
        funding_status   = 'partially_funded'
    WHERE id = v_alloc_id;
  END IF;

  -- Skip if a detailed (multi-tranche) draw schedule already exists
  IF EXISTS (
    SELECT 1 FROM public.draw_schedules ds
    JOIN public.draw_tranches dt ON dt.draw_schedule_id = ds.id
    WHERE ds.allocation_id = v_alloc_id
    HAVING COUNT(dt.id) > 1
  ) THEN
    RAISE NOTICE 'Seed 006: Blue Newkirk draw schedule already seeded — skipping.';
    RETURN;
  END IF;

  -- Remove any placeholder (single-tranche) schedule
  DELETE FROM public.draw_schedules WHERE allocation_id = v_alloc_id;

  INSERT INTO public.draw_schedules (
    organization_id, allocation_id, name, total_scheduled, status
  ) VALUES (
    v_org_id, v_alloc_id,
    'Atium 4-Tranche Construction Draw',
    300000, 'in_progress'
  ) RETURNING id INTO v_schedule_id;

  -- Tranche 1: Contract $50K — FUNDED
  INSERT INTO public.draw_tranches (
    organization_id, draw_schedule_id, sequence, amount, trigger_type,
    trigger_milestone_key, due_date, status, called_at, funded_at
  ) VALUES (
    v_org_id, v_schedule_id, 1, 50000, 'milestone',
    'contract_signed', '2026-04-01', 'funded',
    '2026-03-28 10:00:00+00', '2026-04-01 09:00:00+00'
  ) RETURNING id INTO v_t1_id;

  INSERT INTO public.funding_events (
    organization_id, deal_id, allocation_id, tranche_id, investor_id,
    amount, direction, occurred_at, wire_reference, notes, reconciled
  ) VALUES (
    v_org_id, v_deal_id, v_alloc_id, v_t1_id, v_investor_id,
    50000, 'inbound', '2026-04-01 09:00:00+00',
    'WIRE-ATIUM-001', 'Contract signing draw — confirmed', true
  ) RETURNING id INTO v_fe_id;

  UPDATE public.draw_tranches SET funding_event_id = v_fe_id WHERE id = v_t1_id;

  -- Tranche 2: Foundation $75K — CALLED
  INSERT INTO public.draw_tranches (
    organization_id, draw_schedule_id, sequence, amount, trigger_type,
    trigger_milestone_key, due_date, status, called_at
  ) VALUES (
    v_org_id, v_schedule_id, 2, 75000, 'milestone',
    'site_prep', '2026-05-15', 'called',
    '2026-04-20 14:00:00+00'
  ) RETURNING id INTO v_t2_id;

  -- Tranche 3: Framing $100K — PENDING
  INSERT INTO public.draw_tranches (
    organization_id, draw_schedule_id, sequence, amount, trigger_type,
    trigger_milestone_key, status
  ) VALUES (
    v_org_id, v_schedule_id, 3, 100000, 'milestone',
    'setup', 'pending'
  ) RETURNING id INTO v_t3_id;

  -- Tranche 4: Finishing $75K — PENDING
  INSERT INTO public.draw_tranches (
    organization_id, draw_schedule_id, sequence, amount, trigger_type,
    trigger_milestone_key, status
  ) VALUES (
    v_org_id, v_schedule_id, 4, 75000, 'milestone',
    'finishing', 'pending'
  ) RETURNING id INTO v_t4_id;

  INSERT INTO public.commitment_ledger_entries (
    organization_id, commitment_id, delta_amount, reason, deal_id, allocation_id
  ) VALUES
    (v_org_id, v_commitment_id, 50000,  'tranche_funded',    v_deal_id, v_alloc_id),
    (v_org_id, v_commitment_id, 75000,  'tranche_called',    v_deal_id, v_alloc_id),
    (v_org_id, v_commitment_id, 100000, 'tranche_scheduled', v_deal_id, v_alloc_id),
    (v_org_id, v_commitment_id, 75000,  'tranche_scheduled', v_deal_id, v_alloc_id);

  UPDATE public.deals
  SET funded_to_date    = 50000,
      scheduled_to_date = 225000
  WHERE id = v_deal_id;

  RAISE NOTICE 'Seed 006: Blue Newkirk Rd 4-tranche Atium schedule created (schedule_id: %).', v_schedule_id;
END $$;


-- ─────────────────────────────────────────────────────────────────────
-- Recreate deal_capital_stack_view to include funding columns
-- (migration 010 commented these out; now 006 has added the columns)
-- ─────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.deal_capital_stack_view CASCADE;
CREATE VIEW public.deal_capital_stack_view AS
SELECT
  da.organization_id,
  da.deal_id,
  da.id                                               AS allocation_id,
  da.commitment_id,
  i.id                                                AS investor_id,
  i.name                                              AS investor_name,
  cc.name                                             AS commitment_name,
  da.amount,
  da.percent_of_deal,
  da.position,
  da.preferred_return_pct,
  da.profit_share_pct,
  da.pref_payment_timing,
  da.source_scenario,
  da.status,
  da.funding_status,
  da.amount_scheduled,
  da.amount_funded,
  da.amount - da.amount_funded                        AS amount_outstanding,
  da.allocated_at,
  da.notes,
  SUM(da.amount) OVER (
    PARTITION BY da.deal_id
    ORDER BY da.allocated_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                                                   AS running_total
FROM  public.deal_allocations da
JOIN  public.investors i            ON i.id  = da.investor_id
JOIN  public.capital_commitments cc ON cc.id = da.commitment_id;


-- ─────────────────────────────────────────────────────────────────────
-- Create deal_draw_schedule_view (underlying tables now exist)
-- ─────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.deal_draw_schedule_view CASCADE;
CREATE VIEW public.deal_draw_schedule_view AS
SELECT
  ds.id                   AS schedule_id,
  ds.organization_id,
  ds.allocation_id,
  ds.name                 AS schedule_name,
  ds.status               AS schedule_status,
  ds.total_scheduled,
  da.deal_id,
  da.investor_id,
  i.name                  AS investor_name,
  da.amount               AS allocation_amount,
  da.amount_funded,
  da.funding_status,
  dt.id                   AS tranche_id,
  dt.sequence,
  dt.amount               AS tranche_amount,
  dt.trigger_type,
  dt.trigger_date,
  dt.trigger_milestone_key,
  dt.due_date,
  dt.status               AS tranche_status,
  dt.called_at,
  dt.funded_at,
  dt.funding_event_id,
  dt.notes                AS tranche_notes,
  fe.wire_reference,
  fe.occurred_at          AS funded_occurred_at,
  fe.reconciled
FROM public.draw_schedules ds
JOIN public.deal_allocations da ON da.id = ds.allocation_id
JOIN public.investors i          ON i.id  = da.investor_id
LEFT JOIN public.draw_tranches dt  ON dt.draw_schedule_id = ds.id
LEFT JOIN public.funding_events fe ON fe.id = dt.funding_event_id
ORDER BY ds.allocation_id, dt.sequence;
