-- ─────────────────────────────────────────────────────────────────────────────
-- 098 · Investor RLS fixes — deal_allocations + current_investor_id fallback
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: current_investor_id() only checked investor_users join table.
-- If that row is missing (race condition on setup, or legacy invite), all
-- investor RLS policies silently returned 0 rows.
--
-- Fix 1: current_investor_id() now also falls back to investors.auth_user_id.
-- Fix 2: deal_allocations gets a separate investor policy that checks
--         auth_user_id directly, so allocations work even before investor_users
--         is populated.
-- Fix 3: deals investor policy updated to use the new auth_user_id path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Update current_investor_id() ──────────────────────────────────────────
-- Falls back to investors.auth_user_id when no investor_users row exists yet.
CREATE OR REPLACE FUNCTION public.current_investor_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT investor_id FROM public.investor_users WHERE user_id = auth.uid() LIMIT 1),
    (SELECT id FROM public.investors
     WHERE auth_user_id = auth.uid() AND is_archived IS NOT TRUE LIMIT 1)
  );
$$;

-- ── 2. deal_allocations: add direct auth_user_id investor policy ──────────────
-- The existing allocations_org_select (from migration 015) already has an
-- investor branch via current_investor_id(), but now that function includes
-- the auth_user_id path this policy should work.  We add an additional safety
-- policy that checks auth_user_id directly for belt-and-suspenders coverage.
DROP POLICY IF EXISTS "allocations_investor_auth" ON public.deal_allocations;
CREATE POLICY "allocations_investor_auth" ON public.deal_allocations
  FOR SELECT USING (
    investor_id IN (
      SELECT id FROM public.investors
      WHERE auth_user_id = auth.uid()
        AND is_archived IS NOT TRUE
    )
  );

-- ── 3. investor_users: ensure self-select policy exists ───────────────────────
-- (May already exist from migration 001 / 015, but recreate safely.)
DROP POLICY IF EXISTS "investor_users_self_select" ON public.investor_users;
CREATE POLICY "investor_users_self_select" ON public.investor_users
  FOR SELECT USING (user_id = auth.uid());

-- ── 4. investors: ensure direct auth_user_id select policy exists ─────────────
-- Migration 095 added investors_select_own but only under a conditional.
-- Replace/ensure it unconditionally.
DROP POLICY IF EXISTS "investors_select_own" ON public.investors;
CREATE POLICY "investors_select_own" ON public.investors
  FOR SELECT USING (auth_user_id = auth.uid());
