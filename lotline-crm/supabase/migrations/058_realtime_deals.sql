-- Migration 058: Enable Supabase Realtime on deals and deal_cost_lines
--
-- Without this, the Realtime subscription in DealsContext.jsx exists in JS
-- but never fires because the tables aren't in the supabase_realtime publication.
--
-- REPLICA IDENTITY FULL is required for:
--   • DELETE payloads (payload.old will be populated with all columns)
--   • Row-level filter pushdown on subscriptions

ALTER TABLE public.deals
  REPLICA IDENTITY FULL;

ALTER TABLE public.deal_cost_lines
  REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication.
-- Using a DO block to swallow "already member" errors on re-runs.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  EXCEPTION WHEN duplicate_object THEN
    -- already added, ignore
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_cost_lines;
  EXCEPTION WHEN duplicate_object THEN
    -- already added, ignore
  END;
END $$;
