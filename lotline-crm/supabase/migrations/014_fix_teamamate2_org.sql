-- ═══════════════════════════════════════════════════════════════════════
-- Migration 014: Fix teamamate2@lotlinehomes.com org assignment
--
-- teamamate2 went through onboarding and created their own workspace
-- instead of joining as an operator. This migration:
--   1. Ensures a membership exists in ntrottertest's org
--   2. Sets teamamate2's active_organization_id to ntrottertest's org
--   3. Deletes teamamate2's erroneously created org
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_owner_id      UUID;
  v_teammate_id   UUID;
  v_owner_org_id  UUID;
  v_teammate_org_id UUID;
BEGIN
  -- Resolve user IDs
  SELECT id INTO v_owner_id    FROM auth.users WHERE email = 'ntrottertest@gmail.com';
  SELECT id INTO v_teammate_id FROM auth.users WHERE email = 'teamamate2@lotlinehomes.com';

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'ntrottertest@gmail.com not found in auth.users';
  END IF;
  IF v_teammate_id IS NULL THEN
    RAISE EXCEPTION 'teamamate2@lotlinehomes.com not found in auth.users';
  END IF;

  -- Get ntrottertest's org
  SELECT id INTO v_owner_org_id
    FROM organizations WHERE owner_user_id = v_owner_id
    ORDER BY created_at LIMIT 1;

  IF v_owner_org_id IS NULL THEN
    RAISE EXCEPTION 'Could not find org owned by ntrottertest@gmail.com';
  END IF;

  -- Ensure membership exists in ntrottertest's org
  INSERT INTO memberships (user_id, organization_id, role, status, accepted_at)
  VALUES (v_teammate_id, v_owner_org_id, 'operator', 'active', now())
  ON CONFLICT (user_id, organization_id) DO UPDATE
    SET role = 'operator', status = 'active', accepted_at = now();

  -- Point teamamate2's active org to ntrottertest's org
  UPDATE profiles
  SET active_organization_id = v_owner_org_id
  WHERE id = v_teammate_id;

  -- Delete teamamate2's own org (if they created one)
  SELECT id INTO v_teammate_org_id
    FROM organizations WHERE owner_user_id = v_teammate_id;

  IF v_teammate_org_id IS NOT NULL THEN
    DELETE FROM organizations WHERE id = v_teammate_org_id;
    RAISE NOTICE 'Deleted teamamate2 org: %', v_teammate_org_id;
  END IF;

  RAISE NOTICE 'Done. teamamate2 is now an operator in org: %', v_owner_org_id;
END;
$$;
