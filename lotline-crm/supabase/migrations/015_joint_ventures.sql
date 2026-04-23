-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 015: Joint Venture (JV) Partnership — Data Layer
--
-- Deliverables:
--   1. is_jv_hub flag on organizations (LotLine Homes only)
--   2. joint_ventures table
--   3. jv_access_logs table (append-only)
--   4. jv_scope_preferences table (per-user UI state)
--   5. joint_venture_id column on audit_logs
--   6. v_active_jv_visibility view
--   7. Helper functions: jv_visible_org_ids, jv_permissions_for, jv_can,
--      append_jv_audit
--   8. RLS on new tables
--   9. Updated SELECT policies on all 23 tenant tables (adds JV OR branch)
--  10. Organizations table: additional SELECT policy for JV org visibility
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Hub flag on organizations
--     Only LotLine Homes is a JV hub. Set by super-admin only — no org-level UI.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_jv_hub BOOLEAN NOT NULL DEFAULT false;

-- Mark LotLine Homes as the hub (idempotent)
UPDATE public.organizations SET is_jv_hub = true WHERE slug = 'lotline-homes';


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  joint_ventures table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.joint_ventures (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- host is always LotLine Homes (is_jv_hub = true)
  host_organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  -- partner is any other subscriber org
  partner_organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  host_ownership_pct       NUMERIC(5,2) CHECK (host_ownership_pct BETWEEN 0 AND 100),
  -- What LotLine Homes can do on partner data (JSONB of capability keys → bool)
  permissions_on_partner   JSONB       NOT NULL DEFAULT
    '{"deal.view":true,"investor.view":true,"capital_stack.view":true,
      "document.view":true,"distribution.view":true,"draw_schedule.view":true,
      "deal.edit":false,"investor.edit":false,"capital_stack.edit":false}',
  status                   TEXT        NOT NULL DEFAULT 'proposed'
                             CHECK (status IN ('proposed','active','suspended','terminated')),
  proposed_by_user_id      UUID        NOT NULL,
  proposed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_by_user_id      UUID,
  accepted_at              TIMESTAMPTZ,
  suspended_at             TIMESTAMPTZ,
  suspended_by_user_id     UUID,
  suspension_reason        TEXT,
  terminated_at            TIMESTAMPTZ,
  terminated_by_user_id    UUID,
  termination_reason       TEXT,
  agreement_document_url   TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(host_organization_id, partner_organization_id),
  CHECK(host_organization_id <> partner_organization_id)
);

CREATE INDEX IF NOT EXISTS jv_host_status_idx    ON public.joint_ventures(host_organization_id,    status);
CREATE INDEX IF NOT EXISTS jv_partner_status_idx ON public.joint_ventures(partner_organization_id, status);
CREATE INDEX IF NOT EXISTS jv_status_idx         ON public.joint_ventures(status) WHERE status = 'active';

