-- ═══════════════════════════════════════════════════════════════════════════════
-- 132 · Tune NC-only default costs for the deal calculator
-- ───────────────────────────────────────────────────────────────────────────────
-- Migration 131 seeded NC and SC with the same legacy field defaults via a
-- shared CTE. This migration peels NC's defaults off so a few NC-specific
-- numbers can be updated without touching SC or FL:
--
--   electric      (Utility Power Connection)  $2,000 →  $1,000
--   setup         (Set Up)                    $9,000 → $10,000
--   hvac          (HVAC)                      $4,500 →  $5,500
--   underpinning  (Skirting)                  $4,500 →  $5,200
--
-- All other NC fields (mobileHome, septic, water, etc.) keep their migration-
-- 131 values. SC and FL rows are intentionally not touched — their defaults
-- stay as they are.
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.states_config
SET
  default_costs = '{
    "land":                0,
    "percTest":         2000,
    "survey":           1500,
    "constructionAuth":  400,
    "improvementPermit": 400,
    "wellPermit":        400,
    "mobileHome":      78000,
    "landClearing":        0,
    "roughGrade":       1500,
    "septic":           7500,
    "water":           10000,
    "waterSewer":          0,
    "publicSewer":         0,
    "electric":         1000,
    "footers":          1500,
    "setup":           10000,
    "trimOut":          2800,
    "hvac":             5500,
    "electrical":       2500,
    "plumbingConnection": 1750,
    "septicConnection":   1750,
    "underpinning":     5200,
    "driveway":         1200,
    "landscaping":      2500,
    "decks":            3500,
    "hudEngineer":       500,
    "mailbox":           170,
    "mobileTax":           0
  }'::jsonb,
  updated_at = now()
WHERE state = 'NC';
