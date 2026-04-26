-- 056 · Add contacts DELETE RLS policy
-- Soft-delete via UPDATE was silently blocked. Switch to hard DELETE
-- with an explicit RLS policy for owner/admin roles.
-- contact_types and contact_deals cascade-delete automatically.

DROP POLICY IF EXISTS "contacts_delete" ON contacts;
CREATE POLICY "contacts_delete" ON contacts FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );
