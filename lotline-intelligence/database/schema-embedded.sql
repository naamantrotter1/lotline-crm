-- LotLine Intelligence — Schema (no PostGIS, compatible with embedded-postgres)

-- ─── Counties ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counties (
  id                      SERIAL PRIMARY KEY,
  fips_code               VARCHAR(5) UNIQUE NOT NULL,
  name                    VARCHAR(100) NOT NULL,
  state                   CHAR(2) NOT NULL CHECK (state IN ('NC', 'SC')),
  centroid_lat            DECIMAL(9,6),
  centroid_lng            DECIMAL(9,6),
  population              INTEGER,
  population_growth_pct   DECIMAL(5,2),
  median_household_income DECIMAL(12,2),
  median_home_value       DECIMAL(12,2),
  housing_units           INTEGER,
  renter_pct              DECIMAL(5,2),
  owner_pct               DECIMAL(5,2),
  unemployment_rate       DECIMAL(5,2),
  flood_risk_pct          DECIMAL(5,2),
  mh_friendly_zoning      BOOLEAN DEFAULT FALSE,
  priority_market         BOOLEAN DEFAULT FALSE,
  mh_shipments_annual     INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counties_state ON counties(state);
CREATE INDEX IF NOT EXISTS idx_counties_fips  ON counties(fips_code);

-- ─── Listings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mls_id              VARCHAR(50) UNIQUE,
  county_id           INTEGER REFERENCES counties(id),
  zip_code            VARCHAR(10),
  lat                 DECIMAL(9,6),
  lng                 DECIMAL(9,6),
  address             TEXT,
  list_price          DECIMAL(12,2),
  price_per_acre      DECIMAL(12,2),
  acreage             DECIMAL(8,2),
  bedrooms            SMALLINT,
  bathrooms           DECIMAL(4,1),
  sqft                INTEGER,
  days_on_market      INTEGER,
  list_date           DATE,
  status              VARCHAR(20) DEFAULT 'Active',
  property_type       VARCHAR(50),
  year_built          SMALLINT,
  well_septic         BOOLEAN DEFAULT FALSE,
  public_utilities    BOOLEAN DEFAULT FALSE,
  flood_zone          VARCHAR(10),
  source              VARCHAR(20) DEFAULT 'mock',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_county   ON listings(county_id);
CREATE INDEX IF NOT EXISTS idx_listings_zip      ON listings(zip_code);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_price    ON listings(list_price);
CREATE INDEX IF NOT EXISTS idx_listings_acreage  ON listings(acreage);
CREATE INDEX IF NOT EXISTS idx_listings_coords   ON listings(lat, lng);

-- ─── Sold Comps ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sold_comps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mls_id              VARCHAR(50) UNIQUE,
  county_id           INTEGER REFERENCES counties(id),
  zip_code            VARCHAR(10),
  lat                 DECIMAL(9,6),
  lng                 DECIMAL(9,6),
  address             TEXT,
  list_price          DECIMAL(12,2),
  sale_price          DECIMAL(12,2),
  price_per_acre      DECIMAL(12,2),
  acreage             DECIMAL(8,2),
  bedrooms            SMALLINT,
  bathrooms           DECIMAL(4,1),
  sqft                INTEGER,
  days_on_market      INTEGER,
  list_date           DATE,
  close_date          DATE,
  list_to_sale_ratio  DECIMAL(5,2),
  property_type       VARCHAR(50),
  year_built          SMALLINT,
  source              VARCHAR(20) DEFAULT 'mock',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comps_county     ON sold_comps(county_id);
CREATE INDEX IF NOT EXISTS idx_comps_zip        ON sold_comps(zip_code);
CREATE INDEX IF NOT EXISTS idx_comps_close_date ON sold_comps(close_date);
CREATE INDEX IF NOT EXISTS idx_comps_price      ON sold_comps(sale_price);
CREATE INDEX IF NOT EXISTS idx_comps_acreage    ON sold_comps(acreage);

-- ─── Market Stats ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_stats (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id               INTEGER REFERENCES counties(id),
  zip_code                VARCHAR(10),
  period                  VARCHAR(10) NOT NULL,
  acreage_bucket          VARCHAR(20) DEFAULT 'all',
  active_listings         INTEGER DEFAULT 0,
  sold_count              INTEGER DEFAULT 0,
  median_list_price       DECIMAL(12,2),
  median_sale_price       DECIMAL(12,2),
  median_price_per_acre   DECIMAL(12,2),
  avg_list_price          DECIMAL(12,2),
  avg_sale_price          DECIMAL(12,2),
  median_days_on_market   DECIMAL(6,1),
  avg_days_on_market      DECIMAL(6,1),
  absorption_rate_pct     DECIMAL(5,2),
  months_of_supply        DECIMAL(6,2),
  sell_through_rate_pct   DECIMAL(5,2),
  list_to_sale_ratio_pct  DECIMAL(5,2),
  avg_acreage             DECIMAL(8,2),
  demand_score            DECIMAL(5,1),
  opportunity_score       DECIMAL(5,1),
  calculated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(county_id, zip_code, period, acreage_bucket)
);

CREATE INDEX IF NOT EXISTS idx_stats_county ON market_stats(county_id);
CREATE INDEX IF NOT EXISTS idx_stats_period ON market_stats(period);
CREATE INDEX IF NOT EXISTS idx_stats_scores ON market_stats(opportunity_score, demand_score);

-- ─── Deals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id           INTEGER REFERENCES counties(id),
  zip_code            VARCHAR(10),
  lat                 DECIMAL(9,6),
  lng                 DECIMAL(9,6),
  address             TEXT,
  parcel_id           VARCHAR(50),
  pipeline            VARCHAR(30) DEFAULT 'development',
  acquisition_price   DECIMAL(12,2),
  home_cost           DECIMAL(12,2),
  closing_costs       DECIMAL(12,2) DEFAULT 0,
  carrying_costs      DECIMAL(12,2) DEFAULT 0,
  install_costs       DECIMAL(12,2) DEFAULT 0,
  all_in_cost         DECIMAL(12,2),
  target_sale_price   DECIMAL(12,2),
  projected_profit    DECIMAL(12,2),
  projected_roi_pct   DECIMAL(5,2),
  actual_sale_price   DECIMAL(12,2),
  actual_profit       DECIMAL(12,2),
  actual_roi_pct      DECIMAL(5,2),
  status              VARCHAR(30) DEFAULT 'prospecting',
  contract_date       DATE,
  close_date          DATE,
  list_date           DATE,
  sale_close_date     DATE,
  days_to_close       INTEGER,
  acreage             DECIMAL(8,2),
  home_model          VARCHAR(100),
  sqft                INTEGER,
  bedrooms            SMALLINT,
  bathrooms           DECIMAL(4,1),
  notes               TEXT,
  assigned_to         VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_county   ON deals(county_id);
CREATE INDEX IF NOT EXISTS idx_deals_status   ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline);

-- ─── Ingestion Log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_log (
  id          SERIAL PRIMARY KEY,
  source      VARCHAR(50) NOT NULL,
  status      VARCHAR(20) NOT NULL,
  records_in  INTEGER DEFAULT 0,
  records_out INTEGER DEFAULT 0,
  error_msg   TEXT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- ─── Zip Codes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zip_codes (
  id          SERIAL PRIMARY KEY,
  zip_code    VARCHAR(10) UNIQUE NOT NULL,
  county_id   INTEGER REFERENCES counties(id),
  state       CHAR(2),
  city        VARCHAR(100),
  lat         DECIMAL(9,6),
  lng         DECIMAL(9,6)
);

CREATE INDEX IF NOT EXISTS idx_zip_county ON zip_codes(county_id);

-- ─── Update trigger ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_counties_updated
  BEFORE UPDATE ON counties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_listings_updated
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_comps_updated
  BEFORE UPDATE ON sold_comps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_deals_updated
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
