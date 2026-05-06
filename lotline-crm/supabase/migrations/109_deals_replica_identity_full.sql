-- Migration 109: Ensure deals table has REPLICA IDENTITY FULL
--
-- Required for:
--   1. Server-side Realtime filter (organization_id=eq.X) to work on UPDATE/DELETE
--   2. DELETE payload to include old row data so the client can identify the deal
--
-- Safe to run repeatedly — ALTER TABLE is idempotent for REPLICA IDENTITY.

ALTER TABLE public.deals REPLICA IDENTITY FULL;

-- Ensure deals is in the realtime publication (no-op if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  END IF;
END $$;
