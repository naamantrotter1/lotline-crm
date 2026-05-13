-- Adds a `miscellaneous` canonical cost-breakdown category so it shows up in
-- the Cost Breakdown tab. The Deal Calculator already has a Miscellaneous
-- row but the breakdown registry was missing one — so the two lists drifted.
--
-- Also retires the legacy `mobile_tax` key (the calc's original key for the
-- "Miscellaneous" slot) by registering it as an alias of the new key.

-- 1. Insert the canonical row
INSERT INTO public.cost_breakdown_categories
  (org_id, key, label, sort_order, group_name, default_amount, aggregation, parent_key, is_active)
VALUES
  (NULL, 'miscellaneous', 'Miscellaneous', 250, 'Other', NULL, 'none', NULL, TRUE)
ON CONFLICT (org_id, key) DO UPDATE SET
  label          = EXCLUDED.label,
  sort_order     = EXCLUDED.sort_order,
  group_name     = EXCLUDED.group_name,
  default_amount = EXCLUDED.default_amount,
  aggregation    = EXCLUDED.aggregation,
  parent_key     = EXCLUDED.parent_key,
  is_active      = TRUE;

-- 2. Register the legacy alias so any deal_cost_lines still pointing at
--    `mobile_tax` resolve to the new `miscellaneous` row.
INSERT INTO public.cost_breakdown_category_aliases (key, alias_of_key, notes) VALUES
  ('mobile_tax', 'miscellaneous',
    'Renamed: "Mobile Home Tax" / "Miscellaneous" calc slot → "Miscellaneous" canonical row')
ON CONFLICT (key) DO UPDATE SET
  alias_of_key = EXCLUDED.alias_of_key,
  notes        = EXCLUDED.notes;

-- 3. Backfill missing canonical rows on every existing deal.
--    Covers the new `miscellaneous` row plus the three environmental-permit
--    children that we now also surface in the UI (Construction Authorization,
--    Improvement Permit, Well Permit). Without this backfill, deals created
--    before these rows existed would have empty slots in the breakdown.
WITH backfill_keys (key) AS (
  VALUES
    ('miscellaneous'),
    ('environmental_permits.construction_authorization'),
    ('environmental_permits.improvement_permit'),
    ('environmental_permits.well_permit')
)
INSERT INTO public.deal_cost_lines
  (org_id, deal_id, category_key, category_label, sort_order, group_name,
   parent_key, estimated_amount)
SELECT
  d.organization_id,
  d.id,
  cbc.key,
  cbc.label,
  cbc.sort_order,
  cbc.group_name,
  cbc.parent_key,
  cbc.default_amount
FROM public.deals d
CROSS JOIN public.cost_breakdown_categories cbc
WHERE cbc.org_id IS NULL
  AND cbc.is_active = TRUE
  AND cbc.key IN (SELECT key FROM backfill_keys)
  AND NOT EXISTS (
    SELECT 1 FROM public.deal_cost_lines dcl
    WHERE dcl.deal_id = d.id AND dcl.category_key = cbc.key
  );
