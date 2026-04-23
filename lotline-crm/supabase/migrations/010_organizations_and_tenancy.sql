-- ═══════════════════════════════════════════════════════════════════════════════
-- 010 · Multi-Tenant Foundation  (Phase 1 · PR 1.1)
-- Requires: migrations 001–009 applied
-- ───────────────────────────────────────────────────────────────────────────────
-- Converts the single-tenant LotLine CRM into a shared-database multi-tenant
-- SaaS. Every subscriber gets a private workspace (organization). LotLine Homes
-- becomes the first workspace; every existing row is backfilled to it.
--
-- Zero-downtime strategy
--   1.  Create new global tables (organizations, memberships, …)
--   2.  Add profile columns (active_organization_id, is_super_admin)
--   3.  Add organization_id as NULLABLE to every tenant table
--   4.  Install BEFORE-INSERT triggers that auto-fill organization_id from
--       current_org_id() — keeps existing app code working after migration
--   5.  Create new tenant tables (contractor_database, pipelines, stages, checklists)
--   6.  Fix investor_users UNIQUE constraint
--   7.  Install new RLS helper functions (replace old single-tenant versions)
--   8.  Drop old RLS policies; install org-scoped replacements on every table
--   9.  Recreate views with organization_id column + org filter
--   10. Seed: create "LotLine Homes" org → backfill ALL rows → create memberships
--       → set active_organization_id on every profile → grant super_admin to owner
--   11. Promote organization_id to NOT NULL + add composite index on investor_users
--
-- Reversible: see DOWN section at the bottom of this file.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  New global tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT        NOT NULL UNIQUE,
  name           TEXT        NOT NULL,
  logo_url       TEXT,
  brand_color    TEXT        NOT NULL DEFAULT '#3B82F6',
  status         TEXT        NOT NULL DEFAULT 'trialing'
                               CHECK (status IN ('trialing','active','past_due','canceled','suspended')),
  trial_ends_at  TIMESTAMPTZ,
  owner_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role             TEXT        NOT NULL DEFAULT 'operator'
                                 CHECK (role IN ('owner','admin','operator','viewer')),
  invited_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at       TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  status           TEXT        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('pending','active','disabled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS memberships_org_idx  ON public.memberships (organization_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.memberships (user_id);

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email            TEXT        NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'operator'
                                 CHECK (role IN ('admin','operator','viewer')),
  token            TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_org_idx   ON public.organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.organization_invitations (token);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.organization_invitations (email);

-- Append-only audit trail (no UPDATE/DELETE policies granted)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id          UUID        REFERENCES auth.users(id)           ON DELETE SET NULL,
  action           TEXT        NOT NULL,
  target_table     TEXT,
  target_id        TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  ip_address       INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_idx  ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs (user_id,          created_at DESC);

-- Cross-org access log for super-admin impersonation
CREATE TABLE IF NOT EXISTS public.super_admin_access_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_org_id    UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  action           TEXT        NOT NULL,
  reason           TEXT        NOT NULL,
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS super_admin_logs_org_idx ON public.super_admin_access_logs (target_org_id, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Profile additions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_super_admin          BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_active_org_idx ON public.profiles (active_organization_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Add organization_id (NULLABLE) to every tenant table
--     NOT NULL enforced in §11 after backfill in §10.
--     Indexes created here so RLS function lookups are fast immediately.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS deals_org_idx ON public.deals (organization_id);

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS investors_org_idx ON public.investors (organization_id);

ALTER TABLE public.investor_users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS investor_users_org_idx ON public.investor_users (organization_id);

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS documents_org_idx ON public.documents (organization_id);

ALTER TABLE public.deal_updates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS deal_updates_org_idx ON public.deal_updates (organization_id);

ALTER TABLE public.distributions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS distributions_org_idx ON public.distributions (organization_id);

ALTER TABLE public.investment_interest
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS invest_interest_org_idx ON public.investment_interest (organization_id);

ALTER TABLE public.investor_messages
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS investor_msgs_org_idx ON public.investor_messages (organization_id);

ALTER TABLE public.operator_impersonation_log
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS impersonation_log_org_idx ON public.operator_impersonation_log (organization_id);

ALTER TABLE public.deal_photos
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS deal_photos_org_idx ON public.deal_photos (organization_id);

ALTER TABLE public.deal_milestones
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS deal_milestones_org_idx ON public.deal_milestones (organization_id);

ALTER TABLE public.projected_distributions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS proj_dist_org_idx ON public.projected_distributions (organization_id);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS notifications_org_idx ON public.notifications (organization_id);

ALTER TABLE public.capital_commitments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS commitments_org_idx ON public.capital_commitments (organization_id);

ALTER TABLE public.deal_allocations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS allocations_org_idx ON public.deal_allocations (organization_id);

ALTER TABLE public.commitment_ledger_entries
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ledger_org_idx ON public.commitment_ledger_entries (organization_id);

ALTER TABLE public.draw_schedules
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS draw_schedules_org_idx ON public.draw_schedules (organization_id);

ALTER TABLE public.draw_tranches
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS draw_tranches_org_idx ON public.draw_tranches (organization_id);

ALTER TABLE public.funding_events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS funding_events_org_idx ON public.funding_events (organization_id);

ALTER TABLE public.capital_calls
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS capital_calls_org_idx ON public.capital_calls (organization_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Auto-fill trigger: every INSERT that omits organization_id gets the
--     session's current_org_id() injected automatically.
--     This keeps existing app code (dealsSync.js, capitalStackData.js, etc.)
--     working without changes until PR 1.2 wires in org context explicitly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._auto_set_org_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_org_id();
  END IF;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION
      'organization_id cannot be null: user % has no active organization (profiles.active_organization_id is not set)',
      auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to every tenant table
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'deals','investors','investor_users','documents','deal_updates',
    'distributions','investment_interest','investor_messages',
    'operator_impersonation_log','deal_photos','deal_milestones',
    'projected_distributions','notifications','capital_commitments',
    'deal_allocations','commitment_ledger_entries','draw_schedules',
    'draw_tranches','funding_events','capital_calls'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_auto_org_id ON public.%I;
       CREATE TRIGGER trg_auto_org_id
         BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public._auto_set_org_id();',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  New tenant tables (organization_id NOT NULL from birth)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contractor_database (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  trade            TEXT,
  contact_name     TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  license_number   TEXT,
  insurance_expiry DATE,
  rating           SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  notes            TEXT,
  is_preferred     BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contractors_org_idx ON public.contractor_database (organization_id);
ALTER TABLE public.contractor_database ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pipelines (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  slug             TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS pipelines_org_idx ON public.pipelines (organization_id);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_id      UUID        NOT NULL REFERENCES public.pipelines(id)     ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  slug             TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  color            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pipeline_id, slug)
);
CREATE INDEX IF NOT EXISTS stages_org_idx      ON public.stages (organization_id);
CREATE INDEX IF NOT EXISTS stages_pipeline_idx ON public.stages (pipeline_id);
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

-- items JSONB schema: [{key TEXT, label TEXT, required BOOLEAN, sort_order INT}]
CREATE TABLE IF NOT EXISTS public.checklists (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  pipeline_id      UUID        REFERENCES public.pipelines(id) ON DELETE SET NULL,
  items            JSONB       NOT NULL DEFAULT '[]',
  is_default       BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checklists_org_idx ON public.checklists (organization_id);
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  investor_users: fix UNIQUE constraint
--     Old: UNIQUE(user_id)         → one investor per auth user globally
--     New: UNIQUE(user_id, org_id) → one investor per auth user per org
--     Drop happens before backfill; new constraint added in §11.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  -- Find any single-column UNIQUE on user_id (name may vary)
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
  WHERE tc.table_schema    = 'public'
    AND tc.table_name      = 'investor_users'
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.column_name    = 'user_id'
  GROUP BY tc.constraint_name
  HAVING COUNT(*) = 1   -- only the single-column constraint
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.investor_users DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END IF;
END $$;

-- Belt-and-suspenders fallback for the default name
ALTER TABLE public.investor_users
  DROP CONSTRAINT IF EXISTS investor_users_user_id_key;


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  RLS helper functions (replace old single-tenant versions)
-- ─────────────────────────────────────────────────────────────────────────────

-- Active org UUID for the current session user
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT active_organization_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Membership role within the active org: 'owner'|'admin'|'operator'|'viewer'|NULL
CREATE OR REPLACE FUNCTION public.current_org_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.memberships
  WHERE  user_id         = auth.uid()
    AND  organization_id = public.current_org_id()
    AND  status          = 'active'
  LIMIT 1
$$;

-- True when the current user has any operator membership in the active org
CREATE OR REPLACE FUNCTION public.current_user_is_operator()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_org_role() IS NOT NULL
$$;

-- True when the current user is owner or admin in the active org
CREATE OR REPLACE FUNCTION public.can_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_org_role() IN ('owner','admin')
$$;

-- True when the current user can write (owner|admin|operator)
CREATE OR REPLACE FUNCTION public.can_write()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_org_role() IN ('owner','admin','operator')
$$;

-- Investor UUID within the active org (NULL for non-investor sessions)
CREATE OR REPLACE FUNCTION public.current_investor_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT investor_id FROM public.investor_users
  WHERE  user_id         = auth.uid()
    AND  organization_id = public.current_org_id()
  LIMIT 1
$$;

-- True when the current user is a portal investor in the active org
CREATE OR REPLACE FUNCTION public.current_user_is_investor()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_investor_id() IS NOT NULL
$$;

-- True when the current user has the is_super_admin flag
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(is_super_admin, false) FROM public.profiles WHERE id = auth.uid()
$$;

-- Drop the old single-tenant helpers (no longer used)
DROP FUNCTION IF EXISTS public.current_role_is(TEXT);


-- ─────────────────────────────────────────────────────────────────────────────
-- §8  Replace all RLS policies with org-scoped versions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 8a. organizations ────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Members (operator or investor) see orgs they belong to
CREATE POLICY "orgs_member_select" ON public.organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM public.memberships   WHERE user_id = auth.uid() AND status = 'active')
    OR
    id IN (SELECT organization_id FROM public.investor_users WHERE user_id = auth.uid())
  );

-- Only owners (and super-admins via RPC) can update org settings
CREATE POLICY "orgs_owner_update" ON public.organizations FOR UPDATE
  USING (owner_user_id = auth.uid() OR public.current_user_is_super_admin());

-- Inserts are performed by SECURITY DEFINER RPCs (sign-up, super-admin)
-- No INSERT policy means normal users cannot create orgs directly.


-- ── 8b. memberships ──────────────────────────────────────────────────────────
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_self_or_org_select" ON public.memberships FOR SELECT
  USING (
    user_id = auth.uid()                                                   -- own memberships
    OR (organization_id = public.current_org_id() AND public.current_user_is_operator())
  );

CREATE POLICY "memberships_admin_insert" ON public.memberships FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());

CREATE POLICY "memberships_admin_update" ON public.memberships FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_admin());

