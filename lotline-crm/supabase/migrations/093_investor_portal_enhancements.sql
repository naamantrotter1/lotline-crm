-- ─────────────────────────────────────────────────────────────────────────────
-- 093 · Investor portal enhancements
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Notification preference on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preference TEXT NOT NULL DEFAULT 'Email';

-- 2. organization_id on investors (for multi-tenant scoping)
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 3. Ensure investor_users table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.investor_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.investor_users ENABLE ROW LEVEL SECURITY;

-- Re-create policies (idempotent with IF NOT EXISTS equivalent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='investor_users' AND policyname='investor_users_admin'
  ) THEN
    CREATE POLICY "investor_users_admin" ON public.investor_users
      FOR ALL USING (public.current_role_is('admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='investor_users' AND policyname='investor_users_self_select'
  ) THEN
    CREATE POLICY "investor_users_self_select" ON public.investor_users
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END$$;
