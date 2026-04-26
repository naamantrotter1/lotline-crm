-- Migration: add dead_deal flag and dead_deal_date to deals table
-- Run this in Supabase SQL editor before deploying the Dead Deal feature.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS dead_deal      BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dead_deal_date TIMESTAMPTZ;

-- Index for fast reporting queries
CREATE INDEX IF NOT EXISTS idx_deals_dead_deal ON deals (dead_deal) WHERE dead_deal = true;

-- Pipeline history table — logs every Land Acq ↔ Deal Overview pipeline transition.
-- contract_signed_at on deals already captures the first LA→DO move;
-- this table provides a full audit trail for future analytics.
CREATE TABLE IF NOT EXISTS deal_pipeline_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         TEXT        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  organization_id TEXT,
  from_pipeline   TEXT        NOT NULL,
  to_pipeline     TEXT        NOT NULL,
  moved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_by        UUID        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_dph_deal_id ON deal_pipeline_history (deal_id);
CREATE INDEX IF NOT EXISTS idx_dph_org     ON deal_pipeline_history (organization_id);

-- Enable RLS so the history table respects org-scoping
ALTER TABLE deal_pipeline_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "org members can read pipeline history"
  ON deal_pipeline_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY IF NOT EXISTS "org members can insert pipeline history"
  ON deal_pipeline_history FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );
