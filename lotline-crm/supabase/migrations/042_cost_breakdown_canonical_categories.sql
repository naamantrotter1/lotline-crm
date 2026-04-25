-- ═══════════════════════════════════════════════════════════════════════════════
-- 042 · Cost Breakdown V2 — PR 2: Canonical 25-row Category Registry
-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Adds default_amount column to cost_breakdown_categories.
-- 2. Expands group_name CHECK to allow 'Legacy'.
-- 3. Upserts 28 registry rows (25 canonical + 3 Environmental Permit children).
--    Parent row uses aggregation='sum_of_children'; children have parent_key set.
-- 4. Inserts 5 alias mappings (old-key → canonical-key).
-- 5. Marks every other pre-existing global row is_active=false, group='Legacy'.
-- 6. Updates fn_seed_deal_cost_lines to seed default_amount (not 0) for new deals.
--
-- DATA SAFETY: This migration touches ONLY cost_breakdown_categories and the
-- alias registry. deal_cost_lines are NOT touched here — that is PR 3.
-- Total of canonical leaf defaults = $182,400. Verified at bottom.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Expand group_name CHECK constraint to allow 'Legacy'
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cost_breakdown_categories
  DROP CONSTRAINT IF EXISTS cost_breakdown_categories_group_name_check;

ALTER TABLE public.cost_breakdown_categories
  ADD CONSTRAINT cost_breakdown_categories_group_name_check
    CHECK (group_name IN ('Land','Build','Sitework','Finishing','Other','Legacy'));

-- Same guard for deal_cost_lines (no prior constraint, just document intent)
COMMENT ON COLUMN public.deal_cost_lines.group_name IS
  'Mirrors category registry group. Valid values: Land, Build, Sitework, Finishing, Other, Legacy.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Add default_amount column to cost_breakdown_categories
-- ─────────────────────────────────────────────────────────────────────────────
-- NULL = no default (blank). Used by fn_seed_deal_cost_lines for new deals
-- and by the Deal Calculator as its opening state. Never backfilled to existing
-- deals — existing deal_cost_lines values are never touched by this migration.

ALTER TABLE public.cost_breakdown_categories
  ADD COLUMN IF NOT EXISTS default_amount NUMERIC(14,2);

COMMENT ON COLUMN public.cost_breakdown_categories.default_amount IS
  'Default estimated_amount seeded into new deals. NULL = blank (no default). '
  'Changing this does NOT affect any existing deal_cost_lines.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Upsert 28 canonical rows (org_id NULL = global)
-- ─────────────────────────────────────────────────────────────────────────────
-- Canonical order, sort_order increments by 10; children use parent+1,2,3.
-- ON CONFLICT updates metadata only — never touches deal_cost_lines values.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.cost_breakdown_categories
  (org_id, key, label, sort_order, group_name, default_amount, aggregation, parent_key, is_active)
