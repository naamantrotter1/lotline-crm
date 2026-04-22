-- ─────────────────────────────────────────────────────────────
-- 003 · Projected Distributions + Notifications
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projected_distributions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id            uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  investor_id        uuid REFERENCES investors(id) ON DELETE CASCADE,
  month              text NOT NULL,  -- YYYY-MM
  return_of_capital  numeric DEFAULT 0,
  profit             numeric DEFAULT 0,
  interest           numeric DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (deal_id, investor_id, month)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  type        text NOT NULL, -- 'distribution' | 'milestone' | 'document' | 'message' | 'update'
  title       text NOT NULL,
  body        text,
  deal_id     uuid REFERENCES deals(id),
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE projected_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investors_read_projected_dist"    ON projected_distributions FOR SELECT USING (current_role_is('operator') OR current_role_is('admin') OR investor_id = current_investor_id());
CREATE POLICY "operators_manage_projected_dist"  ON projected_distributions FOR ALL    USING (current_role_is('operator') OR current_role_is('admin')) WITH CHECK (current_role_is('operator') OR current_role_is('admin'));

CREATE POLICY "investors_read_notifications"     ON notifications FOR SELECT USING (current_role_is('operator') OR current_role_is('admin') OR investor_id = current_investor_id());
CREATE POLICY "investors_update_notifications"   ON notifications FOR UPDATE USING (investor_id = current_investor_id()) WITH CHECK (investor_id = current_investor_id());
CREATE POLICY "operators_manage_notifications"   ON notifications FOR ALL    USING (current_role_is('operator') OR current_role_is('admin')) WITH CHECK (current_role_is('operator') OR current_role_is('admin'));
