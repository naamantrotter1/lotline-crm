-- Phase 12: SMS / Twilio
-- Tables: sms_messages, sms_templates, sms_campaigns, sms_opt_outs

-- ── sms_messages ─────────────────────────────────────────────────────────────
CREATE TABLE sms_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id         text        REFERENCES deals(id) ON DELETE SET NULL,
  campaign_id     uuid,       -- FK added below after sms_campaigns is created
  direction       text        NOT NULL CHECK (direction IN ('inbound','outbound')),
  body            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','queued','sent','delivered','failed','undelivered','received')),
  twilio_sid      text,
  from_number     text,
  to_number       text,
  error_message   text,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

-- ── sms_templates ─────────────────────────────────────────────────────────────
CREATE TABLE sms_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  body            text        NOT NULL,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── sms_campaigns ─────────────────────────────────────────────────────────────
CREATE TABLE sms_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  body             text        NOT NULL,
  template_id      uuid        REFERENCES sms_templates(id) ON DELETE SET NULL,
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sending','sent','paused','cancelled')),
  audience_filter  jsonb       NOT NULL DEFAULT '{}',
  recipient_count  int         NOT NULL DEFAULT 0,
  sent_count       int         NOT NULL DEFAULT 0,
  delivered_count  int         NOT NULL DEFAULT 0,
  failed_count     int         NOT NULL DEFAULT 0,
  opt_out_count    int         NOT NULL DEFAULT 0,
  include_opt_out_footer boolean NOT NULL DEFAULT true,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  created_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Add campaign FK now that sms_campaigns exists
ALTER TABLE sms_messages
  ADD CONSTRAINT sms_messages_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES sms_campaigns(id) ON DELETE SET NULL;

-- ── sms_opt_outs ──────────────────────────────────────────────────────────────
CREATE TABLE sms_opt_outs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number    text        NOT NULL,
  opted_out_at    timestamptz NOT NULL DEFAULT now(),
  opted_in_at     timestamptz,
  UNIQUE(organization_id, phone_number)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX ON sms_messages(organization_id, created_at DESC);
CREATE INDEX ON sms_messages(contact_id, created_at DESC);
CREATE INDEX ON sms_messages(deal_id);
CREATE INDEX ON sms_messages(campaign_id);
CREATE INDEX ON sms_campaigns(organization_id, created_at DESC);
CREATE INDEX ON sms_opt_outs(organization_id, phone_number);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE sms_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_outs  ENABLE ROW LEVEL SECURITY;

-- sms_messages
CREATE POLICY "org members view sms_messages" ON sms_messages
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "operators can insert sms_messages" ON sms_messages
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

CREATE POLICY "operators can update sms_messages" ON sms_messages
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

CREATE POLICY "admins can delete sms_messages" ON sms_messages
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'));

-- sms_templates
CREATE POLICY "org members view sms_templates" ON sms_templates
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "operators can manage sms_templates" ON sms_templates
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

-- sms_campaigns
CREATE POLICY "org members view sms_campaigns" ON sms_campaigns
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "operators can manage sms_campaigns" ON sms_campaigns
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

-- sms_opt_outs
CREATE POLICY "org members view sms_opt_outs" ON sms_opt_outs
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "operators can manage sms_opt_outs" ON sms_opt_outs
  FOR ALL USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));
