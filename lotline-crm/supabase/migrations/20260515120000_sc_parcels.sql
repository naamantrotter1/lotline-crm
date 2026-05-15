-- ═══════════════════════════════════════════════════════════════════════════════
-- SC parcel data integration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Imports the South Carolina parcel dataset produced by ~/lotline-sc-data/scripts.
-- 410k rows with real ownership/assessor data (Greenville, York, Sumter); the
-- remaining 2.2M centroid-only stubs from SCDOT are NOT imported here — they
-- continue to be served live from the SCDOT MapServer fallback in
-- api/proxy/parcel-boundaries.js.
--
-- Polygon geometry is NOT stored in this table. The 45 per-county GeoJSON files
-- (7.4GB unsimplified) live in Supabase Storage bucket `parcel-boundaries-sc`.
--
-- Refresh cadence: weekly via ~/lotline-sc-data/scripts/upsert_sc_parcels.py
-- which streams the latest sc_crm_ready.csv into this table using COPY +
-- ON CONFLICT DO UPDATE keyed on (parcel_id, county).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Main table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sc_parcels (
  id                    BIGSERIAL PRIMARY KEY,
  parcel_id             TEXT NOT NULL,
  county                TEXT NOT NULL,
  county_fips           TEXT,
  owner_name            TEXT,
  owner_mail_address    TEXT,
  owner_mail_city       TEXT,
  owner_mail_state      TEXT,
  owner_mail_zip        TEXT,
  absentee_owner        BOOLEAN,
  corporate_owner       BOOLEAN,
  property_address      TEXT,
  property_city         TEXT,
  property_zip          TEXT,
  acreage               NUMERIC,
  lot_sqft              NUMERIC,
  centroid_lat          DOUBLE PRECISION,
  centroid_lon          DOUBLE PRECISION,
  zoning_code           TEXT,
  zoning_desc           TEXT,
  land_use_code         TEXT,
  mobile_home_zone      BOOLEAN,
  sqft_living           NUMERIC,
  bedrooms              INTEGER,
  bathrooms             NUMERIC,
  year_built            INTEGER,
  structure_type        TEXT,
  is_mobile_home        BOOLEAN,
  num_structures        INTEGER,
  assessed_value        NUMERIC,
  market_value          NUMERIC,
  tax_delinquent        BOOLEAN,
  back_taxes_owed       NUMERIC,
  has_well              BOOLEAN,
  has_septic            BOOLEAN,
  well_and_septic       BOOLEAN,
  has_road_frontage     BOOLEAN,
  county_flood_zones    TEXT,
  county_pct_high_risk  NUMERIC,
  -- Derived PostGIS point for spatial queries
  centroid              GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN centroid_lat IS NOT NULL AND centroid_lon IS NOT NULL
        AND centroid_lat BETWEEN -90 AND 90 AND centroid_lon BETWEEN -180 AND 180
      THEN ST_SetSRID(ST_MakePoint(centroid_lon, centroid_lat), 4326)::geography
      ELSE NULL
    END
  ) STORED,
  -- Bookkeeping
  row_hash              TEXT,
  last_synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sc_parcels_pkey_natural UNIQUE (parcel_id, county)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sc_parcels_centroid
  ON sc_parcels USING GIST (centroid);

CREATE INDEX IF NOT EXISTS idx_sc_parcels_county
  ON sc_parcels (county);

