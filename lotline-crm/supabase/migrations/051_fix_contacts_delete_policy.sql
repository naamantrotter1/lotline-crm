-- Fix contacts_update RLS policy to allow soft-deletes (setting deleted_at)
-- The live DB had WITH CHECK (deleted_at IS NULL) which blocked soft-delete.

DROP POLICY IF EXISTS "contacts_update" ON contacts;
CREATE POLICY "contacts_update" ON contacts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid()::text AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid()::text AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );
