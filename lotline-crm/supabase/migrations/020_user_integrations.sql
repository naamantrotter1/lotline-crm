-- 020_user_integrations.sql
-- Phase 3: Email — stores Google OAuth tokens per user so the CRM can
-- send emails via Gmail on their behalf.
-- Safe to re-run (IF NOT EXISTS throughout).

BEGIN;

CREATE TABLE IF NOT EXISTS user_integrations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        text        NOT NULL DEFAULT 'google',
  gmail_email     text,
  access_token    text,
  refresh_token   text,
  token_expiry    timestamptz,
  scopes          text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS user_integrations_user_idx ON user_integrations(user_id);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations_owner_select" ON user_integrations;
CREATE POLICY "integrations_owner_select" ON user_integrations FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "integrations_owner_insert" ON user_integrations;
CREATE POLICY "integrations_owner_insert" ON user_integrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "integrations_owner_update" ON user_integrations;
CREATE POLICY "integrations_owner_update" ON user_integrations FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "integrations_owner_delete" ON user_integrations;
CREATE POLICY "integrations_owner_delete" ON user_integrations FOR DELETE
  USING (user_id = auth.uid());

COMMIT;