ALTER TABLE public.joint_ventures ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  jv_access_logs table (append-only — no UPDATE or DELETE policy ever)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.jv_access_logs (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  joint_venture_id       UUID        NOT NULL REFERENCES public.joint_ventures(id),
  acting_user_id         UUID        NOT NULL,
  acting_organization_id UUID        NOT NULL,
  target_organization_id UUID        NOT NULL,
  action                 TEXT        NOT NULL,  -- e.g. 'deal.view', 'investor.edit'
  target_type            TEXT        NOT NULL,  -- 'deal', 'investor', 'document', etc.
  target_id              UUID,
  target_label           TEXT,                  -- denormalized for log readability
  occurred_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address             TEXT,
  metadata               JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS jv_access_logs_jv_idx         ON public.jv_access_logs(joint_venture_id,       occurred_at DESC);
CREATE INDEX IF NOT EXISTS jv_access_logs_target_org_idx ON public.jv_access_logs(target_organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS jv_access_logs_acting_org_idx ON public.jv_access_logs(acting_organization_id, occurred_at DESC);

ALTER TABLE public.jv_access_logs ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  jv_scope_preferences table (per-user, per-org UI state)
--     Only meaningful for is_jv_hub users — others will never have rows here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.jv_scope_preferences (
  user_id              UUID    NOT NULL,
  organization_id      UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope_mode           TEXT    NOT NULL DEFAULT 'own_only'
                         CHECK (scope_mode IN (
                           'own_only',
                           'single_partner',
                           'multi_partner',
                           'all_partners_combined',
                           'all_partners_excluding_own'
                         )),
  selected_partner_ids UUID[]  NOT NULL DEFAULT '{}',
  include_own_data     BOOLEAN NOT NULL DEFAULT true,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

ALTER TABLE public.jv_scope_preferences ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Add joint_venture_id to audit_logs
--     null  = normal org action
--     non-null = action taken under a JV, cross-references jv_access_logs
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS joint_venture_id UUID REFERENCES public.joint_ventures(id);


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  v_active_jv_visibility view
--     Emits one row per (viewing_org → visible_org) pair for all active JVs.
--     Host (LotLine Homes) views partner. One-directional only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_active_jv_visibility AS
  SELECT
    host_organization_id    AS viewing_org_id,
    partner_organization_id AS visible_org_id,
    id                      AS joint_venture_id,
    permissions_on_partner  AS permissions
  FROM public.joint_ventures
  WHERE status = 'active'
    AND accepted_at IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  RLS helper functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Set of org UUIDs the current org can see via active JVs (empty for non-hub orgs)
CREATE OR REPLACE FUNCTION public.jv_visible_org_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT visible_org_id
  FROM   public.v_active_jv_visibility
  WHERE  viewing_org_id = public.current_org_id()
$$;

-- JSONB permissions blob for a specific partner org (null if no active JV)
CREATE OR REPLACE FUNCTION public.jv_permissions_for(p_target_org UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT permissions
  FROM   public.v_active_jv_visibility
  WHERE  viewing_org_id = public.current_org_id()
    AND  visible_org_id = p_target_org
  LIMIT 1
$$;

-- True if the current org may perform p_action on p_target_org's data via JV
CREATE OR REPLACE FUNCTION public.jv_can(p_target_org UUID, p_action TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (public.jv_permissions_for(p_target_org) ->> p_action)::boolean,
    false
  )
$$;

-- SECURITY DEFINER writer for cross-org audit entries (bypasses RLS on audit_logs)
CREATE OR REPLACE FUNCTION public.append_jv_audit(
  p_org_id       UUID,
  p_actor_id     UUID,
  p_action       TEXT,
  p_target_table TEXT,
  p_target_id    TEXT,
  p_jv_id        UUID,
  p_metadata     JSONB DEFAULT '{}'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs
    (organization_id, user_id, action, target_table, target_id,
     joint_venture_id, metadata, created_at)
  VALUES
    (p_org_id, p_actor_id, p_action, p_target_table, p_target_id,
     p_jv_id, p_metadata, now());
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- §8  RLS policies on new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- ── joint_ventures ────────────────────────────────────────────────────────────
-- Both host and partner see their own JVs; writes go through service-role APIs.

CREATE POLICY "jv_select" ON public.joint_ventures FOR SELECT
  USING (
    host_organization_id    = public.current_org_id()
    OR partner_organization_id = public.current_org_id()
  );

-- No client INSERT/UPDATE/DELETE — all mutations via SECURITY DEFINER API endpoints
-- (service-role admin client bypasses RLS in all JV API handlers)


-- ── jv_access_logs ────────────────────────────────────────────────────────────
-- Hub admins see logs where they acted; partner admins see logs on their data.

CREATE POLICY "jv_access_logs_select" ON public.jv_access_logs FOR SELECT
  USING (
    (acting_organization_id = public.current_org_id() AND public.can_admin())
    OR
    (target_organization_id = public.current_org_id() AND public.can_admin())
  );
-- No UPDATE or DELETE policy — append-only enforced by omission.


-- ── jv_scope_preferences ──────────────────────────────────────────────────────
-- Users manage only their own preferences.

CREATE POLICY "jv_scope_prefs_self" ON public.jv_scope_preferences
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- §9  organizations: additional SELECT policy for JV org visibility
--     Lets hub see partner org rows (for name/logo display) and vice versa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "orgs_jv_select" ON public.organizations FOR SELECT
  USING (
    -- Hub org sees all partner orgs linked via active JVs
    id IN (SELECT visible_org_id  FROM public.v_active_jv_visibility
           WHERE  viewing_org_id = public.current_org_id())
    OR
    -- Partner org sees the hub org (so they can show "LotLine Homes viewed your deal")
    id IN (SELECT viewing_org_id FROM public.v_active_jv_visibility
           WHERE  visible_org_id = public.current_org_id())
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §10  Update SELECT policies on all tenant tables
--      Pattern: add JV OR branch — operator-only, action-gated.
--      INSERT/UPDATE/DELETE policies are unchanged (cross-org writes via API only).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── deals ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deals_org_select" ON public.deals;
CREATE POLICY "deals_org_select" ON public.deals FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.current_user_is_operator())
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── investors ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investors_org_select" ON public.investors;
CREATE POLICY "investors_org_select" ON public.investors FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'investor.view')
    )
  );


-- ── investor_users ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_users_org_select" ON public.investor_users;
CREATE POLICY "investor_users_org_select" ON public.investor_users FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.can_admin())
    OR user_id = auth.uid()
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'investor.view')
    )
  );


