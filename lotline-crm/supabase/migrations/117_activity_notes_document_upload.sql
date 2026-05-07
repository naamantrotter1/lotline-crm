-- 117 · Allow note_type='document_upload' in activity_notes
--
-- DealRightColumn.handleDocUpload inserts an activity_notes row with
-- note_type='document_upload' so file uploads appear in the Activity feed.
-- That value isn't in the migration 101 check constraint, so the insert
-- silently fails (CHECK violation). Add 'document_upload' to the allowed set.

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
