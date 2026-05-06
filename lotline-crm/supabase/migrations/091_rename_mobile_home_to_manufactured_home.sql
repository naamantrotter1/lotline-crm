-- ─────────────────────────────────────────────────────────────────────────────
-- 091 · Rename "Mobile Home" → "Manufactured Home"
-- ─────────────────────────────────────────────────────────────────────────────

-- Update canonical category label
UPDATE public.cost_breakdown_categories
SET label = 'Manufactured Home'
WHERE key = 'mobile_home';

-- Update label on all existing deal_cost_lines rows
UPDATE public.deal_cost_lines
SET category_label = 'Manufactured Home'
WHERE category_key = 'mobile_home';
