-- ═══════════════════════════════════════════════════════════════════════════════
-- 145 · Allow allocated investors to read deal_cost_lines
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Context
-- -------
-- The investor portal needs to show a line-by-line build-cost breakdown for
-- deals an investor is allocated to. Current `dcl_select` is org-only
-- (memberships). Add a parallel policy that grants investors SELECT when
-- they hold an active (non-returned, amount > 0) allocation on the deal.
--
-- Same allocation-based pattern as migrations 099 / 142 / 144.

DROP POLICY IF EXISTS "dcl_investor_select" ON public.deal_cost_lines;

CREATE POLICY "dcl_investor_select" ON public.deal_cost_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.deal_allocations da
      WHERE  da.deal_id = deal_cost_lines.deal_id
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
