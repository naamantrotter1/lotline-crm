-- ═══════════════════════════════════════════════════════════════════════════════
-- University · Phase 2 schema (Forum, Events, Leaderboard)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Depends on Phase 1 (20260518120000_university_phase_1.sql) being applied first.
-- Same role model: hub publisher (is_university_publisher=true) creates events
-- and moderates; subscriber operators (account_type='operator') participate;
-- investors see zero rows.
--
-- Triggers + points-events firing rules live in the companion migration
-- 20260518130100_university_phase_2_triggers.sql.

-- ─── §1 Forum categories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_forum_categories (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT         NOT NULL UNIQUE,
  name        TEXT         NOT NULL,
  description TEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── §2 Forum posts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_forum_posts (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID         NOT NULL REFERENCES public.university_forum_categories(id),
  author_user_id    UUID         NOT NULL REFERENCES auth.users(id),
  author_org_id     UUID         NOT NULL REFERENCES public.organizations(id),
  title             TEXT,
  body              TEXT         NOT NULL,
  image_urls        TEXT[]       NOT NULL DEFAULT '{}',
  is_pinned         BOOLEAN      NOT NULL DEFAULT FALSE,
  is_admin_post     BOOLEAN      NOT NULL DEFAULT FALSE,
  comment_count     INT          NOT NULL DEFAULT 0,
  like_count        INT          NOT NULL DEFAULT 0,
  last_activity_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forum_posts_category_recent ON public.university_forum_posts (category_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS forum_posts_pinned          ON public.university_forum_posts (is_pinned, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS forum_posts_author          ON public.university_forum_posts (author_user_id);

-- ─── §3 Forum comments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_forum_comments (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID         NOT NULL REFERENCES public.university_forum_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID         REFERENCES public.university_forum_comments(id) ON DELETE CASCADE,
  author_user_id    UUID         NOT NULL REFERENCES auth.users(id),
  body              TEXT         NOT NULL,
  like_count        INT          NOT NULL DEFAULT 0,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forum_comments_post   ON public.university_forum_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS forum_comments_parent ON public.university_forum_comments (parent_comment_id);

-- ─── §4 Forum likes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_forum_likes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id),
  post_id     UUID         REFERENCES public.university_forum_posts(id)    ON DELETE CASCADE,
  comment_id  UUID         REFERENCES public.university_forum_comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK ((post_id IS NULL) <> (comment_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS forum_likes_user_post    ON public.university_forum_likes (user_id, post_id)    WHERE post_id    IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS forum_likes_user_comment ON public.university_forum_likes (user_id, comment_id) WHERE comment_id IS NOT NULL;

-- ─── §5 Events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_events (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_org_id  UUID         NOT NULL REFERENCES public.organizations(id),
  title             TEXT         NOT NULL,
  description       TEXT,
  cover_image_url   TEXT,
  host_name         TEXT,
  starts_at         TIMESTAMPTZ  NOT NULL,
  ends_at           TIMESTAMPTZ  NOT NULL,
  timezone          TEXT         NOT NULL DEFAULT 'America/New_York',
  join_url          TEXT,
  recording_url     TEXT,
  location          TEXT,
  status            TEXT         NOT NULL DEFAULT 'scheduled'
                                 CHECK (status IN ('scheduled','live','completed','cancelled')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_upcoming_idx
  ON public.university_events (starts_at)
  WHERE status IN ('scheduled','live');

-- ─── §6 Event RSVPs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_event_rsvps (
  event_id    UUID         NOT NULL REFERENCES public.university_events(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES auth.users(id),
  state       TEXT         NOT NULL CHECK (state IN ('going','interested','declined')),
  attended    BOOLEAN      NOT NULL DEFAULT FALSE,
  attended_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_rsvps_user ON public.university_event_rsvps (user_id);

-- ─── §7 Points events + leaderboard view ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_points_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id),
  points      INT          NOT NULL,
  reason      TEXT         NOT NULL CHECK (reason IN (
                              'lesson_completed','course_completed','forum_post','forum_comment',
                              'post_received_like','comment_received_like','event_attended','daily_login')),
  subject_id  UUID,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS points_user_time ON public.university_points_events (user_id, created_at);

-- Materialized aggregates for fast leaderboard reads
DROP MATERIALIZED VIEW IF EXISTS public.university_leaderboard;
CREATE MATERIALIZED VIEW public.university_leaderboard AS
  SELECT user_id,
         SUM(CASE WHEN created_at >= now() - interval '7 days'  THEN points ELSE 0 END) AS points_7d,
         SUM(CASE WHEN created_at >= now() - interval '30 days' THEN points ELSE 0 END) AS points_30d,
         SUM(points)::INT                                                                 AS points_all_time
    FROM public.university_points_events
   GROUP BY user_id;
CREATE UNIQUE INDEX IF NOT EXISTS university_leaderboard_user ON public.university_leaderboard (user_id);

-- ─── §8 Notifications opt-out preference ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── §9 updated_at touch ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_forum_posts_touch    ON public.university_forum_posts;
CREATE TRIGGER trg_forum_posts_touch
  BEFORE UPDATE ON public.university_forum_posts
  FOR EACH ROW EXECUTE FUNCTION public._university_touch_updated_at();

DROP TRIGGER IF EXISTS trg_forum_comments_touch ON public.university_forum_comments;
CREATE TRIGGER trg_forum_comments_touch
  BEFORE UPDATE ON public.university_forum_comments
  FOR EACH ROW EXECUTE FUNCTION public._university_touch_updated_at();

DROP TRIGGER IF EXISTS trg_event_rsvps_touch    ON public.university_event_rsvps;
CREATE TRIGGER trg_event_rsvps_touch
  BEFORE UPDATE ON public.university_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public._university_touch_updated_at();

-- ─── §10 RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.university_forum_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_forum_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_forum_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_forum_likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_event_rsvps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_points_events     ENABLE ROW LEVEL SECURITY;

-- CATEGORIES — operators read; hub admins write
DROP POLICY IF EXISTS "categories: operator select" ON public.university_forum_categories;
CREATE POLICY "categories: operator select"
  ON public.university_forum_categories FOR SELECT TO authenticated
  USING (_is_operator());

DROP POLICY IF EXISTS "categories: hub admin write" ON public.university_forum_categories;
CREATE POLICY "categories: hub admin write"
  ON public.university_forum_categories FOR ALL TO authenticated
  USING (_is_university_publisher_admin())
  WITH CHECK (_is_university_publisher_admin());

-- POSTS
DROP POLICY IF EXISTS "posts: operator select" ON public.university_forum_posts;
CREATE POLICY "posts: operator select"
  ON public.university_forum_posts FOR SELECT TO authenticated
  USING (_is_operator() AND deleted_at IS NULL);

-- Authors can SELECT their own deleted posts too (so the UI can render a tombstone if needed)
DROP POLICY IF EXISTS "posts: author select all" ON public.university_forum_posts;
CREATE POLICY "posts: author select all"
  ON public.university_forum_posts FOR SELECT TO authenticated
  USING (author_user_id = auth.uid());

DROP POLICY IF EXISTS "posts: hub admin select all" ON public.university_forum_posts;
CREATE POLICY "posts: hub admin select all"
  ON public.university_forum_posts FOR SELECT TO authenticated
  USING (_is_university_publisher_admin());

-- INSERT: operators only; author_user_id must match auth.uid()
DROP POLICY IF EXISTS "posts: author insert" ON public.university_forum_posts;
CREATE POLICY "posts: author insert"
  ON public.university_forum_posts FOR INSERT TO authenticated
  WITH CHECK (
    _is_operator()
    AND author_user_id = auth.uid()
    -- Non-admins cannot mint pinned or admin-flagged posts
    AND (is_pinned = false)
    AND (is_admin_post = false OR _is_university_publisher_admin())
  );

-- UPDATE by author — only within 15 minutes, and only body/title/image_urls
DROP POLICY IF EXISTS "posts: author edit window" ON public.university_forum_posts;
CREATE POLICY "posts: author edit window"
  ON public.university_forum_posts FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    AND (created_at > now() - interval '15 minutes' OR deleted_at IS NULL)
  )
  WITH CHECK (
    author_user_id = auth.uid()
    -- Author cannot self-pin or self-flag as admin
    AND (is_pinned     = (SELECT p.is_pinned     FROM public.university_forum_posts p WHERE p.id = university_forum_posts.id))
    AND (is_admin_post = (SELECT p.is_admin_post FROM public.university_forum_posts p WHERE p.id = university_forum_posts.id))
  );

-- Hub admins can update anything (pin, set is_admin_post, soft-delete via deleted_at)
DROP POLICY IF EXISTS "posts: hub admin update" ON public.university_forum_posts;
CREATE POLICY "posts: hub admin update"
  ON public.university_forum_posts FOR UPDATE TO authenticated
  USING (_is_university_publisher_admin())
  WITH CHECK (_is_university_publisher_admin());

-- Nobody hard-deletes; soft delete is done via UPDATE.

-- COMMENTS
DROP POLICY IF EXISTS "comments: operator select" ON public.university_forum_comments;
CREATE POLICY "comments: operator select"
  ON public.university_forum_comments FOR SELECT TO authenticated
  USING (_is_operator() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "comments: author select all" ON public.university_forum_comments;
CREATE POLICY "comments: author select all"
  ON public.university_forum_comments FOR SELECT TO authenticated
  USING (author_user_id = auth.uid());

DROP POLICY IF EXISTS "comments: hub admin select all" ON public.university_forum_comments;
CREATE POLICY "comments: hub admin select all"
  ON public.university_forum_comments FOR SELECT TO authenticated
  USING (_is_university_publisher_admin());

DROP POLICY IF EXISTS "comments: author insert" ON public.university_forum_comments;
CREATE POLICY "comments: author insert"
  ON public.university_forum_comments FOR INSERT TO authenticated
  WITH CHECK (_is_operator() AND author_user_id = auth.uid());

DROP POLICY IF EXISTS "comments: author edit window" ON public.university_forum_comments;
CREATE POLICY "comments: author edit window"
  ON public.university_forum_comments FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid()
         AND (created_at > now() - interval '15 minutes' OR deleted_at IS NULL))
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS "comments: hub admin update" ON public.university_forum_comments;
CREATE POLICY "comments: hub admin update"
  ON public.university_forum_comments FOR UPDATE TO authenticated
  USING (_is_university_publisher_admin())
  WITH CHECK (_is_university_publisher_admin());

-- LIKES
DROP POLICY IF EXISTS "likes: operator select" ON public.university_forum_likes;
CREATE POLICY "likes: operator select"
  ON public.university_forum_likes FOR SELECT TO authenticated
  USING (_is_operator());

DROP POLICY IF EXISTS "likes: own insert" ON public.university_forum_likes;
CREATE POLICY "likes: own insert"
  ON public.university_forum_likes FOR INSERT TO authenticated
  WITH CHECK (_is_operator() AND user_id = auth.uid());

DROP POLICY IF EXISTS "likes: own delete" ON public.university_forum_likes;
CREATE POLICY "likes: own delete"
  ON public.university_forum_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- EVENTS
DROP POLICY IF EXISTS "events: operator select" ON public.university_events;
CREATE POLICY "events: operator select"
  ON public.university_events FOR SELECT TO authenticated
  USING (_is_operator());

DROP POLICY IF EXISTS "events: hub admin select all" ON public.university_events;
CREATE POLICY "events: hub admin select all"
  ON public.university_events FOR SELECT TO authenticated
  USING (_is_university_publisher_admin());

DROP POLICY IF EXISTS "events: hub admin write" ON public.university_events;
CREATE POLICY "events: hub admin write"
  ON public.university_events FOR ALL TO authenticated
  USING (_is_publisher_admin_of(publisher_org_id))
  WITH CHECK (_is_publisher_admin_of(publisher_org_id));

-- RSVPs
DROP POLICY IF EXISTS "rsvps: operator select" ON public.university_event_rsvps;
CREATE POLICY "rsvps: operator select"
  ON public.university_event_rsvps FOR SELECT TO authenticated
  USING (_is_operator());

DROP POLICY IF EXISTS "rsvps: own write" ON public.university_event_rsvps;
CREATE POLICY "rsvps: own write"
  ON public.university_event_rsvps FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Hub admins can flip attended
DROP POLICY IF EXISTS "rsvps: hub admin update" ON public.university_event_rsvps;
CREATE POLICY "rsvps: hub admin update"
  ON public.university_event_rsvps FOR UPDATE TO authenticated
  USING (_is_university_publisher_admin())
  WITH CHECK (_is_university_publisher_admin());

-- POINTS — read-only for operators; writes go through triggers / security definer
DROP POLICY IF EXISTS "points: operator select" ON public.university_points_events;
CREATE POLICY "points: operator select"
  ON public.university_points_events FOR SELECT TO authenticated
  USING (_is_operator());

-- No INSERT/UPDATE/DELETE policies are defined here. Triggers run as table owner
-- (SECURITY DEFINER, owned by postgres) so they bypass RLS. Direct client inserts
-- are denied because no INSERT policy exists.

-- ─── §11 Realtime publication ─────────────────────────────────────────────
-- Posts + comments are added to the supabase_realtime publication so the Feed
-- can subscribe to live updates. Wrapped in DO blocks to be idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN  ALTER PUBLICATION supabase_realtime ADD TABLE public.university_forum_posts;     EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN  ALTER PUBLICATION supabase_realtime ADD TABLE public.university_forum_comments;  EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN  ALTER PUBLICATION supabase_realtime ADD TABLE public.university_forum_likes;     EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- ─── §12 Leaderboard refresh function ──────────────────────────────────────
-- Refresh-on-demand (debounced 5 min on the client) AND nightly via pg_cron.
CREATE OR REPLACE FUNCTION public.refresh_university_leaderboard()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CONCURRENTLY so reads aren't blocked.
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.university_leaderboard;
END $$;

GRANT EXECUTE ON FUNCTION public.refresh_university_leaderboard() TO authenticated;

-- Schedule via pg_cron if available (Supabase has it). Idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'university_leaderboard_nightly',
      '0 5 * * *',
      $cmd$ SELECT public.refresh_university_leaderboard(); $cmd$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- already scheduled or insufficient privileges — non-fatal
    NULL;
END $$;

-- ─── §13 Leaderboard convenience RPC ───────────────────────────────────────
-- Returns top-N + the caller's row (for "your rank" pin) in one round trip.
CREATE OR REPLACE FUNCTION public.university_leaderboard_top(
  window_kind TEXT  DEFAULT '7d',  -- '7d' | '30d' | 'all'
  top_n       INT   DEFAULT 100
)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  avatar_url   TEXT,
  org_name     TEXT,
  points       INT,
  rank         INT,
  is_me        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col TEXT := CASE window_kind
                   WHEN '7d'  THEN 'points_7d'
                   WHEN '30d' THEN 'points_30d'
                   ELSE             'points_all_time'
                END;
BEGIN
  IF NOT _is_operator() AND NOT _is_university_publisher_admin() THEN
    RETURN; -- investors get zero rows
  END IF;

  RETURN QUERY EXECUTE format($q$
    WITH ranked AS (
      SELECT lb.user_id,
             COALESCE(p.first_name || ' ' || p.last_name, p.email, 'User') AS display_name,
             p.avatar_url,
             o.name AS org_name,
             %1$s::INT AS points,
             RANK() OVER (ORDER BY %1$s DESC, lb.user_id) AS rank
        FROM university_leaderboard lb
        LEFT JOIN profiles p      ON p.id = lb.user_id
        LEFT JOIN organizations o ON o.id = p.active_organization_id
    )
    SELECT user_id, display_name, avatar_url, org_name, points, rank::INT,
           (user_id = auth.uid()) AS is_me
      FROM ranked
     WHERE rank <= $1
        OR user_id = auth.uid()
     ORDER BY rank
     LIMIT $1 + 1
  $q$, v_col)
  USING top_n;
END $$;

GRANT EXECUTE ON FUNCTION public.university_leaderboard_top(TEXT, INT) TO authenticated;
