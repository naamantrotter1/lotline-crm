-- Migration 106: KPI Goals table for Land Acq Sales dashboard
--
-- Stores editable targets for each KPI card, scoped to org + period + metric.
-- Only admin/owner roles can insert or update goals.

CREATE TABLE IF NOT EXISTS public.kpi_goals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period          TEXT        NOT NULL CHECK (period IN ('weekly','monthly','quarterly','yearly')),
  metric_key      TEXT        NOT NULL,
  target_value    NUMERIC     NOT NULL,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period, metric_key)
);

ALTER TABLE public.kpi_goals ENABLE ROW LEVEL SECURITY;

-- Any active org member can read goals
CREATE POLICY "kpi_goals_select" ON public.kpi_goals FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only admin/owner can create goals
CREATE POLICY "kpi_goals_insert" ON public.kpi_goals FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Only admin/owner can update goals
CREATE POLICY "kpi_goals_update" ON public.kpi_goals FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );
