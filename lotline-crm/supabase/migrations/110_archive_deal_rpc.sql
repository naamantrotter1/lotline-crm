-- Migration 110: Add archive_deal RPC so any active org member can archive a deal
--
-- Problem: The deals_member_update RLS policy only allows operator+ roles to UPDATE.
-- If a team member has a lower role (viewer, member), their archiveDeal() call is
-- silently blocked by RLS — Supabase returns {error: null} but 0 rows are updated.
-- The deal stays is_archived=false in Supabase and reappears on the next loadAllDeals.
--
-- Fix: A SECURITY DEFINER function that any authenticated active org member can call.
-- It verifies membership, then updates is_archived bypassing RLS.
-- This is safe because: (a) callers are auth-checked, (b) it ONLY sets is_archived=true.

CREATE OR REPLACE FUNCTION public.archive_deal(p_deal_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is an active member of the deal's organization
  IF NOT EXISTS (
    SELECT 1
    FROM public.deals d
    JOIN public.memberships m ON m.organization_id = d.organization_id
    WHERE d.id = p_deal_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to archive deal %', p_deal_id;
  END IF;

  UPDATE public.deals
  SET is_archived = true,
      archived_at = NOW()
  WHERE id = p_deal_id;
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.archive_deal(text) TO authenticated;
