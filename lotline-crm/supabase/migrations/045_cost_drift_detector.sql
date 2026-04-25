-- ═══════════════════════════════════════════════════════════════════════════════
-- 045 · Cost Drift Detector
-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Creates cost_breakdown_drift_alerts table to persist per-deal drift events.
-- 2. Creates fn_detect_cost_drift() — compares deal_cost_summary_view.total_actual
--    against the sum of the flat legacy columns on deals.*
--    and inserts an alert row for any deal whose values diverge.
-- 3. Creates detect_and_log_cost_drift() — callable SQL function (no args)
--    that runs the detector and returns the alert rows inserted.
--
-- USAGE (run manually or via scheduled job):
--   SELECT * FROM detect_and_log_cost_drift();
--
-- DATA SAFETY: Read-only analysis + inserts into the audit table only.
--   No financial data on deals or deal_cost_lines is modified.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Drift-alerts table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cost_breakdown_drift_alerts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID          NOT NULL,
  deal_id         TEXT          NOT NULL,
  -- Total actual from the canonical cost-lines layer
  lines_total     NUMERIC(14,2) NOT NULL,
  -- Sum of flat legacy columns from the deals table
  legacy_total    NUMERIC(14,2) NOT NULL,
  -- Computed drift (lines_total - legacy_total)
  drift           NUMERIC(14,2) GENERATED ALWAYS AS (lines_total - legacy_total) STORED,
  -- Absolute drift magnitude for easy filtering
  drift_abs       NUMERIC(14,2) GENERATED ALWAYS AS (ABS(lines_total - legacy_total)) STORED,
  -- Whether the deal had any actual overrides set (useful triage signal)
  has_overrides   BOOLEAN       NOT NULL DEFAULT FALSE,
  detected_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Optional: tag from which run / context triggered detection
  run_tag         TEXT
);

CREATE INDEX IF NOT EXISTS cbda_deal_idx     ON public.cost_breakdown_drift_alerts (deal_id);
CREATE INDEX IF NOT EXISTS cbda_org_idx      ON public.cost_breakdown_drift_alerts (org_id);
CREATE INDEX IF NOT EXISTS cbda_drift_idx    ON public.cost_breakdown_drift_alerts (drift_abs DESC);
CREATE INDEX IF NOT EXISTS cbda_detected_idx ON public.cost_breakdown_drift_alerts (detected_at DESC);

COMMENT ON TABLE public.cost_breakdown_drift_alerts IS
  'Audit log for deals where deal_cost_summary_view.total_actual diverges from '
  'the sum of flat legacy cost columns on the deals table. '
  'Populated by detect_and_log_cost_drift(). Rows here signal stale legacy fields.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Drift detection function
