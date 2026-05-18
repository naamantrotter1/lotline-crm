-- ═══════════════════════════════════════════════════════════════════════════════
-- University · Phase 2 point reversals
-- ═══════════════════════════════════════════════════════════════════════════════
-- When a post is soft-deleted, remove its forum_post point event.
-- When a comment is soft-deleted, remove its forum_comment point event.
-- When a like is removed, remove the corresponding post/comment_received_like event.

-- ─── 1. Update _forum_likes_after_delete to also reverse points ───────────────
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
    -- Remove one post_received_like point awarded to the post author for this like
    DELETE FROM university_points_events
     WHERE id = (
       SELECT pe.id
         FROM university_points_events pe
         JOIN university_forum_posts   p  ON p.id = pe.subject_id
        WHERE pe.reason     = 'post_received_like'
          AND pe.subject_id = OLD.post_id
          AND pe.user_id    = p.author_user_id
        ORDER BY pe.created_at DESC
        LIMIT 1
     );
  ELSIF OLD.comment_id IS NOT NULL THEN
    UPDATE public.university_forum_comments
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.comment_id;
    -- Remove one comment_received_like point awarded to the comment author
    DELETE FROM university_points_events
     WHERE id = (
       SELECT pe.id
         FROM university_points_events  pe
         JOIN university_forum_comments c  ON c.id = pe.subject_id
        WHERE pe.reason     = 'comment_received_like'
          AND pe.subject_id = OLD.comment_id
          AND pe.user_id    = c.author_user_id
        ORDER BY pe.created_at DESC
        LIMIT 1
     );
  END IF;
  RETURN OLD;
END $$;

-- Re-attach trigger (function replaced in place; DROP/CREATE for clarity)
DROP TRIGGER IF EXISTS trg_forum_likes_after_delete ON public.university_forum_likes;
CREATE TRIGGER trg_forum_likes_after_delete
  AFTER DELETE ON public.university_forum_likes
  FOR EACH ROW EXECUTE FUNCTION public._forum_likes_after_delete();

-- ─── 2. Soft-delete a post → remove its forum_post point ──────────────────────
CREATE OR REPLACE FUNCTION public._forum_posts_on_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM university_points_events
     WHERE reason     = 'forum_post'
       AND subject_id = NEW.id
       AND user_id    = NEW.author_user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_posts_on_soft_delete ON public.university_forum_posts;
CREATE TRIGGER trg_forum_posts_on_soft_delete
  AFTER UPDATE OF deleted_at ON public.university_forum_posts
  FOR EACH ROW EXECUTE FUNCTION public._forum_posts_on_soft_delete();

-- ─── 3. Soft-delete a comment → remove its forum_comment point ────────────────
CREATE OR REPLACE FUNCTION public._forum_comments_on_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM university_points_events
     WHERE reason     = 'forum_comment'
       AND subject_id = NEW.id
       AND user_id    = NEW.author_user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_forum_comments_on_soft_delete ON public.university_forum_comments;
CREATE TRIGGER trg_forum_comments_on_soft_delete
  AFTER UPDATE OF deleted_at ON public.university_forum_comments
  FOR EACH ROW EXECUTE FUNCTION public._forum_comments_on_soft_delete();
