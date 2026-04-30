-- ─────────────────────────────────────────────────────────────────────────────
-- 094 · Investor self-signup: separate auth flow from operator CRM
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   • profiles.account_type  enum ('operator'|'investor')
--   • investors.status       TEXT (self_registered | invited | linked)
--   • current_account_type() helper for RLS policies
--   • provision_investor_account() RPC called by investor signup page
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. profiles.account_type ─────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'operator'
  CONSTRAINT profiles_account_type_check CHECK (account_type IN ('operator', 'investor'));

-- Backfill: anyone with role='investor' is an investor account
UPDATE public.profiles
  SET account_type = 'investor'
  WHERE role = 'investor' AND account_type <> 'investor';

-- ── 2. investors.status ───────────────────────────────────────────────────────

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'invited'
  CONSTRAINT investors_status_check CHECK (status IN ('invited', 'self_registered', 'linked'));

-- Backfill: existing operator-invited records are 'invited'
UPDATE public.investors SET status = 'invited' WHERE status = 'invited';

-- ── 3. current_account_type() helper ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_account_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_type FROM public.profiles WHERE id = auth.uid()
$$;

COMMENT ON FUNCTION public.current_account_type() IS
  'Returns the account_type of the calling user. Used in RLS policies.';

-- ── 4. provision_investor_account() RPC ──────────────────────────────────────
-- Called by the investor signup page immediately after supabase.auth.signUp.
-- Sets account_type=investor on the profile, upserts an investors row with
-- status=self_registered, and links investor_users — all in one transaction.
-- Does NOT create an organization, membership, or seed any deals.

CREATE OR REPLACE FUNCTION public.provision_investor_account(
  p_email     TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_investor_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated — call provision_investor_account after signing in';
  END IF;

  -- 1. Mark the profile as an investor account (no org needed)
  UPDATE profiles SET
    account_type = 'investor',
    role         = 'investor',
    name         = COALESCE(NULLIF(trim(p_full_name), ''), email)
  WHERE id = v_user_id;

  -- 2. Check if this user already has a linked investor record
  SELECT iu.investor_id INTO v_investor_id
  FROM investor_users iu
  WHERE iu.user_id = v_user_id;

  IF v_investor_id IS NULL THEN
    -- 3. Create a new self-registered investor record (org will be linked by an operator later)
    INSERT INTO investors (name, email, status, organization_id)
    VALUES (trim(p_full_name), lower(trim(p_email)), 'self_registered', NULL)
    RETURNING id INTO v_investor_id;

    -- 4. Link profiles → investors via investor_users
    INSERT INTO investor_users (user_id, investor_id)
    VALUES (v_user_id, v_investor_id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    -- 5. If already linked, update the investor record's status to reflect self-registration
    UPDATE investors SET
      status = 'self_registered',
      name   = trim(p_full_name)
    WHERE id = v_investor_id AND status = 'invited';
  END IF;

  RETURN v_investor_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_investor_account(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.provision_investor_account(TEXT, TEXT) IS
  'Called by investor signup page. Sets account_type=investor on profile,
   creates a self_registered investors row (org NULL until operator links it),
   and writes the investor_users join row. No org/membership/deal side-effects.';

-- ── 5. RLS: block investor accounts from reading CRM data ────────────────────
-- Add a fast-path denial policy on the two most sensitive CRM tables.
-- Existing org-scoping already blocks unlinked users, but this makes the
-- intent explicit and prevents any future policy gap from leaking CRM data.

DO $$
BEGIN
  -- deals: investor accounts see nothing via this policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'deals'
      AND policyname = 'deals_block_investor_accounts'
  ) THEN
    CREATE POLICY "deals_block_investor_accounts" ON public.deals
      AS RESTRICTIVE
      FOR ALL
      USING (public.current_account_type() = 'operator');
  END IF;

  -- contacts: same
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contacts'
      AND policyname = 'contacts_block_investor_accounts'
  ) THEN
    CREATE POLICY "contacts_block_investor_accounts" ON public.contacts
      AS RESTRICTIVE
      FOR ALL
      USING (public.current_account_type() = 'operator');
  END IF;
END$$;
