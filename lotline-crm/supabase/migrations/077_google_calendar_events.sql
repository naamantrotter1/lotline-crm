-- 077_google_calendar_events.sql
-- Team Google Calendar events cache + per-user sync tracking.
-- Events are synced server-side (service role) and visible to all active org members.

-- ── Add calendar sync columns to user_integrations ────────────────────────────
ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS calendar_synced_at   timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_is_active   boolean NOT NULL DEFAULT true;

-- ── google_calendar_events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS google_calendar_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_event_id text        NOT NULL,
  calendar_id     text        NOT NULL DEFAULT 'primary',
  title           text,
  description     text,
  location        text,
  start_at        timestamptz,
  end_at          timestamptz,
  all_day         boolean     NOT NULL DEFAULT false,
  is_private      boolean     NOT NULL DEFAULT false,
  html_link       text,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_gcal_events_org   ON google_calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_user  ON google_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_gcal_events_start ON google_calendar_events(start_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE google_calendar_events ENABLE ROW LEVEL SECURITY;

-- All active org members can view events in their org
CREATE POLICY "org members can view gcal events" ON google_calendar_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM org_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can manage their own events (service role bypasses for bulk upserts)
CREATE POLICY "users can manage own gcal events" ON google_calendar_events
  FOR ALL USING (user_id = auth.uid());

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime so CalendarView updates live when new events are synced
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'google_calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE google_calendar_events;
  END IF;
END $$;
