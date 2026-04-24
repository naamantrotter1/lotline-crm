-- 019_email_logs.sql
-- Phase 3: Email module
-- email_logs: stores outgoing emails sent from the CRM, linked to contacts/deals.
-- Safe to re-run (IF NOT EXISTS throughout).

BEGIN;

-- ── email_logs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id         text,
  to_email        text        NOT NULL,
  to_name         text,
  from_email      text        NOT NULL,
  from_name       text,
  subject         text        NOT NULL,
  body            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent','failed','draft')),
  resend_id       text,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_org_idx     ON email_logs(organization_id);
CREATE INDEX IF NOT EXISTS email_logs_contact_idx ON email_logs(contact_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON email_logs(organization_id, sent_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_select" ON email_logs;
CREATE POLICY "email_logs_select" ON email_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "email_logs_insert" ON email_logs;
CREATE POLICY "email_logs_insert" ON email_logs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

COMMIT;
