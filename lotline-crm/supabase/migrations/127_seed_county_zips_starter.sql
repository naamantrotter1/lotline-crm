-- ═══════════════════════════════════════════════════════════════════════════════
-- 127 · county_zips starter seed — NC, SC, FL
-- ───────────────────────────────────────────────────────────────────────────────
-- This is a STARTER seed: the three Vitest scenario ZIPs (27514 / 29412 /
-- 33101) plus a curated set of high-population ZIPs per state so the
-- calculator works on day one without needing the full HUD crosswalk import.
--
-- For the complete ~5,000-row HUD USPS ZIP→County crosswalk, run
-- `node scripts/seed-zip-county.mjs path/to/HUD_ZIP_COUNTY.csv` after
-- downloading from https://www.huduser.gov/portal/datasets/usps_crosswalk.html
-- — the script upserts in batches and marks the highest residential-ratio
-- county as is_primary for each multi-county ZIP.
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.county_zips (zip_code, county_id, state, is_primary)
SELECT z.zip_code, c.id, z.state, z.is_primary
FROM (VALUES
  -- ── NC starter ────────────────────────────────────────────────────────────
  -- Test scenario: 27514 → Orange County (Chapel Hill)
  ('27514','37135','NC',TRUE),
  ('27517','37135','NC',TRUE),
  ('27510','37135','NC',TRUE),
  -- Wake (Raleigh)
  ('27601','37183','NC',TRUE),('27603','37183','NC',TRUE),('27604','37183','NC',TRUE),
  ('27606','37183','NC',TRUE),('27607','37183','NC',TRUE),('27609','37183','NC',TRUE),
  -- Mecklenburg (Charlotte)
  ('28202','37119','NC',TRUE),('28203','37119','NC',TRUE),('28204','37119','NC',TRUE),
  ('28205','37119','NC',TRUE),('28206','37119','NC',TRUE),('28207','37119','NC',TRUE),
  -- Durham
  ('27701','37063','NC',TRUE),('27703','37063','NC',TRUE),('27705','37063','NC',TRUE),
  ('27707','37063','NC',TRUE),('27713','37063','NC',TRUE),
  -- Guilford (Greensboro)
  ('27401','37081','NC',TRUE),('27403','37081','NC',TRUE),('27405','37081','NC',TRUE),
  -- Forsyth (Winston-Salem)
  ('27101','37067','NC',TRUE),('27103','37067','NC',TRUE),('27107','37067','NC',TRUE),
  -- Buncombe (Asheville)
  ('28801','37021','NC',TRUE),('28803','37021','NC',TRUE),('28806','37021','NC',TRUE),
  -- New Hanover (Wilmington)
  ('28401','37129','NC',TRUE),('28403','37129','NC',TRUE),('28405','37129','NC',TRUE),

  -- ── SC starter ────────────────────────────────────────────────────────────
  -- Test scenario: 29412 → Charleston County (James Island / Charleston)
  ('29401','45019','SC',TRUE),('29403','45019','SC',TRUE),('29407','45019','SC',TRUE),
  ('29412','45019','SC',TRUE),('29414','45019','SC',TRUE),('29455','45019','SC',TRUE),
  -- Richland (Columbia)
  ('29201','45079','SC',TRUE),('29203','45079','SC',TRUE),('29204','45079','SC',TRUE),
  ('29205','45079','SC',TRUE),('29206','45079','SC',TRUE),('29209','45079','SC',TRUE),
  -- Greenville
  ('29601','45045','SC',TRUE),('29605','45045','SC',TRUE),('29607','45045','SC',TRUE),
  ('29609','45045','SC',TRUE),('29611','45045','SC',TRUE),('29615','45045','SC',TRUE),
  -- Horry (Myrtle Beach)
  ('29577','45051','SC',TRUE),('29579','45051','SC',TRUE),('29588','45051','SC',TRUE),
  -- Spartanburg
  ('29301','45083','SC',TRUE),('29302','45083','SC',TRUE),('29303','45083','SC',TRUE),
  -- Berkeley
  ('29456','45015','SC',TRUE),('29483','45015','SC',TRUE),('29484','45015','SC',TRUE),
  -- Lexington
  ('29072','45063','SC',TRUE),('29073','45063','SC',TRUE),('29170','45063','SC',TRUE),
  -- Dorchester
  ('29420','45035','SC',TRUE),('29485','45035','SC',TRUE),

  -- ── FL starter ────────────────────────────────────────────────────────────
  -- Test scenario: 33101 → Miami-Dade County
  ('33101','12086','FL',TRUE),('33125','12086','FL',TRUE),('33126','12086','FL',TRUE),
  ('33127','12086','FL',TRUE),('33128','12086','FL',TRUE),('33129','12086','FL',TRUE),
  ('33130','12086','FL',TRUE),('33131','12086','FL',TRUE),('33132','12086','FL',TRUE),
  ('33133','12086','FL',TRUE),('33134','12086','FL',TRUE),('33135','12086','FL',TRUE),
  -- Broward (Fort Lauderdale)
  ('33301','12011','FL',TRUE),('33304','12011','FL',TRUE),('33308','12011','FL',TRUE),
  ('33311','12011','FL',TRUE),('33312','12011','FL',TRUE),('33316','12011','FL',TRUE),
  -- Palm Beach
  ('33401','12099','FL',TRUE),('33405','12099','FL',TRUE),('33406','12099','FL',TRUE),
  ('33409','12099','FL',TRUE),('33411','12099','FL',TRUE),('33414','12099','FL',TRUE),
  -- Orange (Orlando)
  ('32801','12095','FL',TRUE),('32803','12095','FL',TRUE),('32804','12095','FL',TRUE),
  ('32806','12095','FL',TRUE),('32807','12095','FL',TRUE),('32808','12095','FL',TRUE),
  -- Hillsborough (Tampa)
  ('33602','12057','FL',TRUE),('33603','12057','FL',TRUE),('33605','12057','FL',TRUE),
  ('33606','12057','FL',TRUE),('33607','12057','FL',TRUE),('33609','12057','FL',TRUE),
  -- Pinellas (St. Petersburg / Clearwater)
  ('33701','12103','FL',TRUE),('33702','12103','FL',TRUE),('33703','12103','FL',TRUE),
  ('33704','12103','FL',TRUE),('33705','12103','FL',TRUE),
  -- Duval (Jacksonville)
  ('32202','12031','FL',TRUE),('32204','12031','FL',TRUE),('32205','12031','FL',TRUE),
  ('32207','12031','FL',TRUE),('32208','12031','FL',TRUE),('32209','12031','FL',TRUE),
  -- Lee (Cape Coral / Fort Myers)
  ('33901','12071','FL',TRUE),('33904','12071','FL',TRUE),('33907','12071','FL',TRUE),
  ('33909','12071','FL',TRUE),
  -- Collier (Naples)
  ('34102','12021','FL',TRUE),('34103','12021','FL',TRUE),('34104','12021','FL',TRUE),
  -- Sarasota
  ('34236','12115','FL',TRUE),('34237','12115','FL',TRUE),('34239','12115','FL',TRUE)
) AS z(zip_code, fips_code, state, is_primary)
JOIN public.counties c ON c.fips_code = z.fips_code
ON CONFLICT (zip_code, county_id) DO UPDATE SET
  state      = EXCLUDED.state,
  is_primary = EXCLUDED.is_primary;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────────
