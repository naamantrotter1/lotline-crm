-- ═══════════════════════════════════════════════════════════════════════════════
-- 138 · Fix deal_milestones status check constraint
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Root cause
-- ----------
-- Migration 002 created deal_milestones with:
--   status CHECK (status IN ('pending','in_progress','complete','skipped'))
--
-- Migration 060 intended to change this to ('not_started','in_progress','complete')
-- but used CREATE TABLE IF NOT EXISTS — a no-op since the table already existed.
-- The old constraint was never replaced, so any code that writes 'not_started'
-- (the DD/Dev pipelines and the one-time localStorage migration) gets a CHECK
-- constraint violation and the write silently fails.
--
-- Fix: drop whatever status check constraint exists and replace it with one
-- that accepts all values used by the codebase: not_started, pending (legacy),
-- in_progress, complete, skipped.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all existing CHECK constraints on deal_milestones that reference status
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'public.deal_milestones'::regclass
      AND  contype  = 'c'
      AND  pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE public.deal_milestones DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE public.deal_milestones
  ADD CONSTRAINT deal_milestones_status_check
    CHECK (status IN ('not_started', 'pending', 'in_progress', 'complete', 'skipped'));

-- Also update the default to 'not_started' (aligns with application code)
ALTER TABLE public.deal_milestones
  ALTER COLUMN status SET DEFAULT 'not_started';
