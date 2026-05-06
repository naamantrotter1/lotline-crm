-- 076 · Ensure closing detail columns exist on deals table
-- Safe to run even if columns already exist (IF NOT EXISTS guard).
-- closing_attorney / phone / address were referenced in dealToRow but
-- never explicitly migrated, causing silent write failures if absent.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS closing_attorney         text,
  ADD COLUMN IF NOT EXISTS closing_attorney_phone   text,
  ADD COLUMN IF NOT EXISTS closing_attorney_address text,
  ADD COLUMN IF NOT EXISTS close_date               date,
  ADD COLUMN IF NOT EXISTS contract_date            date;
