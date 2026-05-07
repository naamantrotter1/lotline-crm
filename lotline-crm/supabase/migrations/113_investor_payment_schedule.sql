-- 113_investor_payment_schedule.sql
-- Track scheduled (and completed) money owed to investors per deal:
--   * Hard-money loans: monthly interest + principal return + origination fee
--   * Profit splits:    capital return + investor profit share
--   * Lines of credit:  monthly interest on amount drawn
--
-- Rows here drive both the operator Financing tab "Payment Schedule" UI and the
-- Investor Portal "Payments" tab. A trigger projects each row into deal_events
-- so payment dates appear on the deal calendar and the global Calendar overview.
--
-- Safe to re-run.

BEGIN;

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investor_payment_schedule (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id             text        NOT NULL,
  investor_id         uuid        NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  deal_allocation_id  uuid        REFERENCES public.deal_allocations(id) ON DELETE SET NULL,
  payment_type        text        NOT NULL
    CHECK (payment_type IN ('interest','principal','origination_fee','profit_share','draw_fee','other')),
  payment_number      integer,
  amount              numeric     NOT NULL,
  due_date            date        NOT NULL,
  status              text        NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','paid','overdue','waived')),
  paid_date           date,
  paid_amount         numeric,
  distribution_id     uuid        REFERENCES public.distributions(id) ON DELETE SET NULL,
  deal_event_id       uuid        REFERENCES public.deal_events(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_deal     ON public.investor_payment_schedule(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_schedule_investor ON public.investor_payment_schedule(investor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_schedule_due      ON public.investor_payment_schedule(due_date, status) WHERE deleted_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._set_ips_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ips_updated_at ON public.investor_payment_schedule;
CREATE TRIGGER trg_ips_updated_at
  BEFORE UPDATE ON public.investor_payment_schedule
  FOR EACH ROW EXECUTE FUNCTION public._set_ips_updated_at();

-- Realtime so the financing tab + investor portal + calendar refresh on changes
ALTER TABLE public.investor_payment_schedule REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'investor_payment_schedule'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.investor_payment_schedule';
  END IF;
END $$;

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.investor_payment_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ips_org_members" ON public.investor_payment_schedule;
CREATE POLICY "ips_org_members" ON public.investor_payment_schedule FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Investor-self read access (investor portal). Mirrors the pattern used by
-- distributions / deal_allocations: investor_users join maps auth.users → investor.
DROP POLICY IF EXISTS "ips_investor_self" ON public.investor_payment_schedule;
CREATE POLICY "ips_investor_self" ON public.investor_payment_schedule FOR SELECT
  USING (
    investor_id IN (
      SELECT investor_id FROM public.investor_users
      WHERE user_id = auth.uid()
    )
  );

-- ── Sync to deal_events ────────────────────────────────────────────────────
-- Mirrors sync_task_to_deal_event in 073: SECURITY DEFINER + _upsert_deal_event
-- keyed on (source_table, source_id). Color tracks status: orange (scheduled),
-- red (overdue), green (paid).
CREATE OR REPLACE FUNCTION public.sync_payment_to_deal_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv_name   text;
  type_label text;
  color      text;
BEGIN
  -- Soft delete: hide the corresponding calendar event
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.deal_events
    SET deleted_at = now(), updated_at = now()
    WHERE source_table = 'investor_payment_schedule' AND source_id = NEW.id::text;
    RETURN NEW;
  END IF;

  -- Skip if logically deleted
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT name INTO inv_name FROM public.investors WHERE id = NEW.investor_id;

  type_label := CASE NEW.payment_type
    WHEN 'interest'        THEN 'Interest Payment'
    WHEN 'principal'       THEN 'Principal Return'
    WHEN 'origination_fee' THEN 'Origination Fee'
    WHEN 'profit_share'    THEN 'Profit Share'
    WHEN 'draw_fee'        THEN 'Draw Fee'
    ELSE initcap(NEW.payment_type)
  END;

  color := CASE NEW.status
    WHEN 'paid'    THEN '#16A34A'
    WHEN 'overdue' THEN '#EF4444'
    WHEN 'waived'  THEN '#9CA3AF'
    ELSE                '#E8642A'
  END;

  PERFORM public._upsert_deal_event(
    NEW.organization_id,
    NEW.deal_id,
    COALESCE(inv_name, 'Investor') || ' — ' || type_label || ' $' ||
      to_char(NEW.amount, 'FM999,999,990.00'),
    'payment_due',
    NEW.due_date::timestamptz,
    NULL,
    true,
    color,
    'investor_payment_schedule',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_to_event ON public.investor_payment_schedule;
CREATE TRIGGER trg_sync_payment_to_event
  AFTER INSERT OR UPDATE ON public.investor_payment_schedule
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_to_deal_event();

COMMIT;
