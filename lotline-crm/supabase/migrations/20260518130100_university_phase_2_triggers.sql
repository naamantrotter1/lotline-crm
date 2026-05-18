-- ═══════════════════════════════════════════════════════════════════════════════
-- University · Phase 2 triggers + counters
-- ═══════════════════════════════════════════════════════════════════════════════
-- Wires:
--   • comment_count + last_activity_at on posts when comments are added/soft-deleted
--   • like_count on posts/comments when likes are added/removed
--   • is_admin_post auto-flag based on the inserting author's role
--   • Points-events firing for all 8 'reason' values
--   • Daily abuse cap on forum_post/forum_comment points (5/day)

-- ─── Helper: capped insert into university_points_events ───────────────────
CREATE OR REPLACE FUNCTION public._university_award_points(
  p_user_id    UUID,
  p_points     INT,
  p_reason     TEXT,
  p_subject_id UUID DEFAULT NULL,
  p_daily_cap  INT  DEFAULT NULL    -- e.g. 5 for forum_post/comment
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_count INT;
BEGIN
  IF p_user_id IS NULL OR p_points = 0 THEN RETURN; END IF;
  IF p_daily_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_today_count
      FROM university_points_events
     WHERE user_id = p_user_id
       AND reason  = p_reason
       AND created_at >= date_trunc('day', now());
    IF v_today_count >= p_daily_cap THEN RETURN; END IF;
  END IF;
  INSERT INTO university_points_events (user_id, points, reason, subject_id)
       VALUES (p_user_id, p_points, p_reason, p_subject_id);
END $$;

-- ─── Posts: auto-flag is_admin_post + initialize last_activity_at ─────────
CREATE OR REPLACE FUNCTION public._forum_posts_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Resolve admin status server-side; ignore whatever the client passed
  SELECT EXISTS (
    SELECT 1 FROM memberships m
      JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id = NEW.author_user_id
       AND m.status = 'active'
       AND m.role IN ('owner','admin')
       AND o.is_university_publisher = TRUE
  ) INTO v_is_admin;

  NEW.is_admin_post := v_is_admin AND COALESCE(NEW.is_admin_post, FALSE);
  -- Non-admins can never pin; admins keep whatever they set
  IF NOT v_is_admin THEN NEW.is_pinned := FALSE; END IF;
  NEW.last_activity_at := COALESCE(NEW.last_activity_at, now());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_posts_before_insert ON public.university_forum_posts;
CREATE TRIGGER trg_forum_posts_before_insert
  BEFORE INSERT ON public.university_forum_posts
  FOR EACH ROW EXECUTE FUNCTION public._forum_posts_before_insert();

CREATE OR REPLACE FUNCTION public._forum_posts_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM _university_award_points(NEW.author_user_id, 5, 'forum_post', NEW.id, 5);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_posts_after_insert ON public.university_forum_posts;
CREATE TRIGGER trg_forum_posts_after_insert
  AFTER INSERT ON public.university_forum_posts
  FOR EACH ROW EXECUTE FUNCTION public._forum_posts_after_insert();

-- ─── Comments: bump counters + award points ────────────────────────────────
CREATE OR REPLACE FUNCTION public._forum_comments_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.university_forum_posts
     SET comment_count    = comment_count + 1,
         last_activity_at = now()
   WHERE id = NEW.post_id;
  PERFORM _university_award_points(NEW.author_user_id, 2, 'forum_comment', NEW.id, 5);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_comments_after_insert ON public.university_forum_comments;
CREATE TRIGGER trg_forum_comments_after_insert
  AFTER INSERT ON public.university_forum_comments
  FOR EACH ROW EXECUTE FUNCTION public._forum_comments_after_insert();

-- On soft-delete, decrement the counter
CREATE OR REPLACE FUNCTION public._forum_comments_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.university_forum_posts
       SET comment_count = GREATEST(comment_count - 1, 0)
     WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_comments_after_update ON public.university_forum_comments;
CREATE TRIGGER trg_forum_comments_after_update
  AFTER UPDATE ON public.university_forum_comments
  FOR EACH ROW EXECUTE FUNCTION public._forum_comments_after_update();

-- ─── Likes: bump counters + award the author a point ───────────────────────
CREATE OR REPLACE FUNCTION public._forum_likes_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    UPDATE public.university_forum_posts
       SET like_count = like_count + 1
     WHERE id = NEW.post_id
   RETURNING author_user_id INTO v_recipient;
    -- Don't reward self-likes (defensive — UI prevents this anyway)
    IF v_recipient IS NOT NULL AND v_recipient <> NEW.user_id THEN
      PERFORM _university_award_points(v_recipient, 1, 'post_received_like', NEW.post_id, NULL);
    END IF;
  ELSIF NEW.comment_id IS NOT NULL THEN
    UPDATE public.university_forum_comments
       SET like_count = like_count + 1
     WHERE id = NEW.comment_id
   RETURNING author_user_id INTO v_recipient;
    IF v_recipient IS NOT NULL AND v_recipient <> NEW.user_id THEN
      PERFORM _university_award_points(v_recipient, 1, 'comment_received_like', NEW.comment_id, NULL);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_likes_after_insert ON public.university_forum_likes;
CREATE TRIGGER trg_forum_likes_after_insert
  AFTER INSERT ON public.university_forum_likes
  FOR EACH ROW EXECUTE FUNCTION public._forum_likes_after_insert();

CREATE OR REPLACE FUNCTION public._forum_likes_after_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.post_id IS NOT NULL THEN
    UPDATE public.university_forum_posts
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.post_id;
  ELSIF OLD.comment_id IS NOT NULL THEN
    UPDATE public.university_forum_comments
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.comment_id;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_forum_likes_after_delete ON public.university_forum_likes;
CREATE TRIGGER trg_forum_likes_after_delete
  AFTER DELETE ON public.university_forum_likes
  FOR EACH ROW EXECUTE FUNCTION public._forum_likes_after_delete();

-- ─── Progress: lesson completion + course completion ───────────────────────
-- Fires when a row transitions to completed=true.
CREATE OR REPLACE FUNCTION public._progress_after_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id     UUID;
  v_total_lessons INT;
  v_done_lessons  INT;
BEGIN
  -- Only fire on transitions from not-complete to complete
  IF NEW.completed = TRUE AND COALESCE(OLD.completed, FALSE) = FALSE THEN
    PERFORM _university_award_points(NEW.user_id, 10, 'lesson_completed', NEW.lesson_id, NULL);

    -- Did this complete the course?
    SELECT s.course_id INTO v_course_id
      FROM university_lessons l
      JOIN university_sections s ON s.id = l.section_id
     WHERE l.id = NEW.lesson_id;

    IF v_course_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_total_lessons
        FROM university_lessons l2
        JOIN university_sections s2 ON s2.id = l2.section_id
       WHERE s2.course_id = v_course_id;

      SELECT COUNT(*) INTO v_done_lessons
        FROM university_progress p
        JOIN university_lessons  l3 ON l3.id = p.lesson_id
        JOIN university_sections s3 ON s3.id = l3.section_id
       WHERE s3.course_id = v_course_id
         AND p.user_id   = NEW.user_id
         AND p.completed = TRUE;

      IF v_done_lessons = v_total_lessons AND v_total_lessons > 0 THEN
        PERFORM _university_award_points(NEW.user_id, 50, 'course_completed', v_course_id, NULL);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_progress_after_complete ON public.university_progress;
CREATE TRIGGER trg_progress_after_complete
  AFTER INSERT OR UPDATE ON public.university_progress
  FOR EACH ROW EXECUTE FUNCTION public._progress_after_complete();

-- ─── Event RSVPs: attended flip awards points ──────────────────────────────
CREATE OR REPLACE FUNCTION public._rsvps_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.attended = TRUE AND COALESCE(OLD.attended, FALSE) = FALSE THEN
    NEW.attended_at := now();
    PERFORM _university_award_points(NEW.user_id, 15, 'event_attended', NEW.event_id, NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rsvps_after_update ON public.university_event_rsvps;
CREATE TRIGGER trg_rsvps_after_update
  BEFORE UPDATE ON public.university_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public._rsvps_after_update();

-- Also award when a row is INSERTed already-attended (rare but possible
-- when the hub admin checks someone in retroactively)
CREATE OR REPLACE FUNCTION public._rsvps_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.attended = TRUE THEN
    PERFORM _university_award_points(NEW.user_id, 15, 'event_attended', NEW.event_id, NULL);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rsvps_after_insert ON public.university_event_rsvps;
CREATE TRIGGER trg_rsvps_after_insert
  AFTER INSERT ON public.university_event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public._rsvps_after_insert();

-- ─── Optional daily_login award ────────────────────────────────────────────
-- The frontend calls this RPC once on app boot per session; the daily cap
-- ensures only the first call each calendar day actually awards points.
CREATE OR REPLACE FUNCTION public.award_daily_login()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF NOT _is_operator() THEN RETURN FALSE; END IF;
  SELECT COUNT(*) INTO v_already
    FROM university_points_events
   WHERE user_id = auth.uid()
     AND reason  = 'daily_login'
     AND created_at >= date_trunc('day', now());
  IF v_already > 0 THEN RETURN FALSE; END IF;
  PERFORM _university_award_points(auth.uid(), 3, 'daily_login', NULL, NULL);
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.award_daily_login() TO authenticated;
