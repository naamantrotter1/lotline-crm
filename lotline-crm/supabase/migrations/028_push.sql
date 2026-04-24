-- Phase 15: PWA Push Notifications
-- Table: push_subscriptions

CREATE TABLE push_subscriptions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint        text        NOT NULL,
  p256dh          text        NOT NULL,
  auth            text        NOT NULL,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX ON push_subscriptions(user_id);
CREATE INDEX ON push_subscriptions(organization_id);

-- RLS: users can only manage their own subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own push_subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "service role can read push_subscriptions" ON push_subscriptions
  FOR SELECT USING (true);
