-- Phase 19: AI / Anthropic
-- Table: ai_usage (tracks all AI calls for billing/auditing)

CREATE TABLE ai_usage (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature         text        NOT NULL, -- 'deal_summary'|'email_draft'|'voice_note'|'contact_summary'|'chat'
  model           text        NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  input_tokens    int         NOT NULL DEFAULT 0,
  output_tokens   int         NOT NULL DEFAULT 0,
  prompt_preview  text,        -- first 200 chars of prompt (for debugging)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON ai_usage(organization_id);
CREATE INDEX ON ai_usage(user_id);
CREATE INDEX ON ai_usage(created_at);
CREATE INDEX ON ai_usage(feature);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own ai_usage" ON ai_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins see org ai_usage" ON ai_usage
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );
