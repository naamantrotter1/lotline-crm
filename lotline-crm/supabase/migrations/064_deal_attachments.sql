-- ══════════════════════════════════════════════════════════════════════════════
-- 064 · Deal Attachments
--
-- Replaces base64 DataURL localStorage storage for DDTaskRow file attachments
-- with Supabase Storage (bucket: deal-attachments) + a metadata table.
--
-- Storage path pattern: {organization_id}/{deal_id}/{task_key}/{uuid}.{ext}
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Storage bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('deal-attachments', 'deal-attachments', false, 52428800)   -- 50 MB limit
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ───────────────────────────────────────────────────────────────
-- Path structure: {orgId}/{dealId}/{taskKey}/{filename}
-- First folder component = orgId, which must match user's active membership.

DROP POLICY IF EXISTS "da_storage_select" ON storage.objects;
CREATE POLICY "da_storage_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deal-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "da_storage_insert" ON storage.objects;
CREATE POLICY "da_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deal-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "da_storage_delete" ON storage.objects;
CREATE POLICY "da_storage_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'deal-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

-- ── Metadata table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deal_attachments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         text        NOT NULL,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_key        text        NOT NULL,
  file_name       text        NOT NULL,
  storage_path    text        NOT NULL,
  size_bytes      bigint,
  mime_type       text,
  uploaded_by     uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS da_deal_idx ON public.deal_attachments(deal_id);
CREATE INDEX IF NOT EXISTS da_org_idx  ON public.deal_attachments(organization_id);
CREATE INDEX IF NOT EXISTS da_task_idx ON public.deal_attachments(deal_id, task_key);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.deal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "da_select" ON public.deal_attachments;
CREATE POLICY "da_select" ON public.deal_attachments FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP POLICY IF EXISTS "da_insert" ON public.deal_attachments;
CREATE POLICY "da_insert" ON public.deal_attachments FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));

DROP POLICY IF EXISTS "da_delete" ON public.deal_attachments;
CREATE POLICY "da_delete" ON public.deal_attachments FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));
