-- 059 · Create activity_notes table
-- Stores deal activity feed notes (DB-backed, replaces localStorage notes).

CREATE TABLE IF NOT EXISTS activity_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id             text NOT NULL,
  author_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body                text NOT NULL,
  mentioned_user_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_notes_deal_id_idx ON activity_notes(deal_id);
CREATE INDEX IF NOT EXISTS activity_notes_org_id_idx  ON activity_notes(organization_id);

ALTER TABLE activity_notes ENABLE ROW LEVEL SECURITY;

-- Members of the org can read notes
CREATE POLICY "activity_notes_select" ON activity_notes FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Members can insert notes for their org
CREATE POLICY "activity_notes_insert" ON activity_notes FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND author_id = auth.uid()
  );

-- Authors can delete their own notes; admins/owners can delete any
CREATE POLICY "activity_notes_delete" ON activity_notes FOR DELETE
  USING (
    author_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );
