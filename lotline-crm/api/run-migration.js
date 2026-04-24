/**
 * One-time migration runner — DELETE AFTER USE
 * GET /api/run-migration?secret=lotline-migrate-2026
 * Uses Supabase Management API to execute DDL.
 */

const PROJECT_REF = 'kukwppzrhbbaxppkvtjs';

const SQL = `
CREATE TABLE IF NOT EXISTS calendar_connections (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider        text        NOT NULL DEFAULT 'google' CHECK (provider IN ('google','outlook')),
  email           text        NOT NULL,
  access_token    text,
  refresh_token   text,
  token_expires_at timestamptz,
  calendar_id     text,
  sync_enabled    boolean     NOT NULL DEFAULT true,
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS meetings (
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
  google_event_id     text,
  google_meet_link    text,
  attendee_emails     text[]      NOT NULL DEFAULT '{}',
  outcome             text,
  scheduler_link_id   uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduler_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  description     text,
  duration_minutes int        NOT NULL DEFAULT 30,
  meeting_type    text        NOT NULL DEFAULT 'video' CHECK (meeting_type IN ('call','video','in-person')),
  active          boolean     NOT NULL DEFAULT true,
  availability    jsonb       NOT NULL DEFAULT '[{"day":1,"start":"09:00","end":"17:00"},{"day":2,"start":"09:00","end":"17:00"},{"day":3,"start":"09:00","end":"17:00"},{"day":4,"start":"09:00","end":"17:00"},{"day":5,"start":"09:00","end":"17:00"}]',
  timezone        text        NOT NULL DEFAULT 'America/New_York',
  buffer_minutes  int         NOT NULL DEFAULT 15,
  max_future_days int         NOT NULL DEFAULT 30,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_scheduler_link_id_fkey'
  ) THEN
    ALTER TABLE meetings ADD CONSTRAINT meetings_scheduler_link_id_fkey
      FOREIGN KEY (scheduler_link_id) REFERENCES scheduler_links(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cal_conn_user   ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_org    ON meetings(organization_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_meetings_contact ON meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meetings_by     ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_sched_slug      ON scheduler_links(slug);
CREATE INDEX IF NOT EXISTS idx_sched_user      ON scheduler_links(user_id);

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_links      ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='calendar_connections' AND policyname='users can manage own calendar_connections') THEN
    CREATE POLICY "users can manage own calendar_connections" ON calendar_connections FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meetings' AND policyname='org members view meetings') THEN
    CREATE POLICY "org members view meetings" ON meetings FOR SELECT USING (organization_id IN (SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meetings' AND policyname='operators can manage meetings') THEN
    CREATE POLICY "operators can manage meetings" ON meetings FOR ALL USING (organization_id IN (SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduler_links' AND policyname='org members view scheduler_links') THEN
    CREATE POLICY "org members view scheduler_links" ON scheduler_links FOR SELECT USING (organization_id IN (SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scheduler_links' AND policyname='users can manage own scheduler_links') THEN
    CREATE POLICY "users can manage own scheduler_links" ON scheduler_links FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
`;

export default async function handler(req, res) {
  if (req.query.secret !== 'lotline-migrate-2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const mgmtToken = process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!mgmtToken) return res.status(500).json({ error: 'No management token' });

  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });

  const result = await r.json();
  if (!r.ok) return res.status(500).json({ error: result });
  return res.status(200).json({ ok: true, result });
}