-- Only owners can remove members; owners cannot remove themselves
CREATE POLICY "memberships_owner_delete" ON public.memberships FOR DELETE
  USING (
    organization_id = public.current_org_id()
    AND public.current_org_role() = 'owner'
    AND user_id <> auth.uid()
  );


-- ── 8c. organization_invitations ─────────────────────────────────────────────
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_admin_all" ON public.organization_invitations
  USING  (organization_id = public.current_org_id() AND public.can_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());

-- Token lookup for accept-invite page is handled via SECURITY DEFINER RPC;
-- the acceptance RPC bypasses RLS.


-- ── 8d. audit_logs ───────────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins+ can read their org's log; super-admins see all (via RPC)
CREATE POLICY "audit_logs_org_select" ON public.audit_logs FOR SELECT
  USING (organization_id = public.current_org_id() AND public.can_admin());

-- Any org member or system (SECURITY DEFINER) can append
CREATE POLICY "audit_logs_member_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (
    organization_id = public.current_org_id()
    OR public.current_user_is_super_admin()
  );
-- No UPDATE or DELETE — append-only by policy design.


-- ── 8e. super_admin_access_logs ──────────────────────────────────────────────
ALTER TABLE public.super_admin_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_logs_all" ON public.super_admin_access_logs
  USING (public.current_user_is_super_admin())
  WITH CHECK (public.current_user_is_super_admin());


