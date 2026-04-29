-- ─────────────────────────────────────────────────────────────────────────────
-- 086 · Ensure deals.scenario_data exists as JSONB
-- This column stores all financing scenario inputs (interest rate, fees, etc.)
-- so they survive page refreshes. Referenced by migration 005 but never
-- explicitly added via ALTER TABLE — this migration guarantees it exists.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS scenario_data JSONB;
