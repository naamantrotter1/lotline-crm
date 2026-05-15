-- ═══════════════════════════════════════════════════════════════════════════════
-- 135 · Update SC perc test / permit default to $2,675
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.states_config
SET
  default_costs = jsonb_set(default_costs, '{percTest}', '2675'),
  updated_at = now()
WHERE state = 'SC';
