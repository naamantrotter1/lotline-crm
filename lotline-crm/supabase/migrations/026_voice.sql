-- Phase 13: Voice / Twilio
-- Table: calls

CREATE TABLE calls (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id         text        REFERENCES deals(id) ON DELETE SET NULL,
  direction       text        NOT NULL CHECK (direction IN ('inbound','outbound')),
  status          text        NOT NULL DEFAULT 'initiated'
                              CHECK (status IN ('initiated','ringing','in-progress','completed','busy','no-answer','canceled','failed')),
  duration_seconds int,
  twilio_sid      text,
  from_number     text,
  to_number       text,
  recording_url   text,
  recording_sid   text,
  transcript      text,
  notes           text,
  outcome         text        CHECK (outcome IN ('answered','voicemail','busy','no-answer','failed') OR outcome IS NULL),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX ON calls(organization_id, started_at DESC);
CREATE INDEX ON calls(contact_id, started_at DESC);
CREATE INDEX ON calls(deal_id);

-- RLS
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view calls" ON calls
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM org_members WHERE user_id = auth.uid() AND status = 'active'));

CREATE POLICY "operators can insert calls" ON calls
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

CREATE POLICY "operators can update calls" ON calls
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin','operator') AND status = 'active'));

CREATE POLICY "admins can delete calls" ON calls
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin') AND status = 'active'));
