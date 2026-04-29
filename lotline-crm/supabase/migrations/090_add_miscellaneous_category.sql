-- ─────────────────────────────────────────────────────────────────────────────
-- 090 · Add miscellaneous category + update perc_test label
-- ─────────────────────────────────────────────────────────────────────────────

-- Add Miscellaneous as a canonical category at the end (sort_order 250)
INSERT INTO public.cost_breakdown_categories
  (org_id, key, label, sort_order, group_name, default_amount, aggregation, parent_key, is_active)
VALUES
  (NULL, 'miscellaneous', 'Miscellaneous', 250, 'Other', 0, 'none', NULL, TRUE)
ON CONFLICT (org_id, key) DO UPDATE SET
  label          = EXCLUDED.label,
  sort_order     = EXCLUDED.sort_order,
  group_name     = EXCLUDED.group_name,
  default_amount = EXCLUDED.default_amount,
  is_active      = TRUE;

-- Update perc_test label to match UI ("Perc Test / Permit")
UPDATE public.cost_breakdown_categories
SET label = 'Perc Test / Permit'
WHERE org_id IS NULL AND key = 'perc_test';

-- Seed miscellaneous line into any existing deals that don't have it yet
-- (fn_seed_deal_cost_lines only runs on INSERT of new deals; this backfills existing)
INSERT INTO public.deal_cost_lines
  (org_id, deal_id, category_key, category_label, sort_order, group_name, parent_key, estimated_amount)
SELECT
  d.organization_id,
  d.id,
  'miscellaneous',
  'Miscellaneous',
  250,
  'Other',
  NULL,
  0
FROM public.deals d
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_cost_lines dcl
  WHERE dcl.deal_id = d.id AND dcl.category_key = 'miscellaneous'
);
