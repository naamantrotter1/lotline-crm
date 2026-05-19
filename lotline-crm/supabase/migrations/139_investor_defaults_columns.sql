-- ═══════════════════════════════════════════════════════════════════════════════
-- 139 · Add per-investor financing default columns
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Context
-- -------
-- Today, per-investor financing defaults (interest rate, origination fee,
-- servicing fee, profit share) are hardcoded by NAME STRING in
-- src/data/deals.js (e.g. `if (investor === 'Atium Build Group LLC') return 13`).
-- This couples the application to investor display names and breaks when an
-- investor is renamed.
--
-- Part of the broader deprecation of `deals.investor` as a source of truth in
-- favor of `deal_allocations.investor_id`. This migration adds the columns;
-- the application will switch to reading from them in a follow-up.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS default_interest_rate_pct    numeric,
  ADD COLUMN IF NOT EXISTS default_origination_fee_pct  numeric,
  ADD COLUMN IF NOT EXISTS default_servicing_fee_flat   numeric,
  ADD COLUMN IF NOT EXISTS default_profit_share_pct     numeric;

-- ── Backfill known values from src/data/deals.js ─────────────────────────────
-- These exact-string matches mirror the hardcoded helpers in the app today.
-- Investors not listed here will fall through to the application's default
-- (interest_rate=12, origination_fee=2%, etc.).

UPDATE public.investors SET default_interest_rate_pct = 13
  WHERE name IN ('Atium Build Group LLC', 'Louis Isom')
    AND default_interest_rate_pct IS NULL;

UPDATE public.investors SET default_interest_rate_pct = 14
  WHERE name IN ('Blue Bay Capital', 'Windstone')
    AND default_interest_rate_pct IS NULL;
