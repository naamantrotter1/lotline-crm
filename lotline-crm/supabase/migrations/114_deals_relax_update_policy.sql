-- 114_deals_relax_update_policy.sql
-- Relax deals RLS so any active org member can UPDATE deals in their org.
-- The existing deals_member_update / "admin, editor and agent can update"
-- policies restrict by role, which causes silent save failures (no error,
-- 0 rows updated) when other roles edit the deal page. Symptom: pick a
-- financing scenario, refresh, scenario reverts because the UPDATE was
-- rejected by RLS but the client never sees an error.
--
-- Mirrors the pattern from 112_tasks_relax_delete_policy.sql.
--
-- Safe to re-run.

BEGIN;

-- Replace the role-restricted member update policy with a permissive one
-- (any active org member). The companion "admin, editor and agent" policy
-- can stay; PostgreSQL OR-combines policies, so the broader one wins.
DROP POLICY IF EXISTS "deals_member_update" ON public.deals;
CREATE POLICY "deals_member_update" ON public.deals FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

COMMIT;
