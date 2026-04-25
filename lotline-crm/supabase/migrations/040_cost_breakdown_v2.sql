-- ═══════════════════════════════════════════════════════════════════════════════
-- 040 · Cost Breakdown V2  (PR 1 of 6)
-- ───────────────────────────────────────────────────────────────────────────────
-- Replaces the flat cost columns on the deals table with a normalized
-- deal_cost_lines table. Every downstream consumer reads
-- actual_amount_resolved from deal_cost_resolved_view — which equals
-- estimated_amount until an operator manually overrides the actual.
--
-- Zero-data-loss strategy
--   1. Create cost_breakdown_categories (global defaults with org_id NULL)
--   2. Create deal_cost_lines with UNIQUE(deal_id, category_key)
--   3. Seed 22 default categories (org_id NULL = global)
--   4. Backfill every existing deal with one row per category, reading the
--      legacy columns as estimated_amount; actual_amount = NULL (mirrors)
--   5. Create two views: deal_cost_resolved_view, deal_cost_summary_view
--   6. Add feature_flags JSONB to organizations for the per-org flag
--
-- Legacy columns on deals are LEFT INTACT (not dropped). They are deprecated
-- read-only fallbacks until a follow-up PR confirms parity and drops them.
--
-- Fully reversible — see DOWN section at the bottom.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Feature flags column on organizations
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.organizations.feature_flags IS
  'Per-org feature flags. Keys: "cost_breakdown.three_column" (bool, default false).';


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Global category catalogue
-- ─────────────────────────────────────────────────────────────────────────────
-- org_id NULL = global default (every org inherits these on first use).
-- org_id NOT NULL = org-specific custom category.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cost_breakdown_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  group_name  TEXT        NOT NULL DEFAULT 'Other'
                            CHECK (group_name IN ('Land','Build','Sitework','Finishing','Other')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (org_id, key)
);

CREATE INDEX IF NOT EXISTS cbc_org_idx    ON public.cost_breakdown_categories (org_id);
CREATE INDEX IF NOT EXISTS cbc_key_idx    ON public.cost_breakdown_categories (key);
CREATE INDEX IF NOT EXISTS cbc_active_idx ON public.cost_breakdown_categories (is_active);

COMMENT ON TABLE public.cost_breakdown_categories IS
  'Global (org_id NULL) and per-org cost line categories. '
  'Operators can add custom categories per org; global ones are inherited.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Per-deal cost lines
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deal_cost_lines (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                        UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id                       TEXT        NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  category_key                  TEXT        NOT NULL,
  category_label                TEXT        NOT NULL,
  sort_order                    INTEGER     NOT NULL DEFAULT 0,
  group_name                    TEXT        NOT NULL DEFAULT 'Other',

  -- Estimated (operator editable; feeds the Estimated column)
  estimated_amount              NUMERIC(14,2),
  estimated_updated_at          TIMESTAMPTZ,
  estimated_updated_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Actual (NULL = mirrors estimated; NOT NULL + actual_overridden = manual entry)
  actual_amount                 NUMERIC(14,2),          -- NULL until first override
  actual_overridden             BOOLEAN     NOT NULL DEFAULT FALSE,
  actual_overridden_at          TIMESTAMPTZ,
  actual_overridden_by_user_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  notes                         TEXT,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (deal_id, category_key)
);

CREATE INDEX IF NOT EXISTS dcl_deal_idx  ON public.deal_cost_lines (deal_id);
CREATE INDEX IF NOT EXISTS dcl_org_idx   ON public.deal_cost_lines (org_id);
CREATE INDEX IF NOT EXISTS dcl_over_idx  ON public.deal_cost_lines (deal_id, actual_overridden);

COMMENT ON TABLE public.deal_cost_lines IS
  'Normalized cost lines per deal. actual_amount NULL = mirrors estimated. '
  'actual_overridden TRUE = manually entered actual (green checkmark in UI).';

