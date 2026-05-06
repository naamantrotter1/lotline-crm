-- 087 · Ensure capital tracking columns exist on deals table
-- Safe to run even if columns already exist (IF NOT EXISTS guard).
-- capital_deployed_date / capital_returned_date / investor_paid_out were
-- referenced in dealToRow but never explicitly migrated, causing silent
-- write failures (Supabase UPDATE returns error for unknown columns) that
-- prevented all financing-tab values from persisting across page refreshes.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS capital_deployed_date date,
  ADD COLUMN IF NOT EXISTS capital_returned_date date,
  ADD COLUMN IF NOT EXISTS investor_paid_out     boolean NOT NULL DEFAULT false;
