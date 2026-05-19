-- ═══════════════════════════════════════════════════════════════════════════════
-- 144 · Allow allocated investors to read deal_documents
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Context
-- -------
-- deal_documents stores files uploaded by operators on a deal page. Until now
-- the RLS policy only granted SELECT to org members (operators), so the
-- investor portal couldn't see them. Investors expect to see the documents
-- attached to deals they're allocated to.
--
-- This policy uses the same allocation-based pattern as migrations 099 and 142:
-- an investor may read a deal_documents row iff they have an active
-- (non-returned, amount > 0) allocation on the deal.
--
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS "deal_documents_investor_select" ON public.deal_documents;

CREATE POLICY "deal_documents_investor_select" ON public.deal_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.deal_allocations da
      WHERE  da.deal_id = deal_documents.deal_id
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
