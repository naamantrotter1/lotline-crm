-- 103 · Add document_upload to activity_notes.note_type constraint
--
-- Migration 101 set the allowed note_type values. Now that document uploads
-- are logged to the activity feed, document_upload must be allowed.

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
      'task', 'task_complete', 'task_update',
      'document_upload'
    ));