VALUES
  -- ── Land ──────────────────────────────────────────────────────────────────
  (NULL, 'land_purchase_price',
        'Land / Purchase Price',         0,   'Land',      30000,   'none',            NULL, TRUE),

  -- ── Sitework ──────────────────────────────────────────────────────────────
  (NULL, 'perc_test',
        'Perc Test',                    10,   'Sitework',   2500,   'none',            NULL, TRUE),
  (NULL, 'land_survey',
        'Land Survey',                  20,   'Sitework',   1500,   'none',            NULL, TRUE),

  -- Environmental Permits: parent (computed) + 3 children
  (NULL, 'environmental_permits',
        'Environmental Permits',         30,   'Sitework',   NULL,   'sum_of_children', NULL, TRUE),
  (NULL, 'environmental_permits.construction_authorization',
        'Construction Authorization',    31,   'Sitework',    400,   'none', 'environmental_permits', TRUE),
  (NULL, 'environmental_permits.improvement_permit',
        'Improvement Permit',            32,   'Sitework',    400,   'none', 'environmental_permits', TRUE),
  (NULL, 'environmental_permits.well_permit',
        'Well Permit',                   33,   'Sitework',    400,   'none', 'environmental_permits', TRUE),

  -- ── Build ─────────────────────────────────────────────────────────────────
  (NULL, 'mobile_home',
        'Mobile Home',                  40,   'Build',      80000,   'none',            NULL, TRUE),

  -- ── Sitework (continued) ──────────────────────────────────────────────────
  (NULL, 'land_clearing',
        'Land Clearing',                50,   'Sitework',   4000,   'none',            NULL, TRUE),
  (NULL, 'rough_grade',
        'Rough Grade',                  60,   'Sitework',   1500,   'none',            NULL, TRUE),
  (NULL, 'septic',
        'Septic',                       70,   'Sitework',   7500,   'none',            NULL, TRUE),
  (NULL, 'well',
        'Well',                         80,   'Sitework',  10000,   'none',            NULL, TRUE),
  (NULL, 'public_water',
        'Public Water',                 90,   'Sitework',   NULL,   'none',            NULL, TRUE),
  (NULL, 'public_sewer',
        'Public Sewer',                100,   'Sitework',   NULL,   'none',            NULL, TRUE),
  (NULL, 'utility_power_connection',
        'Utility Power Connection',     110,   'Sitework',   2000,   'none',            NULL, TRUE),

  -- ── Build (continued) ─────────────────────────────────────────────────────
  (NULL, 'foundation_footers',
        'Foundation / Footers',         120,   'Build',      2000,   'none',            NULL, TRUE),
  (NULL, 'set_up',
        'Set Up',                       130,   'Build',     10000,   'none',            NULL, TRUE),

  -- ── Finishing ─────────────────────────────────────────────────────────────
  (NULL, 'trim_out',
        'Trim Out (Interior / Exterior)',140,   'Finishing',  2800,   'none',            NULL, TRUE),

  -- ── Build (continued) ─────────────────────────────────────────────────────
  (NULL, 'hvac',
        'HVAC',                         150,   'Build',      4500,   'none',            NULL, TRUE),
  (NULL, 'electrical',
        'Electrical',                   160,   'Build',      2500,   'none',            NULL, TRUE),
  (NULL, 'plumbing_connection',
        'Plumbing Connection',          170,   'Build',      1750,   'none',            NULL, TRUE),
  (NULL, 'septic_connection',
        'Septic Connection',            180,   'Build',      1750,   'none',            NULL, TRUE),

  -- ── Finishing (continued) ─────────────────────────────────────────────────
  (NULL, 'skirting',
        'Skirting',                     190,   'Finishing',  9500,   'none',            NULL, TRUE),

  -- ── Sitework (continued) ──────────────────────────────────────────────────
  (NULL, 'driveway',
        'Driveway',                     200,   'Sitework',   1500,   'none',            NULL, TRUE),
  (NULL, 'final_grade',
        'Final Grade',                  210,   'Sitework',   1500,   'none',            NULL, TRUE),

  -- ── Finishing (continued) ─────────────────────────────────────────────────
  (NULL, 'decks_installed',
        'Decks Installed',              220,   'Finishing',  3500,   'none',            NULL, TRUE),

  -- ── Build (continued) ─────────────────────────────────────────────────────
  (NULL, 'hud_engineer',
        'HUD Engineer',                 230,   'Build',       600,   'none',            NULL, TRUE),

  -- ── Finishing (continued) ─────────────────────────────────────────────────
  (NULL, 'mailbox',
        'Mailbox',                      240,   'Finishing',   300,   'none',            NULL, TRUE)

ON CONFLICT (org_id, key) DO UPDATE SET
  label          = EXCLUDED.label,
  sort_order     = EXCLUDED.sort_order,
  group_name     = EXCLUDED.group_name,
  default_amount = EXCLUDED.default_amount,
  aggregation    = EXCLUDED.aggregation,
  parent_key     = EXCLUDED.parent_key,
  is_active      = TRUE;   -- re-activate if previously deactivated


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Register alias mappings (old key → canonical key)
-- ─────────────────────────────────────────────────────────────────────────────
-- These are inserted into cost_breakdown_category_aliases so PR 3 can use them
-- to re-key deal_cost_lines without hardcoding the mapping there.

INSERT INTO public.cost_breakdown_category_aliases (key, alias_of_key, notes) VALUES
  ('perc_test_permit',     'perc_test',                'Renamed: "Perc Test / Permit" → "Perc Test"'),
  ('footers',              'foundation_footers',        'Renamed: "Footers" → "Foundation / Footers"'),
  ('setup',                'set_up',                    'Renamed: "Setup" → "Set Up"'),
  ('clear_land',           'land_clearing',             'Renamed: "Clear Land" → "Land Clearing"'),
  ('electric_power_pole',  'utility_power_connection',  'Renamed: "Electric / Power Pole" → "Utility Power Connection"')
