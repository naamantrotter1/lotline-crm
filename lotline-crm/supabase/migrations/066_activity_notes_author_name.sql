-- 066 · Denormalized author_name on activity_notes
-- Stores display name at write-time so notes still show correctly
-- even if a user later changes their profile name.

ALTER TABLE public.activity_notes
  ADD COLUMN IF NOT EXISTS author_name text;
