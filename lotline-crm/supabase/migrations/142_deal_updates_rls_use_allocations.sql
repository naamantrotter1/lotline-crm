-- ═══════════════════════════════════════════════════════════════════════════════
-- 142 · Switch deal_updates investor-read RLS off deals.investor
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Context
-- -------
-- Migration 001 created `deal_updates_investor_select` that scoped an
-- investor's read access by joining deals on the legacy `deals.investor`
-- text field. The `deals.investor` column is being dropped in 143; every
-- other investor-read policy already keys off deal_allocations.investor_id
-- (see migration 099's investor_read_allocated_deals).
--
-- Replace the policy so it scopes via deal_allocations: an investor can read
-- a deal_update iff they have an active allocation on the deal.
--
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "deal_updates_investor_select" ON public.deal_updates;

-- Match the pattern used by migration 099's investor_read_allocated_deals:
-- check auth_user_id / investor_users directly instead of the legacy
-- current_role_is() helper (which has been removed from later migrations).
CREATE POLICY "deal_updates_investor_select" ON public.deal_updates
  FOR SELECT USING (
    visibility = 'investor'
    AND EXISTS (
      SELECT 1
      FROM   public.deal_allocations da
      WHERE  da.deal_id = deal_updates.deal_id
        AND  da.status != 'returned'
        AND  da.amount  > 0
        AND  (
              da.investor_id IN (
                SELECT id FROM public.investors WHERE auth_user_id = auth.uid()
              )
              OR da.investor_id IN (
                SELECT investor_id FROM public.investor_users WHERE user_id = auth.uid()
              )
        )
    )
  );
