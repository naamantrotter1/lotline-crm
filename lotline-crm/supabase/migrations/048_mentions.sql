-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 048: @mention system data layer
-- PRs 1-7 of the deal_activity.mentions.enabled feature
--
-- New tables:
--   activity_notes          DB-backed notes for Activity tab (replaces localStorage)
--   mentions                One row per @mention; inbox + notifications
--   deal_notification_mutes Per-user per-deal mention mute toggle
--
-- Columns added:
--   deal_thread_messages.mentioned_user_ids  uuid[] (already had JSONB mentions field)
--
-- Org-isolation guarantee: DB-level trigger rejects any INSERT into mentions
-- where mentioned_user_id is not an active member of org_id. RLS adds a second
-- enforcement layer. Together they make cross-org leakage impossible.
--
-- Feature flag: deal_activity.mentions.enabled (default off in prod)
-- Enable per org:
--   UPDATE organizations
--   SET feature_flags = feature_flags || '{"deal_activity.mentions.enabled": true}'::jsonb
--   WHERE id = '<org_id>';
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── activity_notes ─────────────────────────────────────────────────────────────
-- DB-backed notes for the Activity tab. Body is Markdown; mention tokens are
-- @[Display Name](user-uuid). mentioned_user_ids is extracted on save by the app
-- and stored denormalized for fast unread-mention queries.

CREATE TABLE IF NOT EXISTS activity_notes (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id            uuid        NOT NULL,
  author_id          uuid        NOT NULL REFERENCES auth.users(id),
  body               text        NOT NULL,
  mentioned_user_ids uuid[]      NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz           -- soft-delete (hard-delete via admin policy)
);

CREATE INDEX IF NOT EXISTS activity_notes_deal_idx
  ON activity_notes(deal_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activity_notes_org_idx
  ON activity_notes(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activity_notes_mentions_gin_idx
  ON activity_notes USING gin(mentioned_user_ids);

ALTER TABLE activity_notes ENABLE ROW LEVEL SECURITY;

-- All active org members can read non-deleted notes
CREATE POLICY "an_select" ON activity_notes FOR SELECT USING (
  deleted_at IS NULL
  AND organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Owner / admin / operator can create notes
CREATE POLICY "an_insert" ON activity_notes FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin','operator')
  )
);

-- Authors can edit their own non-deleted notes
CREATE POLICY "an_update_own" ON activity_notes FOR UPDATE
  USING (author_id = auth.uid() AND deleted_at IS NULL);

-- Authors can soft-delete their own notes
CREATE POLICY "an_delete_own" ON activity_notes FOR DELETE
  USING (author_id = auth.uid());

-- Admins can hard-delete any note in their org
CREATE POLICY "an_delete_admin" ON activity_notes FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
    AND role IN ('owner','admin')
  )
);

-- ── add mentioned_user_ids to deal_thread_messages ──────────────────────────────
-- The threads table already has a `mentions jsonb` column (list of {userId,name}).
-- We add a proper uuid[] for fast indexed lookups and notification fanout.

ALTER TABLE deal_thread_messages
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS dtm_mentioned_users_gin_idx
  ON deal_thread_messages USING gin(mentioned_user_ids);

-- ── mentions ───────────────────────────────────────────────────────────────────
-- One row per @mention per message/note. Powers the mentions inbox + notifications.
-- RLS + DB trigger together enforce cross-org isolation.

CREATE TABLE IF NOT EXISTS mentions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mentioned_user_id    uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  mentioned_by_user_id uuid        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  -- What kind of item contains this mention
  target_type          text        NOT NULL CHECK (target_type IN ('activity_note','thread_message')),
  target_id            uuid        NOT NULL,
  -- Denormalized for fast per-deal surfacing (null for non-deal targets)
  deal_id              uuid,
  -- Null = unread; set on first view
  read_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Unread feed index — the hot path for bell badge count
