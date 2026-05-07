-- 116_deals_estimated_sale_date.sql
-- Adds an `estimated_sale_date` column to deals so financing-tab cost
-- calculations can be driven by the actual expected hold (deployed → sale)
-- rather than the contractual term length.
--
-- Safe to re-run.

BEGIN;

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS estimated_sale_date date;

COMMIT;