-- Expected: zip_row_count > 100, and the three test ZIPs resolve to the
-- expected counties.

CREATE OR REPLACE VIEW public._calc_v2_zip_seed_check AS
SELECT
  (SELECT COUNT(*) FROM public.county_zips)                                AS total_zip_rows,
  (SELECT COUNT(*) FROM public.county_zips WHERE state='NC')               AS nc_zip_count,
  (SELECT COUNT(*) FROM public.county_zips WHERE state='SC')               AS sc_zip_count,
  (SELECT COUNT(*) FROM public.county_zips WHERE state='FL')               AS fl_zip_count,
  (SELECT c.county_name FROM public.county_zips z
     JOIN public.counties c ON c.id = z.county_id
     WHERE z.zip_code='27514' AND z.is_primary LIMIT 1)                    AS zip_27514_resolves_to,
  (SELECT c.county_name FROM public.county_zips z
     JOIN public.counties c ON c.id = z.county_id
     WHERE z.zip_code='29412' AND z.is_primary LIMIT 1)                    AS zip_29412_resolves_to,
  (SELECT c.county_name FROM public.county_zips z
     JOIN public.counties c ON c.id = z.county_id
     WHERE z.zip_code='33101' AND z.is_primary LIMIT 1)                    AS zip_33101_resolves_to;
