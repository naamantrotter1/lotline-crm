-- 074 · Sync deals.close_date + contract_date → deal_events
--       + backfill all existing milestone etas and deal dates

-- ── 1. Trigger: deals.close_date / contract_date → deal_events ───────────────
CREATE OR REPLACE FUNCTION public.sync_deal_dates_to_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- close_date
  IF NEW.close_date IS DISTINCT FROM OLD.close_date THEN
    IF NEW.close_date IS NULL THEN
      UPDATE public.deal_events
      SET deleted_at = now(), updated_at = now()
      WHERE source_table = 'deals_close_date' AND source_id = NEW.id::text;
    ELSE
      PERFORM public._upsert_deal_event(
        NEW.organization_id, NEW.id,
        'Closing Date',
        'closing',
        NEW.close_date::timestamptz,
        NULL, true,
        '#10b981',   -- green
        'deals_close_date',
        NEW.id::text
      );
    END IF;
  END IF;

  -- contract_date
  IF NEW.contract_date IS DISTINCT FROM OLD.contract_date THEN
    IF NEW.contract_date IS NULL THEN
      UPDATE public.deal_events
      SET deleted_at = now(), updated_at = now()
      WHERE source_table = 'deals_contract_date' AND source_id = NEW.id::text;
    ELSE
      PERFORM public._upsert_deal_event(
        NEW.organization_id, NEW.id,
        'Contract Signed',
        'milestone',
        NEW.contract_date::timestamptz,
        NULL, true,
        '#3b82f6',   -- blue
        'deals_contract_date',
        NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_dates_to_events ON public.deals;
CREATE TRIGGER trg_sync_deal_dates_to_events
  AFTER UPDATE OF close_date, contract_date ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.sync_deal_dates_to_events();

-- ── 2. Backfill: existing deal_milestones with eta set ────────────────────────
INSERT INTO public.deal_events (
  organization_id, deal_id, title, event_type,
  start_at, end_at, all_day, color, source_table, source_id
)
SELECT
  d.organization_id,
  dm.deal_id,
  public._milestone_label(dm.milestone_key),
  'milestone',
  dm.eta::timestamptz,
  NULL,
  true,
  '#3b82f6',
  'deal_milestones',
  dm.id::text
FROM public.deal_milestones dm
JOIN public.deals d ON d.id = dm.deal_id
WHERE dm.eta IS NOT NULL
  AND d.organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 3. Backfill: deals.close_date ────────────────────────────────────────────
INSERT INTO public.deal_events (
  organization_id, deal_id, title, event_type,
  start_at, end_at, all_day, color, source_table, source_id
)
SELECT
  organization_id,
  id,
  'Closing Date',
  'closing',
  close_date::timestamptz,
  NULL,
  true,
  '#10b981',
  'deals_close_date',
  id::text
FROM public.deals
WHERE close_date IS NOT NULL
  AND organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 4. Backfill: deals.contract_date ─────────────────────────────────────────
INSERT INTO public.deal_events (
  organization_id, deal_id, title, event_type,
  start_at, end_at, all_day, color, source_table, source_id
)
SELECT
  organization_id,
  id,
  'Contract Signed',
  'milestone',
  contract_date::timestamptz,
  NULL,
  true,
  '#3b82f6',
  'deals_contract_date',
  id::text
FROM public.deals
WHERE contract_date IS NOT NULL
  AND organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 5. Backfill: existing activity_notes stage_changes ───────────────────────
INSERT INTO public.deal_events (
  organization_id, deal_id, title, event_type,
  start_at, end_at, all_day, color, source_table, source_id
)
SELECT
  organization_id,
  deal_id,
  body,
  'stage_change',
  created_at,
  NULL,
  true,
  '#9ca3af',
  'activity_notes',
  id::text
FROM public.activity_notes
WHERE note_type = 'stage_change'
  AND parent_note_id IS NULL
ON CONFLICT DO NOTHING;
