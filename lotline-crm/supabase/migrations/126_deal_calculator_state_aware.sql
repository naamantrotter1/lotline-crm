-- ═══════════════════════════════════════════════════════════════════════════════
-- 126 · Deal Calculator V2 — State-aware schema (NC, SC, FL only)
-- ───────────────────────────────────────────────────────────────────────────────
-- Tables created
--   states_config       (3 rows: NC, SC, FL)
--   counties            (213 rows: 100 NC + 46 SC + 67 FL, FIPS-keyed)
--   county_zips         (empty; HUD crosswalk seeded in a follow-up migration)
--
-- Phase A only. Heat-map metrics column exists but is left empty; the data
-- feed is deferred (operator decision). Calculator UI rewrites + ZIP seeding
-- ship in subsequent commits.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  states_config — global registry of states the calculator supports
-- ─────────────────────────────────────────────────────────────────────────────
-- visible_fields is the whitelist the calculator UI iterates over for this
--   state. Any field not in the list is hidden.
-- default_costs holds dollar values OR the literal string 'auto' for fields
--   that are computed from purchase_price / loan amount via tax_formulas.
-- tax_formulas holds the rates used by lib/taxes.ts at compute time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.states_config (
  state          TEXT PRIMARY KEY
    CHECK (state IN ('NC','SC','FL')),
  display_name   TEXT NOT NULL,
  default_costs  JSONB NOT NULL,
  visible_fields TEXT[] NOT NULL,
  tax_formulas   JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.states_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "states_config read open to authed"
  ON public.states_config FOR SELECT
  TO authenticated
  USING (TRUE);

-- Writes restricted to org owner / admin. We don't carry organization_id on
-- this global table; instead we gate on the requester having owner/admin in
-- ANY membership row. Tighter scoping can be added later if needed.
CREATE POLICY "states_config write owner/admin"
  ON public.states_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  counties — one row per county, FIPS-keyed
-- ─────────────────────────────────────────────────────────────────────────────
-- This is a NEW table; the existing County Database page uses a local JS file
-- + localStorage and has no Supabase backing. Future migration can lift the
-- per-county SOP JSON (zoning / deeds / water / etc.) into a separate column
-- on this table; out of scope for Phase A.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.counties (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state             TEXT NOT NULL
    CHECK (state IN ('NC','SC','FL')),
  county_name       TEXT NOT NULL,
  fips_code         TEXT NOT NULL UNIQUE,
  default_costs     JSONB NOT NULL DEFAULT '{}'::jsonb,
  heat_map_metrics  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state, county_name)
);

CREATE INDEX IF NOT EXISTS counties_state_idx ON public.counties (state);

ALTER TABLE public.counties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counties read open to authed"
  ON public.counties FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "counties write owner/admin"
  ON public.counties FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  county_zips — ZIP → county crosswalk, NC/SC/FL only
-- ─────────────────────────────────────────────────────────────────────────────
-- Populated in a follow-up migration with HUD USPS data. A single zip can map
-- to multiple counties (border ZIPs); is_primary marks the highest residential
-- ratio one so the resolver can pick a default without prompting.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.county_zips (
  zip_code   TEXT NOT NULL,
  county_id  UUID NOT NULL REFERENCES public.counties(id) ON DELETE CASCADE,
  state      TEXT NOT NULL
    CHECK (state IN ('NC','SC','FL')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (zip_code, county_id)
);

CREATE INDEX IF NOT EXISTS county_zips_zip_idx   ON public.county_zips (zip_code);
CREATE INDEX IF NOT EXISTS county_zips_state_idx ON public.county_zips (state);

ALTER TABLE public.county_zips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "county_zips read open to authed"
  ON public.county_zips FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "county_zips write owner/admin"
  ON public.county_zips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Seed states_config — NC, SC, FL
-- ─────────────────────────────────────────────────────────────────────────────
-- default_costs entries with value 'auto' are computed at the UI/tax layer
-- from purchasePrice (deed/excise taxes) or loanAmount (intangible tax).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.states_config (state, display_name, default_costs, visible_fields, tax_formulas)
VALUES
  ('NC', 'North Carolina',
    '{
      "percTest": 800,
      "septicPermit": 450,
      "surveying": 1200,
      "attorneyClosing": 950,
      "ncExciseTax": "auto",
      "recordingFees": 64,
      "holdingCosts": 0
    }'::jsonb,
    ARRAY[
      'purchasePrice','closingCosts','percTest','septicPermit','surveying',
      'attorneyClosing','ncExciseTax','recordingFees','holdingCosts',
      'rehabBudget','contingency','subdivisionCost','permitting','utilityConnection'
    ],
    '{ "ncExciseRate": 0.002 }'::jsonb
  ),
  ('SC', 'South Carolina',
    '{
      "percTest": 750,
      "septicPermit": 425,
      "surveying": 1100,
      "attorneyClosing": 1100,
      "scDeedStamps": "auto",
      "platRecording": 25,
      "recordingFees": 15
    }'::jsonb,
    ARRAY[
      'purchasePrice','closingCosts','percTest','septicPermit','surveying',
      'attorneyClosing','scDeedStamps','platRecording','recordingFees',
      'holdingCosts','rehabBudget','contingency','subdivisionCost','permitting',
      'utilityConnection'
    ],
    '{ "scDeedStampRate": 0.00370 }'::jsonb
  ),
  ('FL', 'Florida',
    '{
      "surveying": 1300,
      "docStampsDeed": "auto",
      "intangibleTax": "auto",
      "impactFee": 0,
      "windInsurance": 1800,
      "floodInsurance": 0,
      "recordingFees": 10
    }'::jsonb,
    ARRAY[
      'purchasePrice','closingCosts','surveying','docStampsDeed','intangibleTax',
      'impactFee','windInsurance','floodInsurance','recordingFees',
      'holdingCosts','rehabBudget','contingency','subdivisionCost','permitting',
      'utilityConnection','hoaTransfer'
    ],
    '{ "docStampsDeedRate": 0.007, "intangibleTaxRate": 0.002 }'::jsonb
  )
