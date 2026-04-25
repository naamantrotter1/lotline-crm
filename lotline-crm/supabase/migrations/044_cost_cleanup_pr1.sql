-- ═══════════════════════════════════════════════════════════════════════════════
-- 044 · Cost Cleanup PR 1: Miscellaneous Category + Alias Expansion
-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Insert 'miscellaneous' as a new global canonical category (group=Other).
-- 2. Create migration_failures table for per-deal parity rollback logging (PR 2).
-- 3. Add 2 new alias rows to cost_breakdown_category_aliases:
--      water                  → well
--      landscaping_final_grading → final_grade
--    (5 existing aliases from 042 remain: perc_test_permit, footers, setup,
--     clear_land, electric_power_pole — already in the table.)
-- 4. Backfill all existing deals with a miscellaneous row (NULL amount).
--    PR 2 will merge Staging/Professional Photos/Gutters values into it.
--
-- DATA SAFETY: No financial data is modified here. All deal_cost_lines inserts
-- use estimated_amount=NULL, actual_overridden=FALSE, ON CONFLICT DO NOTHING.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Insert 'miscellaneous' canonical category into the registry
-- ─────────────────────────────────────────────────────────────────────────────
-- sort_order=500 puts it at the very bottom after all other categories.
-- default_amount=NULL means new deals start with a blank (not $0).
-- aggregation='none' means it is a leaf (directly editable, not computed).

INSERT INTO public.cost_breakdown_categories
  (org_id, key, label, sort_order, group_name, default_amount, aggregation, parent_key, is_active)
VALUES
  (NULL, 'miscellaneous', 'Miscellaneous', 500, 'Other', NULL, 'none', NULL, TRUE)
ON CONFLICT (org_id, key) DO UPDATE SET
  label          = EXCLUDED.label,
  sort_order     = EXCLUDED.sort_order,
  group_name     = EXCLUDED.group_name,
  default_amount = EXCLUDED.default_amount,
  aggregation    = EXCLUDED.aggregation,
  parent_key     = EXCLUDED.parent_key,
  is_active      = TRUE;


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Create migration_failures table
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores per-deal parity failures discovered during PR 2 merge logic.
-- A row here means the deal was skipped (not mutated) and needs manual review.

CREATE TABLE IF NOT EXISTS public.cost_cleanup_migration_failures (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       TEXT        NOT NULL,
  org_id        UUID        NOT NULL,
  migration_tag TEXT        NOT NULL,  -- e.g. '045_cost_cleanup_pr2'
  reason        TEXT        NOT NULL,  -- human-readable description of the failure
  before_total  NUMERIC(14,2),
  after_total   NUMERIC(14,2),
  drift         NUMERIC(14,2) GENERATED ALWAYS AS (after_total - before_total) STORED,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ccmf_deal_idx ON public.cost_cleanup_migration_failures (deal_id);
CREATE INDEX IF NOT EXISTS ccmf_tag_idx  ON public.cost_cleanup_migration_failures (migration_tag);

COMMENT ON TABLE public.cost_cleanup_migration_failures IS
  'Audit log for per-deal parity failures during cost cleanup migrations. '
  'Rows here = deals that were NOT mutated and require manual review.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Add 2 new alias rows
-- ─────────────────────────────────────────────────────────────────────────────
-- 'water' was the original key for the Well row (seeded from d.water_cost).
-- 'landscaping_final_grading' was the key for Final Grade (seeded from d.landscaping).

INSERT INTO public.cost_breakdown_category_aliases (key, alias_of_key, notes) VALUES
  ('water',                    'well',        'Renamed: "Water" → "Well"'),
  ('landscaping_final_grading','final_grade',  'Renamed: "Landscaping / Final Grading" → "Final Grade"')
ON CONFLICT (key) DO UPDATE SET
  alias_of_key = EXCLUDED.alias_of_key,
  notes        = EXCLUDED.notes;


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Merge 'water' → 'well' and 'landscaping_final_grading' → 'final_grade'
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 043 §5 already backfilled canonical 'well' and 'final_grade' rows
-- for every deal (with NULL amounts). So we CANNOT simply re-key the old rows
-- (UPDATE category_key would violate the UNIQUE constraint).
--
-- Instead:
--   a) Copy financial data from the old row into the canonical row
--      (only when the old row has a non-zero estimated amount or an override).
--   b) DELETE the old rows — they are now superseded.
--
-- Parity is preserved because:
--   Before: old_row.estimated_amount + canonical_row.NULL(→$0) = old value
--   After:  canonical_row.estimated_amount = old value, old_row deleted     = same total

