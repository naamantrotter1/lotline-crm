-- ══════════════════════════════════════════════════════════════════════════════
-- 063 · Deal Task Statuses
--
-- Replaces per-browser localStorage storage for pipeline task states so all
-- users see the same checkbox/status state across all browsers.
--
-- Stores:
--   • DD pipeline card statuses:   task_key = 'dd_{colKey}'        (complete/in_progress/not_started)
--   • Dev pipeline subtask states: task_key = 'dev_{colKey}_{idx}' (1 or '')
--   • Task-level notes:            task_key = 'dd_{colKey}_notes'
--   • Contractor contact fields:   task_key = 'dd_{colKey}_cont', _phone, _email, _company
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.deal_task_statuses (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         text        NOT NULL,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_key        text        NOT NULL,
  value           text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, organization_id, task_key)
);

CREATE INDEX IF NOT EXISTS dts_deal_idx ON public.deal_task_statuses(deal_id);
CREATE INDEX IF NOT EXISTS dts_org_idx  ON public.deal_task_statuses(organization_id);

CREATE OR REPLACE FUNCTION _set_dts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_dts_updated_at ON public.deal_task_statuses;
CREATE TRIGGER trg_dts_updated_at
  BEFORE UPDATE ON public.deal_task_statuses
  FOR EACH ROW EXECUTE FUNCTION _set_dts_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_task_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dts_select" ON public.deal_task_statuses;
CREATE POLICY "dts_select" ON public.deal_task_statuses FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP POLICY IF EXISTS "dts_insert" ON public.deal_task_statuses;
CREATE POLICY "dts_insert" ON public.deal_task_statuses FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));

DROP POLICY IF EXISTS "dts_update" ON public.deal_task_statuses;
CREATE POLICY "dts_update" ON public.deal_task_statuses FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));

DROP POLICY IF EXISTS "dts_delete" ON public.deal_task_statuses;
CREATE POLICY "dts_delete" ON public.deal_task_statuses FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));
