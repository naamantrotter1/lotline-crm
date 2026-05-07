-- 112_tasks_relax_delete_policy.sql
-- Relax tasks RLS so any active org member can soft-delete or hard-delete tasks
-- in their org. Previously the UPDATE policy required owner/admin/operator role,
-- which caused "new row violates row-level security policy" errors when other
-- roles (member/viewer/etc.) clicked delete in the sidebar. Hard DELETE had no
-- policy at all so it defaulted to deny.
--
-- Safe to re-run.

BEGIN;

-- Allow any active org member to UPDATE tasks (covers soft-delete via deleted_at).
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE
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

-- Allow any active org member to hard-DELETE tasks in their org.
-- (No prior DELETE policy existed, so DELETE defaulted to deny.)
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

COMMIT;
