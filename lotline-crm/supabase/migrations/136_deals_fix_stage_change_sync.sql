-- ═══════════════════════════════════════════════════════════════════════════════
-- 136 · Fix Land Acquisition real-time stage-change sync
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Root-cause analysis
-- -------------------
-- 1. deals_member_update RLS policy (migration 104) restricts UPDATE to
--    operator+ roles.  Non-operator team members' stage changes are silently
--    rejected: Supabase returns {error: null, data: []} with 0 rows updated.
--    The change appears locally (React state) but reverts on refresh because
--    Supabase still has the old stage.  Other users never see the update
--    because no realtime event fires when the write is blocked.
--    Migration 114 already addressed this but may not be applied to
--    production.  This migration re-applies the fix idempotently.
--
-- 2. log_deal_stage_change trigger (migration 070) inserts into activity_notes
--    with author_id = auth.uid().  If auth.uid() is null for any reason the
--    INSERT fails (NOT NULL constraint on author_id), which rolls back the
--    entire UPDATE transaction.  Wrapping the INSERT in a BEGIN/EXCEPTION
--    block makes the trigger non-fatal — the audit note is skipped on error
--    but the deal UPDATE always commits.

BEGIN;

-- ── Fix 1: Relax deals UPDATE to any active org member ────────────────────────
-- (Idempotent re-application of migration 114)
DROP POLICY IF EXISTS "deals_member_update" ON public.deals;
CREATE POLICY "deals_member_update" ON public.deals FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ── Fix 2: Make stage-change audit trigger non-fatal ─────────────────────────
-- The EXCEPTION block catches any INSERT failure (null auth.uid, FK mismatch,
-- constraint violation, etc.) and emits a WARNING instead of rolling back the
-- deal UPDATE.
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage AND auth.uid() IS NOT NULL THEN
    BEGIN
      INSERT INTO public.activity_notes (
        id, organization_id, deal_id, author_id, author_name,
        body, note_type, created_at
      ) VALUES (
        gen_random_uuid(),
        NEW.organization_id,
        NEW.id,
        auth.uid(),
        COALESCE(
          (SELECT name FROM public.profiles WHERE id = auth.uid()),
          'System'
        ),
        'Stage changed from "' || COALESCE(OLD.stage, 'None') || '" to "' || NEW.stage || '"',
        'stage_change',
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[log_deal_stage_change] activity_notes insert failed for deal %: %',
        NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
