-- 060 · Deal documents table + storage bucket
-- deal_id is text (not uuid) because deals use localStorage string IDs.

CREATE TABLE IF NOT EXISTS deal_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id         text NOT NULL,
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'Other',
  storage_path    text NOT NULL,
  url             text NOT NULL,
  size            bigint,
  uploaded_by     uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_documents_deal_id_idx ON deal_documents(deal_id);
CREATE INDEX IF NOT EXISTS deal_documents_org_id_idx  ON deal_documents(organization_id);

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

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-documents', 'deal-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "deal_documents_storage_select" ON storage.objects;
CREATE POLICY "deal_documents_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "deal_documents_storage_insert" ON storage.objects;
CREATE POLICY "deal_documents_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "deal_documents_storage_delete" ON storage.objects;
CREATE POLICY "deal_documents_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'deal-documents' AND auth.role() = 'authenticated');
