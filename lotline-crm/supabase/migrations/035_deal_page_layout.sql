-- 035_deal_page_layout.sql
-- user_layout_preferences: persists resizable panel widths per user
-- record_layout_preferences: section order + visibility per user/org/entity

-- ── user_layout_preferences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_layout_preferences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page            text NOT NULL,           -- e.g. 'deal_detail'
  layout          jsonb NOT NULL DEFAULT '{}', -- { leftPct, rightPct }
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id, page)
);

ALTER TABLE user_layout_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ulp_select" ON user_layout_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ulp_insert" ON user_layout_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ulp_update" ON user_layout_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ulp_delete" ON user_layout_preferences FOR DELETE USING (user_id = auth.uid());

-- ── record_layout_preferences ─────────────────────────────────────────────────
-- Stores section order + visibility for the customize-record drawer.
-- user_id NULL = org-level default; user_id set = per-user override.
CREATE TABLE IF NOT EXISTS record_layout_preferences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity          text NOT NULL,       -- 'deal' | 'contact' | 'investor'
  column_key      text NOT NULL,       -- 'left' | 'middle' | 'right'
  sections        jsonb NOT NULL DEFAULT '[]',
  -- sections schema: [{ key: string, label: string, visible: boolean, order: int }]
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, organization_id, entity, column_key)
);

ALTER TABLE record_layout_preferences ENABLE ROW LEVEL SECURITY;

-- Members can read org defaults (user_id IS NULL) and their own overrides
CREATE POLICY "rlp_select" ON record_layout_preferences FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "rlp_insert" ON record_layout_preferences FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "rlp_update" ON record_layout_preferences FOR UPDATE USING (
  user_id = auth.uid()
  AND organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Admins/owners can set org defaults (user_id IS NULL)
CREATE POLICY "rlp_admin_insert" ON record_layout_preferences FOR INSERT WITH CHECK (
  user_id IS NULL
  AND organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
  )
);
CREATE POLICY "rlp_admin_update" ON record_layout_preferences FOR UPDATE USING (
  user_id IS NULL
  AND organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner','admin')
  )
);

-- ── Updated_at triggers ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ulp_updated_at') THEN
    CREATE TRIGGER ulp_updated_at
      BEFORE UPDATE ON user_layout_preferences
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rlp_updated_at') THEN
    CREATE TRIGGER rlp_updated_at
      BEFORE UPDATE ON record_layout_preferences
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
