-- ─────────────────────────────────────────────────────────────────────────────
-- 096 · has_set_password flag on profiles
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   • profiles.has_set_password — true once an investor completes /investor-setup
--     (sets name + password). Used by InvestorLayout to guard the portal.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_set_password BOOLEAN NOT NULL DEFAULT false;

-- Backfill: investors who already have a name set have completed setup.
UPDATE public.profiles
SET has_set_password = true
WHERE (role = 'investor' OR account_type = 'investor')
  AND name IS NOT NULL
  AND name <> '';
