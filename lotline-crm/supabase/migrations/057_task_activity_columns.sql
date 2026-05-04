-- 057_task_activity_columns.sql
-- Adds note_type and author_name to activity_notes so task events can be
-- distinguished from user-written notes and rendered differently in the feed.
-- Safe to re-run (uses IF NOT EXISTS / column existence checks).

BEGIN;

-- Add note_type column (defaults to 'note' so existing rows are unaffected)
ALTER TABLE activity_notes
  ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'note';

-- Add author_name column (denormalised for task events so we don't need
-- a profile join just to display "Task created by X")
ALTER TABLE activity_notes
  ADD COLUMN IF NOT EXISTS author_name text;

COMMIT;
