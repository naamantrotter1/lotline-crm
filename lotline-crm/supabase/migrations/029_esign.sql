-- Phase 16: E-sign / PandaDoc Integration
-- Tables: esign_connections, esign_templates, esign_envelopes, esign_recipients

CREATE TYPE esign_envelope_status AS ENUM (
  'draft', 'sent', 'partially_signed', 'completed', 'declined', 'voided', 'expired'
);

CREATE TYPE esign_recipient_status AS ENUM (
  'pending', 'sent', 'viewed', 'signed', 'declined'
);

-- OAuth connection per user/org
CREATE TABLE esign_connections (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider        text        NOT NULL DEFAULT 'pandadoc',
  access_token    text        NOT NULL,
  refresh_token   text,
  token_expires_at timestamptz,
  pandadoc_workspace_id text,
  connected_email text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id, provider)
);

-- Reusable templates (synced from PandaDoc)
CREATE TABLE esign_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pandadoc_template_id text   NOT NULL,
  name            text        NOT NULL,
  description     text,
  fields          jsonb       DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  UNIQUE(organization_id, pandadoc_template_id)
);

-- Sent envelopes / documents
CREATE TABLE esign_envelopes (
  id              uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid                  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid                  NOT NULL REFERENCES profiles(id),
  contact_id      uuid                  REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id         text,
  template_id     uuid                  REFERENCES esign_templates(id) ON DELETE SET NULL,
  pandadoc_doc_id text,
  name            text                  NOT NULL,
  status          esign_envelope_status NOT NULL DEFAULT 'draft',
  fields_data     jsonb                 DEFAULT '{}',
  sent_at         timestamptz,
  completed_at    timestamptz,
  declined_at     timestamptz,
  voided_at       timestamptz,
  expires_at      timestamptz,
  pandadoc_view_url text,
  created_at      timestamptz           NOT NULL DEFAULT now(),
  updated_at      timestamptz           NOT NULL DEFAULT now()
);

-- Per-recipient status tracking
CREATE TABLE esign_recipients (
  id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id     uuid                    NOT NULL REFERENCES esign_envelopes(id) ON DELETE CASCADE,
  name            text                    NOT NULL,
  email           text                    NOT NULL,
  role            text                    NOT NULL DEFAULT 'signer',
  status          esign_recipient_status  NOT NULL DEFAULT 'pending',
  signed_at       timestamptz,
  declined_at     timestamptz,
  decline_reason  text,
  created_at      timestamptz             NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON esign_connections(organization_id);
CREATE INDEX ON esign_templates(organization_id);
CREATE INDEX ON esign_envelopes(organization_id);
CREATE INDEX ON esign_envelopes(contact_id);
CREATE INDEX ON esign_envelopes(deal_id);
CREATE INDEX ON esign_envelopes(status);
CREATE INDEX ON esign_recipients(envelope_id);

-- RLS
ALTER TABLE esign_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_envelopes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_recipients  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own esign_connections" ON esign_connections
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "org members read esign_templates" ON esign_templates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "operators manage esign_templates" ON esign_templates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
    )
  );

CREATE POLICY "org members read esign_envelopes" ON esign_envelopes
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "operators manage esign_envelopes" ON esign_envelopes
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
    )
  );

CREATE POLICY "org members read esign_recipients" ON esign_recipients
  FOR SELECT USING (
    envelope_id IN (
      SELECT id FROM esign_envelopes WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );
CREATE POLICY "operators manage esign_recipients" ON esign_recipients
  FOR ALL USING (
    envelope_id IN (
      SELECT id FROM esign_envelopes WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
      )
    )
  );
