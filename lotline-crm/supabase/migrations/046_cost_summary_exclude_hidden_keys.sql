-- Migration 046: Update deal_cost_summary_view to exclude hidden category keys
--
-- The cost breakdown tab hides certain categories from the UI (HIDDEN_KEYS in
-- CostBreakdownTab.jsx). These hidden lines should not contribute to the
-- total_actual used by deal headers, dashboards, P&L, and investor portal.
-- Previously, hidden lines with overrides would silently inflate totals.
--
-- Hidden keys excluded from totals (mirrors CostBreakdownTab.jsx HIDDEN_KEYS):
--   environmental_permits, environmental_permits.construction_authorization,
--   environmental_permits.improvement_permit, environmental_permits.well_permit,
--   gutters, professional_photos, staging

CREATE OR REPLACE VIEW public.deal_cost_summary_view AS
SELECT
  dcl.deal_id,
  dcl.org_id,

  -- Leaf-only, visible-only sums — no double-counting, no hidden key inflation
  COALESCE(SUM(
    COALESCE(dcl.estimated_amount, 0)
  ) FILTER (
    WHERE COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'environmental_permits.construction_authorization',
        'environmental_permits.improvement_permit',
        'environmental_permits.well_permit',
        'gutters',
        'professional_photos',
        'staging'
      )
  ), 0)                                                                   AS total_estimated,

  COALESCE(SUM(
    CASE
      WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
      ELSE COALESCE(dcl.estimated_amount, 0)
    END
  ) FILTER (
    WHERE COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'environmental_permits.construction_authorization',
        'environmental_permits.improvement_permit',
        'environmental_permits.well_permit',
        'gutters',
        'professional_photos',
        'staging'
      )
  ), 0)                                                                   AS total_actual,

  COALESCE(SUM(
    (CASE
      WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
      ELSE COALESCE(dcl.estimated_amount, 0)
    END) - COALESCE(dcl.estimated_amount, 0)
  ) FILTER (
    WHERE COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'environmental_permits.construction_authorization',
        'environmental_permits.improvement_permit',
        'environmental_permits.well_permit',
        'gutters',
        'professional_photos',
        'staging'
      )
  ), 0)                                                                   AS total_difference,

  COUNT(*) FILTER (
    WHERE dcl.actual_overridden
      AND COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'environmental_permits.construction_authorization',
        'environmental_permits.improvement_permit',
        'environmental_permits.well_permit',
        'gutters',
        'professional_photos',
        'staging'
      )
  )                                                                       AS override_count,

  COUNT(*) FILTER (
    WHERE COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'environmental_permits.construction_authorization',
        'environmental_permits.improvement_permit',
        'environmental_permits.well_permit',
        'gutters',
        'professional_photos',
        'staging'
      )
  )                                                                       AS line_count,

  MAX(dcl.actual_overridden_at) FILTER (
    WHERE dcl.actual_overridden
      AND COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'environmental_permits.construction_authorization',
        'environmental_permits.improvement_permit',
        'environmental_permits.well_permit',
        'gutters',
        'professional_photos',
        'staging'
      )
  )                                                                       AS last_actual_change_at

FROM public.deal_cost_lines dcl
LEFT JOIN public.cost_breakdown_categories cbc
  ON cbc.key = dcl.category_key
  AND (cbc.org_id IS NULL OR cbc.org_id = dcl.org_id)
GROUP BY dcl.deal_id, dcl.org_id;

COMMENT ON VIEW public.deal_cost_summary_view IS
  'Per-deal cost totals. Sums leaf lines only (aggregation = ''none'') and '
  'excludes hidden UI categories (environmental_permits.*, gutters, '
  'professional_photos, staging). Mirrors the Total Actual shown in '
  'CostBreakdownTab.jsx.';
