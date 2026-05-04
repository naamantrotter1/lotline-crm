-- 101 · Add task note types to activity_notes.note_type constraint
--
-- Migration 083/085 set the allowed note_type values to only
-- ('note', 'stage_change', 'email'), which caused logTaskActivity
-- inserts to fail with a CHECK constraint violation when note_type
-- was 'task', 'task_complete', or 'task_update'.
--
-- This migration drops all existing note_type constraints (regardless
-- of auto-generated name) and recreates with the full set.

DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.activity_notes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%note_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.activity_notes DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END$$;

ALTER TABLE public.activity_notes
  ADD CONSTRAINT activity_notes_note_type_check
    CHECK (note_type IS NULL OR note_type IN (
      'note', 'stage_change', 'email',
      'task', 'task_complete', 'task_update'
    ));
