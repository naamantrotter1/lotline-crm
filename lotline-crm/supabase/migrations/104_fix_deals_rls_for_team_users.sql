-- Migration 104: Fix deals RLS policies so team users can save deal data
--
-- Root cause: migrations 010 deals policies used current_org_id() which reads
-- profiles.active_organization_id. If a team user's active_organization_id is
-- not set (or set to a different org), the UPDATE policy silently rejects the
-- write even though the user has an active membership with operator+ role.
--
-- Fix: replace current_org_id()-based checks with direct membership lookup,
-- matching the pattern used by migrations 052 (contacts, activity_notes,
-- deal_documents) and 060 (deal_milestones).

DROP POLICY IF EXISTS "deals_org_select" ON public.deals;
DROP POLICY IF EXISTS "deals_org_insert" ON public.deals;
DROP POLICY IF EXISTS "deals_org_update" ON public.deals;
DROP POLICY IF EXISTS "deals_org_delete" ON public.deals;

-- SELECT: all active members of the org can read deals
CREATE POLICY "deals_member_select" ON public.deals FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- INSERT: operator+ can create deals
CREATE POLICY "deals_member_insert" ON public.deals FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
  );

-- UPDATE: operator+ can update deals
CREATE POLICY "deals_member_update" ON public.deals FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin', 'operator')
    )
  );

-- DELETE: admin+ can delete deals
CREATE POLICY "deals_member_delete" ON public.deals FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );
