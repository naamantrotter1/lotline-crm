-- Supersedes migration 128. The new inputs (impactFee, floodInsurance,
-- wetlandSurvey) should appear ONLY in the Florida calculator. This rolls
-- NC and SC back to their original 126-era field lists and trims FL down
-- to its original fields + wetlandSurvey.
--
-- Apply this migration AFTER 128 (or in place of it if 128 hasn't been
-- run yet — the UPDATEs are idempotent and don't depend on 128 state).

UPDATE public.states_config
SET
  default_costs = '{
    "percTest":        800,
    "septicPermit":    450,
    "surveying":      1200,
    "attorneyClosing": 950,
    "ncExciseTax":    "auto",
    "recordingFees":   64,
    "holdingCosts":     0
  }'::jsonb,
  visible_fields = ARRAY[
    'purchasePrice','closingCosts','percTest','septicPermit','surveying',
    'attorneyClosing','ncExciseTax','recordingFees','holdingCosts',
    'rehabBudget','contingency','subdivisionCost','permitting','utilityConnection'
  ],
  updated_at = now()
WHERE state = 'NC';

UPDATE public.states_config
SET
  default_costs = '{
    "percTest":         750,
    "septicPermit":     425,
    "surveying":       1100,
    "attorneyClosing": 1100,
    "scDeedStamps":   "auto",
    "platRecording":    25,
    "recordingFees":    15
  }'::jsonb,
  visible_fields = ARRAY[
    'purchasePrice','closingCosts','percTest','septicPermit','surveying',
    'attorneyClosing','scDeedStamps','platRecording','recordingFees',
    'holdingCosts','rehabBudget','contingency','subdivisionCost','permitting',
    'utilityConnection'
  ],
  updated_at = now()
WHERE state = 'SC';

-- Florida keeps its original fields + the new `wetlandSurvey`.
UPDATE public.states_config
SET
  default_costs = '{
    "surveying":      1300,
    "wetlandSurvey":  1600,
    "docStampsDeed": "auto",
    "intangibleTax": "auto",
    "impactFee":         0,
    "windInsurance":  1800,
    "floodInsurance":    0,
    "recordingFees":    10
  }'::jsonb,
  visible_fields = ARRAY[
    'purchasePrice','closingCosts','surveying','wetlandSurvey',
    'docStampsDeed','intangibleTax','impactFee','windInsurance',
    'floodInsurance','recordingFees','holdingCosts','rehabBudget',
    'contingency','subdivisionCost','permitting','utilityConnection',
    'hoaTransfer'
  ],
  updated_at = now()
WHERE state = 'FL';
