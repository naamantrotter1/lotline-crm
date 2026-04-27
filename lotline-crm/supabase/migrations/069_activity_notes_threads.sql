-- 069 · Threaded replies + note_type for activity_notes
-- parent_note_id enables threaded replies; note_type distinguishes user notes from auto-events.

ALTER TABLE public.activity_notes
  ADD COLUMN IF NOT EXISTS parent_note_id uuid
    REFERENCES public.activity_notes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activity_notes_parent ON public.activity_notes(parent_note_id);

ALTER TABLE public.activity_notes
  ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'note'
    CHECK (note_type IN ('note', 'stage_change'));

-- The existing activity_notes_select policy already covers replies since they belong
-- to the same organization_id — no policy change needed.

-- Allow replies: extend the INSERT policy logic stays the same (org member + author_id = uid).
-- Replies just have a non-null parent_note_id; the same WITH CHECK covers them.