ON CONFLICT (state) DO UPDATE SET
  display_name   = EXCLUDED.display_name,
  default_costs  = EXCLUDED.default_costs,
  visible_fields = EXCLUDED.visible_fields,
  tax_formulas   = EXCLUDED.tax_formulas,
  updated_at     = now();


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Seed counties — 100 NC, 46 SC, 67 FL (213 rows)
-- ─────────────────────────────────────────────────────────────────────────────
-- FIPS codes follow Census standard (state FIPS + 3-digit county FIPS, e.g.
-- "37001" = Alamance County, NC). ON CONFLICT keeps existing rows untouched
-- if this migration is replayed.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.counties (state, county_name, fips_code) VALUES
  -- ── NORTH CAROLINA (100) ─────────────────────────────────────────────────
  ('NC','Alamance','37001'),('NC','Alexander','37003'),('NC','Alleghany','37005'),
  ('NC','Anson','37007'),('NC','Ashe','37009'),('NC','Avery','37011'),
  ('NC','Beaufort','37013'),('NC','Bertie','37015'),('NC','Bladen','37017'),
  ('NC','Brunswick','37019'),('NC','Buncombe','37021'),('NC','Burke','37023'),
  ('NC','Cabarrus','37025'),('NC','Caldwell','37027'),('NC','Camden','37029'),
  ('NC','Carteret','37031'),('NC','Caswell','37033'),('NC','Catawba','37035'),
  ('NC','Chatham','37037'),('NC','Cherokee','37039'),('NC','Chowan','37041'),
  ('NC','Clay','37043'),('NC','Cleveland','37045'),('NC','Columbus','37047'),
  ('NC','Craven','37049'),('NC','Cumberland','37051'),('NC','Currituck','37053'),
  ('NC','Dare','37055'),('NC','Davidson','37057'),('NC','Davie','37059'),
  ('NC','Duplin','37061'),('NC','Durham','37063'),('NC','Edgecombe','37065'),
  ('NC','Forsyth','37067'),('NC','Franklin','37069'),('NC','Gaston','37071'),
  ('NC','Gates','37073'),('NC','Graham','37075'),('NC','Granville','37077'),
  ('NC','Greene','37079'),('NC','Guilford','37081'),('NC','Halifax','37083'),
  ('NC','Harnett','37085'),('NC','Haywood','37087'),('NC','Henderson','37089'),
  ('NC','Hertford','37091'),('NC','Hoke','37093'),('NC','Hyde','37095'),
  ('NC','Iredell','37097'),('NC','Jackson','37099'),('NC','Johnston','37101'),
  ('NC','Jones','37103'),('NC','Lee','37105'),('NC','Lenoir','37107'),
  ('NC','Lincoln','37109'),('NC','McDowell','37111'),('NC','Macon','37113'),
  ('NC','Madison','37115'),('NC','Martin','37117'),('NC','Mecklenburg','37119'),
  ('NC','Mitchell','37121'),('NC','Montgomery','37123'),('NC','Moore','37125'),
  ('NC','Nash','37127'),('NC','New Hanover','37129'),('NC','Northampton','37131'),
  ('NC','Onslow','37133'),('NC','Orange','37135'),('NC','Pamlico','37137'),
  ('NC','Pasquotank','37139'),('NC','Pender','37141'),('NC','Perquimans','37143'),
  ('NC','Person','37145'),('NC','Pitt','37147'),('NC','Polk','37149'),
  ('NC','Randolph','37151'),('NC','Richmond','37153'),('NC','Robeson','37155'),
  ('NC','Rockingham','37157'),('NC','Rowan','37159'),('NC','Rutherford','37161'),
  ('NC','Sampson','37163'),('NC','Scotland','37165'),('NC','Stanly','37167'),
  ('NC','Stokes','37169'),('NC','Surry','37171'),('NC','Swain','37173'),
  ('NC','Transylvania','37175'),('NC','Tyrrell','37177'),('NC','Union','37179'),
  ('NC','Vance','37181'),('NC','Wake','37183'),('NC','Warren','37185'),
  ('NC','Washington','37187'),('NC','Watauga','37189'),('NC','Wayne','37191'),
  ('NC','Wilkes','37193'),('NC','Wilson','37195'),('NC','Yadkin','37197'),
  ('NC','Yancey','37199'),

  -- ── SOUTH CAROLINA (46) ──────────────────────────────────────────────────
  ('SC','Abbeville','45001'),('SC','Aiken','45003'),('SC','Allendale','45005'),
  ('SC','Anderson','45007'),('SC','Bamberg','45009'),('SC','Barnwell','45011'),
  ('SC','Beaufort','45013'),('SC','Berkeley','45015'),('SC','Calhoun','45017'),
  ('SC','Charleston','45019'),('SC','Cherokee','45021'),('SC','Chester','45023'),
  ('SC','Chesterfield','45025'),('SC','Clarendon','45027'),('SC','Colleton','45029'),
  ('SC','Darlington','45031'),('SC','Dillon','45033'),('SC','Dorchester','45035'),
  ('SC','Edgefield','45037'),('SC','Fairfield','45039'),('SC','Florence','45041'),
  ('SC','Georgetown','45043'),('SC','Greenville','45045'),('SC','Greenwood','45047'),
  ('SC','Hampton','45049'),('SC','Horry','45051'),('SC','Jasper','45053'),
  ('SC','Kershaw','45055'),('SC','Lancaster','45057'),('SC','Laurens','45059'),
  ('SC','Lee','45061'),('SC','Lexington','45063'),('SC','McCormick','45065'),
  ('SC','Marion','45067'),('SC','Marlboro','45069'),('SC','Newberry','45071'),
  ('SC','Oconee','45073'),('SC','Orangeburg','45075'),('SC','Pickens','45077'),
  ('SC','Richland','45079'),('SC','Saluda','45081'),('SC','Spartanburg','45083'),
  ('SC','Sumter','45085'),('SC','Union','45087'),('SC','Williamsburg','45089'),
  ('SC','York','45091'),

  -- ── FLORIDA (67) ─────────────────────────────────────────────────────────
  ('FL','Alachua','12001'),('FL','Baker','12003'),('FL','Bay','12005'),
  ('FL','Bradford','12007'),('FL','Brevard','12009'),('FL','Broward','12011'),
  ('FL','Calhoun','12013'),('FL','Charlotte','12015'),('FL','Citrus','12017'),
  ('FL','Clay','12019'),('FL','Collier','12021'),('FL','Columbia','12023'),
  ('FL','DeSoto','12027'),('FL','Dixie','12029'),('FL','Duval','12031'),
  ('FL','Escambia','12033'),('FL','Flagler','12035'),('FL','Franklin','12037'),
  ('FL','Gadsden','12039'),('FL','Gilchrist','12041'),('FL','Glades','12043'),
  ('FL','Gulf','12045'),('FL','Hamilton','12047'),('FL','Hardee','12049'),
  ('FL','Hendry','12051'),('FL','Hernando','12053'),('FL','Highlands','12055'),
  ('FL','Hillsborough','12057'),('FL','Holmes','12059'),('FL','Indian River','12061'),
  ('FL','Jackson','12063'),('FL','Jefferson','12065'),('FL','Lafayette','12067'),
  ('FL','Lake','12069'),('FL','Lee','12071'),('FL','Leon','12073'),
  ('FL','Levy','12075'),('FL','Liberty','12077'),('FL','Madison','12079'),
  ('FL','Manatee','12081'),('FL','Marion','12083'),('FL','Martin','12085'),
  ('FL','Miami-Dade','12086'),('FL','Monroe','12087'),('FL','Nassau','12089'),
  ('FL','Okaloosa','12091'),('FL','Okeechobee','12093'),('FL','Orange','12095'),
  ('FL','Osceola','12097'),('FL','Palm Beach','12099'),('FL','Pasco','12101'),
  ('FL','Pinellas','12103'),('FL','Polk','12105'),('FL','Putnam','12107'),
  ('FL','St. Johns','12109'),('FL','St. Lucie','12111'),('FL','Santa Rosa','12113'),
  ('FL','Sarasota','12115'),('FL','Seminole','12117'),('FL','Sumter','12119'),
  ('FL','Suwannee','12121'),('FL','Taylor','12123'),('FL','Union','12125'),
  ('FL','Volusia','12127'),('FL','Wakulla','12129'),('FL','Walton','12131'),
  ('FL','Washington','12133')
ON CONFLICT (fips_code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Miami-Dade FL override
-- ─────────────────────────────────────────────────────────────────────────────
-- Miami-Dade has the only county-level doc-stamps deed rate in FL (0.6%
-- instead of the state 0.7%) and a higher impact fee. Stored on the
-- county-level default_costs so the resolver merges it over state defaults.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.counties
SET default_costs = jsonb_build_object(
      'docStampsDeedRate', 0.006,
      'impactFee', 4200
    )
WHERE fips_code = '12086';


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  Verification view (read-only, safe to query)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public._calc_v2_seed_check AS
SELECT
  (SELECT COUNT(*) FROM public.states_config)                     AS states_seeded,
  (SELECT COUNT(*) FROM public.counties WHERE state='NC')         AS nc_county_count,
  (SELECT COUNT(*) FROM public.counties WHERE state='SC')         AS sc_county_count,
  (SELECT COUNT(*) FROM public.counties WHERE state='FL')         AS fl_county_count,
  (SELECT COUNT(*) FROM public.county_zips)                       AS zip_row_count,
  (SELECT default_costs->>'docStampsDeedRate'
     FROM public.counties WHERE fips_code='12086')                AS miami_dade_doc_stamps_rate;
