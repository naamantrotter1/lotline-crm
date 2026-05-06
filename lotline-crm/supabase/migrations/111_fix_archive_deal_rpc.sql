-- Migration 111: Ensure archived_at column exists on deals and fix archive_deal RPC
--
-- The previous RPC (migration 110) referenced archived_at = NOW() but no migration
-- added that column to the deals table. If it's missing, every archive_deal() call
-- fails with "column does not exist" — the deal is never archived in Supabase and
-- comes back for all users on the next page refresh.
--
-- This migration is safe to run multiple times (ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION).

-- 1. Ensure archived_at column exists on deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2. Re-create the archive_deal RPC with the correct column reference
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