CREATE INDEX IF NOT EXISTS idx_sc_parcels_owner_trgm
  ON sc_parcels USING gin (owner_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sc_parcels_addr_trgm
  ON sc_parcels USING gin (property_address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sc_parcels_parcel_id_trgm
  ON sc_parcels USING gin (parcel_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sc_parcels_acreage
  ON sc_parcels (acreage) WHERE acreage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sc_parcels_assessed_value
  ON sc_parcels (assessed_value) WHERE assessed_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sc_parcels_absentee
  ON sc_parcels (county) WHERE absentee_owner = true;

CREATE INDEX IF NOT EXISTS idx_sc_parcels_corporate
  ON sc_parcels (county) WHERE corporate_owner = true;

CREATE INDEX IF NOT EXISTS idx_sc_parcels_tax_delinquent
  ON sc_parcels (county) WHERE tax_delinquent = true;

CREATE INDEX IF NOT EXISTS idx_sc_parcels_mobile_home
  ON sc_parcels (county) WHERE is_mobile_home = true;

CREATE INDEX IF NOT EXISTS idx_sc_parcels_mh_zone
  ON sc_parcels (county) WHERE mobile_home_zone = true;

-- ─── Refresh log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sc_data_refresh_log (
  id                BIGSERIAL PRIMARY KEY,
  ran_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file       TEXT,
  rows_inserted     INTEGER,
  rows_updated      INTEGER,
  rows_unchanged    INTEGER,
  rows_skipped      INTEGER,
  duration_seconds  NUMERIC,
  status            TEXT NOT NULL DEFAULT 'ok',
  notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_sc_refresh_log_ran_at
  ON sc_data_refresh_log (ran_at DESC);

-- ─── RPC: parcels in bbox (drop-in for /api/proxy/parcel-boundaries SC branch) ─
-- Returns attribute rows for parcels whose centroid falls inside the bounding
-- box. The caller joins these with the polygon geometry from the per-county
-- GeoJSON file in Supabase Storage to produce the final FeatureCollection.
CREATE OR REPLACE FUNCTION sc_parcels_in_bbox(
  west       DOUBLE PRECISION,
  south      DOUBLE PRECISION,
  east       DOUBLE PRECISION,
  north      DOUBLE PRECISION,
  filters    JSONB DEFAULT '{}'::jsonb,
  max_rows   INTEGER DEFAULT 4000
)
RETURNS TABLE (
  parcel_id             TEXT,
  county                TEXT,
  owner_name            TEXT,
  owner_mail_state      TEXT,
  property_address      TEXT,
  property_city         TEXT,
  property_zip          TEXT,
  acreage               NUMERIC,
  centroid_lat          DOUBLE PRECISION,
  centroid_lon          DOUBLE PRECISION,
  zoning_code           TEXT,
  zoning_desc           TEXT,
  land_use_code         TEXT,
  mobile_home_zone      BOOLEAN,
  is_mobile_home        BOOLEAN,
  absentee_owner        BOOLEAN,
  corporate_owner       BOOLEAN,
  tax_delinquent        BOOLEAN,
  back_taxes_owed       NUMERIC,
  assessed_value        NUMERIC,
  market_value          NUMERIC,
  sqft_living           NUMERIC,
  bedrooms              INTEGER,
  bathrooms             NUMERIC,
  year_built            INTEGER,
  structure_type        TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.parcel_id, p.county, p.owner_name, p.owner_mail_state,
    p.property_address, p.property_city, p.property_zip,
    p.acreage, p.centroid_lat, p.centroid_lon,
    p.zoning_code, p.zoning_desc, p.land_use_code,
    p.mobile_home_zone, p.is_mobile_home,
    p.absentee_owner, p.corporate_owner, p.tax_delinquent, p.back_taxes_owed,
    p.assessed_value, p.market_value,
    p.sqft_living, p.bedrooms, p.bathrooms, p.year_built, p.structure_type
  FROM sc_parcels p
  WHERE p.centroid IS NOT NULL
    AND ST_Intersects(
      p.centroid,
      ST_MakeEnvelope(west, south, east, north, 4326)::geography
    )
    AND (filters->>'acresMin' IS NULL OR p.acreage >= (filters->>'acresMin')::numeric)
    AND (filters->>'acresMax' IS NULL OR p.acreage <= (filters->>'acresMax')::numeric)
    AND (filters->>'county'   IS NULL OR UPPER(p.county) LIKE UPPER('%'||(filters->>'county')||'%'))
    AND (filters->>'assessedMin' IS NULL OR p.assessed_value >= (filters->>'assessedMin')::numeric)
    AND (filters->>'assessedMax' IS NULL OR p.assessed_value <= (filters->>'assessedMax')::numeric)
    AND (NOT COALESCE((filters->>'absenteeOnly')::boolean, false)      OR p.absentee_owner = true)
    AND (NOT COALESCE((filters->>'corporateOnly')::boolean, false)     OR p.corporate_owner = true)
    AND (NOT COALESCE((filters->>'taxDelinquentOnly')::boolean, false) OR p.tax_delinquent = true)
    AND (NOT COALESCE((filters->>'mobileHomeOnly')::boolean, false)
         OR p.is_mobile_home = true OR p.mobile_home_zone = true)
    AND (NOT COALESCE((filters->>'vacantOnly')::boolean, false)
         OR p.is_mobile_home IS NOT TRUE AND COALESCE(p.num_structures, 0) = 0)
  LIMIT max_rows;
$$;

-- ─── RPC: parcel by id (drop-in for /api/proxy/parcel SC branch) ─────────────
CREATE OR REPLACE FUNCTION sc_parcel_by_id(
  p_parcel_id TEXT,
  p_county    TEXT DEFAULT NULL
)
RETURNS SETOF sc_parcels
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM sc_parcels
  WHERE parcel_id = p_parcel_id
    AND (p_county IS NULL OR county ILIKE p_county)
  LIMIT 1;
$$;

-- ─── RPC: text search (parcel_id / owner / address) ──────────────────────────
CREATE OR REPLACE FUNCTION sc_parcel_search(
  q          TEXT,
  p_county   TEXT DEFAULT NULL,
  p_limit    INTEGER DEFAULT 20
)
RETURNS SETOF sc_parcels
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM sc_parcels
  WHERE (
        parcel_id        ILIKE q || '%'
     OR owner_name       ILIKE '%' || q || '%'
     OR property_address ILIKE '%' || q || '%'
  )
  AND (p_county IS NULL OR county ILIKE p_county)
  ORDER BY
    CASE
      WHEN parcel_id        ILIKE q || '%'    THEN 1
      WHEN property_address ILIKE q || '%'    THEN 2
      WHEN owner_name       ILIKE q || '%'    THEN 3
      ELSE 4
    END,
    LENGTH(COALESCE(property_address, owner_name, parcel_id))
  LIMIT p_limit;
$$;

-- ─── RLS: public read (parcels are public record data) ───────────────────────
ALTER TABLE sc_parcels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sc_data_refresh_log    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_parcels public read"            ON sc_parcels;
CREATE POLICY        "sc_parcels public read"            ON sc_parcels             FOR SELECT USING (true);

DROP POLICY IF EXISTS "sc_data_refresh_log public read"   ON sc_data_refresh_log;
CREATE POLICY        "sc_data_refresh_log public read"   ON sc_data_refresh_log    FOR SELECT USING (true);

-- ─── Storage bucket for per-county polygon GeoJSON ───────────────────────────
-- Public bucket — same justification as public read on the table: this is
-- public record data already published by SCDOT. CDN caching is critical for
-- pan/zoom performance.
INSERT INTO storage.buckets (id, name, public)
VALUES ('parcel-boundaries-sc', 'parcel-boundaries-sc', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read polygons (public bucket).
DROP POLICY IF EXISTS "parcel polygons public read" ON storage.objects;
CREATE POLICY        "parcel polygons public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'parcel-boundaries-sc');

-- Only authenticated service role can upload (handled by service-role key in
-- the refresh script — no client uploads needed).