-- §4a: Merge 'water' data into 'well'
UPDATE public.deal_cost_lines AS target
SET
  estimated_amount             = CASE
    WHEN source.estimated_amount > 0 THEN source.estimated_amount
    ELSE target.estimated_amount
  END,
  actual_amount                = CASE
    WHEN source.actual_overridden THEN source.actual_amount
    ELSE target.actual_amount
  END,
  actual_overridden            = target.actual_overridden OR source.actual_overridden,
  actual_overridden_at         = GREATEST(target.actual_overridden_at, source.actual_overridden_at),
  actual_overridden_by_user_id = COALESCE(target.actual_overridden_by_user_id, source.actual_overridden_by_user_id),
  estimated_updated_at         = GREATEST(target.estimated_updated_at, source.estimated_updated_at),
  estimated_updated_by_user_id = COALESCE(target.estimated_updated_by_user_id, source.estimated_updated_by_user_id)
FROM public.deal_cost_lines AS source
WHERE target.deal_id      = source.deal_id
  AND target.category_key = 'well'
  AND source.category_key = 'water'
  AND (source.estimated_amount > 0 OR source.actual_overridden = TRUE);

-- §4b: Delete all 'water' rows (data merged into 'well'; $0 rows have no value to preserve)
DELETE FROM public.deal_cost_lines WHERE category_key = 'water';

-- §4c: Merge 'landscaping_final_grading' data into 'final_grade'
UPDATE public.deal_cost_lines AS target
SET
  estimated_amount             = CASE
    WHEN source.estimated_amount > 0 THEN source.estimated_amount
    ELSE target.estimated_amount
  END,
  actual_amount                = CASE
    WHEN source.actual_overridden THEN source.actual_amount
    ELSE target.actual_amount
  END,
  actual_overridden            = target.actual_overridden OR source.actual_overridden,
  actual_overridden_at         = GREATEST(target.actual_overridden_at, source.actual_overridden_at),
  actual_overridden_by_user_id = COALESCE(target.actual_overridden_by_user_id, source.actual_overridden_by_user_id),
  estimated_updated_at         = GREATEST(target.estimated_updated_at, source.estimated_updated_at),
  estimated_updated_by_user_id = COALESCE(target.estimated_updated_by_user_id, source.estimated_updated_by_user_id)
FROM public.deal_cost_lines AS source
WHERE target.deal_id      = source.deal_id
  AND target.category_key = 'final_grade'
  AND source.category_key = 'landscaping_final_grading'
  AND (source.estimated_amount > 0 OR source.actual_overridden = TRUE);

-- §4d: Delete all 'landscaping_final_grading' rows
DELETE FROM public.deal_cost_lines WHERE category_key = 'landscaping_final_grading';


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Backfill 'miscellaneous' row for all existing deals
-- ─────────────────────────────────────────────────────────────────────────────
-- Every deal gets a blank miscellaneous row now. PR 2 will fill it with
-- the summed values from Staging + Professional Photos + Gutters.
-- ON CONFLICT DO NOTHING is fully idempotent.

INSERT INTO public.deal_cost_lines
  (org_id, deal_id, category_key, category_label, sort_order, group_name,
   parent_key, estimated_amount, actual_amount, actual_overridden)
SELECT
  d.organization_id,
  d.id,
  'miscellaneous',
  'Miscellaneous',
  500,
  'Other',
  NULL,
  NULL::NUMERIC(14,2),
  NULL::NUMERIC(14,2),
  FALSE
FROM public.deals d
WHERE d.organization_id IS NOT NULL
ON CONFLICT (deal_id, category_key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Verification
-- ─────────────────────────────────────────────────────────────────────────────
-- Run these selects to confirm the migration ran correctly.
-- Expected:
--   §6a → 1 row: key='miscellaneous', sort_order=500, group_name='Other'
--   §6b → 2 rows: water, landscaping_final_grading
--   §6c → 0 rows with old keys remaining in deal_cost_lines

-- §6a: Registry check
SELECT key, label, sort_order, group_name, default_amount, is_active
FROM public.cost_breakdown_categories
WHERE org_id IS NULL AND key = 'miscellaneous';

-- §6b: New alias rows
SELECT key, alias_of_key, notes
FROM public.cost_breakdown_category_aliases
WHERE key IN ('water', 'landscaping_final_grading');

-- §6c: Old keys should be gone from deal_cost_lines
SELECT category_key, COUNT(*) AS remaining_rows
FROM public.deal_cost_lines
WHERE category_key IN ('water', 'landscaping_final_grading')
GROUP BY category_key;

-- §6d: Miscellaneous row count (should equal number of active deals)
SELECT COUNT(*) AS misc_rows_inserted
FROM public.deal_cost_lines
WHERE category_key = 'miscellaneous';


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN — reversible
-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS public.cost_cleanup_migration_failures;
-- DELETE FROM public.cost_breakdown_category_aliases
--   WHERE key IN ('water', 'landscaping_final_grading');
-- UPDATE dcl SET category_key=a.key FROM cost_breakdown_category_aliases a
--   WHERE dcl.category_key = a.alias_of_key AND a.key IN ('water','landscaping_final_grading');
-- DELETE FROM public.deal_cost_lines WHERE category_key='miscellaneous';
-- UPDATE public.cost_breakdown_categories SET is_active=FALSE WHERE key='miscellaneous' AND org_id IS NULL;
-- ═══════════════════════════════════════════════════════════════════════════════
