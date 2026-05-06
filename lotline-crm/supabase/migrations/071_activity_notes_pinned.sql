-- 071 · Add pinned flag to activity_notes
ALTER TABLE public.activity_notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- Broaden UPDATE policy so any active org member can pin/unpin any note.
-- Body edits are still restricted to authors at the application layer.
DROP POLICY IF EXISTS "activity_notes_update" ON public.activity_notes;
CREATE POLICY "activity_notes_update" ON public.activity_notes FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
