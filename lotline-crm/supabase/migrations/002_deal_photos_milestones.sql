-- ─────────────────────────────────────────────────────────────
-- 002 · Deal Photos + Milestones
-- ─────────────────────────────────────────────────────────────

-- Photos carousel
CREATE TABLE IF NOT EXISTS deal_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      text NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  url          text NOT NULL,
  caption      text,
  taken_at     date,
  type         text CHECK (type IN ('rendering','site','progress','finished')),
  sort_order   int  DEFAULT 0,
  uploaded_by  uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- Milestone stepper
CREATE TABLE IF NOT EXISTS deal_milestones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id       text NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','complete','skipped')),
  completed_at  timestamptz,
  eta           date,
  note          text,
  photo_ids     uuid[] DEFAULT '{}',
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (deal_id, milestone_key)
);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE deal_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_milestones ENABLE ROW LEVEL SECURITY;

-- Helper: investor can read photos/milestones for their own deal
CREATE OR REPLACE FUNCTION investor_owns_deal(p_deal_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM deals d
    WHERE  d.id = p_deal_id
      AND  d.investor = (
        SELECT i.name
        FROM   investors i
        JOIN   investor_users iu ON iu.investor_id = i.id
        WHERE  iu.user_id = auth.uid()
        LIMIT  1
      )
  );
$$;

CREATE POLICY "investors_read_deal_photos"   ON deal_photos    FOR SELECT USING (current_role_is('operator') OR current_role_is('admin') OR investor_owns_deal(deal_id));
CREATE POLICY "operators_manage_deal_photos" ON deal_photos    FOR ALL    USING (current_role_is('operator') OR current_role_is('admin')) WITH CHECK (current_role_is('operator') OR current_role_is('admin'));

CREATE POLICY "investors_read_milestones"    ON deal_milestones FOR SELECT USING (current_role_is('operator') OR current_role_is('admin') OR investor_owns_deal(deal_id));
CREATE POLICY "operators_manage_milestones"  ON deal_milestones FOR ALL    USING (current_role_is('operator') OR current_role_is('admin')) WITH CHECK (current_role_is('operator') OR current_role_is('admin'));

-- ── Storage bucket for deal photos ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-photos', 'deal-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "deal_photos_public_read"    ON storage.objects FOR SELECT USING (bucket_id = 'deal-photos');
CREATE POLICY "deal_photos_operator_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'deal-photos' AND (current_role_is('operator') OR current_role_is('admin')));
CREATE POLICY "deal_photos_operator_delete" ON storage.objects FOR DELETE USING (bucket_id = 'deal-photos' AND (current_role_is('operator') OR current_role_is('admin')));