-- ── 8f. deals ────────────────────────────────────────────────────────────────
-- deals had no RLS before; enable + install org policies now.
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_operator_select" ON public.deals;
DROP POLICY IF EXISTS "deals_operator_insert" ON public.deals;
DROP POLICY IF EXISTS "deals_operator_update" ON public.deals;
DROP POLICY IF EXISTS "deals_operator_delete" ON public.deals;

CREATE POLICY "deals_org_select" ON public.deals FOR SELECT
  USING (organization_id = public.current_org_id() AND public.current_user_is_operator());

CREATE POLICY "deals_org_insert" ON public.deals FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deals_org_update" ON public.deals FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deals_org_delete" ON public.deals FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8g. investors ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investors_operator_select" ON public.investors;
DROP POLICY IF EXISTS "investors_operator_insert" ON public.investors;
DROP POLICY IF EXISTS "investors_operator_update" ON public.investors;

CREATE POLICY "investors_org_select" ON public.investors FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND id = public.current_investor_id())
    )
  );

CREATE POLICY "investors_org_insert" ON public.investors FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "investors_org_update" ON public.investors FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "investors_org_delete" ON public.investors FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8h. investor_users ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_users_admin"       ON public.investor_users;
DROP POLICY IF EXISTS "investor_users_self_select" ON public.investor_users;

CREATE POLICY "investor_users_org_select" ON public.investor_users FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.can_admin())
    OR user_id = auth.uid()
  );

CREATE POLICY "investor_users_admin_insert" ON public.investor_users FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());

CREATE POLICY "investor_users_admin_update" ON public.investor_users FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_admin());

