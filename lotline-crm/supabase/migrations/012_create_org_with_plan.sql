-- ═══════════════════════════════════════════════════════════════════════
-- Migration 012: Add p_plan / p_seat_limit params to create_organization
--
-- The previous version defaulted all new orgs to 'starter'.
-- Now the checkout flow passes the purchased plan so it is set atomically.
-- Defaults to 'starter' / 1 for backward-compat (e.g. old sign-up page).
-- ═══════════════════════════════════════════════════════════════════════

-- Drop old signatures
DROP FUNCTION IF EXISTS public.create_organization(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_organization(
  p_name       TEXT,
  p_slug       TEXT,
  p_plan       TEXT    DEFAULT 'starter',
  p_seat_limit INTEGER DEFAULT 1
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

  IF p_plan NOT IN ('starter', 'pro', 'scale') THEN
    p_plan := 'starter';
  END IF;

  -- ── 1. Create organization ─────────────────────────────────────────
  INSERT INTO public.organizations (slug, name, status, trial_ends_at, owner_user_id, plan, seat_limit)
  VALUES (
    p_slug,
    trim(p_name),
    'trialing',
    now() + INTERVAL '14 days',
    v_uid,
    p_plan,
    p_seat_limit
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
    jsonb_build_object('slug', p_slug, 'name', trim(p_name), 'plan', p_plan, 'source', 'signup')
  );

  RETURN v_org_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL  ON FUNCTION public.create_organization(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT, TEXT, INTEGER) TO authenticated;