ON CONFLICT (key) DO UPDATE SET
  alias_of_key = EXCLUDED.alias_of_key,
  notes        = EXCLUDED.notes;


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Mark non-canonical global rows Legacy / inactive
-- ─────────────────────────────────────────────────────────────────────────────
-- Any global (org_id NULL) row whose key is not in the canonical set is retired.
-- deal_cost_lines referencing these keys are NOT touched here (PR 3 handles it).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.cost_breakdown_categories
SET
  is_active  = FALSE,
  group_name = 'Legacy'
WHERE org_id IS NULL
  AND key NOT IN (
    -- 28 canonical keys (25 categories + 3 children)
    'land_purchase_price',
    'perc_test',
    'land_survey',
    'environmental_permits',
    'environmental_permits.construction_authorization',
    'environmental_permits.improvement_permit',
    'environmental_permits.well_permit',
    'mobile_home',
    'land_clearing',
    'rough_grade',
    'septic',
    'well',
    'public_water',
    'public_sewer',
    'utility_power_connection',
    'foundation_footers',
    'set_up',
    'trim_out',
    'hvac',
    'electrical',
    'plumbing_connection',
    'septic_connection',
    'skirting',
    'driveway',
    'final_grade',
    'decks_installed',
    'hud_engineer',
    'mailbox'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Update fn_seed_deal_cost_lines to use default_amount for new deals
-- ─────────────────────────────────────────────────────────────────────────────
-- Previously seeded 0 for every line. Now seeds default_amount from registry.
-- NULL default_amount → NULL estimated_amount (blank, not zero).
-- Parent rows (aggregation='sum_of_children') are seeded with NULL amounts
-- since their display value is always computed from children.

CREATE OR REPLACE FUNCTION public.fn_seed_deal_cost_lines()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.deal_cost_lines
    (org_id, deal_id, category_key, category_label, sort_order, group_name,
     parent_key, estimated_amount)
  SELECT
    NEW.organization_id,
    NEW.id,
    cbc.key,
    cbc.label,
    cbc.sort_order,
    cbc.group_name,
    cbc.parent_key,
    -- Parents always NULL (computed from children); leaves use registry default
    CASE WHEN cbc.aggregation = 'sum_of_children' THEN NULL ELSE cbc.default_amount END
  FROM public.cost_breakdown_categories cbc
  WHERE (cbc.org_id IS NULL OR cbc.org_id = NEW.organization_id)
    AND cbc.is_active = TRUE
  ON CONFLICT (deal_id, category_key) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger already exists (from 040); replacing the function is sufficient.


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  Parity verification query — run to confirm registry-only changes
-- ─────────────────────────────────────────────────────────────────────────────
-- This SELECT returns the leaf count and sum of defaults.
-- Expected: 27 leaf rows, total_default_amount = 182400.
-- Run manually to verify: SELECT * FROM _cbv2_registry_check;

CREATE OR REPLACE VIEW public._cbv2_registry_check AS
SELECT
  COUNT(*)                                             AS leaf_row_count,
  SUM(COALESCE(default_amount, 0))                     AS total_default_amount,
  COUNT(*) FILTER (WHERE aggregation = 'sum_of_children') AS parent_row_count,
  COUNT(*) FILTER (WHERE parent_key IS NOT NULL)       AS child_row_count
FROM public.cost_breakdown_categories
WHERE org_id IS NULL
  AND is_active = TRUE
  AND aggregation = 'none';


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN — reversible
-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP VIEW IF EXISTS public._cbv2_registry_check;
-- Restore fn_seed_deal_cost_lines to seed 0 (from migration 040).
-- DELETE FROM public.cost_breakdown_category_aliases
--   WHERE key IN ('perc_test_permit','footers','setup','clear_land','electric_power_pole');
-- UPDATE public.cost_breakdown_categories SET is_active=TRUE, group_name=<original>
--   WHERE org_id IS NULL AND key IN (<legacy keys>);
-- DELETE FROM public.cost_breakdown_categories
--   WHERE org_id IS NULL AND key IN (<new canonical keys not in 040>);
-- ALTER TABLE public.cost_breakdown_categories DROP COLUMN IF EXISTS default_amount;
-- Restore group_name CHECK without 'Legacy'.
-- ═══════════════════════════════════════════════════════════════════════════════
