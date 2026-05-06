-- 075 · Add unique constraint on deal_events(source_table, source_id)
-- Required for ON CONFLICT upserts from triggers and frontend syncs.
-- Partial index: only applies when both columns are non-null.

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_events_source_unique
  ON public.deal_events(source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL AND deleted_at IS NULL;