-- ── documents ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "documents_org_select" ON public.documents;
CREATE POLICY "documents_org_select" ON public.documents FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (
          public.current_user_is_investor()
          AND visible_to_investor = true
          AND investor_id = public.current_investor_id()
        )
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'document.view')
    )
  );


-- ── deal_updates ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_updates_org_select" ON public.deal_updates;
CREATE POLICY "deal_updates_org_select" ON public.deal_updates FOR SELECT
  USING (
    (
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
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── distributions ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "distributions_org_select" ON public.distributions;
CREATE POLICY "distributions_org_select" ON public.distributions FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'distribution.view')
    )
  );


-- ── investment_interest ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "invest_interest_org_select" ON public.investment_interest;
CREATE POLICY "invest_interest_org_select" ON public.investment_interest FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'investor.view')
    )
  );


-- ── investor_messages ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "investor_msgs_org_select" ON public.investor_messages;
CREATE POLICY "investor_msgs_org_select" ON public.investor_messages FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'investor.view')
    )
  );


-- ── deal_photos ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_photos_org_select" ON public.deal_photos;
CREATE POLICY "deal_photos_org_select" ON public.deal_photos FOR SELECT
  USING (
    (
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
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── deal_milestones ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deal_milestones_org_select" ON public.deal_milestones;
CREATE POLICY "deal_milestones_org_select" ON public.deal_milestones FOR SELECT
  USING (
    (
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
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── projected_distributions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "proj_dist_org_select" ON public.projected_distributions;
CREATE POLICY "proj_dist_org_select" ON public.projected_distributions FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'distribution.view')
    )
  );


-- ── notifications ─────────────────────────────────────────────────────────────
-- Notifications are not exposed cross-org via JV (they're personal to each org).
-- SELECT policy unchanged — no JV OR branch for notifications.


-- ── capital_commitments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "commitments_org_select" ON public.capital_commitments;
CREATE POLICY "commitments_org_select" ON public.capital_commitments FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'capital_stack.view')
    )
  );


-- ── deal_allocations ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "allocations_org_select" ON public.deal_allocations;
CREATE POLICY "allocations_org_select" ON public.deal_allocations FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'capital_stack.view')
    )
  );


