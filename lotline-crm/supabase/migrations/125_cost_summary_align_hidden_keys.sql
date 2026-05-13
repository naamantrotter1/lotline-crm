-- Re-aligns the deal_cost_summary_view's hidden-keys filter with the current
-- HIDDEN_KEYS set in CostBreakdownTab.jsx after two UI changes:
--
--   1) Migration 124 unhid the three Environmental Permits children
--      (Construction Authorization, Improvement Permit, Well Permit) so they
--      show in the Cost Breakdown UI again. The view was still excluding them
--      from total_estimated / total_actual, causing the rows to display but
--      not roll up into the deal header / dashboards / P&L.
--
--   2) "Water / Sewer Hook Up" (`water_sewer`) is now hidden from the UI —
--      it duplicated Public Water + Public Sewer and was retired from the
--      canonical registry. The view needs to exclude it from totals so a
--      legacy non-zero value on an old deal can't inflate the cost number.
--
-- New hidden-keys list (must match CostBreakdownTab.jsx HIDDEN_KEYS exactly):
--   environmental_permits   (parent grouping row, sum_of_children)
--   gutters
--   professional_photos
--   staging
--   water_sewer

CREATE OR REPLACE VIEW public.deal_cost_summary_view AS
SELECT
  dcl.deal_id,
  dcl.org_id,

  COALESCE(SUM(
    COALESCE(dcl.estimated_amount, 0)
  ) FILTER (
    WHERE COALESCE(cbc.aggregation, 'none') = 'none'
      AND dcl.category_key NOT IN (
        'environmental_permits',
        'gutters',
        'professional_photos',
        'staging',
        'water_sewer'
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
        'gutters',
        'professional_photos',
        'staging',
        'water_sewer'
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
        'gutters',
        'professional_photos',
        'staging',
        'water_sewer'
      )
  ), 0)                                                                   AS total_difference

FROM public.deal_cost_lines dcl
LEFT JOIN public.cost_breakdown_categories cbc
  ON cbc.key = dcl.category_key
GROUP BY dcl.deal_id, dcl.org_id;
