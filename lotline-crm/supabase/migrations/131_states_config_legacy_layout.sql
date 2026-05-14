-- ═══════════════════════════════════════════════════════════════════════════════
-- 131 · Align NC / SC / FL calculators on the legacy field set
-- ───────────────────────────────────────────────────────────────────────────────
-- Supersedes the abstract "purchasePrice / closingCosts / attorneyClosing /
-- platRecording" field list seeded by migration 129. The three state-aware
-- calculators now share the construction-cost field list that the legacy
-- (non-state-aware) calculator uses — same inputs, same defaults, same labels.
--
-- Florida additionally exposes two FL-specific extras at the end of its
-- visible_fields list:
--   • wetlandSurvey  — environmental survey for wetland-bordering lots
--   • impactFee      — county-level new-construction impact fee
--
-- Auto-tax fields (ncExciseTax / scDeedStamps / docStampsDeed / intangibleTax)
-- are intentionally dropped from visible_fields. They stayed locked-read-only
-- before and have always been folded into the "Selling Costs %" input on the
-- legacy view; keeping them out of visible_fields makes the rendered grid
-- identical across states.
--
-- The defaults below mirror the `defaultValues` constant in
-- src/pages/DealCalculator.jsx so seeding a fresh deal looks the same whether
-- the user has resolved a state yet or not.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Build the common defaults JSON once via a CTE so the three UPDATEs can't
-- drift apart.
WITH legacy_defaults AS (
  SELECT '{
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
    "electric":         2000,
    "footers":          1500,
    "setup":            9000,
    "trimOut":          2800,
    "hvac":             4500,
    "electrical":       2500,
    "plumbingConnection": 1750,
    "septicConnection":   1750,
    "underpinning":     4500,
    "driveway":         1200,
    "landscaping":      2500,
    "decks":            3500,
    "hudEngineer":       500,
    "mailbox":           170,
    "mobileTax":           0
  }'::jsonb AS j
)
UPDATE public.states_config s
SET
  default_costs = legacy_defaults.j,
  visible_fields = ARRAY[
    'land','percTest','survey','constructionAuth','improvementPermit',
    'wellPermit','mobileHome','landClearing','roughGrade','septic','water',
    'waterSewer','publicSewer','electric','footers','setup','trimOut','hvac',
    'electrical','plumbingConnection','septicConnection','underpinning',
    'driveway','landscaping','decks','hudEngineer','mailbox','mobileTax'
  ],
  updated_at = now()
FROM legacy_defaults
WHERE s.state IN ('NC','SC');

-- Florida = same legacy set + wetlandSurvey + impactFee at the end.
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
    "electric":         2000,
    "footers":          1500,
    "setup":            9000,
    "trimOut":          2800,
    "hvac":             4500,
    "electrical":       2500,
    "plumbingConnection": 1750,
    "septicConnection":   1750,
    "underpinning":     4500,
    "driveway":         1200,
    "landscaping":      2500,
    "decks":            3500,
    "hudEngineer":       500,
    "mailbox":           170,
    "mobileTax":           0,
    "wetlandSurvey":       0,
    "impactFee":           0
  }'::jsonb,
  visible_fields = ARRAY[
    'land','percTest','survey','constructionAuth','improvementPermit',
    'wellPermit','mobileHome','landClearing','roughGrade','septic','water',
    'waterSewer','publicSewer','electric','footers','setup','trimOut','hvac',
    'electrical','plumbingConnection','septicConnection','underpinning',
    'driveway','landscaping','decks','hudEngineer','mailbox','mobileTax',
    'wetlandSurvey','impactFee'
  ],
  updated_at = now()
WHERE state = 'FL';
