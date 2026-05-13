-- Unify the calculator's input list across NC / SC / FL so each state's
-- calculator shows the same fields (the only state-specific differences
-- are the auto-tax lines: ncExciseTax for NC, scDeedStamps for SC,
-- docStampsDeed + intangibleTax for FL).
--
-- Adds three new fields to every state:
--   wetlandSurvey   — environmental survey for wetland-bordering lots
--   impactFee       — county-level new-construction impact fee
--   floodInsurance  — coastal-county flood insurance estimate
--
-- Also rounds out NC / SC with windInsurance / hoaTransfer / platRecording
-- so the rendered grid matches FL's coverage. State-specific tax fields
-- (ncExciseTax, scDeedStamps, docStampsDeed, intangibleTax) remain in their
-- respective state only.

UPDATE public.states_config
SET
  default_costs = '{
    "percTest":         800,
    "septicPermit":     450,
    "surveying":       1200,
    "wetlandSurvey":   1500,
    "attorneyClosing":  950,
    "ncExciseTax":     "auto",
    "platRecording":    25,
    "recordingFees":    64,
    "impactFee":         0,
    "windInsurance":     0,
    "floodInsurance":    0,
    "hoaTransfer":       0,
    "holdingCosts":      0
  }'::jsonb,
  visible_fields = ARRAY[
    'purchasePrice','closingCosts','percTest','septicPermit','surveying',
    'wetlandSurvey','attorneyClosing','ncExciseTax','platRecording',
    'recordingFees','impactFee','windInsurance','floodInsurance',
    'hoaTransfer','holdingCosts','rehabBudget','contingency',
    'subdivisionCost','permitting','utilityConnection'
  ],
  updated_at = now()
WHERE state = 'NC';

UPDATE public.states_config
SET
  default_costs = '{
    "percTest":         750,
    "septicPermit":     425,
    "surveying":       1100,
    "wetlandSurvey":   1400,
    "attorneyClosing": 1100,
    "scDeedStamps":   "auto",
    "platRecording":    25,
    "recordingFees":    15,
    "impactFee":         0,
    "windInsurance":     0,
    "floodInsurance":    0,
    "hoaTransfer":       0,
    "holdingCosts":      0
  }'::jsonb,
  visible_fields = ARRAY[
    'purchasePrice','closingCosts','percTest','septicPermit','surveying',
    'wetlandSurvey','attorneyClosing','scDeedStamps','platRecording',
    'recordingFees','impactFee','windInsurance','floodInsurance',
    'hoaTransfer','holdingCosts','rehabBudget','contingency',
    'subdivisionCost','permitting','utilityConnection'
  ],
  updated_at = now()
WHERE state = 'SC';

UPDATE public.states_config
SET
  default_costs = '{
    "percTest":         900,
    "septicPermit":     475,
    "surveying":       1300,
    "wetlandSurvey":   1600,
    "attorneyClosing": 1050,
    "docStampsDeed":  "auto",
    "intangibleTax":  "auto",
    "platRecording":    25,
    "recordingFees":    10,
    "impactFee":         0,
    "windInsurance":  1800,
    "floodInsurance":    0,
    "hoaTransfer":       0,
    "holdingCosts":      0
  }'::jsonb,
  visible_fields = ARRAY[
    'purchasePrice','closingCosts','percTest','septicPermit','surveying',
    'wetlandSurvey','attorneyClosing','docStampsDeed','intangibleTax',
    'platRecording','recordingFees','impactFee','windInsurance',
    'floodInsurance','hoaTransfer','holdingCosts','rehabBudget',
    'contingency','subdivisionCost','permitting','utilityConnection'
  ],
  updated_at = now()
WHERE state = 'FL';
