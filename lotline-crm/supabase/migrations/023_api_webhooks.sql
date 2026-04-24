-- 023_api_webhooks.sql
-- Phase 10: API Keys & Webhook Endpoints
-- Allows orgs to create named API keys (stored as SHA-256 hashes) and
-- register webhook URLs that receive POST notifications on deal/contact events.
-- Safe to re-run (IF NOT EXISTS throughout).

BEGIN;

-- ── api_keys ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  key_prefix      text        NOT NULL,          -- first 8 chars shown to user for identification
  key_hash        text        NOT NULL UNIQUE,   -- SHA-256 of the full key (never stored in plain)
  scopes          text[]      NOT NULL DEFAULT ARRAY['read'],
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(organization_id, revoked_at);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only org owner/admin can manage API keys
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;
CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

-- ── webhook_endpoints ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             text        NOT NULL,
  events          text[]      NOT NULL DEFAULT ARRAY['deal.created'],
  secret          text        NOT NULL,   -- HMAC signing secret shown once on creation
  active          boolean     NOT NULL DEFAULT true,
  last_fired_at   timestamptz,
  last_status     int,                    -- HTTP status code of last delivery attempt
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhooks_org_idx ON webhook_endpoints(organization_id, active);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhooks_select" ON webhook_endpoints;
CREATE POLICY "webhooks_select" ON webhook_endpoints FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "webhooks_insert" ON webhook_endpoints;
CREATE POLICY "webhooks_insert" ON webhook_endpoints FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "webhooks_update" ON webhook_endpoints;
CREATE POLICY "webhooks_update" ON webhook_endpoints FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "webhooks_delete" ON webhook_endpoints;
CREATE POLICY "webhooks_delete" ON webhook_endpoints FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

-- ── webhook_deliveries (delivery log) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     uuid        NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event           text        NOT NULL,
  payload         jsonb       NOT NULL,
  status_code     int,
  response_body   text,
  fired_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deliveries_endpoint_idx ON webhook_deliveries(endpoint_id, fired_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deliveries_select" ON webhook_deliveries;
CREATE POLICY "deliveries_select" ON webhook_deliveries FOR SELECT
  USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
      )
    )
  );

DROP POLICY IF EXISTS "deliveries_insert" ON webhook_deliveries;
CREATE POLICY "deliveries_insert" ON webhook_deliveries FOR INSERT
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (
        SELECT organization_id FROM memberships
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
      )
    )
  );

COMMIT;