COMMENT ON COLUMN public.deal_cost_lines.actual_amount IS
  'NULL means "mirror estimated_amount". Set + actual_overridden=TRUE on first manual entry.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Computed views
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.deal_cost_resolved_view;
CREATE VIEW public.deal_cost_resolved_view AS
SELECT
  dcl.id                  AS line_id,
  dcl.deal_id,
  dcl.org_id,
  dcl.category_key,
  dcl.category_label      AS label,
  dcl.sort_order,
  dcl.group_name,
  dcl.notes,
  dcl.actual_overridden,
  dcl.actual_overridden_at,
  dcl.actual_overridden_by_user_id,
  dcl.estimated_updated_at,
  dcl.estimated_updated_by_user_id,
  dcl.updated_at,

  -- Estimated is always the stored value (default 0 when NULL)
  COALESCE(dcl.estimated_amount, 0)                             AS estimated_amount,

  -- Resolved actual: manual override when overridden, else mirrors estimated
  CASE
    WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
    ELSE COALESCE(dcl.estimated_amount, 0)
  END                                                           AS actual_amount_resolved,

  -- Difference: positive = over budget, negative = under budget
  (CASE
    WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
    ELSE COALESCE(dcl.estimated_amount, 0)
  END) - COALESCE(dcl.estimated_amount, 0)                     AS difference

FROM public.deal_cost_lines dcl;

COMMENT ON VIEW public.deal_cost_resolved_view IS
  'Per-line resolved values. Every downstream consumer reads actual_amount_resolved — '
  'NEVER raw estimated_amount — for net profit, ROI, dashboards, etc.';


DROP VIEW IF EXISTS public.deal_cost_summary_view;
CREATE VIEW public.deal_cost_summary_view AS
SELECT
  dcl.deal_id,
  dcl.org_id,
  COALESCE(SUM(COALESCE(dcl.estimated_amount, 0)), 0)          AS total_estimated,
  COALESCE(SUM(
    CASE
      WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
      ELSE COALESCE(dcl.estimated_amount, 0)
    END
  ), 0)                                                         AS total_actual,
  COALESCE(SUM(
    (CASE
      WHEN dcl.actual_overridden THEN COALESCE(dcl.actual_amount, 0)
      ELSE COALESCE(dcl.estimated_amount, 0)
    END) - COALESCE(dcl.estimated_amount, 0)
  ), 0)                                                         AS total_difference,
  COUNT(*) FILTER (WHERE dcl.actual_overridden)                 AS override_count,
  COUNT(*)                                                      AS line_count,
  MAX(dcl.actual_overridden_at) FILTER (WHERE dcl.actual_overridden) AS last_actual_change_at
FROM public.deal_cost_lines dcl
GROUP BY dcl.deal_id, dcl.org_id;

COMMENT ON VIEW public.deal_cost_summary_view IS
  'Per-deal roll-up of estimated vs actual. total_actual is the authoritative '
  'cost figure for net profit, ROI, and all dashboard surfaces.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cost_breakdown_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_cost_lines           ENABLE ROW LEVEL SECURITY;

-- cost_breakdown_categories: org members read global (org_id NULL) + own org rows
DROP POLICY IF EXISTS "cbc_select" ON public.cost_breakdown_categories;
CREATE POLICY "cbc_select" ON public.cost_breakdown_categories
  FOR SELECT USING (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "cbc_insert" ON public.cost_breakdown_categories;
CREATE POLICY "cbc_insert" ON public.cost_breakdown_categories
  FOR INSERT WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "cbc_update" ON public.cost_breakdown_categories;
CREATE POLICY "cbc_update" ON public.cost_breakdown_categories
  FOR UPDATE USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "cbc_delete" ON public.cost_breakdown_categories;
CREATE POLICY "cbc_delete" ON public.cost_breakdown_categories
  FOR DELETE USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );

-- deal_cost_lines: org-scoped CRUD
DROP POLICY IF EXISTS "dcl_select" ON public.deal_cost_lines;
CREATE POLICY "dcl_select" ON public.deal_cost_lines
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "dcl_insert" ON public.deal_cost_lines;
CREATE POLICY "dcl_insert" ON public.deal_cost_lines
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "dcl_update" ON public.deal_cost_lines;
CREATE POLICY "dcl_update" ON public.deal_cost_lines
  FOR UPDATE USING (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin','operator')
    )
  );

