-- Migration 016: JV partner invitation links
-- Allows hub orgs to send a signup link that creates a new subscriber org
-- and auto-establishes a JV partnership.

CREATE TABLE IF NOT EXISTS jv_partner_invitations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token               text        UNIQUE NOT NULL,
  hub_org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invitee_email       text        NOT NULL,
  invited_by_user_id  uuid        NOT NULL REFERENCES auth.users(id),
  notes               text,
  status              text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at         timestamptz,
  new_org_id          uuid        REFERENCES organizations(id),
  new_user_id         uuid
);

ALTER TABLE jv_partner_invitations ENABLE ROW LEVEL SECURITY;

-- Hub org members can view invitations for their org
CREATE POLICY "hub members view invitations"
  ON jv_partner_invitations FOR SELECT
  USING (
    hub_org_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Hub org admins/owners can create invitations
CREATE POLICY "hub admins create invitations"
  ON jv_partner_invitations FOR INSERT
  WITH CHECK (
    hub_org_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Hub org admins/owners can update (revoke) invitations
CREATE POLICY "hub admins update invitations"
  ON jv_partner_invitations FOR UPDATE
  USING (
    hub_org_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );
