-- 119 · delete_deal RPC — true hard-delete (companion to archive_deal).
--
-- Until now the client's "delete" path actually called archive_deal (sets
-- is_archived=true). Users want a real, irreversible delete option distinct
-- from archive. This RPC hard-deletes the deal row; foreign keys with
-- ON DELETE CASCADE clean up dependent rows automatically (tasks,
-- activity_notes, deal_events, allocations, milestones, etc.). Soft-deleted
-- archived rows can also be permanently removed via this same RPC.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_deal(p_deal_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authz: caller must be an active member of the deal's organization.
  IF NOT EXISTS (
    SELECT 1
    FROM public.deals d
    JOIN public.memberships m ON m.organization_id = d.organization_id
    WHERE d.id = p_deal_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete deal %', p_deal_id;
  END IF;

  DELETE FROM public.deals WHERE id = p_deal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_deal(text) TO authenticated;

COMMIT;
