-- 148 · Update Florida calculator default costs + reorder wetlandSurvey
--
-- Changes from user request:
--   impactFee:     0      → 15000
--   decks:         3500   → 5000
--   septic:        7500   → 15000
--   mobileHome:    78000  → 80000
--   wetlandSurvey: 0      → 1500
--
-- Also moves wetlandSurvey to appear directly after percTest in visible_fields
-- (previously it was at the end before impactFee).

UPDATE public.states_config
SET
  default_costs = '{
    "land":                0,
    "percTest":         2000,
    "survey":           1500,
    "constructionAuth":  400,
    "improvementPermit": 400,
    "wellPermit":        400,
    "mobileHome":      80000,
    "landClearing":        0,
    "roughGrade":       1500,
    "septic":          15000,
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
    "decks":            5000,
    "hudEngineer":       500,
    "mailbox":           170,
    "mobileTax":           0,
    "wetlandSurvey":    1500,
    "impactFee":       15000
  }'::jsonb,
  visible_fields = ARRAY[
    'land','percTest','wetlandSurvey','survey','constructionAuth','improvementPermit',
    'wellPermit','mobileHome','landClearing','roughGrade','septic','water',
    'waterSewer','publicSewer','electric','footers','setup','trimOut','hvac',
    'electrical','plumbingConnection','septicConnection','underpinning',
    'driveway','landscaping','decks','hudEngineer','mailbox','mobileTax',
    'impactFee'
  ],
  updated_at = now()
WHERE state = 'FL';
