-- ============================================================
-- Migration 011: Team Management
-- Adds: invitation status/resent_count, org plan/seat_limit,
--       DB-level seat enforcement trigger
-- ============================================================

-- 1. Expand organization_invitations
ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','canceled')),
  ADD COLUMN IF NOT EXISTS resent_count INT NOT NULL DEFAULT 0;

-- Back-fill existing rows
UPDATE organization_invitations
  SET status = 'accepted'
  WHERE accepted_at IS NOT NULL AND status = 'pending';

UPDATE organization_invitations
  SET status = 'expired'
  WHERE accepted_at IS NULL AND expires_at < now() AND status = 'pending';

-- ============================================================
-- 2. Add plan + seat_limit to organizations
-- ============================================================
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter','pro','scale')),
  ADD COLUMN IF NOT EXISTS seat_limit INT NOT NULL DEFAULT 1;

-- starter = 1 seat (Owner only)
-- pro     = 6 seats (Owner + 5 members)
-- scale   = 20 seats (Owner + 19 members, default)
UPDATE organizations SET plan = 'scale', seat_limit = 20
  WHERE slug = 'lotline-homes';

-- All other existing orgs default to starter; update when billing is wired
UPDATE organizations SET plan = 'starter', seat_limit = 1
  WHERE slug != 'lotline-homes';

-- ============================================================
-- 3. Helper: active seat count for an org
-- Counts active memberships + pending non-expired invitations
-- ============================================================
CREATE OR REPLACE FUNCTION org_active_seat_count(p_org_id UUID)
RETURNS INT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    (SELECT COUNT(*)::INT FROM memberships
      WHERE organization_id = p_org_id AND status = 'active')
    +
    (SELECT COUNT(*)::INT FROM organization_invitations
      WHERE organization_id = p_org_id
        AND status = 'pending'
        AND expires_at > now())
$$;

-- ============================================================
-- 4. Trigger: block INSERT on memberships when seat limit hit
-- ============================================================
CREATE OR REPLACE FUNCTION _enforce_seat_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limit INT;
  v_count INT;
BEGIN
  -- Only enforce on new active memberships (not pending/disabled)
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  SELECT seat_limit INTO v_limit
    FROM organizations WHERE id = NEW.organization_id;

  SELECT org_active_seat_count(NEW.organization_id) INTO v_count;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'seat_limit_exceeded: organization % has reached its seat limit of %',
      NEW.organization_id, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_seat_limit ON memberships;
CREATE TRIGGER trg_enforce_seat_limit
  BEFORE INSERT ON memberships
  FOR EACH ROW EXECUTE FUNCTION _enforce_seat_limit();

-- ============================================================
-- 5. Helper: get seat limit for org
-- ============================================================
CREATE OR REPLACE FUNCTION org_seat_limit(p_org_id UUID)
RETURNS INT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT seat_limit FROM organizations WHERE id = p_org_id
$$;

-- ============================================================
-- 6. RLS: expose org plan + seat counts to org members
-- ============================================================
-- (existing orgs_member_select policy already covers SELECT on organizations)
-- No additional policies needed; seat helpers are SECURITY DEFINER

-- ============================================================
-- 7. Index for status on invitations (for pending queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS invitations_status_idx
  ON organization_invitations(organization_id, status)
  WHERE status = 'pending';

-- ============================================================
-- 8. RLS on organization_invitations: allow org members to read
--    their own invitation (for /invite/[token] acceptance flow)
-- ============================================================
DROP POLICY IF EXISTS invitations_self_read ON organization_invitations;
CREATE POLICY invitations_self_read ON organization_invitations
  FOR SELECT USING (
    -- admin/owner see all invitations for their org
    (organization_id = current_org_id() AND can_admin())
    OR
    -- anyone can look up an invitation by token (for acceptance flow)
    -- actual token matching is done in the API layer
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