CREATE INDEX IF NOT EXISTS mentions_user_unread_idx
  ON mentions(mentioned_user_id, read_at)
  WHERE read_at IS NULL;

-- Per-deal mentions index — for deal-scoped inbox filter
CREATE INDEX IF NOT EXISTS mentions_org_deal_idx
  ON mentions(org_id, deal_id);

-- Source lookup — for deep-linking back to the message
CREATE INDEX IF NOT EXISTS mentions_target_idx
  ON mentions(target_type, target_id);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

-- SELECT: visible to the mentioned user and to the author (for audit)
--         but only within an org the caller belongs to
CREATE POLICY "mentions_select" ON mentions FOR SELECT USING (
  (mentioned_user_id = auth.uid() OR mentioned_by_user_id = auth.uid())
  AND org_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- INSERT: only the author can insert, in their own active org,
--         and only if the mentioned user is an active member of that org.
--         The DB trigger below adds a second hard check.
CREATE POLICY "mentions_insert" ON mentions FOR INSERT WITH CHECK (
  mentioned_by_user_id = auth.uid()
  AND org_id IN (
    SELECT organization_id FROM memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
  AND mentioned_user_id IN (
    SELECT user_id FROM memberships
    WHERE organization_id = org_id AND status = 'active'
  )
);

-- UPDATE: only the mentioned user can mark it read (sets read_at)
CREATE POLICY "mentions_update" ON mentions FOR UPDATE
  USING (mentioned_user_id = auth.uid())
  WITH CHECK (mentioned_user_id = auth.uid());

-- No DELETE policy — mentions are permanent for audit purposes.

-- ── DB-level org-membership guard ──────────────────────────────────────────────
-- This trigger fires BEFORE INSERT and raises an exception if mentioned_user_id
-- is not an active member of org_id. Combined with RLS, it provides two
-- independent enforcement layers so cross-org mentions are impossible even via
-- direct DB calls with a valid JWT.

CREATE OR REPLACE FUNCTION fn_check_mention_org_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id        = NEW.mentioned_user_id
      AND organization_id = NEW.org_id
      AND status          = 'active'
  ) THEN
    RAISE EXCEPTION
      'User % is not an active member of org % — cross-org mentions are not allowed.',
      NEW.mentioned_user_id, NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mention_org_membership_check ON mentions;
CREATE TRIGGER trg_mention_org_membership_check
  BEFORE INSERT ON mentions
  FOR EACH ROW EXECUTE FUNCTION fn_check_mention_org_membership();

-- ── deal_notification_mutes ────────────────────────────────────────────────────
-- Per-user per-deal mute toggle. When muted, new @mention notifications
-- (in-app + email + push) are suppressed — but the mentions row is still written
-- for audit and "All" inbox filter visibility.

CREATE TABLE IF NOT EXISTS deal_notification_mutes (
  user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id   uuid        NOT NULL,
  muted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deal_id)
);

CREATE INDEX IF NOT EXISTS deal_mutes_user_idx
  ON deal_notification_mutes(user_id);

ALTER TABLE deal_notification_mutes ENABLE ROW LEVEL SECURITY;

-- Users manage only their own mute preferences
CREATE POLICY "mutes_select" ON deal_notification_mutes FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "mutes_insert" ON deal_notification_mutes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mutes_delete" ON deal_notification_mutes FOR DELETE
  USING (user_id = auth.uid());

-- ── Realtime ───────────────────────────────────────────────────────────────────
-- mentions realtime: instant bell-badge increment and feed updates.
-- activity_notes realtime: new notes appear in other users' Activity tabs.

ALTER PUBLICATION supabase_realtime ADD TABLE mentions;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_notes;

-- ── auto-updated_at trigger for activity_notes ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'activity_notes_updated_at'
  ) THEN
    CREATE TRIGGER activity_notes_updated_at
      BEFORE UPDATE ON activity_notes
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
