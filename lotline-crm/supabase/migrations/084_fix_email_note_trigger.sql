-- 084 · Skip 'email' notes in fn_notify_new_note trigger + fix note_type constraint
-- Email activity notes are not user-authored notes, so no "new note" notification needed.

-- 1. Update constraint to allow 'email' type
DO $$
DECLARE
  con_name text;
BEGIN
  FOR con_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.activity_notes'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%note_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.activity_notes DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END$$;

ALTER TABLE public.activity_notes
  ADD CONSTRAINT activity_notes_note_type_check
    CHECK (note_type IN ('note', 'stage_change', 'email'));

-- 2. Update trigger to skip 'email' type notes (no new_note notification for auto-logged emails)
CREATE OR REPLACE FUNCTION public.fn_notify_new_note()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deal_addr text;
BEGIN
  IF NEW.deal_id IS NULL THEN RETURN NEW; END IF;
  -- Skip automated system notes
  IF COALESCE(NEW.note_type, '') IN ('stage_change', 'email') THEN RETURN NEW; END IF;

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
