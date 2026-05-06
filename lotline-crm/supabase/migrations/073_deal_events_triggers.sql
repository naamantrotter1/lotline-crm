-- 073 · Auto-sync triggers: tasks + deal_milestones + activity_notes → deal_events
-- Uses (source_table, source_id) as upsert key to prevent duplicates.

-- ── Helper: upsert a deal_event row ──────────────────────────────────────────
-- Called by all three triggers. Matches on source_table+source_id.
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
  IF p_start_at IS NULL THEN RETURN; END IF;  -- skip if no date

  INSERT INTO public.deal_events (
    organization_id, deal_id, title, event_type,
    start_at, end_at, all_day, color,
    source_table, source_id
  ) VALUES (
    p_org_id, p_deal_id, p_title, p_event_type,
    p_start_at, p_end_at, p_all_day, p_color,
    p_source_table, p_source_id
  )
  ON CONFLICT DO NOTHING;

  -- If row already existed, update it
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
  WHERE source_table = p_source_table
    AND source_id    = p_source_id
    AND organization_id = p_org_id;
END;
$$;

-- ── 1. tasks → deal_events ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_task_to_deal_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Soft-delete: mark deleted if task is deleted
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.deal_events
    SET deleted_at = now(), updated_at = now()
    WHERE source_table = 'tasks' AND source_id = NEW.id::text;
    RETURN NEW;
  END IF;

  -- Only sync tasks that have a deal_id and a due_date
  IF NEW.deal_id IS NULL OR NEW.due_date IS NULL THEN RETURN NEW; END IF;

  PERFORM public._upsert_deal_event(
    NEW.organization_id,
    NEW.deal_id,
    NEW.title,
    'task',
    NEW.due_date::timestamptz,
    NULL,
    true,
    '#f97316',   -- orange
    'tasks',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tasks_to_events ON public.tasks;
CREATE TRIGGER trg_sync_tasks_to_events
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_to_deal_event();

-- ── 2. deal_milestones → deal_events ─────────────────────────────────────────
-- Milestone label map (key → human label)
CREATE OR REPLACE FUNCTION public._milestone_label(p_key text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_key
    WHEN 'perc_tests_scheduled'          THEN 'Perc Tests Scheduled'
    WHEN 'land_survey_scheduled'         THEN 'Land Survey Scheduled'
    WHEN 'env_permits_submitted'         THEN 'Env. Permits Submitted'
    WHEN 'env_permits_approved'          THEN 'Env. Permits Approved'
    WHEN 'land_closed'                   THEN 'Land Closed'
    WHEN 'home_ordered'                  THEN 'Home Ordered'
    WHEN 'land_clearing_scheduled'       THEN 'Land Clearing Scheduled'
    WHEN 'building_permits_submitted'    THEN 'Building Permits Submitted'
    WHEN 'building_permits_approved'     THEN 'Building Permits Approved'
    WHEN 'setup_contractor_scheduled'    THEN 'Set Up Contractor Scheduled'
    WHEN 'septic_install_scheduled'      THEN 'Septic Install Scheduled'
    WHEN 'well_install_scheduled'        THEN 'Well Install Scheduled'
    WHEN 'power_company_scheduled'       THEN 'Power Company Scheduled'
    WHEN 'septic_installs_completed'     THEN 'Septic Installs Completed'
    WHEN 'well_installs_completed'       THEN 'Well Installs Completed'
    WHEN 'power_connections_completed'   THEN 'Power Connections Completed'
    WHEN 'home_delivered'                THEN 'Home Delivered / Set Up'
    WHEN 'co_received'                   THEN 'CO Received'
    WHEN 'home_listed'                   THEN 'Home Listed'
    WHEN 'home_under_contract'           THEN 'Home Under Contract'
    WHEN 'home_closed'                   THEN 'Home Closed'
    ELSE initcap(replace(p_key, '_', ' '))
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_milestone_to_deal_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Look up organization_id from deals table (milestones don't store org_id)
  SELECT organization_id INTO v_org_id FROM public.deals WHERE id = NEW.deal_id;
  IF v_org_id IS NULL THEN RETURN NEW; END IF;

  -- If eta cleared, soft-delete the event
  IF NEW.eta IS NULL THEN
    UPDATE public.deal_events
    SET deleted_at = now(), updated_at = now()
    WHERE source_table = 'deal_milestones'
      AND source_id    = NEW.id::text;
    RETURN NEW;
  END IF;

  PERFORM public._upsert_deal_event(
    v_org_id,
    NEW.deal_id,
    public._milestone_label(NEW.milestone_key),
    'milestone',
    NEW.eta::timestamptz,
    NULL,
    true,
    '#3b82f6',   -- blue
    'deal_milestones',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_milestones_to_events ON public.deal_milestones;
CREATE TRIGGER trg_sync_milestones_to_events
  AFTER INSERT OR UPDATE OF eta ON public.deal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.sync_milestone_to_deal_event();

-- ── 3. activity_notes (stage_change) → deal_events ───────────────────────────
CREATE OR REPLACE FUNCTION public.sync_stage_change_to_deal_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.note_type != 'stage_change' THEN RETURN NEW; END IF;

  PERFORM public._upsert_deal_event(
    NEW.organization_id,
    NEW.deal_id,
    NEW.body,
    'stage_change',
    NEW.created_at,
    NULL,
    true,
    '#9ca3af',   -- gray
    'activity_notes',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stage_changes_to_events ON public.activity_notes;
CREATE TRIGGER trg_sync_stage_changes_to_events
  AFTER INSERT ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION public.sync_stage_change_to_deal_event();
