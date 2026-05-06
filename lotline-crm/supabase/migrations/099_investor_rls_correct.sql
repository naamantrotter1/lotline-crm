-- ─────────────────────────────────────────────────────────────────────────────
-- 099 · Correct investor RLS — check auth_user_id directly
-- ─────────────────────────────────────────────────────────────────────────────
-- The existing policies depend on current_investor_id() which reads
-- investor_users.  If that join row is missing the investor sees nothing.
-- These new policies check auth_user_id and investor_users directly so
-- investors can always read their own data regardless of join table state.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── investors ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_read_own_record" ON public.investors;
CREATE POLICY "investor_read_own_record" ON public.investors
FOR SELECT USING (
  auth_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.investor_users
    WHERE investor_users.investor_id = investors.id
      AND investor_users.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND organization_id = investors.organization_id
  )
);

-- ── deal_allocations ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_read_own_allocs" ON public.deal_allocations;
CREATE POLICY "investor_read_own_allocs" ON public.deal_allocations
FOR SELECT USING (
  investor_id IN (
    SELECT id FROM public.investors WHERE auth_user_id = auth.uid()
  )
  OR investor_id IN (
    SELECT investor_id FROM public.investor_users WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND organization_id = deal_allocations.organization_id
  )
);

-- ── deals ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_read_allocated_deals" ON public.deals;
CREATE POLICY "investor_read_allocated_deals" ON public.deals
FOR SELECT USING (
  id IN (
    SELECT da.deal_id FROM public.deal_allocations da
    JOIN public.investors inv ON da.investor_id = inv.id
    WHERE inv.auth_user_id = auth.uid()
  )
  OR id IN (
    SELECT da.deal_id FROM public.deal_allocations da
    JOIN public.investor_users iu ON da.investor_id = iu.investor_id
    WHERE iu.user_id = auth.uid()
  )
  OR organization_id IN (
    SELECT organization_id FROM public.memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- ── investor_users ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_read_own_investor_users" ON public.investor_users;
CREATE POLICY "investor_read_own_investor_users" ON public.investor_users
FOR SELECT USING (user_id = auth.uid());
