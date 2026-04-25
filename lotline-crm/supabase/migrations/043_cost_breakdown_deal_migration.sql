-- ═══════════════════════════════════════════════════════════════════════════════
-- 043 · Cost Breakdown V2 — PR 3: Per-Deal Data Migration
-- ───────────────────────────────────────────────────────────────────────────────
-- Step 1: Re-key deal_cost_lines rows for aliased categories (old key → canonical).
--         Preserves estimated_amount / actual_amount / actual_overridden exactly.
-- Step 2: Backfill missing canonical category rows per deal with NULL amounts.
--         NULL, NOT the default — defaults are for new deals only.
-- Step 3: Environmental Permits special case — if any deal has a flat
--         environmental_permits row, convert it to environmental_permits.legacy_combined.
-- Step 4: Backfill parent_key on deal_cost_lines for the newly-inserted children.
-- Step 5: Parity verification — total_actual before vs after must match exactly.
--
-- DATA SAFETY GUARANTEE:
--   - No estimated_amount or actual_amount is changed on any pre-existing row.
--   - Only category_key, category_label, sort_order, group_name, parent_key
--     are updated on aliased rows (metadata only, not financial data).
--   - New rows are inserted with estimated_amount=NULL, actual_overridden=FALSE.
--   - If the parity check (§6) returns any rows, the migration flags them.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Pre-migration parity snapshot
-- ─────────────────────────────────────────────────────────────────────────────
-- Capture current total_actual per deal before any changes.
-- We compare against this in §6.

CREATE TEMP TABLE _pre_migration_totals AS
SELECT
  deal_id,
  org_id,
  COALESCE(SUM(
    CASE WHEN actual_overridden THEN COALESCE(actual_amount, 0)
         ELSE COALESCE(estimated_amount, 0)
    END
  ), 0) AS total_actual_before
FROM public.deal_cost_lines
GROUP BY deal_id, org_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Re-key aliased deal_cost_lines rows
-- ─────────────────────────────────────────────────────────────────────────────
-- For each alias in cost_breakdown_category_aliases, update matching
-- deal_cost_lines rows: update key, label, sort_order, group_name, parent_key.
-- Financial columns (estimated_amount, actual_amount, actual_overridden) untouched.

UPDATE public.deal_cost_lines dcl
SET
  category_key   = cbc.key,
  category_label = cbc.label,
  sort_order     = cbc.sort_order,
  group_name     = cbc.group_name,
  parent_key     = cbc.parent_key
FROM public.cost_breakdown_category_aliases alias
JOIN public.cost_breakdown_categories cbc
  ON cbc.key = alias.alias_of_key AND cbc.org_id IS NULL
WHERE dcl.category_key = alias.key;


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Update group_name + sort_order for Legacy deal_cost_lines rows
-- ─────────────────────────────────────────────────────────────────────────────
-- For rows whose category is now Legacy in the registry, reflect that in
-- deal_cost_lines so the UI can render them in the Legacy group at the bottom.
-- Financial data untouched.

UPDATE public.deal_cost_lines dcl
SET
  group_name = 'Legacy',
  sort_order = 9000 + dcl.sort_order  -- push to bottom
FROM public.cost_breakdown_categories cbc
WHERE dcl.category_key = cbc.key
  AND cbc.org_id IS NULL
  AND cbc.is_active = FALSE
  AND dcl.group_name <> 'Legacy';  -- idempotent


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Environmental Permits special case
-- ─────────────────────────────────────────────────────────────────────────────
-- If a deal has a flat 'environmental_permits' row with a non-zero estimated_amount,
-- convert it to 'environmental_permits.legacy_combined' (a child of the parent)
-- so the existing dollar value is preserved while the parent computes from children.
-- The parent row gets re-inserted with NULL (computed from children in UI).

-- 4a: Rename flat environmental_permits rows that have data to legacy_combined
UPDATE public.deal_cost_lines
SET
  category_key   = 'environmental_permits.legacy_combined',
  category_label = 'Legacy Combined (pre-restructure)',
  parent_key     = 'environmental_permits',
  sort_order     = 34  -- after the three canonical children
WHERE category_key = 'environmental_permits'
  AND (COALESCE(estimated_amount, 0) <> 0 OR actual_overridden = TRUE);

