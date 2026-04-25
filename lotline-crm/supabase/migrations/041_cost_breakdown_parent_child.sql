-- ═══════════════════════════════════════════════════════════════════════════════
-- 041 · Cost Breakdown V2 — PR 1: Parent/Child Schema
-- ───────────────────────────────────────────────────────────────────────────────
-- Adds parent/child structure to cost categories + aliases + calculator scenarios.
-- Zero data loss — purely additive columns + new tables.
-- Rebuilds views to exclude parent (sum_of_children) rows from totals.
--
-- Reversible — see DOWN section at bottom.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  parent_key + aggregation on cost_breakdown_categories
-- ─────────────────────────────────────────────────────────────────────────────
-- aggregation: 'none' (leaf, directly editable) | 'sum_of_children' (computed)
-- parent_key:  NULL = top-level; non-NULL = child of that key.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cost_breakdown_categories
  ADD COLUMN IF NOT EXISTS parent_key  TEXT,
  ADD COLUMN IF NOT EXISTS aggregation TEXT NOT NULL DEFAULT 'none'
    CHECK (aggregation IN ('none','sum_of_children'));

COMMENT ON COLUMN public.cost_breakdown_categories.parent_key IS
  'Key of the parent category, or NULL if this is a top-level category.';
COMMENT ON COLUMN public.cost_breakdown_categories.aggregation IS
  '"none" = leaf (editable); "sum_of_children" = read-only, computed from children.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  parent_key (denormalized) on deal_cost_lines
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.deal_cost_lines
  ADD COLUMN IF NOT EXISTS parent_key TEXT;

COMMENT ON COLUMN public.deal_cost_lines.parent_key IS
  'Denormalized from cost_breakdown_categories.parent_key. Kept in sync by trigger.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Trigger: sync parent_key from registry → deal_cost_lines
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sync_dcl_parent_key()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.deal_cost_lines
  SET parent_key = NEW.parent_key
  WHERE category_key = NEW.key;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dcl_parent_key ON public.cost_breakdown_categories;
CREATE TRIGGER trg_sync_dcl_parent_key
  AFTER UPDATE OF parent_key ON public.cost_breakdown_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_dcl_parent_key();


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Backfill parent_key on existing deal_cost_lines from registry
-- ─────────────────────────────────────────────────────────────────────────────
-- No-op today since no categories have parent_key set yet; safe to rerun.

UPDATE public.deal_cost_lines dcl
SET parent_key = cbc.parent_key
FROM public.cost_breakdown_categories cbc
WHERE dcl.category_key = cbc.key
  AND cbc.parent_key IS NOT NULL
  AND dcl.parent_key IS DISTINCT FROM cbc.parent_key;


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  cost_breakdown_category_aliases
-- ─────────────────────────────────────────────────────────────────────────────
-- Tracks old keys that were renamed to canonical keys.
-- Used during PR 3 migration to re-key deal_cost_lines and surface audit entries.

CREATE TABLE IF NOT EXISTS public.cost_breakdown_category_aliases (
  key          TEXT        NOT NULL PRIMARY KEY,   -- old / retired key
  alias_of_key TEXT        NOT NULL,               -- canonical key it maps to
  retired_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes        TEXT
);

COMMENT ON TABLE public.cost_breakdown_category_aliases IS
  'Maps retired category keys to canonical keys. '
  'deal_cost_lines referencing old keys are re-keyed during PR 3 migration.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  deal_calculator_scenarios
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deal_calculator_scenarios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  line_values JSONB       NOT NULL DEFAULT '{}',
  -- line_values shape: { "category_key": estimated_amount, ... }
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dcs_org_idx ON public.deal_calculator_scenarios (org_id);

COMMENT ON TABLE public.deal_calculator_scenarios IS
  'Saved Deal Calculator snapshots. line_values is {category_key: amount}. '
  '"Apply to deal" copies values onto a deal''s deal_cost_lines with confirmation.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  RLS for new tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cost_breakdown_category_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_calculator_scenarios       ENABLE ROW LEVEL SECURITY;

-- Aliases: readable by any authenticated user (global reference data)
DROP POLICY IF EXISTS "cbca_select" ON public.cost_breakdown_category_aliases;
CREATE POLICY "cbca_select" ON public.cost_breakdown_category_aliases
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cbca_insert" ON public.cost_breakdown_category_aliases;
CREATE POLICY "cbca_insert" ON public.cost_breakdown_category_aliases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
    )
  );