DROP POLICY IF EXISTS "dcl_delete" ON public.deal_cost_lines;
CREATE POLICY "dcl_delete" ON public.deal_cost_lines
  FOR DELETE USING (
    org_id IN (
      SELECT organization_id FROM public.memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner','admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Seed global default categories (org_id NULL)
-- ─────────────────────────────────────────────────────────────────────────────
-- Matches current COST_FIELDS in DealDetail.jsx exactly.
-- sort_order increments by 10 to leave room for insertions.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.cost_breakdown_categories (org_id, key, label, sort_order, group_name) VALUES
  (NULL, 'land_purchase_price',      'Land / Purchase Price',       0,   'Land'),
  (NULL, 'mobile_home',              'Mobile Home',                 10,  'Build'),
  (NULL, 'hud_engineer',             'HUD Engineer',                20,  'Build'),
  (NULL, 'footers',                  'Footers',                     30,  'Build'),
  (NULL, 'setup',                    'Setup',                       40,  'Build'),
  (NULL, 'hvac',                     'HVAC',                        50,  'Build'),
  (NULL, 'skirting',                 'Skirting',                    60,  'Build'),
  (NULL, 'decks_installed',          'Decks Installed',             70,  'Build'),
  (NULL, 'perc_test_permit',         'Perc Test / Permit',          80,  'Sitework'),
  (NULL, 'land_survey',              'Land Survey',                 90,  'Sitework'),
  (NULL, 'clear_land',               'Clear Land',                  100, 'Sitework'),
  (NULL, 'water',                    'Water',                       110, 'Sitework'),
  (NULL, 'septic',                   'Septic',                      120, 'Sitework'),
  (NULL, 'electric_power_pole',      'Electric / Power Pole',       130, 'Sitework'),
  (NULL, 'driveway',                 'Driveway',                    140, 'Sitework'),
  (NULL, 'landscaping_final_grading','Landscaping / Final Grading', 150, 'Sitework'),
  (NULL, 'water_sewer_hookup',       'Water / Sewer Hook Up',       160, 'Sitework'),
  (NULL, 'mailbox',                  'Mailbox',                     170, 'Finishing'),
  (NULL, 'gutters',                  'Gutters',                     180, 'Finishing'),
  (NULL, 'professional_photos',      'Professional Photos',         190, 'Finishing'),
  (NULL, 'mobile_home_tax',          'Mobile Home Tax',             200, 'Finishing'),
  (NULL, 'staging',                  'Staging',                     210, 'Finishing')
ON CONFLICT (org_id, key) DO UPDATE
  SET label      = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      group_name = EXCLUDED.group_name;


-- ─────────────────────────────────────────────────────────────────────────────
-- §7  Backfill existing deals → deal_cost_lines
-- ─────────────────────────────────────────────────────────────────────────────
-- For each existing deal × each global category, create a cost line.
-- estimated_amount is read from the legacy deal column.
-- actual_amount is NULL (mirrors estimated — no checkmark, no override).
-- ON CONFLICT DO NOTHING ensures reruns are safe.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.deal_cost_lines
  (org_id, deal_id, category_key, category_label, sort_order, group_name, estimated_amount)
SELECT
  d.organization_id,
  d.id,
  cbc.key,
  cbc.label,
  cbc.sort_order,
  cbc.group_name,
  CASE cbc.key
    WHEN 'land_purchase_price'       THEN COALESCE(d.land,         0)
    WHEN 'mobile_home'               THEN COALESCE(d.mobile_home,  0)
    WHEN 'hud_engineer'              THEN COALESCE(d.hud_engineer, 0)
    WHEN 'perc_test_permit'          THEN COALESCE(d.perc_test,    0)
    WHEN 'land_survey'               THEN COALESCE(d.survey,       0)
    WHEN 'footers'                   THEN COALESCE(d.footers,      0)
    WHEN 'setup'                     THEN COALESCE(d.setup,        0)
    WHEN 'clear_land'                THEN COALESCE(d.clear_land,   0)
    WHEN 'water'                     THEN COALESCE(d.water_cost,   0)
    WHEN 'septic'                    THEN COALESCE(d.septic,       0)
    WHEN 'electric_power_pole'       THEN COALESCE(d.electric,     0)
    WHEN 'hvac'                      THEN COALESCE(d.hvac,         0)
    WHEN 'skirting'                  THEN COALESCE(d.underpinning, 0)
    WHEN 'decks_installed'           THEN COALESCE(d.decks,        0)
    WHEN 'driveway'                  THEN COALESCE(d.driveway,     0)
    WHEN 'landscaping_final_grading' THEN COALESCE(d.landscaping,  0)
    WHEN 'water_sewer_hookup'        THEN COALESCE(d.water_sewer,  0)
    WHEN 'mailbox'                   THEN COALESCE(d.mailbox,      0)
    WHEN 'gutters'                   THEN COALESCE(d.gutters,      0)
    WHEN 'professional_photos'       THEN COALESCE(d.photos,       0)
    WHEN 'mobile_home_tax'           THEN COALESCE(d.mobile_tax,   0)
    WHEN 'staging'                   THEN COALESCE(d.staging,      0)
    ELSE 0
  END AS estimated_amount
FROM public.deals d
CROSS JOIN public.cost_breakdown_categories cbc
WHERE cbc.org_id IS NULL       -- only global defaults
  AND d.organization_id IS NOT NULL
ON CONFLICT (deal_id, category_key) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- §8  Trigger: auto-backfill new deals with all active global categories
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_seed_deal_cost_lines()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.deal_cost_lines
    (org_id, deal_id, category_key, category_label, sort_order, group_name, estimated_amount)
  SELECT
    NEW.organization_id,
    NEW.id,
    cbc.key,
    cbc.label,
    cbc.sort_order,
    cbc.group_name,
    0 -- new deal starts with 0 estimated; operator fills in
  FROM public.cost_breakdown_categories cbc
  WHERE (cbc.org_id IS NULL OR cbc.org_id = NEW.organization_id)
    AND cbc.is_active = TRUE
  ON CONFLICT (deal_id, category_key) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_deal_cost_lines ON public.deals;
CREATE TRIGGER trg_seed_deal_cost_lines
  AFTER INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.fn_seed_deal_cost_lines();


-- ─────────────────────────────────────────────────────────────────────────────
-- §9  Trigger: auto-stamp updated_at on deal_cost_lines
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_dcl_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dcl_updated_at ON public.deal_cost_lines;
CREATE TRIGGER trg_dcl_updated_at
  BEFORE UPDATE ON public.deal_cost_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_dcl_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- §10  Trigger: when a new org-scoped category is added, seed it on all deals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_seed_category_on_deals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only runs for org-specific new categories (not global defaults)
  IF NEW.org_id IS NOT NULL THEN
    INSERT INTO public.deal_cost_lines
      (org_id, deal_id, category_key, category_label, sort_order, group_name, estimated_amount)
    SELECT
      NEW.org_id,
      d.id,
      NEW.key,
      NEW.label,
      NEW.sort_order,
      NEW.group_name,
      NULL  -- new custom category: NULL estimated until operator enters a value
    FROM public.deals d
    WHERE d.organization_id = NEW.org_id
    ON CONFLICT (deal_id, category_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_category_on_deals ON public.cost_breakdown_categories;
CREATE TRIGGER trg_seed_category_on_deals
  AFTER INSERT ON public.cost_breakdown_categories
  FOR EACH ROW EXECUTE FUNCTION public.fn_seed_category_on_deals();


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN — fully reversible
-- ═══════════════════════════════════════════════════════════════════════════════
-- To roll back, run:
--
--   DROP TRIGGER IF EXISTS trg_seed_category_on_deals ON public.cost_breakdown_categories;
--   DROP TRIGGER IF EXISTS trg_seed_deal_cost_lines   ON public.deals;
--   DROP TRIGGER IF EXISTS trg_dcl_updated_at         ON public.deal_cost_lines;
--   DROP FUNCTION IF EXISTS public.fn_seed_category_on_deals();
--   DROP FUNCTION IF EXISTS public.fn_seed_deal_cost_lines();
--   DROP FUNCTION IF EXISTS public.fn_dcl_updated_at();
--   DROP VIEW IF EXISTS public.deal_cost_summary_view;
--   DROP VIEW IF EXISTS public.deal_cost_resolved_view;
--   DROP TABLE IF EXISTS public.deal_cost_lines;
--   DROP TABLE IF EXISTS public.cost_breakdown_categories;
--   ALTER TABLE public.organizations DROP COLUMN IF EXISTS feature_flags;
--
-- Legacy deal columns (land, mobile_home, hud_engineer, etc.) are untouched.
-- ═══════════════════════════════════════════════════════════════════════════════
