-- ─────────────────────────────────────────────────────────────────────────────
-- 095 · Investor activation flow
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   • investors.auth_user_id   — links the activated investor to their auth user
--   • investors.activated_at   — timestamp of password-set activation
--   • investors.invited_by_name — operator name who sent the invite
--   • investors.invited_at     — timestamp invite was sent
--   • status constraint update — adds 'active' value
--   • activate_investor_account() RPC — called by /investor/activate page
--   • RLS: investors can SELECT/UPDATE their own row via auth_user_id
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. New columns on investors ───────────────────────────────────────────────

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS auth_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by_name TEXT,
  ADD COLUMN IF NOT EXISTS invited_at     TIMESTAMPTZ;

-- ── 2. Extend status check to include 'active' ────────────────────────────────

ALTER TABLE public.investors
  DROP CONSTRAINT IF EXISTS investors_status_check;

ALTER TABLE public.investors
  ADD CONSTRAINT investors_status_check
  CHECK (status IN ('invited', 'self_registered', 'linked', 'active'));

-- ── 3. Index for auth_user_id lookups ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS investors_auth_user_id_idx
  ON public.investors (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ── 4. activate_investor_account() RPC ───────────────────────────────────────
-- Called by the /investor/activate page after the user has set their password.
-- Atomically:
--   a. Links investors.auth_user_id = auth.uid()
--   b. Sets status='active', activated_at=now()
--   c. Upserts investor_users so AuthContext resolves investorRecord
--   d. Ensures profiles.account_type='investor' and role='investor'

CREATE OR REPLACE FUNCTION public.activate_investor_account(p_investor_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Link investor row to this auth user
  UPDATE investors SET
    auth_user_id  = v_uid,
    status        = 'active',
    activated_at  = now()
  WHERE id = p_investor_id;

  -- Ensure investor_users join row exists
  INSERT INTO investor_users (user_id, investor_id)
  VALUES (v_uid, p_investor_id)
  ON CONFLICT DO NOTHING;

  -- Mark profile as investor (upsert in case profile row was just created)
  INSERT INTO profiles (id, email, account_type, role)
  SELECT v_uid, u.email, 'investor', 'investor'
  FROM auth.users u WHERE u.id = v_uid
  ON CONFLICT (id) DO UPDATE SET
    account_type = 'investor',
    role         = 'investor';
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_investor_account(UUID) TO authenticated;

COMMENT ON FUNCTION public.activate_investor_account(UUID) IS
  'Called from /investor/activate after the invited user sets their password.
   Links investors.auth_user_id, sets status=active, upserts investor_users,
   and ensures profiles.account_type=investor.';

-- ── 5. RLS: investors can see and update their own row ────────────────────────

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- SELECT: investor sees their own row
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investors'
      AND policyname = 'investors_select_own'
  ) THEN
    CREATE POLICY "investors_select_own" ON public.investors
      FOR SELECT
      USING (auth_user_id = auth.uid());
  END IF;

  -- Operators (account_type='operator') can SELECT all investors in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investors'
      AND policyname = 'investors_select_operator'
  ) THEN
    CREATE POLICY "investors_select_operator" ON public.investors
      FOR SELECT
      USING (public.current_account_type() = 'operator');
  END IF;

  -- Operators can INSERT/UPDATE/DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'investors'
      AND policyname = 'investors_write_operator'
  ) THEN
    CREATE POLICY "investors_write_operator" ON public.investors
      FOR ALL
      USING (public.current_account_type() = 'operator')
      WITH CHECK (public.current_account_type() = 'operator');
  END IF;
END$$;
