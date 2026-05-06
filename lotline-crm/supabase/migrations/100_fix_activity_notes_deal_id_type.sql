-- 100 · Fix activity_notes.deal_id column type: uuid → text
--
-- Migration 052 created activity_notes with `deal_id uuid`, but deals.id
-- is TEXT (e.g. "deal-020", "custom-1777...").  Every logTaskActivity
-- insert was failing with:
--   "invalid input syntax for type uuid: 'deal-020'"
--
-- Migration 059 attempted to create the table as TEXT but was skipped
-- because the table already existed (CREATE TABLE IF NOT EXISTS).
--
-- This migration fixes the column type in-place.

ALTER TABLE public.activity_notes
  ALTER COLUMN deal_id TYPE text USING deal_id::text;
