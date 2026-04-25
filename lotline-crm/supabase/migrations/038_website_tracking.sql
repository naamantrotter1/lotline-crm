-- 038_website_tracking.sql
-- Website tracking pixel: per-org tracked sites + anonymous visit log.
-- The pixel calls Supabase REST API with the anon key; RLS enforces write-only
-- access for visitors and read access only for org members.

-- ── tracked_websites ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracked_websites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pixel_id        uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  domain          text NOT NULL,          -- e.g. 'example.com' (display only)
  name            text,                   -- friendly label, e.g. 'Main Site'
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  UNIQUE (organization_id, domain)
);

ALTER TABLE tracked_websites ENABLE ROW LEVEL SECURITY;

-- Org members can manage their tracked websites
CREATE POLICY "tw_select" ON tracked_websites FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "tw_insert" ON tracked_websites FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin','operator')
  )
);
CREATE POLICY "tw_update" ON tracked_websites FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin','operator')
  )
);
CREATE POLICY "tw_delete" ON tracked_websites FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);

-- ── web_visits ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS web_visits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id        uuid NOT NULL REFERENCES tracked_websites(pixel_id) ON DELETE CASCADE,
  url             text,
  referrer        text,
  user_agent      text,
  screen_width    int,
  screen_height   int,
  visitor_id      text,   -- random UUID stored in visitor's localStorage (pseudonymous)
  session_id      text,   -- random UUID per session (sessionStorage)
  visited_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_visits_pixel_idx    ON web_visits(pixel_id);
CREATE INDEX IF NOT EXISTS web_visits_visited_idx  ON web_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS web_visits_visitor_idx  ON web_visits(visitor_id);

ALTER TABLE web_visits ENABLE ROW LEVEL SECURITY;

-- Public (anon) can insert visits when pixel_id is valid and active
CREATE POLICY "wv_public_insert" ON web_visits FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tracked_websites tw
    WHERE tw.pixel_id = web_visits.pixel_id AND tw.active = true
  )
);

-- Org members can read visits for their pixels
CREATE POLICY "wv_member_select" ON web_visits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tracked_websites tw
    JOIN memberships m ON m.organization_id = tw.organization_id
    WHERE tw.pixel_id = web_visits.pixel_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
);

-- ── Convenience view: visit counts per website ────────────────────────────────
CREATE OR REPLACE VIEW website_visit_counts AS
  SELECT
    tw.id              AS website_id,
    tw.organization_id,
    tw.pixel_id,
    tw.domain,
    tw.name,
    tw.active,
    COUNT(wv.id)                            AS total_visits,
    COUNT(DISTINCT wv.visitor_id)           AS unique_visitors,
    MAX(wv.visited_at)                      AS last_visit_at
  FROM tracked_websites tw
  LEFT JOIN web_visits wv ON wv.pixel_id = tw.pixel_id
  GROUP BY tw.id, tw.organization_id, tw.pixel_id, tw.domain, tw.name, tw.active;
