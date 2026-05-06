-- 081_activity_notes_metadata.sql
-- Add metadata JSONB column to activity_notes for structured email (and future) note data.

ALTER TABLE public.activity_notes
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.activity_notes.metadata IS
  'Structured data for typed notes. For note_type=email: { subject, to_name, to_email, body_preview, sent_by, status }';
