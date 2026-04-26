-- ── 1. Fix contacts UPDATE policy (allow soft-delete) ────────────────────────
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

-- ── 2. Activity notes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id             uuid REFERENCES deals(id) ON DELETE CASCADE,
  author_id           uuid NOT NULL,
  body                text NOT NULL,
  mentioned_user_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

ALTER TABLE activity_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_notes_select" ON activity_notes;
CREATE POLICY "activity_notes_select" ON activity_notes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "activity_notes_insert" ON activity_notes;
CREATE POLICY "activity_notes_insert" ON activity_notes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator','viewer')
    )
  );

DROP POLICY IF EXISTS "activity_notes_update" ON activity_notes;
CREATE POLICY "activity_notes_update" ON activity_notes FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "activity_notes_delete" ON activity_notes;
CREATE POLICY "activity_notes_delete" ON activity_notes FOR DELETE
  USING (author_id = auth.uid());

-- ── 3. Deal documents ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id         uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'Other',
  storage_path    text NOT NULL,
  url             text NOT NULL,
  size            bigint,
  uploaded_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deal_documents_select" ON deal_documents;
CREATE POLICY "deal_documents_select" ON deal_documents FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "deal_documents_insert" ON deal_documents;
CREATE POLICY "deal_documents_insert" ON deal_documents FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "deal_documents_delete" ON deal_documents;
CREATE POLICY "deal_documents_delete" ON deal_documents FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );
