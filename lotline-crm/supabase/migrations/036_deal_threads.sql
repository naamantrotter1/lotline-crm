-- 036_deal_threads.sql
-- Slack-style threaded chat scoped per deal.
-- Designed to generalize (target_type/target_id) but PR 5 only uses deals.

-- ── deal_threads ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_threads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id          uuid NOT NULL,  -- references deals.id (no FK — deals may be in localStorage)
  target_type      text NOT NULL DEFAULT 'deal',
  target_id        text NOT NULL,  -- string version of deal_id for generalizability
  title            text,           -- optional thread subject
  created_by       uuid REFERENCES auth.users(id),
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES auth.users(id),
  archived_at      timestamptz,
  message_count    int NOT NULL DEFAULT 0,
  last_message_at  timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_threads_deal_idx ON deal_threads(deal_id);
CREATE INDEX IF NOT EXISTS deal_threads_org_idx  ON deal_threads(organization_id, last_message_at DESC);

-- ── deal_thread_messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_thread_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid NOT NULL REFERENCES deal_threads(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id        uuid NOT NULL REFERENCES auth.users(id),
  body             text NOT NULL,
  body_type        text NOT NULL DEFAULT 'markdown',  -- 'markdown' | 'plain'
  mentions         jsonb DEFAULT '[]',  -- [{ userId, name }]
  attachments      jsonb DEFAULT '[]',  -- [{ url, name, size, type }]
  reactions        jsonb DEFAULT '{}',  -- { "👍": [userId, ...], ... }
  edited_at        timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS thread_messages_thread_idx ON deal_thread_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS thread_messages_org_idx    ON deal_thread_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS thread_messages_author_idx ON deal_thread_messages(author_id);

-- ── deal_thread_reads ─────────────────────────────────────────────────────────
-- Tracks last-read watermark per user per thread (for unread badge)
CREATE TABLE IF NOT EXISTS deal_thread_reads (
  thread_id   uuid NOT NULL REFERENCES deal_threads(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS thread_reads_user_idx ON deal_thread_reads(user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE deal_threads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_thread_reads    ENABLE ROW LEVEL SECURITY;

-- deal_threads: all active org members can view + create
CREATE POLICY "dt_select" ON deal_threads FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "dt_insert" ON deal_threads FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin','operator')
  )
);
CREATE POLICY "dt_update_own" ON deal_threads FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "dt_delete_admin" ON deal_threads FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);

-- deal_thread_messages: same pattern + author can edit/delete own
CREATE POLICY "dtm_select" ON deal_thread_messages FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
CREATE POLICY "dtm_insert" ON deal_thread_messages FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin','operator')
  )
  AND author_id = auth.uid()
);
CREATE POLICY "dtm_update_own" ON deal_thread_messages FOR UPDATE USING (
  author_id = auth.uid()
);
CREATE POLICY "dtm_update_admin" ON deal_thread_messages FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);
CREATE POLICY "dtm_delete_own" ON deal_thread_messages FOR DELETE USING (
  author_id = auth.uid()
);
CREATE POLICY "dtm_delete_admin" ON deal_thread_messages FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);

-- deal_thread_reads: users manage their own read state
CREATE POLICY "dtr_select" ON deal_thread_reads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "dtr_insert" ON deal_thread_reads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "dtr_update" ON deal_thread_reads FOR UPDATE USING (user_id = auth.uid());

-- ── Triggers ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'deal_threads_updated_at') THEN
    CREATE TRIGGER deal_threads_updated_at
      BEFORE UPDATE ON deal_threads
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'deal_thread_messages_updated_at') THEN
    CREATE TRIGGER deal_thread_messages_updated_at
      BEFORE UPDATE ON deal_thread_messages
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ── Auto-increment message_count + last_message_at on insert ─────────────────
CREATE OR REPLACE FUNCTION increment_thread_message_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deal_threads
  SET message_count  = message_count + 1,
      last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_thread_message_insert') THEN
    CREATE TRIGGER on_thread_message_insert
      AFTER INSERT ON deal_thread_messages
      FOR EACH ROW EXECUTE FUNCTION increment_thread_message_count();
  END IF;
END $$;
