-- 085 · Definitively fix note_type constraint to allow 'email'
-- Drops ALL check constraints on note_type (regardless of auto-generated name)
-- then recreates the correct one. Safe to run multiple times.

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
    CHECK (note_type IN ('note', 'stage_change', 'email'));
