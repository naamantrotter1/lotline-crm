-- 021_notifications.sql
-- Phase 4: Notifications module
-- Stores per-user in-app notifications, with a DB trigger that auto-creates
-- a notification whenever a task is assigned (or reassigned) to someone.
-- Safe to re-run (IF NOT EXISTS throughout).

BEGIN;

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text        NOT NULL,  -- 'task_assigned', 'deal_stage', 'deal_pipeline', 'general'
  title           text        NOT NULL,
  body            text,
  entity_type     text,                  -- 'task' | 'deal' | 'contact'
  entity_id       text,
  read            boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx    ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_org_idx     ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx  ON notifications(user_id, read) WHERE read = false;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Any active org member can insert a notification for any user in their org
-- (used when one user assigns a task to another, etc.)
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can update (mark read) only their own notifications
DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete only their own notifications
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable realtime so the TopBar bell updates live without polling
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── DB trigger: notify on task assignment ─────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_task_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Fire when a task is assigned (or reassigned) to a different user
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  THEN
    INSERT INTO notifications (organization_id, user_id, type, title, body, entity_type, entity_id)
    VALUES (
      NEW.organization_id,
      NEW.assigned_to,
      'task_assigned',
      'Task assigned to you',
      NEW.title,
      'task',
      NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assigned ON tasks;
CREATE TRIGGER trg_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_notify_task_assigned();

COMMIT;
