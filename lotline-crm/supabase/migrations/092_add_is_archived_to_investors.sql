-- ─────────────────────────────────────────────────────────────────────────────
-- 092 · Add is_archived column to investors
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