-- ─────────────────────────────────────────────────────────────────────────────
-- Compares deal_cost_summary_view.total_actual (canonical truth)
-- against the sum of legacy flat columns on deals.* (stale layer).
--
-- Legacy cost columns summed:
--   land, mobile_home, hud_engineer, perc_test, survey, footers, setup,
--   clear_land, water_cost, septic, electric, hvac, underpinning, decks,
--   driveway, landscaping, water_sewer, mailbox, gutters, photos, mobile_tax,
--   staging
--
-- Returns the count of alert rows inserted.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.detect_and_log_cost_drift(
  p_run_tag TEXT DEFAULT NULL,
  p_min_drift NUMERIC DEFAULT 0.01   -- ignore rounding noise below this threshold
)
RETURNS TABLE (
  deal_id        TEXT,
  org_id         UUID,
  lines_total    NUMERIC(14,2),
  legacy_total   NUMERIC(14,2),
  drift          NUMERIC(14,2),
  has_overrides  BOOLEAN,
  detected_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert alert rows for all drifting deals, return them
  RETURN QUERY
  WITH summary AS (
    SELECT
      s.deal_id,
      s.org_id,
      COALESCE(s.total_actual, 0)::NUMERIC(14,2)    AS lines_total,
      COALESCE(s.override_count, 0) > 0             AS has_overrides
    FROM public.deal_cost_summary_view s
  ),
  legacy AS (
    SELECT
      d.id AS deal_id,
      (
        COALESCE(d.land,          0) +
        COALESCE(d.mobile_home,   0) +
        COALESCE(d.hud_engineer,  0) +
        COALESCE(d.perc_test,     0) +
        COALESCE(d.survey,        0) +
        COALESCE(d.footers,       0) +
        COALESCE(d.setup,         0) +
        COALESCE(d.clear_land,    0) +
        COALESCE(d.water_cost,    0) +
        COALESCE(d.septic,        0) +
        COALESCE(d.electric,      0) +
        COALESCE(d.hvac,          0) +
        COALESCE(d.underpinning,  0) +
        COALESCE(d.decks,         0) +
        COALESCE(d.driveway,      0) +
        COALESCE(d.landscaping,   0) +
        COALESCE(d.water_sewer,   0) +
        COALESCE(d.mailbox,       0) +
        COALESCE(d.gutters,       0) +
        COALESCE(d.photos,        0) +
        COALESCE(d.mobile_tax,    0) +
        COALESCE(d.staging,       0)
      )::NUMERIC(14,2) AS legacy_total
    FROM public.deals d
    WHERE d.organization_id IS NOT NULL
  ),
  drift_rows AS (
    SELECT
      s.deal_id,
      s.org_id,
      s.lines_total,
      l.legacy_total,
      s.has_overrides
    FROM summary s
    JOIN legacy l ON l.deal_id = s.deal_id
    WHERE ABS(s.lines_total - l.legacy_total) >= p_min_drift
  ),
  inserted AS (
    INSERT INTO public.cost_breakdown_drift_alerts
      (org_id, deal_id, lines_total, legacy_total, has_overrides, run_tag)
    SELECT
      dr.org_id,
      dr.deal_id,
      dr.lines_total,
      dr.legacy_total,
      dr.has_overrides,
      p_run_tag
    FROM drift_rows dr
    RETURNING
      cost_breakdown_drift_alerts.deal_id,
      cost_breakdown_drift_alerts.org_id,
      cost_breakdown_drift_alerts.lines_total,
      cost_breakdown_drift_alerts.legacy_total,
      cost_breakdown_drift_alerts.drift,
      cost_breakdown_drift_alerts.has_overrides,
      cost_breakdown_drift_alerts.detected_at
  )
  SELECT * FROM inserted
  ORDER BY ABS(inserted.drift) DESC;
END;
$$;

COMMENT ON FUNCTION public.detect_and_log_cost_drift IS
  'Detects deals where deal_cost_summary_view.total_actual differs from the sum '
  'of legacy flat cost columns on deals.*. Inserts a row into '
  'cost_breakdown_drift_alerts for each drifting deal and returns them. '
  'Args: p_run_tag (label for the run, e.g. ''migration-045''), '
  '      p_min_drift (ignore diffs smaller than this; default 0.01).';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Quick-summary view for monitoring
-- ─────────────────────────────────────────────────────────────────────────────
-- Run:  SELECT * FROM cost_drift_summary;
-- Expected after full migration (PR 2–5): all counts = 0.

CREATE OR REPLACE VIEW public.cost_drift_summary AS
SELECT
  COUNT(DISTINCT deal_id)                                     AS drifting_deals,
  COUNT(*)                                                    AS total_alerts,
  MAX(drift_abs)                                              AS max_drift,
  AVG(drift_abs)                                              AS avg_drift,
  SUM(CASE WHEN has_overrides THEN 1 ELSE 0 END)             AS deals_with_overrides,
  MAX(detected_at)                                            AS last_run_at
FROM public.cost_breakdown_drift_alerts;

COMMENT ON VIEW public.cost_drift_summary IS
  'Aggregate stats from cost_breakdown_drift_alerts. '
  'Run detect_and_log_cost_drift() first to populate data.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Verification
-- ─────────────────────────────────────────────────────────────────────────────
-- Run to confirm the function and table exist:

-- §4a: Table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'cost_breakdown_drift_alerts';

-- §4b: Function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'detect_and_log_cost_drift';

-- §4c: Execute the detector (first run — inserts alerts)
-- SELECT * FROM detect_and_log_cost_drift('migration-045-baseline');

-- §4d: Review summary
-- SELECT * FROM cost_drift_summary;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DOWN — reversible
-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP VIEW  IF EXISTS public.cost_drift_summary;
-- DROP FUNCTION IF EXISTS public.detect_and_log_cost_drift(TEXT, NUMERIC);
-- DROP TABLE IF EXISTS public.cost_breakdown_drift_alerts;
-- ═══════════════════════════════════════════════════════════════════════════════
