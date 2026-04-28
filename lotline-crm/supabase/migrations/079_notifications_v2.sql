-- 079_notifications_v2.sql
-- Extend notifications table with deal context + action URL + email tracking.
-- Add notification_prefs JSONB to profiles.
-- Add DB trigger functions for: @mention, deal stage change, new note.

BEGIN;

-- ── Extend notifications ─────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deal_id          text,
  ADD COLUMN IF NOT EXISTS deal_address     text,
  ADD COLUMN IF NOT EXISTS source_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_user_name text,
  ADD COLUMN IF NOT EXISTS read_at          timestamptz,
  ADD COLUMN IF NOT EXISTS action_url       text,
  ADD COLUMN IF NOT EXISTS email_sent       boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notifications_email_unsent_idx
  ON public.notifications(created_at DESC) WHERE email_sent = false;

-- ── Notification preferences on profiles ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
    '{"email_notifications":true,"mentions":true,"task_assigned":true,"task_due":true,"stage_change":true,"new_note":true,"new_document":true}'::jsonb;

-- ── Trigger A: @mention in activity_notes ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_mention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid       uuid;
  deal_addr text;
BEGIN
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) = 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.deal_id IS NOT NULL THEN
    SELECT address INTO deal_addr FROM public.deals WHERE id = NEW.deal_id;
  END IF;

  FOREACH uid IN ARRAY NEW.mentioned_user_ids LOOP
    -- Skip if this user opted out of mention notifications
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = uid
        AND (notification_prefs->>'mentions')::boolean IS NOT FALSE
    ) AND uid <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN

      INSERT INTO public.notifications (
        organization_id, user_id, type, title, body,
        entity_type, entity_id,
        deal_id, deal_address, source_user_id, source_user_name, action_url
      ) VALUES (
        NEW.organization_id,
        uid,
        'mention',
        COALESCE(NEW.author_name, 'Someone') || ' mentioned you in a note',
        LEFT(COALESCE(NEW.body, ''), 120),
        'activity_note',
        json_build_object('dealId', NEW.deal_id, 'noteId', NEW.id::text)::text,
        NEW.deal_id,
        deal_addr,
        NEW.author_id,
        NEW.author_name,
        CASE WHEN NEW.deal_id IS NOT NULL THEN '/deal/' || NEW.deal_id ELSE NULL END
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mention ON public.activity_notes;
CREATE TRIGGER trg_notify_mention
  AFTER INSERT ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_mention();

-- ── Trigger B: deal stage change ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_deal_stage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  member_rec RECORD;
  deal_addr  text;
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    deal_addr := COALESCE(NEW.address, NEW.id);

    FOR member_rec IN
      SELECT user_id FROM public.memberships
      WHERE organization_id = NEW.organization_id
        AND status = 'active'
        AND role IN ('owner', 'admin')
    LOOP
      -- Skip if opted out of stage_change notifications
      IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = member_rec.user_id
          AND (notification_prefs->>'stage_change')::boolean IS NOT FALSE
      ) THEN
        INSERT INTO public.notifications (
          organization_id, user_id, type, title, body,
          entity_type, entity_id, deal_id, deal_address, action_url
        ) VALUES (
          NEW.organization_id,
          member_rec.user_id,
          'stage_change',
          deal_addr || ' moved to ' || NEW.stage,
          'Previously: ' || COALESCE(OLD.stage, 'None'),
          'deal',
          NEW.id,
          NEW.id,
          deal_addr,
          '/deal/' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_deal_stage ON public.deals;
CREATE TRIGGER trg_notify_deal_stage
  AFTER UPDATE OF stage ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_deal_stage();

-- ── Trigger C: new note posted on a deal ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notify_new_note()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deal_addr text;
BEGIN
  IF NEW.deal_id IS NULL THEN RETURN NEW; END IF;
  -- Skip automated system notes
  IF COALESCE(NEW.note_type, '') IN ('stage_change') THEN RETURN NEW; END IF;

  SELECT address INTO deal_addr FROM public.deals WHERE id = NEW.deal_id;

  INSERT INTO public.notifications (
    organization_id, user_id, type, title, body,
    entity_type, entity_id, deal_id, deal_address,
    source_user_id, source_user_name, action_url
  )
  SELECT
    NEW.organization_id,
    m.user_id,
    'new_note',
    COALESCE(NEW.author_name, 'Someone') || ' added a note on ' || COALESCE(deal_addr, NEW.deal_id),
    LEFT(COALESCE(NEW.body, ''), 120),
    'activity_note',
    json_build_object('dealId', NEW.deal_id, 'noteId', NEW.id::text)::text,
    NEW.deal_id,
    deal_addr,
    NEW.author_id,
    NEW.author_name,
    '/deal/' || NEW.deal_id
  FROM public.memberships m
  WHERE m.organization_id = NEW.organization_id
    AND m.status = 'active'
    AND m.user_id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND m.role IN ('owner', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = m.user_id
        AND (p.notification_prefs->>'new_note')::boolean IS NOT FALSE
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_note ON public.activity_notes;
CREATE TRIGGER trg_notify_new_note
  AFTER INSERT ON public.activity_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_new_note();

COMMIT;
