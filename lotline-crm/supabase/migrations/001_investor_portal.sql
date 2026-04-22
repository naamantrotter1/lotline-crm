-- ============================================================
-- LotLine CRM — Investor Portal Migration
-- Run this against your Supabase project SQL editor.
-- ============================================================

-- ── 1. investors (canonical investor records) ─────────────────
CREATE TABLE IF NOT EXISTS public.investors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  contact             TEXT,
  email               TEXT,
  phone               TEXT,
  type                TEXT DEFAULT 'Private Lender',
  preferred_financing TEXT,
  standard_terms      TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

-- ── 2. investor_users (profiles ↔ investors link) ────────────
CREATE TABLE IF NOT EXISTS public.investor_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.investor_users ENABLE ROW LEVEL SECURITY;

-- ── 3. deals additions ────────────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS projected_payout_date  DATE,
  ADD COLUMN IF NOT EXISTS projected_irr          NUMERIC,
  ADD COLUMN IF NOT EXISTS min_check_size         NUMERIC,
  ADD COLUMN IF NOT EXISTS remaining_allocation   NUMERIC,
  ADD COLUMN IF NOT EXISTS visible_to_investors   BOOLEAN NOT NULL DEFAULT true;

-- ── 4. documents ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  investor_id         UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  uploaded_by         UUID NOT NULL REFERENCES public.profiles(id),
  title               TEXT NOT NULL,
  file_url            TEXT NOT NULL,
  file_size_bytes     BIGINT,
  mime_type           TEXT,
  doc_type            TEXT NOT NULL DEFAULT 'other',
  -- doc_type values: operating_agreement | subscription | wire | closing | k1 | 1099 | other
  visible_to_investor BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ── 5. deal_updates (construction / project update feed) ─────
CREATE TABLE IF NOT EXISTS public.deal_updates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  posted_by  UUID NOT NULL REFERENCES public.profiles(id),
  posted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  title      TEXT NOT NULL,
  body_md    TEXT,
  photos     JSONB NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'investor'
  -- visibility: 'investor' | 'operator_only'
);

ALTER TABLE public.deal_updates ENABLE ROW LEVEL SECURITY;

-- ── 6. distributions (investor payout ledger) ────────────────
CREATE TABLE IF NOT EXISTS public.distributions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  investor_id    UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  amount         NUMERIC NOT NULL,
  type           TEXT NOT NULL DEFAULT 'profit',
  -- type: return_of_capital | profit | preferred_return
  wire_reference TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;

-- ── 7. investment_interest ("Reserve Interest" submissions) ───
CREATE TABLE IF NOT EXISTS public.investment_interest (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  deal_id     UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  amount      NUMERIC,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | reviewed | accepted | declined
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investment_interest ENABLE ROW LEVEL SECURITY;

-- ── 8. investor_messages (in-app inbox) ──────────────────────
CREATE TABLE IF NOT EXISTS public.investor_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  sent_by     UUID NOT NULL REFERENCES public.profiles(id),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investor_messages ENABLE ROW LEVEL SECURITY;

-- ── 9. operator_impersonation_log ────────────────────────────
CREATE TABLE IF NOT EXISTS public.operator_impersonation_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.profiles(id),
  investor_id UUID NOT NULL REFERENCES public.investors(id),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);

ALTER TABLE public.operator_impersonation_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: current user's role
CREATE OR REPLACE FUNCTION public.current_role_is(r TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = r);
$$;

-- Helper: current user's investor_id (via investor_users)
CREATE OR REPLACE FUNCTION public.current_investor_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT investor_id FROM public.investor_users WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── investors ─────────────────────────────────────────────────
-- Operators (admin/user/viewer) see all; investor sees only their own record
CREATE POLICY "investors_operator_select" ON public.investors
  FOR SELECT USING (
    public.current_role_is('admin') OR public.current_role_is('user') OR public.current_role_is('viewer') OR public.current_role_is('realtor')
    OR id = public.current_investor_id()
  );