-- 4b: Insert the environmental_permits parent row for any deal that had its
-- flat row converted above (they now have legacy_combined child but no parent).
INSERT INTO public.deal_cost_lines
  (org_id, deal_id, category_key, category_label, sort_order, group_name,
   parent_key, estimated_amount, actual_amount, actual_overridden)
SELECT DISTINCT
  dcl.org_id,
  dcl.deal_id,
  'environmental_permits',
  'Environmental Permits',
  30,
  'Sitework',
  NULL,   -- top-level
  NULL,   -- computed from children
  NULL,
  FALSE
FROM public.deal_cost_lines dcl
WHERE dcl.category_key = 'environmental_permits.legacy_combined'
ON CONFLICT (deal_id, category_key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Backfill missing canonical rows per deal with NULL amounts
-- ─────────────────────────────────────────────────────────────────────────────
-- For each existing deal × each active global canonical category, if the deal
-- does NOT already have that category row, insert one with:
--   estimated_amount = NULL (blank — NOT the default amount)
--   actual_amount    = NULL
--   actual_overridden = FALSE
-- This ensures all deals show all 28 canonical rows in the UI.
-- ON CONFLICT DO NOTHING ensures no existing values are touched.

INSERT INTO public.deal_cost_lines
  (org_id, deal_id, category_key, category_label, sort_order, group_name,
   parent_key, estimated_amount, actual_amount, actual_overridden)
SELECT
  d.organization_id,
  d.id,
  cbc.key,
  cbc.label,
  cbc.sort_order,
  cbc.group_name,
  cbc.parent_key,
  NULL,   -- NULL, never the default — existing deals don't get defaults
  NULL,
  FALSE
FROM public.deals d
CROSS JOIN public.cost_breakdown_categories cbc
WHERE cbc.org_id IS NULL
  AND cbc.is_active = TRUE
  AND d.organization_id IS NOT NULL
ON CONFLICT (deal_id, category_key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Backfill parent_key on deal_cost_lines from registry
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.deal_cost_lines dcl
SET parent_key = cbc.parent_key
FROM public.cost_breakdown_categories cbc
WHERE dcl.category_key = cbc.key
  AND (cbc.org_id IS NULL OR cbc.org_id = dcl.org_id)
  AND dcl.parent_key IS DISTINCT FROM cbc.parent_key;


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  Parity verification — STOP if any deal drifts by even $1
-- ─────────────────────────────────────────────────────────────────────────────
-- Compute post-migration total_actual (leaf rows only) and compare to snapshot.
-- If this query returns any rows, a deal's total changed — investigate before
-- declaring the migration done.

CREATE TEMP TABLE _post_migration_totals AS
SELECT
  dcl.deal_id,
  dcl.org_id,
  COALESCE(SUM(
    CASE WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
         ELSE COALESCE(dcl.estimated_amount, 0)
    END
  ) FILTER (WHERE COALESCE(cbc.aggregation, 'none') = 'none'), 0) AS total_actual_after
FROM public.deal_cost_lines dcl
LEFT JOIN public.cost_breakdown_categories cbc
  ON cbc.key = dcl.category_key AND (cbc.org_id IS NULL OR cbc.org_id = dcl.org_id)
GROUP BY dcl.deal_id, dcl.org_id;

-- Return parity failures (should be 0 rows)
SELECT
  pre.deal_id,
  pre.total_actual_before,
  post.total_actual_after,
  post.total_actual_after - pre.total_actual_before AS drift
FROM _pre_migration_totals pre
JOIN _post_migration_totals post USING (deal_id, org_id)
WHERE ABS(post.total_actual_after - pre.total_actual_before) > 0
ORDER BY ABS(drift) DESC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN
-- ═══════════════════════════════════════════════════════════════════════════════
-- Rollback is complex since deal_cost_lines rows were re-keyed.
-- Use the cost_breakdown_category_aliases table to reverse key mappings:
--   UPDATE dcl SET category_key=a.key FROM aliases a WHERE dcl.category_key=a.alias_of_key;
-- Delete backfilled rows (estimated_amount IS NULL AND actual_overridden=FALSE AND
--   category_key IN canonical-new-keys AND created_at >= migration timestamp).
-- Re-run migration 040's backfill to restore original rows if needed.
-- ═══════════════════════════════════════════════════════════════════════════════