-- Scenarios: org-scoped
DROP POLICY IF EXISTS "dcs_select" ON public.deal_calculator_scenarios;
CREATE POLICY "dcs_select" ON public.deal_calculator_scenarios
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "dcs_insert" ON public.deal_calculator_scenarios;
CREATE POLICY "dcs_insert" ON public.deal_calculator_scenarios
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "dcs_update" ON public.deal_calculator_scenarios;
CREATE POLICY "dcs_update" ON public.deal_calculator_scenarios
  FOR UPDATE USING (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "dcs_delete" ON public.deal_calculator_scenarios;
CREATE POLICY "dcs_delete" ON public.deal_calculator_scenarios
  FOR DELETE USING (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §8  Rebuild views — exclude parent (sum_of_children) rows from totals
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.deal_cost_summary_view;
DROP VIEW IF EXISTS public.deal_cost_resolved_view;

CREATE VIEW public.deal_cost_resolved_view AS
SELECT
  dcl.id                             AS line_id,
  dcl.deal_id,
  dcl.org_id,
  dcl.category_key,
  dcl.category_label                 AS label,
  dcl.sort_order,
  dcl.group_name,
  dcl.parent_key,
  dcl.notes,
  dcl.actual_overridden,
  dcl.actual_overridden_at,
  dcl.actual_overridden_by_user_id,
  dcl.estimated_updated_at,
  dcl.estimated_updated_by_user_id,
  dcl.updated_at,

  COALESCE(cbc.aggregation, 'none')  AS aggregation,

  COALESCE(dcl.estimated_amount, 0)  AS estimated_amount,

  CASE
    WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
    ELSE COALESCE(dcl.estimated_amount, 0)
  END                                AS actual_amount_resolved,

  (CASE
    WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
    ELSE COALESCE(dcl.estimated_amount, 0)
  END) - COALESCE(dcl.estimated_amount, 0) AS difference

FROM public.deal_cost_lines dcl
LEFT JOIN public.cost_breakdown_categories cbc
  ON cbc.key = dcl.category_key
  AND (cbc.org_id IS NULL OR cbc.org_id = dcl.org_id);

COMMENT ON VIEW public.deal_cost_resolved_view IS
  'Per-line resolved values including parent_key and aggregation. '
  'Consumers that sum totals MUST filter WHERE aggregation = ''none'' '
  'to avoid double-counting parent + children rows.';


CREATE VIEW public.deal_cost_summary_view AS
SELECT
  dcl.deal_id,
  dcl.org_id,

  -- Leaf-only sums (aggregation = 'none') — no double-counting with parents
  COALESCE(SUM(
    COALESCE(dcl.estimated_amount, 0)
  ) FILTER (WHERE COALESCE(cbc.aggregation, 'none') = 'none'), 0)       AS total_estimated,

  COALESCE(SUM(
    CASE
      WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
      ELSE COALESCE(dcl.estimated_amount, 0)
    END
  ) FILTER (WHERE COALESCE(cbc.aggregation, 'none') = 'none'), 0)       AS total_actual,

  COALESCE(SUM(
    (CASE
      WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
      ELSE COALESCE(dcl.estimated_amount, 0)
    END) - COALESCE(dcl.estimated_amount, 0)
  ) FILTER (WHERE COALESCE(cbc.aggregation, 'none') = 'none'), 0)       AS total_difference,

  COUNT(*) FILTER (
    WHERE dcl.actual_overridden
      AND COALESCE(cbc.aggregation, 'none') = 'none'
  )                                                                       AS override_count,

  COUNT(*) FILTER (
    WHERE COALESCE(cbc.aggregation, 'none') = 'none'
  )                                                                       AS line_count,

  MAX(dcl.actual_overridden_at) FILTER (
    WHERE dcl.actual_overridden
      AND COALESCE(cbc.aggregation, 'none') = 'none'
  )                                                                       AS last_actual_change_at

FROM public.deal_cost_lines dcl
LEFT JOIN public.cost_breakdown_categories cbc
  ON cbc.key = dcl.category_key
  AND (cbc.org_id IS NULL OR cbc.org_id = dcl.org_id)
GROUP BY dcl.deal_id, dcl.org_id;

COMMENT ON VIEW public.deal_cost_summary_view IS
  'Per-deal roll-up. Sums ONLY leaf rows (aggregation=''none'') to prevent '
  'double-counting parent rows alongside their children. '
  'Authoritative source for Dashboard, P&L, Analytics, Investor Portal, etc.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §9  Updated-at trigger for deal_calculator_scenarios
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_dcs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dcs_updated_at ON public.deal_calculator_scenarios;
CREATE TRIGGER trg_dcs_updated_at
  BEFORE UPDATE ON public.deal_calculator_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_dcs_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN — fully reversible
-- ═══════════════════════════════════════════════════════════════════════════════
-- To roll back:
--
--   DROP TRIGGER IF EXISTS trg_dcs_updated_at        ON public.deal_calculator_scenarios;
--   DROP TRIGGER IF EXISTS trg_sync_dcl_parent_key   ON public.cost_breakdown_categories;
--   DROP FUNCTION IF EXISTS public.fn_dcs_updated_at();
--   DROP FUNCTION IF EXISTS public.fn_sync_dcl_parent_key();
--   DROP VIEW  IF EXISTS public.deal_cost_summary_view;
--   DROP VIEW  IF EXISTS public.deal_cost_resolved_view;
--   DROP TABLE IF EXISTS public.deal_calculator_scenarios;
--   DROP TABLE IF EXISTS public.cost_breakdown_category_aliases;
--   ALTER TABLE public.deal_cost_lines           DROP COLUMN IF EXISTS parent_key;
--   ALTER TABLE public.cost_breakdown_categories DROP COLUMN IF EXISTS aggregation;
--   ALTER TABLE public.cost_breakdown_categories DROP COLUMN IF EXISTS parent_key;
--
-- Then re-run views from migration 040 to restore prior definitions.
-- ═══════════════════════════════════════════════════════════════════════════════