CREATE POLICY "investors_operator_insert" ON public.investors
  FOR INSERT WITH CHECK (public.current_role_is('admin') OR public.current_role_is('user'));
CREATE POLICY "investors_operator_update" ON public.investors
  FOR UPDATE USING (public.current_role_is('admin') OR public.current_role_is('user'));

-- ── investor_users ────────────────────────────────────────────
CREATE POLICY "investor_users_admin" ON public.investor_users
  FOR ALL USING (public.current_role_is('admin'));
CREATE POLICY "investor_users_self_select" ON public.investor_users
  FOR SELECT USING (user_id = auth.uid());

-- ── documents ─────────────────────────────────────────────────
-- Operators see all; investors see only their visible docs
CREATE POLICY "documents_operator_all" ON public.documents
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );
CREATE POLICY "documents_investor_select" ON public.documents
  FOR SELECT USING (
    public.current_role_is('investor')
    AND visible_to_investor = true
    AND investor_id = public.current_investor_id()
  );

-- ── deal_updates ──────────────────────────────────────────────
CREATE POLICY "deal_updates_operator_all" ON public.deal_updates
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );
CREATE POLICY "deal_updates_investor_select" ON public.deal_updates
  FOR SELECT USING (
    public.current_role_is('investor')
    AND visibility = 'investor'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND d.investor = (SELECT name FROM public.investors WHERE id = public.current_investor_id())
    )
  );

-- ── distributions ─────────────────────────────────────────────
CREATE POLICY "distributions_operator_all" ON public.distributions
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );
CREATE POLICY "distributions_investor_select" ON public.distributions
  FOR SELECT USING (
    public.current_role_is('investor')
    AND investor_id = public.current_investor_id()
  );

-- ── investment_interest ───────────────────────────────────────
CREATE POLICY "investment_interest_operator_all" ON public.investment_interest
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );
CREATE POLICY "investment_interest_investor" ON public.investment_interest
  FOR ALL USING (investor_id = public.current_investor_id());

-- ── investor_messages ─────────────────────────────────────────
CREATE POLICY "investor_messages_operator_all" ON public.investor_messages
  FOR ALL USING (
    public.current_role_is('admin') OR public.current_role_is('user')
  );
CREATE POLICY "investor_messages_investor_select" ON public.investor_messages
  FOR SELECT USING (
    public.current_role_is('investor')
    AND investor_id = public.current_investor_id()
  );
CREATE POLICY "investor_messages_investor_read" ON public.investor_messages
  FOR UPDATE USING (
    public.current_role_is('investor')
    AND investor_id = public.current_investor_id()
  );

-- ── operator_impersonation_log ────────────────────────────────
CREATE POLICY "impersonation_log_admin" ON public.operator_impersonation_log
  FOR ALL USING (public.current_role_is('admin'));

-- ── Supabase Storage bucket for investor documents ────────────
-- Run this in your Supabase dashboard Storage settings OR via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('investor-documents', 'investor-documents', false);

-- ============================================================
-- SEED: 2 test investors
-- ============================================================
INSERT INTO public.investors (id, name, contact, email, phone, type, preferred_financing, standard_terms, notes)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Test Investor Alpha', 'Alice Alpha', 'alpha@test.lotline.com', '555-001-0001', 'Private Lender', 'Hard Money Loan', '13% interest, 3pt origination', 'Seed investor for testing'),
  ('11111111-0000-0000-0000-000000000002', 'Test Investor Beta',  'Bob Beta',   'beta@test.lotline.com',  '555-002-0002', 'Equity Partner', 'Profit Split', '50/50 equity split', 'Seed investor for testing')
ON CONFLICT (id) DO NOTHING;

-- NOTE: After running this migration:
-- 1. Create Supabase auth users for alpha@test.lotline.com and beta@test.lotline.com
-- 2. Set their profile role = 'investor'
-- 3. Insert rows in investor_users linking those profile IDs to the investor IDs above
-- 4. Create storage bucket 'investor-documents' (private)