-- ── commitment_ledger_entries ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "ledger_org_select" ON public.commitment_ledger_entries;
CREATE POLICY "ledger_org_select" ON public.commitment_ledger_entries FOR SELECT
  USING (
    (
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
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'capital_stack.view')
    )
  );


-- ── draw_schedules ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "draw_schedules_org_select" ON public.draw_schedules;
CREATE POLICY "draw_schedules_org_select" ON public.draw_schedules FOR SELECT
  USING (
    (
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
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'draw_schedule.view')
    )
  );


-- ── draw_tranches ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "draw_tranches_org_select" ON public.draw_tranches;
CREATE POLICY "draw_tranches_org_select" ON public.draw_tranches FOR SELECT
  USING (
    (
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
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'draw_schedule.view')
    )
  );


-- ── funding_events ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "funding_events_org_select" ON public.funding_events;
CREATE POLICY "funding_events_org_select" ON public.funding_events FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'capital_stack.view')
    )
  );


-- ── capital_calls ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "capital_calls_org_select" ON public.capital_calls;
CREATE POLICY "capital_calls_org_select" ON public.capital_calls FOR SELECT
  USING (
    (
      organization_id = public.current_org_id()
      AND (
        public.current_user_is_operator()
        OR (public.current_user_is_investor() AND investor_id = public.current_investor_id())
      )
    )
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'capital_stack.view')
    )
  );


-- ── contractor_database ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contractors_org_select" ON public.contractor_database;
CREATE POLICY "contractors_org_select" ON public.contractor_database FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.current_user_is_operator())
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── pipelines ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pipelines_org_select" ON public.pipelines;
CREATE POLICY "pipelines_org_select" ON public.pipelines FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.current_user_is_operator())
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── stages ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stages_org_select" ON public.stages;
CREATE POLICY "stages_org_select" ON public.stages FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.current_user_is_operator())
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ── checklists ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "checklists_org_select" ON public.checklists;
CREATE POLICY "checklists_org_select" ON public.checklists FOR SELECT
  USING (
    (organization_id = public.current_org_id() AND public.current_user_is_operator())
    OR (
      organization_id = ANY(ARRAY(SELECT public.jv_visible_org_ids()))
      AND public.current_user_is_operator()
      AND public.jv_can(organization_id, 'deal.view')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §11  Audit log entry for this migration
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id   UUID;
  v_owner_id UUID;
BEGIN
  SELECT id, owner_user_id INTO v_org_id, v_owner_id
  FROM   public.organizations WHERE slug = 'lotline-homes' LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.audit_logs
      (organization_id, user_id, action, target_table, target_id, metadata, created_at)
    VALUES (
      v_org_id, v_owner_id,
      'migration_015_joint_ventures',
      'organizations', v_org_id::text,
      jsonb_build_object('migration', '015', 'applied_at', now()::text),
      now()
    );
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN (manual rollback)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- DROP VIEW  IF EXISTS public.v_active_jv_visibility;
-- DROP FUNCTION IF EXISTS public.jv_visible_org_ids();
-- DROP FUNCTION IF EXISTS public.jv_permissions_for(UUID);
-- DROP FUNCTION IF EXISTS public.jv_can(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.append_jv_audit(UUID,UUID,TEXT,TEXT,TEXT,UUID,JSONB);
-- ALTER TABLE public.audit_logs DROP COLUMN IF EXISTS joint_venture_id;
-- DROP TABLE IF EXISTS public.jv_scope_preferences CASCADE;
-- DROP TABLE IF EXISTS public.jv_access_logs CASCADE;
-- DROP TABLE IF EXISTS public.joint_ventures CASCADE;
-- ALTER TABLE public.organizations DROP COLUMN IF EXISTS is_jv_hub;
-- (then re-run the original SELECT policies from migration 010)
-- ═══════════════════════════════════════════════════════════════════════════════
