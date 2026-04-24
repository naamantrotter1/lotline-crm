-- Phase 18: Dedupe + Merge
-- Table: dedupe_candidates (pairs of contacts identified as potential duplicates)

CREATE TYPE dedupe_status AS ENUM ('pending', 'merged', 'dismissed');

CREATE TABLE dedupe_candidates (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_a_id    uuid          NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id    uuid          NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score           numeric(4,2)  NOT NULL DEFAULT 0, -- 0-100 similarity score
  match_reasons   text[]        NOT NULL DEFAULT '{}', -- ['same_email','similar_name',...]
  status          dedupe_status NOT NULL DEFAULT 'pending',
  resolved_by     uuid          REFERENCES profiles(id),
  resolved_at     timestamptz,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE(organization_id, contact_a_id, contact_b_id)
);

CREATE INDEX ON dedupe_candidates(organization_id);
CREATE INDEX ON dedupe_candidates(status);
CREATE INDEX ON dedupe_candidates(score DESC);

ALTER TABLE dedupe_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read dedupe_candidates" ON dedupe_candidates
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins manage dedupe_candidates" ON dedupe_candidates
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
    )
  );
