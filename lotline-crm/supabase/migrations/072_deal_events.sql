-- 072 · Unified deal_events table
-- Stores all calendar events for all deals (manual + auto-synced from triggers).

CREATE TABLE IF NOT EXISTS public.deal_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id             text        NOT NULL,
  title               text        NOT NULL,
  description         text,
  event_type          text        NOT NULL DEFAULT 'manual',
    -- manual | meeting | task | milestone | stage_change
    -- perc_test | land_survey | permit | closing | inspection | contractor | delivery | deadline
  start_at            timestamptz NOT NULL,
  end_at              timestamptz,
  all_day             boolean     NOT NULL DEFAULT false,
  location            text,
  created_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name     text,
  color               text,
  source_table        text,   -- 'tasks' | 'deal_milestones' | 'activity_notes' | null
  source_id           text,   -- originating record id for dedup
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deal_events_deal_id   ON public.deal_events(deal_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_events_org_id    ON public.deal_events(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_events_start_at  ON public.deal_events(start_at)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_events_source    ON public.deal_events(source_table, source_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._set_deal_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_deal_events_updated_at ON public.deal_events;
CREATE TRIGGER trg_deal_events_updated_at
  BEFORE UPDATE ON public.deal_events
  FOR EACH ROW EXECUTE FUNCTION public._set_deal_events_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;

-- Any active org member can read events
CREATE POLICY "deal_events_select" ON public.deal_events FOR SELECT
  USING (
    deleted_at IS NULL AND
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Any active org member can insert events for their org
CREATE POLICY "deal_events_insert" ON public.deal_events FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Any active org member can update events in their org (for soft-delete + edits)
CREATE POLICY "deal_events_update" ON public.deal_events FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ── Realtime ───────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_events;
