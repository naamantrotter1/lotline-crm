-- 034_esign_v2.sql
-- Creates all esign tables from scratch with correct RLS policies.
-- (Previously 029_esign.sql had broken RLS using organization_members which doesn't exist;
--  this replaces it entirely.)

-- ── esign_connections ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esign_connections (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES auth.users(id),
  provider             text NOT NULL DEFAULT 'pandadoc',
  auth_method          text NOT NULL DEFAULT 'oauth',
  access_token_enc     text,
  refresh_token_enc    text,
  token_expires_at     timestamptz,
  api_key_enc          text,
  pandadoc_workspace_id text,
  webhook_secret       text,
  last_sync_at         timestamptz,
  connected_at         timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (organization_id, provider)
);

-- ── esign_templates ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esign_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider         text NOT NULL DEFAULT 'pandadoc',
  pandadoc_id      text,
  name             text NOT NULL,
  roles            jsonb DEFAULT '[]',
  tokens           jsonb DEFAULT '[]',
  fields_schema    jsonb DEFAULT '{}',
  thumbnail_url    text,
  last_synced_at   timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (organization_id, pandadoc_id)
);

-- ── esign_envelopes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esign_envelopes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id),
  template_id      uuid REFERENCES esign_templates(id),
  contact_id       uuid,
  deal_id          uuid,
  name             text NOT NULL,
  provider         text NOT NULL DEFAULT 'pandadoc',
  pandadoc_doc_id  text,
  pandadoc_status  text,
  status           text NOT NULL DEFAULT 'draft',
  fields_data      jsonb DEFAULT '{}',
  sent_at          timestamptz,
  completed_at     timestamptz,
  voided_at        timestamptz,
  voided_by        uuid REFERENCES auth.users(id),
  remind_count     int NOT NULL DEFAULT 0,
  last_reminded_at timestamptz,
  signed_pdf_path  text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── esign_recipients ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esign_recipients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id           uuid NOT NULL REFERENCES esign_envelopes(id) ON DELETE CASCADE,
  pandadoc_recipient_id text,
  name                  text,
  email                 text NOT NULL,
  role                  text DEFAULT 'signer',
  signing_order         int DEFAULT 1,
  delivery_method       text DEFAULT 'email',
  status                text DEFAULT 'pending',
  viewed_at             timestamptz,
  signed_at             timestamptz,
  declined_at           timestamptz,
  decline_reason        text,
  reminder_count        int NOT NULL DEFAULT 0,
  last_reminded_at      timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── esign_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esign_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  envelope_id          uuid REFERENCES esign_envelopes(id) ON DELETE SET NULL,
  pandadoc_event_id    text UNIQUE,
  provider             text NOT NULL DEFAULT 'pandadoc',
  event_type           text NOT NULL,
  payload              jsonb NOT NULL DEFAULT '{}',
  processed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS esign_events_org_idx      ON esign_events(organization_id);
CREATE INDEX IF NOT EXISTS esign_events_envelope_idx ON esign_events(envelope_id);
CREATE INDEX IF NOT EXISTS esign_events_type_idx     ON esign_events(event_type);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE esign_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_envelopes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_recipients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE esign_events      ENABLE ROW LEVEL SECURITY;

-- esign_connections
CREATE POLICY "esign_conn_select" ON esign_connections FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "esign_conn_insert" ON esign_connections FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin'))
);
CREATE POLICY "esign_conn_update" ON esign_connections FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin'))
);
CREATE POLICY "esign_conn_delete" ON esign_connections FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin'))
);

-- esign_templates
CREATE POLICY "esign_tmpl_select" ON esign_templates FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "esign_tmpl_all" ON esign_templates FOR ALL USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin','operator'))
);

-- esign_envelopes
CREATE POLICY "esign_env_select" ON esign_envelopes FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "esign_env_insert" ON esign_envelopes FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin','operator'))
);
CREATE POLICY "esign_env_update" ON esign_envelopes FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin','operator'))
);

-- esign_recipients
CREATE POLICY "esign_recip_select" ON esign_recipients FOR SELECT USING (
  envelope_id IN (SELECT id FROM esign_envelopes WHERE organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
  ))
);
CREATE POLICY "esign_recip_all" ON esign_recipients FOR ALL USING (
  envelope_id IN (SELECT id FROM esign_envelopes WHERE organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin','operator')
  ))
);

-- esign_events
CREATE POLICY "esign_events_select" ON esign_events FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'esign_connections_updated_at') THEN
    CREATE TRIGGER esign_connections_updated_at BEFORE UPDATE ON esign_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'esign_templates_updated_at') THEN
    CREATE TRIGGER esign_templates_updated_at BEFORE UPDATE ON esign_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'esign_envelopes_updated_at') THEN
    CREATE TRIGGER esign_envelopes_updated_at BEFORE UPDATE ON esign_envelopes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'esign_recipients_updated_at') THEN
    CREATE TRIGGER esign_recipients_updated_at BEFORE UPDATE ON esign_recipients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
