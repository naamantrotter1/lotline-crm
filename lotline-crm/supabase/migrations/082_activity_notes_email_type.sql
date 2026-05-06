-- 082_activity_notes_email_type.sql
-- Expand note_type check constraint to allow 'email' type notes.

ALTER TABLE public.activity_notes
  DROP CONSTRAINT IF EXISTS activity_notes_note_type_check;

ALTER TABLE public.activity_notes
  ADD CONSTRAINT activity_notes_note_type_check
    CHECK (note_type IN ('note', 'stage_change', 'email'));
