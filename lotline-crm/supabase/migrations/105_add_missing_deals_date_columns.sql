-- Migration 105: Add missing date / closing columns to deals table
--
-- These fields are mapped in dealToRow / rowToDeal (dealsSync.js) but were
-- never explicitly added via a migration — they existed in the original
-- pre-migration table for some orgs and not others.
-- Using ADD COLUMN IF NOT EXISTS makes this safe to run repeatedly.

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS close_date               DATE,
  ADD COLUMN IF NOT EXISTS contract_date            DATE,
  ADD COLUMN IF NOT EXISTS closing_date             DATE,
  ADD COLUMN IF NOT EXISTS delivery_date            DATE,
  ADD COLUMN IF NOT EXISTS dd_deadline              DATE,
  ADD COLUMN IF NOT EXISTS appraisal_date           DATE,
  ADD COLUMN IF NOT EXISTS fin_contingency          DATE,
  ADD COLUMN IF NOT EXISTS closing_attorney         TEXT,
  ADD COLUMN IF NOT EXISTS closing_attorney_phone   TEXT,
  ADD COLUMN IF NOT EXISTS closing_attorney_address TEXT,
  ADD COLUMN IF NOT EXISTS listing_url              TEXT,
  ADD COLUMN IF NOT EXISTS deal_owner               TEXT,
  ADD COLUMN IF NOT EXISTS contract_signed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manufacturer             TEXT,
  ADD COLUMN IF NOT EXISTS realtor                  TEXT,
  ADD COLUMN IF NOT EXISTS date_listed              DATE;
