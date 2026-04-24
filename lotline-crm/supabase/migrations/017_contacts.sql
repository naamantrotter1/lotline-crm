-- 017_contacts.sql
-- Phase 1: Contacts module
-- Creates contacts, contact_types, contact_relationships, contact_deals with full RLS.
-- Safe to re-run (IF NOT EXISTS throughout).

BEGIN;

-- ── contacts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name        text        NOT NULL DEFAULT '',
  last_name         text        NOT NULL DEFAULT '',
  email             text,
  phone             text,
  secondary_phone   text,
  company           text,
  title             text,
  address           jsonb       NOT NULL DEFAULT '{}',
  lead_source       text,
  owner_user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tags              text[]      NOT NULL DEFAULT '{}',
  custom_fields     jsonb       NOT NULL DEFAULT '{}',
  lifecycle_stage   text        NOT NULL DEFAULT 'new'
                    CHECK (lifecycle_stage IN ('new','working','qualified','customer','dormant')),
  do_not_contact    boolean     NOT NULL DEFAULT false,
  notes             text,
  last_contacted_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  import_batch_id   uuid
);

CREATE INDEX IF NOT EXISTS contacts_org_idx       ON contacts(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_email_org_idx ON contacts(organization_id, lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_lifecycle_idx ON contacts(organization_id, lifecycle_stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_owner_idx     ON contacts(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contacts_search_idx    ON contacts USING gin(
  (to_tsvector('english', coalesce(first_name,'') || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(company,'')))
) WHERE deleted_at IS NULL;

-- ── contact_types (multi-select) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_types (
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('lead','seller','buyer','investor','attorney','contractor','agent','vendor','other')),
  PRIMARY KEY (contact_id, type)
);

-- ── contact_relationships ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_relationships (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id       uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  b_id       uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('spouse','parent','child','partner','referrer','referred_by','colleague','attorney_for','other')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_relationship CHECK (a_id <> b_id),
  CONSTRAINT unique_relationship   UNIQUE (a_id, b_id, type)
);

-- ── contact_deals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_deals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id    text        NOT NULL,
  role       text        NOT NULL DEFAULT 'other'
             CHECK (role IN ('seller','buyer','investor','attorney','contractor','primary','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_contact_deal_role UNIQUE (contact_id, deal_id, role)
);

CREATE INDEX IF NOT EXISTS contact_deals_deal_idx    ON contact_deals(deal_id);
CREATE INDEX IF NOT EXISTS contact_deals_contact_idx ON contact_deals(contact_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _set_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION _set_contacts_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE contacts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_types         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_deals         ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller an active member of the given org with one of the allowed roles?
-- (Inline subqueries keep RLS policies readable and avoid creating functions that need SECURITY DEFINER.)

-- contacts ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contacts_select" ON contacts;
CREATE POLICY "contacts_select" ON contacts FOR SELECT
  USING (
    deleted_at IS NULL AND
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "contacts_insert" ON contacts;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "contacts_update" ON contacts;
CREATE POLICY "contacts_update" ON contacts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

-- Soft-delete via UPDATE deleted_at — hard DELETE is service-role only.

-- contact_types ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contact_types_select" ON contact_types;
CREATE POLICY "contact_types_select" ON contact_types FOR SELECT
  USING (contact_id IN (SELECT id FROM contacts));

DROP POLICY IF EXISTS "contact_types_insert" ON contact_types;
CREATE POLICY "contact_types_insert" ON contact_types FOR INSERT
  WITH CHECK (
    contact_id IN (
      SELECT c.id FROM contacts c
      INNER JOIN memberships m ON m.organization_id = c.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role IN ('owner','admin','operator')
        AND c.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "contact_types_delete" ON contact_types;
CREATE POLICY "contact_types_delete" ON contact_types FOR DELETE
  USING (
    contact_id IN (
      SELECT c.id FROM contacts c
      INNER JOIN memberships m ON m.organization_id = c.organization_id
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND m.role IN ('owner','admin','operator')
    )
  );

-- contact_relationships ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contact_rels_select" ON contact_relationships;
CREATE POLICY "contact_rels_select" ON contact_relationships FOR SELECT
  USING (a_id IN (SELECT id FROM contacts) OR b_id IN (SELECT id FROM contacts));

DROP POLICY IF EXISTS "contact_rels_insert" ON contact_relationships;
CREATE POLICY "contact_rels_insert" ON contact_relationships FOR INSERT
  WITH CHECK (
    a_id IN (SELECT id FROM contacts) AND b_id IN (SELECT id FROM contacts)
  );

DROP POLICY IF EXISTS "contact_rels_delete" ON contact_relationships;
CREATE POLICY "contact_rels_delete" ON contact_relationships FOR DELETE
  USING (a_id IN (SELECT id FROM contacts));

-- contact_deals ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contact_deals_select" ON contact_deals;
CREATE POLICY "contact_deals_select" ON contact_deals FOR SELECT
  USING (contact_id IN (SELECT id FROM contacts));

DROP POLICY IF EXISTS "contact_deals_insert" ON contact_deals;
CREATE POLICY "contact_deals_insert" ON contact_deals FOR INSERT
  WITH CHECK (contact_id IN (SELECT id FROM contacts));

DROP POLICY IF EXISTS "contact_deals_delete" ON contact_deals;
CREATE POLICY "contact_deals_delete" ON contact_deals FOR DELETE
  USING (contact_id IN (SELECT id FROM contacts));

COMMIT;
