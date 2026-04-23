-- ═══════════════════════════════════════════════════════════════════════
-- create_organization RPC
--
-- Called from the Onboarding UI when a new subscriber sets up their
-- workspace for the first time (active_organization_id IS NULL).
--
-- Atomically:
--   1. Inserts a new row into organizations
--   2. Inserts an 'owner' membership for the calling user
--   3. Sets profiles.active_organization_id to the new org
--
-- Run in Supabase SQL editor (or via Management API).
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name TEXT,
  p_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_uid    UUID := auth.uid();
BEGIN
  -- Must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Slug must be URL-safe: lowercase letters, numbers, hyphens only
  IF p_slug !~ '^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug — use lowercase letters, numbers, and hyphens (3–64 chars)';
  END IF;

  -- Name must not be blank
  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name cannot be blank';
  END IF;

  -- Create the organization
  INSERT INTO public.organizations (slug, name, status, owner_user_id)
  VALUES (p_slug, trim(p_name), 'active', v_uid)
  RETURNING id INTO v_org_id;

  -- Make calling user an owner member
  INSERT INTO public.memberships (user_id, organization_id, role, status, accepted_at)
  VALUES (v_uid, v_org_id, 'owner', 'active', now());

  -- Point the user's profile at the new org
  UPDATE public.profiles
  SET    active_organization_id = v_org_id
  WHERE  id = v_uid;

  RETURN v_org_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.create_organization(TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT) TO authenticated;
