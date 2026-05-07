-- 118 · Make _upsert_deal_event idempotent against the partial unique index.
--
-- Symptom: stage save fails with
--   "duplicate key value violates unique constraint idx_deal_events_source_unique"
-- when a date column (close_date / contract_date) already has a deal_events row
-- with deleted_at IS NULL.
--
-- Root cause: the existing function uses bare `INSERT ... ON CONFLICT DO NOTHING`
-- which Postgres will not always reliably resolve against a *partial* unique index
-- (idx_deal_events_source_unique has WHERE source_table IS NOT NULL AND source_id IS NOT NULL
-- AND deleted_at IS NULL). When called from the deals INSERT/UPDATE trigger (which fires
-- once per row even when the row already exists), the second invocation can collide.
--
-- Fix: rewrite as UPDATE-first / INSERT-if-not-found. Any existing matching row (live or
-- soft-deleted) gets updated and reactivated; a fresh insert only happens when no row
-- with that (source_table, source_id, organization_id) tuple exists.

BEGIN;

CREATE OR REPLACE FUNCTION public._upsert_deal_event(
  p_org_id      uuid,
  p_deal_id     text,
  p_title       text,
  p_event_type  text,
  p_start_at    timestamptz,
  p_end_at      timestamptz,
  p_all_day     boolean,
  p_color       text,
  p_source_table text,
  p_source_id   text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_start_at IS NULL THEN RETURN; END IF;

  -- Update an existing row first (live or soft-deleted). This both refreshes the
  -- row's data and clears deleted_at, effectively "reviving" it.
  UPDATE public.deal_events
  SET
    title       = p_title,
    event_type  = p_event_type,
    start_at    = p_start_at,
    end_at      = p_end_at,
    all_day     = p_all_day,
    color       = p_color,
    deleted_at  = NULL,
    updated_at  = now()
  WHERE source_table     = p_source_table
    AND source_id        = p_source_id
    AND organization_id  = p_org_id;

  IF FOUND THEN RETURN; END IF;

  -- No matching row — safe to insert a fresh one.
  INSERT INTO public.deal_events (
    organization_id, deal_id, title, event_type,
    start_at, end_at, all_day, color,
    source_table, source_id
  ) VALUES (
    p_org_id, p_deal_id, p_title, p_event_type,
    p_start_at, p_end_at, p_all_day, p_color,
    p_source_table, p_source_id
  )
  -- Defensive: if a concurrent transaction inserted between our UPDATE and INSERT,
  -- silently drop. Using DO NOTHING (no target) so partial-index inference isn't required.
  ON CONFLICT DO NOTHING;
END;
$$;

COMMIT;
