-- 088 · Ensure listing_url and contract_signed_at exist on deals table
-- Both columns are referenced in dealToRow (dealsSync.js) but were never
-- explicitly added via ALTER TABLE, causing every flushToSupabaseAsync call
-- to silently fail with a "column does not exist" error from Supabase,
-- which prevented ALL deal fields from persisting across page refreshes.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS listing_url        text,
  ADD COLUMN IF NOT EXISTS contract_signed_at timestamptz;
