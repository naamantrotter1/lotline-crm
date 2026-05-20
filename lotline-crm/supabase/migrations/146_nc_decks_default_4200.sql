-- ═══════════════════════════════════════════════════════════════════════════════
-- 146 · Bump NC "Decks Installed" default cost from $3,500 to $4,200
-- ───────────────────────────────────────────────────────────────────────────────
-- Migration 132 set NC.default_costs.decks = 3500. Operator now wants the NC
-- calculator to seed Decks Installed at $4,200 by default. SC and FL rows are
-- intentionally untouched.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.states_config
SET
  default_costs = jsonb_set(default_costs, '{decks}', '4200'::jsonb, false),
  updated_at = now()
WHERE state = 'NC';
