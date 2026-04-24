-- 022_custom_fields.sql
-- Phase 7: Custom Fields
-- Allows orgs to define their own extra fields on contacts and deals.
-- Values are stored in the existing custom_fields JSONB column on contacts
-- and in a new custom_fields column added to deals.
-- Safe to re-run (IF NOT EXISTS / IF NOT EXISTS throughout).

BEGIN;

-- ── custom_field_definitions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type     text        NOT NULL CHECK (entity_type IN ('contact', 'deal')),
  name            text        NOT NULL,
  field_key       text        NOT NULL,   -- slug used as JSONB key, e.g. "annual_revenue"
  field_type      text        NOT NULL DEFAULT 'text'
                  CHECK (field_type IN ('text','number','date','select','checkbox','url')),
  options         jsonb,                  -- ["Option A", "Option B"] for select type
  required        boolean     NOT NULL DEFAULT false,
  sort_order      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entity_type, field_key)
);

CREATE INDEX IF NOT EXISTS custom_fields_org_entity_idx
  ON custom_field_definitions(organization_id, entity_type, sort_order);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- All org members can read field definitions
DROP POLICY IF EXISTS "custom_fields_select" ON custom_field_definitions;
CREATE POLICY "custom_fields_select" ON custom_field_definitions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only owner/admin can create definitions
DROP POLICY IF EXISTS "custom_fields_insert" ON custom_field_definitions;
CREATE POLICY "custom_fields_insert" ON custom_field_definitions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );

-- Only owner/admin can update definitions
DROP POLICY IF EXISTS "custom_fields_update" ON custom_field_definitions;
CREATE POLICY "custom_fields_update" ON custom_field_definitions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );

-- Only owner/admin can delete definitions
DROP POLICY IF EXISTS "custom_fields_delete" ON custom_field_definitions;
CREATE POLICY "custom_fields_delete" ON custom_field_definitions FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );

-- ── Add custom_fields column to deals ────────────────────────────────────────
ALTER TABLE deals ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';

COMMIT;
