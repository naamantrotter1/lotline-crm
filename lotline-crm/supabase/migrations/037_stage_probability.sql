-- 037_stage_probability.sql
-- Per-org, per-stage win probability configuration.
-- Operators set these in Settings → Pipeline; displayed on deal cards and reports.

CREATE TABLE IF NOT EXISTS stage_probabilities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pipeline        text NOT NULL,   -- 'land_acquisition' | 'deal_overview'
  stage           text NOT NULL,
  probability_pct int  NOT NULL DEFAULT 0 CHECK (probability_pct BETWEEN 0 AND 100),
  sort_order      int  NOT NULL DEFAULT 0,
  updated_by      uuid REFERENCES auth.users(id),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, pipeline, stage)
);

ALTER TABLE stage_probabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_select" ON stage_probabilities FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "sp_upsert" ON stage_probabilities FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);
CREATE POLICY "sp_update" ON stage_probabilities FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);

-- Seed default probabilities for land_acquisition pipeline
-- (Organizations will inherit these via a function call at org creation,
--  or can seed via the Settings UI. These are reference defaults only.)
-- INSERT INTO stage_probabilities values are handled application-side.

-- ── deal_contacts join table ──────────────────────────────────────────────────
-- Links contacts to deals (many-to-many) for auto-association
CREATE TABLE IF NOT EXISTS deal_contacts (
  deal_id    text NOT NULL,            -- string (deals may live in localStorage)
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role       text DEFAULT 'related',   -- 'seller' | 'buyer' | 'attorney' | 'agent' | 'related'
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS deal_contacts_contact_idx ON deal_contacts(contact_id);
CREATE INDEX IF NOT EXISTS deal_contacts_deal_idx    ON deal_contacts(deal_id);

ALTER TABLE deal_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_select" ON deal_contacts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM contacts c
    JOIN memberships m ON m.organization_id = c.organization_id
    WHERE c.id = deal_contacts.contact_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  )
);
CREATE POLICY "dc_insert" ON deal_contacts FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM contacts c
    JOIN memberships m ON m.organization_id = c.organization_id
    WHERE c.id = deal_contacts.contact_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('owner','admin','operator')
  )
);
CREATE POLICY "dc_delete" ON deal_contacts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM contacts c
    JOIN memberships m ON m.organization_id = c.organization_id
    WHERE c.id = deal_contacts.contact_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('owner','admin','operator')
  )
);
