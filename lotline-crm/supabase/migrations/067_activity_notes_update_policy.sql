-- 067 · Allow authors to edit their own activity notes
CREATE POLICY "activity_notes_update" ON public.activity_notes FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
