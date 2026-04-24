-- Phase 14: Calendar / Google
-- Tables: calendar_connections, meetings, scheduler_links

-- ── calendar_connections ──────────────────────────────────────────────────────
CREATE TABLE calendar_connections (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider        text        NOT NULL DEFAULT 'google' CHECK (provider IN ('google','outlook')),
  email           text        NOT NULL,
  access_token    text,        -- encrypted at rest by Supabase Vault in production
  refresh_token   text,
  token_expires_at timestamptz,
  calendar_id     text,        -- primary calendar ID from provider
  sync_enabled    boolean     NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- ── meetings ─────────────────────────────────────────────────────────────────
CREATE TABLE meetings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id          uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id             text        REFERENCES deals(id) ON DELETE SET NULL,
  created_by          uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  title               text        NOT NULL,
  description         text,
  location            text,
  meeting_type        text        NOT NULL DEFAULT 'call'
                                  CHECK (meeting_type IN ('call','video','in-person','site-visit')),
  status              text        NOT NULL DEFAULT 'scheduled'
                                  CHECK (status IN ('scheduled','completed','cancelled','no-show')),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  all_day             boolean     NOT NULL DEFAULT false,
  google_event_id     text,        -- synced from Google Calendar
  google_meet_link    text,
  attendee_emails     text[]      NOT NULL DEFAULT '{}',
  outcome             text,        -- post-meeting notes
  scheduler_link_id   uuid,        -- if booked via scheduler link
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── scheduler_links ───────────────────────────────────────────────────────────
CREATE TABLE scheduler_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  description     text,
  duration_minutes int        NOT NULL DEFAULT 30,
  meeting_type    text        NOT NULL DEFAULT 'video' CHECK (meeting_type IN ('call','video','in-person')),
  active          boolean     NOT NULL DEFAULT true,
  -- Availability windows stored as [{day: 0-6, start: "09:00", end: "17:00"}]
  availability    jsonb       NOT NULL DEFAULT '[{"day":1,"start":"09:00","end":"17:00"},{"day":2,"start":"09:00","end":"17:00"},{"day":3,"start":"09:00","end":"17:00"},{"day":4,"start":"09:00","end":"17:00"},{"day":5,"start":"09:00","end":"17:00"}]',
  timezone        text        NOT NULL DEFAULT 'America/New_York',
  buffer_minutes  int         NOT NULL DEFAULT 15,
  max_future_days int         NOT NULL DEFAULT 30,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Add scheduler_link FK now that scheduler_links exists
ALTER TABLE meetings
  ADD CONSTRAINT meetings_scheduler_link_id_fkey
  FOREIGN KEY (scheduler_link_id) REFERENCES scheduler_links(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX ON calendar_connections(user_id);
CREATE INDEX ON meetings(organization_id, starts_at);
CREATE INDEX ON meetings(contact_id);
CREATE INDEX ON meetings(deal_id);
CREATE INDEX ON meetings(created_by);
CREATE INDEX ON scheduler_links(slug);
CREATE INDEX ON scheduler_links(user_id);

-- RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_links      ENABLE ROW LEVEL SECURITY;

-- calendar_connections: user can only see/edit their own
CREATE POLICY "users can manage own calendar_connections" ON calendar_connections
  FOR ALL USING (user_id = auth.uid());

-- meetings: all org members view; operators can insert/update; admins can delete
CREATE POLICY "org members view meetings" ON meetings
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "operators can manage meetings" ON meetings
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

-- scheduler_links: owner manages their links; public can read active ones (via service role in edge fn)
CREATE POLICY "org members view scheduler_links" ON scheduler_links
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "users can manage own scheduler_links" ON scheduler_links
  FOR ALL USING (user_id = auth.uid());
