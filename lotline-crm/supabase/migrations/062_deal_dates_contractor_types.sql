-- ══════════════════════════════════════════════════════════════════════════════
-- 062 · Deal Dates + Contractor Types
--
-- Adds:
--   1. contractor_type column to contacts (e.g. 'Soil Scientist', 'Septic Contractor')
--   2. deal_stage_contacts table — links a pipeline stage → contact for a deal
--      (e.g. deal X's septic contractor is contact Y)
--
-- Important Dates use the existing deal_milestones table (milestone_key + eta).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. contractor_type on contacts ───────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contractor_type text;

-- ── 2. deal_stage_contacts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_stage_contacts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         text        NOT NULL,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage_key       text        NOT NULL,   -- e.g. 'perc_test', 'septic', 'survey'
  contact_id      uuid        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id, stage_key)
);

CREATE INDEX IF NOT EXISTS dsc_deal_idx ON public.deal_stage_contacts(deal_id);
CREATE INDEX IF NOT EXISTS dsc_org_idx  ON public.deal_stage_contacts(organization_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION _set_dsc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_dsc_updated_at ON public.deal_stage_contacts;
CREATE TRIGGER trg_dsc_updated_at
  BEFORE UPDATE ON public.deal_stage_contacts
  FOR EACH ROW EXECUTE FUNCTION _set_dsc_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_stage_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dsc_select" ON public.deal_stage_contacts;
CREATE POLICY "dsc_select" ON public.deal_stage_contacts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "dsc_insert" ON public.deal_stage_contacts;
CREATE POLICY "dsc_insert" ON public.deal_stage_contacts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "dsc_update" ON public.deal_stage_contacts;
CREATE POLICY "dsc_update" ON public.deal_stage_contacts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "dsc_delete" ON public.deal_stage_contacts;
CREATE POLICY "dsc_delete" ON public.deal_stage_contacts FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );
