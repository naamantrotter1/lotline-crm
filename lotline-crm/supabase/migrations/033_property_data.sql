-- Phase 20: Property Data
-- Table: property_lookups (cache for 3rd-party property data pulls)

CREATE TABLE property_lookups (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES profiles(id),
  deal_id         text,
  address         text        NOT NULL,
  parcel_id       text,
  provider        text        NOT NULL DEFAULT 'attom', -- 'attom'|'regrid'|'propstream'
  raw_data        jsonb       NOT NULL DEFAULT '{}',
  -- Normalized fields
  owner_name      text,
  owner_mailing   text,
  assessed_value  numeric,
  market_value    numeric,
  lot_size_sqft   numeric,
  year_built      int,
  zoning          text,
  land_use        text,
  flood_zone      text,
  last_sale_date  date,
  last_sale_price numeric,
  tax_amount      numeric,
  latitude        numeric,
  longitude       numeric,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE direct_mail_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid        NOT NULL REFERENCES profiles(id),
  name            text        NOT NULL,
  template_id     text,         -- Lob template ID
  recipient_count int         NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'draft', -- draft|sending|sent|failed
  lob_campaign_id text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON property_lookups(organization_id);
CREATE INDEX ON property_lookups(deal_id);
CREATE INDEX ON property_lookups(address);
CREATE INDEX ON direct_mail_jobs(organization_id);

ALTER TABLE property_lookups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_mail_jobs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read property_lookups" ON property_lookups
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "operators manage property_lookups" ON property_lookups
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
    )
  );

CREATE POLICY "org members read direct_mail_jobs" ON direct_mail_jobs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "operators manage direct_mail_jobs" ON direct_mail_jobs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','operator')
    )
  );
