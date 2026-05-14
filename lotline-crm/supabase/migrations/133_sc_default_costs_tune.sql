-- ═══════════════════════════════════════════════════════════════════════════════
-- 133 · Tune SC-only default costs for the deal calculator
-- ───────────────────────────────────────────────────────────────────────────────
-- SC peels off from the migration-131 shared defaults so a handful of
-- SC-specific numbers can be updated. NC and FL rows are intentionally
-- not touched.
--
--   roughGrade    (Rough Grade)              $1,500 →     $0
--   electric      (Utility Power Connection) $2,000 → $1,000
--   setup         (Set Up)                   $9,000 → $10,000
--   footers       (Foundation / Footers)     $1,500 → $3,500
--   trimOut       (Trim Out)                 $2,800 →     $0
--   hvac          (HVAC)                     $4,500 → $6,500
--   landscaping   (Final Grade)              $2,500 → $1,800
--   decks         (Decks Installed)          $3,500 → $5,000
--   mobileTax     (Miscellaneous)                $0 → $5,000
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
    "roughGrade":          0,
    "septic":           7500,
    "water":           10000,
    "waterSewer":          0,
    "publicSewer":         0,
    "electric":         1000,
    "footers":          3500,
    "setup":           10000,
    "trimOut":             0,
    "hvac":             6500,
    "electrical":       2500,
    "plumbingConnection": 1750,
    "septicConnection":   1750,
    "underpinning":     4500,
    "driveway":         1200,
    "landscaping":      1800,
    "decks":            5000,
    "hudEngineer":       500,
    "mailbox":           170,
    "mobileTax":        5000
  }'::jsonb,
  updated_at = now()
WHERE state = 'SC';
