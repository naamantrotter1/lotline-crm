-- 102 · Add missing columns to deals table
--
-- Several columns referenced in dealToRow (dealsSync.js) were never added
-- via ALTER TABLE migrations. Any missing column causes the entire
-- flushToSupabase UPDATE to fail silently, preventing ALL field saves
-- (close date, attorney, milestones, etc.) from persisting.
--
-- Root cause: is_starred was added to dealToRow in a code commit without
-- a corresponding migration, breaking every save since that commit.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS is_starred     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closing_date   date,
  ADD COLUMN IF NOT EXISTS dd_deadline    date,
  ADD COLUMN IF NOT EXISTS appraisal_date date,
  ADD COLUMN IF NOT EXISTS fin_contingency text;
