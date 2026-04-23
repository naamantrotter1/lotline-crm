-- ═══════════════════════════════════════════════════════════════════════
-- create_organization RPC  (v2 — replaces v1 from create_organization_rpc.sql)
--
-- Called from the Sign-Up page immediately after supabase.auth.signUp()
-- creates the auth user.
--
-- Atomically (in a single transaction):
--   1. Validates inputs (auth required, slug format, name not blank)
--   2. Inserts the organization (status = trialing, trial_ends_at = now + 14 days)
--   3. Inserts an 'owner' membership for the calling user
--   4. Sets profiles.active_organization_id to the new org
--   5. Creates a default 4-stage pipeline (Land Acquisition, Due Diligence,
--      Development, Sales) with normalized slugs
--   6. Creates a starter "Cash" investor for self-funded deals
--   7. Writes an organization.created entry to audit_logs
--
-- Returns the new organization UUID.
--
-- Run this in the Supabase SQL editor (or via Management API).
-- Replaces create_organization_rpc.sql — safe to run again (idempotent slug
-- check in organizations table; v1 function is dropped first).
-- ═══════════════════════════════════════════════════════════════════════

-- Drop old v1 if it exists
DROP FUNCTION IF EXISTS public.create_organization(TEXT, TEXT);

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
  v_org_id    UUID;
  v_uid       UUID := auth.uid();
  v_pipeline  UUID;
BEGIN
  -- ── Guards ─────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_slug !~ '^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug — use lowercase letters, numbers, and hyphens (3–64 chars)';
  END IF;

  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Organization name cannot be blank';
  END IF;

  -- ── 1. Create organization ─────────────────────────────────────────
  INSERT INTO public.organizations (slug, name, status, trial_ends_at, owner_user_id)
  VALUES (
    p_slug,
    trim(p_name),
    'trialing',
    now() + INTERVAL '14 days',
    v_uid
  )
  RETURNING id INTO v_org_id;

  -- ── 2. Owner membership ────────────────────────────────────────────
  INSERT INTO public.memberships (user_id, organization_id, role, status, accepted_at)
  VALUES (v_uid, v_org_id, 'owner', 'active', now());

  -- ── 3. Set active org on profile ──────────────────────────────────
  UPDATE public.profiles
  SET    active_organization_id = v_org_id
  WHERE  id = v_uid;

  -- ── 4. Default pipeline + 4 stages ────────────────────────────────
  INSERT INTO public.pipelines (organization_id, name, slug, sort_order, is_default)
  VALUES (v_org_id, 'Deal Flow', 'deal-flow', 0, true)
  RETURNING id INTO v_pipeline;

  INSERT INTO public.stages (organization_id, pipeline_id, name, slug, sort_order, color)
  VALUES
    (v_org_id, v_pipeline, 'Land Acquisition', 'land-acquisition', 0, '#f59e0b'),
    (v_org_id, v_pipeline, 'Due Diligence',    'due-diligence',    1, '#3b82f6'),
    (v_org_id, v_pipeline, 'Development',       'development',      2, '#8b5cf6'),
    (v_org_id, v_pipeline, 'Sales',             'sales',            3, '#10b981');

  -- ── 5. Starter "Cash" investor ────────────────────────────────────
  -- Represents owner-funded / self-financed deals; every org starts with one.
  INSERT INTO public.investors (organization_id, name, type, notes)
  VALUES (v_org_id, 'Cash', 'individual', 'Self-funded / cash deals');

  -- ── 6. Audit log ──────────────────────────────────────────────────
  INSERT INTO public.audit_logs (organization_id, user_id, action, target_table, target_id, metadata)
  VALUES (
    v_org_id,
    v_uid,
    'organization.created',
    'organizations',
    v_org_id::TEXT,
    jsonb_build_object('slug', p_slug, 'name', trim(p_name), 'source', 'signup')
  );

  RETURN v_org_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL  ON FUNCTION public.create_organization(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT) TO authenticated;
