-- 078 · Fix deal date triggers to fire on INSERT as well as UPDATE
-- Root cause: trg_sync_deal_dates_to_events was AFTER UPDATE only,
-- so deals created with close_date/contract_date already set were never
-- synced to deal_events.

-- ── 1. Replace trigger function to handle INSERT + UPDATE ─────────────────────
CREATE OR REPLACE FUNCTION public.sync_deal_dates_to_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- close_date: sync if inserting with a value, or if value changed on update
  IF (TG_OP = 'INSERT' AND NEW.close_date IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.close_date IS DISTINCT FROM OLD.close_date)
  THEN
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
        '#10b981',
        'deals_close_date',
        NEW.id::text
      );
    END IF;
  END IF;

  -- contract_date: sync if inserting with a value, or if value changed on update
  IF (TG_OP = 'INSERT' AND NEW.contract_date IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.contract_date IS DISTINCT FROM OLD.contract_date)
  THEN
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
        '#3b82f6',
        'deals_contract_date',
        NEW.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Recreate trigger to fire on INSERT OR UPDATE ───────────────────────────
DROP TRIGGER IF EXISTS trg_sync_deal_dates_to_events ON public.deals;
CREATE TRIGGER trg_sync_deal_dates_to_events
  AFTER INSERT OR UPDATE OF close_date, contract_date ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.sync_deal_dates_to_events();

-- ── 3. Backfill any deals whose close_date has no deal_events entry yet ───────
INSERT INTO public.deal_events (
  organization_id, deal_id, title, event_type,
  start_at, end_at, all_day, color, source_table, source_id
)
SELECT
  d.organization_id,
  d.id,
  'Closing Date',
  'closing',
  d.close_date::timestamptz,
  NULL,
  true,
  '#10b981',
  'deals_close_date',
  d.id::text
FROM public.deals d
WHERE d.close_date IS NOT NULL
  AND d.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.deal_events e
    WHERE e.source_table = 'deals_close_date'
      AND e.source_id    = d.id::text
      AND e.deleted_at IS NULL
  );

-- ── 4. Backfill any deals whose contract_date has no deal_events entry yet ────
INSERT INTO public.deal_events (
  organization_id, deal_id, title, event_type,
  start_at, end_at, all_day, color, source_table, source_id
)
SELECT
  d.organization_id,
  d.id,
  'Contract Signed',
  'milestone',
  d.contract_date::timestamptz,
  NULL,
  true,
  '#3b82f6',
  'deals_contract_date',
  d.id::text
FROM public.deals d
WHERE d.contract_date IS NOT NULL
  AND d.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.deal_events e
    WHERE e.source_table = 'deals_contract_date'
      AND e.source_id    = d.id::text
      AND e.deleted_at IS NULL
  );
