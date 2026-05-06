-- 070 · Auto-log deal stage changes into activity_notes
-- Fires AFTER UPDATE OF stage on deals; inserts a note_type='stage_change' row.

CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.activity_notes (
      id,
      organization_id,
      deal_id,
      author_id,
      author_name,
      body,
      note_type,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.organization_id,
      NEW.id,
      auth.uid(),
      COALESCE(
        (SELECT name FROM public.profiles WHERE id = auth.uid()),
        'System'
      ),
      'Stage changed from "' || COALESCE(OLD.stage, 'None') || '" to "' || NEW.stage || '"',
      'stage_change',
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_deal_stage_change ON public.deals;
CREATE TRIGGER trg_log_deal_stage_change
  AFTER UPDATE OF stage ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_stage_change();
