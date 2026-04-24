-- 024_workflows.sql
-- Phase 11: Workflow / Automation builder
-- Workflows are org-level automation pipelines triggered by CRM events.
-- Steps execute sequentially (or in branches) via the client-side engine.
-- Safe to re-run (IF NOT EXISTS throughout).

BEGIN;

-- ── workflows ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  status          text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','paused')),
  trigger_type    text        NOT NULL DEFAULT 'manual',
  trigger_config  jsonb       NOT NULL DEFAULT '{}',
  last_run_at     timestamptz,
  run_count       int         NOT NULL DEFAULT 0,
  created_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflows_org_idx    ON workflows(organization_id, status);
CREATE INDEX IF NOT EXISTS workflows_trigger_idx ON workflows(organization_id, trigger_type) WHERE status = 'active';

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflows_select" ON workflows;
CREATE POLICY "workflows_select" ON workflows FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP POLICY IF EXISTS "workflows_insert" ON workflows;
CREATE POLICY "workflows_insert" ON workflows FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));

DROP POLICY IF EXISTS "workflows_update" ON workflows;
CREATE POLICY "workflows_update" ON workflows FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin','operator')
  ));

DROP POLICY IF EXISTS "workflows_delete" ON workflows;
CREATE POLICY "workflows_delete" ON workflows FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner','admin')
  ));

-- ── workflow_steps ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     uuid        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  parent_step_id  uuid        REFERENCES workflow_steps(id) ON DELETE CASCADE,
  branch_label    text,        -- 'yes' | 'no' | null for sequential
  sequence        int         NOT NULL DEFAULT 0,
  type            text        NOT NULL
                  CHECK (type IN (
                    'send_email','send_sms','create_task','update_field',
                    'add_tag','remove_tag','wait','branch','webhook',
                    'assign_owner','create_deal','add_to_sequence'
                  )),
  config          jsonb       NOT NULL DEFAULT '{}',
  -- visual layout
  position_x      float       NOT NULL DEFAULT 0,
  position_y      float       NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_steps_workflow_idx ON workflow_steps(workflow_id, sequence);

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_steps_select" ON workflow_steps;
CREATE POLICY "workflow_steps_select" ON workflow_steps FOR SELECT
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

DROP POLICY IF EXISTS "workflow_steps_write" ON workflow_steps;
CREATE POLICY "workflow_steps_write" ON workflow_steps FOR ALL
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  ));

-- ── workflow_runs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     uuid        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_event   text        NOT NULL,
  trigger_payload jsonb,
  status          text        NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','cancelled')),
  entity_type     text,
  entity_id       text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  error           text
);

CREATE INDEX IF NOT EXISTS workflow_runs_workflow_idx ON workflow_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS workflow_runs_status_idx   ON workflow_runs(workflow_id, status);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workflow_runs_select" ON workflow_runs;
CREATE POLICY "workflow_runs_select" ON workflow_runs FOR SELECT
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

DROP POLICY IF EXISTS "workflow_runs_insert" ON workflow_runs;
CREATE POLICY "workflow_runs_insert" ON workflow_runs FOR INSERT
  WITH CHECK (workflow_id IN (
    SELECT id FROM workflows WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

DROP POLICY IF EXISTS "workflow_runs_update" ON workflow_runs;
CREATE POLICY "workflow_runs_update" ON workflow_runs FOR UPDATE
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- ── workflow_step_runs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid        NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id         uuid        NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','skipped')),
  started_at      timestamptz,
  completed_at    timestamptz,
  output          jsonb,
  error           text,
  attempt_count   int         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS step_runs_run_idx ON workflow_step_runs(run_id);

ALTER TABLE workflow_step_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_runs_select" ON workflow_step_runs;
CREATE POLICY "step_runs_select" ON workflow_step_runs FOR SELECT
  USING (run_id IN (
    SELECT id FROM workflow_runs WHERE workflow_id IN (
      SELECT id FROM workflows WHERE organization_id IN (
        SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  ));

DROP POLICY IF EXISTS "step_runs_write" ON workflow_step_runs;
CREATE POLICY "step_runs_write" ON workflow_step_runs FOR ALL
  USING (run_id IN (
    SELECT id FROM workflow_runs WHERE workflow_id IN (
      SELECT id FROM workflows WHERE organization_id IN (
        SELECT organization_id FROM memberships WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  ));

COMMIT;