CREATE POLICY "investor_users_admin_delete" ON public.investor_users FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8i. documents ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents_operator_all"    ON public.documents;
DROP POLICY IF EXISTS "documents_investor_select" ON public.documents;

CREATE POLICY "documents_org_select" ON public.documents FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND visible_to_investor = true
        AND investor_id = public.current_investor_id()
      )
    )
  );

CREATE POLICY "documents_org_insert" ON public.documents FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "documents_org_update" ON public.documents FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "documents_org_delete" ON public.documents FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8j. deal_updates ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_updates_operator_all"    ON public.deal_updates;
DROP POLICY IF EXISTS "deal_updates_investor_select" ON public.deal_updates;

-- Investor visibility upgraded to use deal_allocations (capital-stack aware)
-- rather than the old fragile deals.investor name join.
CREATE POLICY "deal_updates_org_select" ON public.deal_updates FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND visibility = 'investor'
        AND EXISTS (
          SELECT 1 FROM public.deal_allocations da
          WHERE  da.deal_id         = deal_updates.deal_id
            AND  da.investor_id     = public.current_investor_id()
            AND  da.organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "deal_updates_org_insert" ON public.deal_updates FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deal_updates_org_update" ON public.deal_updates FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deal_updates_org_delete" ON public.deal_updates FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8k. distributions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "distributions_operator_all"    ON public.distributions;
DROP POLICY IF EXISTS "distributions_investor_select" ON public.distributions;

CREATE POLICY "distributions_org_select" ON public.distributions FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "distributions_org_insert" ON public.distributions FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "distributions_org_update" ON public.distributions FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "distributions_org_delete" ON public.distributions FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8l. investment_interest ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "investment_interest_operator_all" ON public.investment_interest;
DROP POLICY IF EXISTS "investment_interest_investor"     ON public.investment_interest;

CREATE POLICY "invest_interest_org_select" ON public.investment_interest FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "invest_interest_org_insert" ON public.investment_interest FOR INSERT
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.can_write()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "invest_interest_org_update" ON public.investment_interest FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "invest_interest_org_delete" ON public.investment_interest FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8m. investor_messages ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_messages_operator_all"    ON public.investor_messages;
DROP POLICY IF EXISTS "investor_messages_investor_select" ON public.investor_messages;
DROP POLICY IF EXISTS "investor_messages_investor_read"   ON public.investor_messages;

CREATE POLICY "investor_msgs_org_select" ON public.investor_messages FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "investor_msgs_org_insert" ON public.investor_messages FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "investor_msgs_org_update" ON public.investor_messages FOR UPDATE
  USING (
    organization_id = public.current_org_id()
    AND (
      public.can_write()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "investor_msgs_org_delete" ON public.investor_messages FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8n. operator_impersonation_log ───────────────────────────────────────────
DROP POLICY IF EXISTS "impersonation_log_admin" ON public.operator_impersonation_log;

CREATE POLICY "impersonation_log_org_all" ON public.operator_impersonation_log
  USING  (organization_id = public.current_org_id() AND public.can_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8o. deal_photos ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investors_read_deal_photos"  ON public.deal_photos;
DROP POLICY IF EXISTS "operators_manage_deal_photos" ON public.deal_photos;

CREATE POLICY "deal_photos_org_select" ON public.deal_photos FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND EXISTS (
          SELECT 1 FROM public.deal_allocations da
          WHERE  da.deal_id         = deal_photos.deal_id
            AND  da.investor_id     = public.current_investor_id()
            AND  da.organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "deal_photos_org_insert" ON public.deal_photos FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deal_photos_org_update" ON public.deal_photos FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deal_photos_org_delete" ON public.deal_photos FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8p. deal_milestones ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investors_read_milestones"    ON public.deal_milestones;
DROP POLICY IF EXISTS "operators_manage_milestones"  ON public.deal_milestones;

CREATE POLICY "deal_milestones_org_select" ON public.deal_milestones FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND EXISTS (
          SELECT 1 FROM public.deal_allocations da
          WHERE  da.deal_id         = deal_milestones.deal_id
            AND  da.investor_id     = public.current_investor_id()
            AND  da.organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "deal_milestones_org_insert" ON public.deal_milestones FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deal_milestones_org_update" ON public.deal_milestones FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "deal_milestones_org_delete" ON public.deal_milestones FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8q. projected_distributions ──────────────────────────────────────────────
DROP POLICY IF EXISTS "investors_read_projected_dist"    ON public.projected_distributions;
DROP POLICY IF EXISTS "operators_manage_projected_dist"  ON public.projected_distributions;

CREATE POLICY "proj_dist_org_select" ON public.projected_distributions FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "proj_dist_org_insert" ON public.projected_distributions FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "proj_dist_org_update" ON public.projected_distributions FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "proj_dist_org_delete" ON public.projected_distributions FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8r. notifications ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investors_read_notifications"   ON public.notifications;
DROP POLICY IF EXISTS "investors_update_notifications" ON public.notifications;
DROP POLICY IF EXISTS "operators_manage_notifications" ON public.notifications;

CREATE POLICY "notifications_org_select" ON public.notifications FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "notifications_org_insert" ON public.notifications FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

-- Investors can mark their own read; operators can update anything in their org
CREATE POLICY "notifications_org_update" ON public.notifications FOR UPDATE
  USING (
    organization_id = public.current_org_id()
    AND (
      public.can_write()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "notifications_org_delete" ON public.notifications FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8s. capital_commitments ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "commitments_operator_all"    ON public.capital_commitments;
DROP POLICY IF EXISTS "commitments_investor_select" ON public.capital_commitments;

CREATE POLICY "commitments_org_select" ON public.capital_commitments FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "commitments_org_insert" ON public.capital_commitments FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "commitments_org_update" ON public.capital_commitments FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "commitments_org_delete" ON public.capital_commitments FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8t. deal_allocations ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allocations_operator_all"    ON public.deal_allocations;
DROP POLICY IF EXISTS "allocations_investor_select" ON public.deal_allocations;

CREATE POLICY "allocations_org_select" ON public.deal_allocations FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "allocations_org_insert" ON public.deal_allocations FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "allocations_org_update" ON public.deal_allocations FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "allocations_org_delete" ON public.deal_allocations FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8u. commitment_ledger_entries — append-only ───────────────────────────────
DROP POLICY IF EXISTS "ledger_operator_all"    ON public.commitment_ledger_entries;
DROP POLICY IF EXISTS "ledger_investor_select" ON public.commitment_ledger_entries;

CREATE POLICY "ledger_org_select" ON public.commitment_ledger_entries FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND commitment_id IN (
          SELECT id FROM public.capital_commitments
          WHERE  investor_id     = public.current_investor_id()
            AND  organization_id = public.current_org_id()
        )
      )
    )
  );

-- Append-only: no UPDATE or DELETE policy
CREATE POLICY "ledger_org_insert" ON public.commitment_ledger_entries FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());


-- ── 8v. draw_schedules ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "draw_schedules_operator_all"    ON public.draw_schedules;
DROP POLICY IF EXISTS "draw_schedules_investor_select" ON public.draw_schedules;

CREATE POLICY "draw_schedules_org_select" ON public.draw_schedules FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND allocation_id IN (
          SELECT id FROM public.deal_allocations
          WHERE  investor_id     = public.current_investor_id()
            AND  organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "draw_schedules_org_insert" ON public.draw_schedules FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_schedules_org_update" ON public.draw_schedules FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_schedules_org_delete" ON public.draw_schedules FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8w. draw_tranches ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "draw_tranches_operator_all"    ON public.draw_tranches;
DROP POLICY IF EXISTS "draw_tranches_investor_select" ON public.draw_tranches;

CREATE POLICY "draw_tranches_org_select" ON public.draw_tranches FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (
        public.current_user_is_investor()
        AND draw_schedule_id IN (
          SELECT ds.id FROM public.draw_schedules ds
          JOIN   public.deal_allocations da ON da.id = ds.allocation_id
          WHERE  da.investor_id     = public.current_investor_id()
            AND  da.organization_id = public.current_org_id()
        )
      )
    )
  );

CREATE POLICY "draw_tranches_org_insert" ON public.draw_tranches FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_tranches_org_update" ON public.draw_tranches FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "draw_tranches_org_delete" ON public.draw_tranches FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8x. funding_events ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "funding_events_operator_all"    ON public.funding_events;
DROP POLICY IF EXISTS "funding_events_investor_select" ON public.funding_events;

CREATE POLICY "funding_events_org_select" ON public.funding_events FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "funding_events_org_insert" ON public.funding_events FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "funding_events_org_update" ON public.funding_events FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "funding_events_org_delete" ON public.funding_events FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8y. capital_calls ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "capital_calls_operator_all"    ON public.capital_calls;
DROP POLICY IF EXISTS "capital_calls_investor_select" ON public.capital_calls;

CREATE POLICY "capital_calls_org_select" ON public.capital_calls FOR SELECT
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_user_is_operator()
      OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
    )
  );

CREATE POLICY "capital_calls_org_insert" ON public.capital_calls FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "capital_calls_org_update" ON public.capital_calls FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "capital_calls_org_delete" ON public.capital_calls FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8z. contractor_database ──────────────────────────────────────────────────
CREATE POLICY "contractors_org_select" ON public.contractor_database FOR SELECT
  USING (organization_id = public.current_org_id() AND public.current_user_is_operator());

CREATE POLICY "contractors_org_insert" ON public.contractor_database FOR INSERT
  WITH CHECK (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "contractors_org_update" ON public.contractor_database FOR UPDATE
  USING (organization_id = public.current_org_id() AND public.can_write());

CREATE POLICY "contractors_org_delete" ON public.contractor_database FOR DELETE
  USING (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8aa. pipelines ───────────────────────────────────────────────────────────
CREATE POLICY "pipelines_org_select" ON public.pipelines FOR SELECT
  USING (organization_id = public.current_org_id() AND public.current_user_is_operator());

CREATE POLICY "pipelines_admin_write" ON public.pipelines
  USING  (organization_id = public.current_org_id() AND public.can_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8bb. stages ──────────────────────────────────────────────────────────────
CREATE POLICY "stages_org_select" ON public.stages FOR SELECT
  USING (organization_id = public.current_org_id() AND public.current_user_is_operator());

CREATE POLICY "stages_admin_write" ON public.stages
  USING  (organization_id = public.current_org_id() AND public.can_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());


-- ── 8cc. checklists ──────────────────────────────────────────────────────────
CREATE POLICY "checklists_org_select" ON public.checklists FOR SELECT
  USING (organization_id = public.current_org_id() AND public.current_user_is_operator());

CREATE POLICY "checklists_admin_write" ON public.checklists
  USING  (organization_id = public.current_org_id() AND public.can_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.can_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- §9  Recreate views with organization_id exposed
--     Base tables' RLS already enforces org isolation; the org column in the
--     view output lets the application layer do org-aware client filtering.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.investor_commitment_summary AS
SELECT
  i.organization_id,
  i.id                                                             AS investor_id,
  i.name                                                           AS investor_name,
  cc.id                                                            AS commitment_id,
  cc.name                                                          AS commitment_name,
  cc.committed_amount,
  cc.revolving,
  cc.commitment_type,
  cc.status                                                        AS commitment_status,
  cc.priority_rank,
  cc.commitment_date,
  cc.expiration_date,
  COALESCE(SUM(da.amount) FILTER (
    WHERE da.status NOT IN ('returned','orphaned_scenario_change')
  ), 0)                                                            AS total_allocated,
  CASE
    WHEN cc.committed_amount IS NULL THEN NULL
    ELSE GREATEST(0,
      cc.committed_amount
      - COALESCE(SUM(da.amount) FILTER (
          WHERE da.status NOT IN ('returned','orphaned_scenario_change')
        ), 0)
    )
  END                                                              AS remaining_headroom,
  COUNT(DISTINCT da.deal_id) FILTER (
    WHERE da.status NOT IN ('returned','orphaned_scenario_change')
  )                                                                AS active_deals_count
FROM  public.investors i
JOIN  public.capital_commitments cc ON cc.investor_id = i.id
LEFT JOIN public.deal_allocations da ON da.commitment_id = cc.id
GROUP BY
  i.organization_id, i.id, i.name,
  cc.id, cc.name, cc.committed_amount, cc.revolving, cc.commitment_type,
  cc.status, cc.priority_rank, cc.commitment_date, cc.expiration_date;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.deal_capital_stack_view AS
SELECT
  da.organization_id,
  da.deal_id,
  da.id                                               AS allocation_id,
  da.commitment_id,
  i.id                                                AS investor_id,
  i.name                                              AS investor_name,
  cc.name                                             AS commitment_name,
  da.amount,
  da.percent_of_deal,
  da.position,
  da.preferred_return_pct,
  da.profit_share_pct,
  da.pref_payment_timing,
  da.source_scenario,
  da.status,
  da.funding_status,
  da.amount_scheduled,
  da.amount_funded,
  (da.amount - COALESCE(da.amount_funded, 0))         AS amount_outstanding,
  da.allocated_at,
  da.notes,
  SUM(da.amount) OVER (
    PARTITION BY da.deal_id
    ORDER BY da.allocated_at
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                                                   AS running_total
FROM  public.deal_allocations da
JOIN  public.investors i           ON i.id  = da.investor_id
JOIN  public.capital_commitments cc ON cc.id = da.commitment_id;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.deal_draw_schedule_view AS
SELECT
  ds.organization_id,
  ds.id                               AS schedule_id,
  ds.allocation_id,
  ds.name                             AS schedule_name,
  ds.status                           AS schedule_status,
  ds.total_scheduled,
  da.deal_id,
  da.investor_id,
  i.name                              AS investor_name,
  da.amount                           AS allocation_amount,
  da.amount_funded,
  da.funding_status,
  dt.id                               AS tranche_id,
  dt.sequence,
  dt.amount                           AS tranche_amount,
  dt.trigger_type,
  dt.trigger_date,
  dt.trigger_milestone_key,
  dt.due_date,
  dt.status                           AS tranche_status,
  dt.called_at,
  dt.funded_at,
  dt.funding_event_id,
  dt.notes                            AS tranche_notes,
  fe.wire_reference,
  fe.occurred_at                      AS funded_occurred_at,
  fe.reconciled
FROM  public.draw_schedules ds
JOIN  public.deal_allocations da ON da.id = ds.allocation_id
JOIN  public.investors i          ON i.id  = da.investor_id
LEFT JOIN public.draw_tranches  dt ON dt.draw_schedule_id = ds.id
LEFT JOIN public.funding_events fe ON fe.id               = dt.funding_event_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- §10  Seed: LotLine Homes org → backfill all rows → memberships → super_admin
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id    UUID;
  v_owner_id  UUID;
BEGIN

  -- ── Find (or re-find) LotLine Homes org ────────────────────────────────────
  -- Idempotent: if already run, skip creation.
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'lotline-homes' LIMIT 1;

  IF v_org_id IS NULL THEN

    -- Locate the owner profile: prefer naaman/lotline email, then first admin
    SELECT id INTO v_owner_id
    FROM public.profiles
    ORDER BY
      CASE
        WHEN email ILIKE '%naaman%'   THEN 0
        WHEN email ILIKE '%lotline%'  THEN 1
        WHEN role  = 'admin'          THEN 2
        ELSE 3
      END,
      created_at ASC
    LIMIT 1;

    v_org_id := gen_random_uuid();

    INSERT INTO public.organizations
      (id, slug, name, status, owner_user_id, trial_ends_at, created_at, updated_at)
    VALUES
      (v_org_id, 'lotline-homes', 'LotLine Homes', 'active', v_owner_id, NULL, now(), now());

  ELSE
    SELECT owner_user_id INTO v_owner_id FROM public.organizations WHERE id = v_org_id;
  END IF;

  -- ── Backfill organization_id on every tenant table ─────────────────────────
  UPDATE public.deals                    SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.investors                SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.investor_users           SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.documents                SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.deal_updates             SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.distributions            SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.investment_interest      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.investor_messages        SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.operator_impersonation_log SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.deal_photos              SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.deal_milestones          SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.projected_distributions  SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.notifications            SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.capital_commitments      SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.deal_allocations         SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.commitment_ledger_entries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.draw_schedules           SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.draw_tranches            SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.funding_events           SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE public.capital_calls            SET organization_id = v_org_id WHERE organization_id IS NULL;

  -- ── Create memberships for existing operator profiles ──────────────────────
  -- profiles.role → memberships.role mapping:
  --   admin   → admin      (Naaman will be promoted to owner below)
  --   user    → operator
  --   viewer  → viewer
  --   realtor → operator   (route-level access handled by app; DB role = operator)
  INSERT INTO public.memberships (user_id, organization_id, role, status, accepted_at, created_at, updated_at)
  SELECT
    p.id,
    v_org_id,
    CASE p.role
      WHEN 'admin'   THEN 'admin'
      WHEN 'user'    THEN 'operator'
      WHEN 'viewer'  THEN 'viewer'
      WHEN 'realtor' THEN 'operator'
      ELSE 'viewer'
    END,
    'active',
    now(),
    now(),
    now()
  FROM public.profiles p
  WHERE p.role IN ('admin','user','viewer','realtor')
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  -- ── Promote owner to 'owner' role ─────────────────────────────────────────
  IF v_owner_id IS NOT NULL THEN
    UPDATE public.memberships
    SET    role = 'owner', updated_at = now()
    WHERE  user_id = v_owner_id AND organization_id = v_org_id;
  END IF;

  -- ── Set active_organization_id for all operator profiles ───────────────────
  UPDATE public.profiles
  SET    active_organization_id = v_org_id
  WHERE  role IN ('admin','user','viewer','realtor')
    AND  active_organization_id IS NULL;

  -- ── Set active_organization_id for investor profiles ──────────────────────
  UPDATE public.profiles p
  SET    active_organization_id = v_org_id
  WHERE  p.role = 'investor'
    AND  p.active_organization_id IS NULL
    AND  EXISTS (
           SELECT 1 FROM public.investor_users iu
           WHERE  iu.user_id = p.id
             AND  iu.organization_id = v_org_id
         );

  -- ── Grant super_admin to owner ─────────────────────────────────────────────
  IF v_owner_id IS NOT NULL THEN
    UPDATE public.profiles SET is_super_admin = true WHERE id = v_owner_id;
  END IF;

  -- ── Append audit log entry (seed event) ───────────────────────────────────
  INSERT INTO public.audit_logs
    (organization_id, user_id, action, target_table, target_id, metadata, created_at)
  VALUES
    (
      v_org_id,
      v_owner_id,
      'migration_010_multi_tenant_foundation',
      'organizations',
      v_org_id::text,
      jsonb_build_object(
        'migration',  '010',
        'org_name',   'LotLine Homes',
        'org_slug',   'lotline-homes',
        'applied_at', now()::text
      ),
      now()
    );

END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- §11  NOT NULL constraints + composite UNIQUE on investor_users
--      Safe to run now: §10 backfilled every row.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.deals                      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.investors                  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.investor_users             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.documents                  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deal_updates               ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.distributions              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.investment_interest        ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.investor_messages          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.operator_impersonation_log ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deal_photos                ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deal_milestones            ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.projected_distributions    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.notifications              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.capital_commitments        ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deal_allocations           ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.commitment_ledger_entries  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.draw_schedules             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.draw_tranches              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.funding_events             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.capital_calls              ALTER COLUMN organization_id SET NOT NULL;

-- New composite UNIQUE: one investor-portal account per auth user per org
ALTER TABLE public.investor_users
  ADD CONSTRAINT IF NOT EXISTS investor_users_user_org_unique
  UNIQUE (user_id, organization_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN  (reversible — execute manually in reverse order if rollback needed)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Step 1: Restore investor_users constraint
--   ALTER TABLE public.investor_users DROP CONSTRAINT IF EXISTS investor_users_user_org_unique;
--   ALTER TABLE public.investor_users ADD CONSTRAINT investor_users_user_id_key UNIQUE (user_id);
--
-- Step 2: Drop NOT NULL on all tenant tables
--   ALTER TABLE public.deals                      ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.investors                  ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.investor_users             ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.documents                  ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.deal_updates               ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.distributions              ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.investment_interest        ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.investor_messages          ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.operator_impersonation_log ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.deal_photos                ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.deal_milestones            ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.projected_distributions    ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.notifications              ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.capital_commitments        ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.deal_allocations           ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.commitment_ledger_entries  ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.draw_schedules             ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.draw_tranches              ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.funding_events             ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE public.capital_calls              ALTER COLUMN organization_id DROP NOT NULL;
--
-- Step 3: Drop org INSERT triggers
--   DO $$ DECLARE tbl TEXT; BEGIN
--     FOREACH tbl IN ARRAY ARRAY['deals','investors','investor_users','documents',
--       'deal_updates','distributions','investment_interest','investor_messages',
--       'operator_impersonation_log','deal_photos','deal_milestones',
--       'projected_distributions','notifications','capital_commitments',
--       'deal_allocations','commitment_ledger_entries','draw_schedules',
--       'draw_tranches','funding_events','capital_calls']
--     LOOP
--       EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_org_id ON public.%I', tbl);
--     END LOOP;
--   END $$;
--   DROP FUNCTION IF EXISTS public._auto_set_org_id();
--
-- Step 4: Drop new helper functions
--   DROP FUNCTION IF EXISTS public.current_org_id();
--   DROP FUNCTION IF EXISTS public.current_org_role();
--   DROP FUNCTION IF EXISTS public.current_user_is_operator();
--   DROP FUNCTION IF EXISTS public.can_admin();
--   DROP FUNCTION IF EXISTS public.can_write();
--   DROP FUNCTION IF EXISTS public.current_investor_id();
--   DROP FUNCTION IF EXISTS public.current_user_is_investor();
--   DROP FUNCTION IF EXISTS public.current_user_is_super_admin();
--   -- Restore old: CREATE FUNCTION public.current_role_is(r TEXT) RETURNS BOOLEAN ...
--
-- Step 5: Drop organization_id columns from all tenant tables
--   ALTER TABLE public.deals                      DROP COLUMN IF EXISTS organization_id;
--   ALTER TABLE public.investors                  DROP COLUMN IF EXISTS organization_id;
--   -- (repeat for all 20 tenant tables)
--
-- Step 6: Drop profile additions
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS active_organization_id;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_admin;
--
-- Step 7: Drop new tables (CASCADE drops all their policies/indexes)
--   DROP TABLE IF EXISTS public.checklists                CASCADE;
--   DROP TABLE IF EXISTS public.stages                    CASCADE;
--   DROP TABLE IF EXISTS public.pipelines                 CASCADE;
--   DROP TABLE IF EXISTS public.contractor_database       CASCADE;
--   DROP TABLE IF EXISTS public.super_admin_access_logs   CASCADE;
--   DROP TABLE IF EXISTS public.audit_logs                CASCADE;
--   DROP TABLE IF EXISTS public.organization_invitations  CASCADE;
--   DROP TABLE IF EXISTS public.memberships               CASCADE;
--   DROP TABLE IF EXISTS public.organizations             CASCADE;
--
-- Step 8: Restore old RLS policies from migrations 001–009.
-- ═══════════════════════════════════════════════════════════════════════════════
