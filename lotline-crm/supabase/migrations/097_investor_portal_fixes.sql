-- ─────────────────────────────────────────────────────────────────────────────
-- 097 · Investor portal fixes
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Allow investors to SELECT their own deals (deals RLS was operator-only).
-- 2. Add a unique partial index on investors(email, organization_id) so that
--    the PostgREST upsert with Prefer: resolution=merge-duplicates works and
--    prevents duplicate rows when re-inviting the same email.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Deals RLS — add investor branch ───────────────────────────────────────
-- The existing deals_org_select policy (from migration 015) only allowed
-- operators.  Investors could never query their own deals.
DROP POLICY IF EXISTS "deals_org_select" ON public.deals;

CREATE POLICY "deals_org_select" ON public.deals FOR SELECT
  USING (
    -- Operators (own org + JV partners)
    (organization_id = public.current_org_id() AND public.current_user_is_operator())
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
    -- Investors: see deals assigned to them by name OR via capital-stack allocations
    OR (
      public.current_user_is_investor()
      AND visible_to_investors = true
      AND (
        investor = (SELECT name FROM public.investors WHERE id = public.current_investor_id())
        OR EXISTS (
          SELECT 1 FROM public.deal_allocations da
          WHERE  da.deal_id     = deals.id
            AND  da.investor_id = public.current_investor_id()
        )
      )
    )
  );

-- ── 2. Unique partial index on investors(email, organization_id) ──────────────
-- Allows PostgREST resolution=merge-duplicates to work (prevents duplicate
-- investor rows when the same email is invited twice for the same org).
CREATE UNIQUE INDEX IF NOT EXISTS investors_email_org_uniq
  ON public.investors (lower(email), organization_id)
  WHERE organization_id IS NOT NULL
    AND email IS NOT NULL
    AND email <> '';
