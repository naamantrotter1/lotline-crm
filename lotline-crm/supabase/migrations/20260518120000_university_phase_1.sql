-- ═══════════════════════════════════════════════════════════════════════════════
-- University · Phase 1 schema
-- ═══════════════════════════════════════════════════════════════════════════════
-- Adds a "University" feature where LotLine (and any future publisher org)
-- publishes video courses for paying subscribers (account_type='operator').
-- Investors are blocked at the RLS layer.
--
-- Schema is intentionally future-proof: Phase 2 (forum, events, leaderboard) can
-- be added in a follow-up migration without altering anything here. See
-- docs/UNIVERSITY_PHASE_2.md for the reserved table names.
--
-- Video model is provider-agnostic: video_provider ∈ ('cf_stream','mux','url').
-- Only Cloudflare Stream is wired in Phase 1; the others are pure abstractions.

-- ─── §1  Org publisher flag ────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_university_publisher BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed: flip true for LotLine Homes hub (the same org that has is_lending_hub=true).
UPDATE public.organizations
   SET is_university_publisher = TRUE
 WHERE is_lending_hub = TRUE;

-- ─── §2  Courses ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_courses (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_org_id  UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  slug              TEXT         NOT NULL UNIQUE,
  title             TEXT         NOT NULL,
  emoji             TEXT,
  instructor_name   TEXT,
  description       TEXT,
  cover_image_url   TEXT,
  status            TEXT         NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft','published','archived')),
  required_plan     TEXT         CHECK (required_plan IS NULL
                                        OR required_plan IN ('starter','pro','scale')),
  sort_order        INT          NOT NULL DEFAULT 0,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_university_courses_publisher
  ON public.university_courses (publisher_org_id);
CREATE INDEX IF NOT EXISTS idx_university_courses_status_sort
  ON public.university_courses (status, sort_order) WHERE status = 'published';

-- ─── §3  Sections ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_sections (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID         NOT NULL REFERENCES public.university_courses(id) ON DELETE CASCADE,
  title       TEXT         NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS university_sections_course_sort
  ON public.university_sections (course_id, sort_order);

-- ─── §4  Lessons ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_lessons (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id        UUID         NOT NULL REFERENCES public.university_sections(id) ON DELETE CASCADE,
  slug              TEXT         NOT NULL,
  title             TEXT         NOT NULL,
  description       TEXT,
  video_provider    TEXT         NOT NULL CHECK (video_provider IN ('cf_stream','mux','url')),
  video_id_or_url   TEXT         NOT NULL,
  duration_seconds  INT,
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (section_id, slug)
);

CREATE INDEX IF NOT EXISTS university_lessons_section_sort
  ON public.university_lessons (section_id, sort_order);

-- ─── §5  Lesson resources (PDFs, downloadable files, links) ────────────────
CREATE TABLE IF NOT EXISTS public.university_lesson_resources (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID         NOT NULL REFERENCES public.university_lessons(id) ON DELETE CASCADE,
  label       TEXT         NOT NULL,
  file_url    TEXT         NOT NULL,
  mime_type   TEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_university_resources_lesson
  ON public.university_lesson_resources (lesson_id, sort_order);

-- ─── §6  Per-user progress ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.university_progress (
  user_id                 UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id               UUID         NOT NULL REFERENCES public.university_lessons(id) ON DELETE CASCADE,
  watched_seconds         INT          NOT NULL DEFAULT 0,
  completed               BOOLEAN      NOT NULL DEFAULT FALSE,
  completed_at            TIMESTAMPTZ,
  last_position_seconds   INT          NOT NULL DEFAULT 0,
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS university_progress_user
  ON public.university_progress (user_id);
CREATE INDEX IF NOT EXISTS university_progress_lesson
  ON public.university_progress (lesson_id);

-- ─── §7  updated_at triggers ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._university_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_university_courses_touch  ON public.university_courses;
CREATE TRIGGER trg_university_courses_touch
  BEFORE UPDATE ON public.university_courses
  FOR EACH ROW EXECUTE FUNCTION public._university_touch_updated_at();

DROP TRIGGER IF EXISTS trg_university_progress_touch  ON public.university_progress;
CREATE TRIGGER trg_university_progress_touch
  BEFORE UPDATE ON public.university_progress
  FOR EACH ROW EXECUTE FUNCTION public._university_touch_updated_at();

-- ─── §8  RLS helpers ───────────────────────────────────────────────────────
-- Returns true if the caller is an operator (subscriber) — not investor.
CREATE OR REPLACE FUNCTION public._is_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND COALESCE(account_type,
                   CASE WHEN role = 'investor' THEN 'investor' ELSE 'operator' END)
          = 'operator'
  )
$$;

-- Returns true if caller belongs (as owner/admin) to a publisher org.
CREATE OR REPLACE FUNCTION public._is_university_publisher_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM memberships m
      JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id = auth.uid()
       AND m.status = 'active'
       AND m.role IN ('owner','admin')
       AND o.is_university_publisher = TRUE
  )
$$;

-- Returns true if caller is an admin of the specific publisher org.
CREATE OR REPLACE FUNCTION public._is_publisher_admin_of(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM memberships m
     WHERE m.user_id = auth.uid()
       AND m.organization_id = p_org
       AND m.status = 'active'
       AND m.role IN ('owner','admin')
  )
$$;

-- Plan-tier visibility. Maps tiers in ascending order:
--   starter (1) < pro (2) < scale (3)
-- A course requiring 'pro' is visible to pro+scale subscribers; NULL = all.
CREATE OR REPLACE FUNCTION public._plan_rank(p TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE LOWER(COALESCE(p,''))
           WHEN 'starter'    THEN 1
           WHEN 'pro'        THEN 2
           WHEN 'scale'      THEN 3
           WHEN 'enterprise' THEN 3
           ELSE 0
         END
$$;

CREATE OR REPLACE FUNCTION public._caller_org_plan()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.plan
    FROM profiles p
    JOIN organizations o ON o.id = p.active_organization_id
   WHERE p.id = auth.uid()
   LIMIT 1
$$;

-- ─── §9  RLS policies ──────────────────────────────────────────────────────
ALTER TABLE public.university_courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_lessons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_lesson_resources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_progress          ENABLE ROW LEVEL SECURITY;

-- COURSES
DROP POLICY IF EXISTS "courses: subscriber select published"   ON public.university_courses;
DROP POLICY IF EXISTS "courses: publisher admin select drafts" ON public.university_courses;
DROP POLICY IF EXISTS "courses: publisher admin write"         ON public.university_courses;

CREATE POLICY "courses: subscriber select published"
  ON public.university_courses
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND _is_operator()
    AND (required_plan IS NULL
         OR _plan_rank(_caller_org_plan()) >= _plan_rank(required_plan))
  );

CREATE POLICY "courses: publisher admin select drafts"
  ON public.university_courses
  FOR SELECT
  TO authenticated
  USING (_is_publisher_admin_of(publisher_org_id));

CREATE POLICY "courses: publisher admin write"
  ON public.university_courses
  FOR ALL
  TO authenticated
  USING (_is_publisher_admin_of(publisher_org_id))
  WITH CHECK (_is_publisher_admin_of(publisher_org_id));

-- SECTIONS — visibility follows the parent course
DROP POLICY IF EXISTS "sections: select via course" ON public.university_sections;
DROP POLICY IF EXISTS "sections: publisher write"   ON public.university_sections;

CREATE POLICY "sections: select via course"
  ON public.university_sections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.university_courses c
       WHERE c.id = university_sections.course_id
    )
  );

CREATE POLICY "sections: publisher write"
  ON public.university_sections FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.university_courses c
     WHERE c.id = university_sections.course_id
       AND _is_publisher_admin_of(c.publisher_org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.university_courses c
     WHERE c.id = university_sections.course_id
       AND _is_publisher_admin_of(c.publisher_org_id)
  ));

-- LESSONS — visibility follows parent section → course
DROP POLICY IF EXISTS "lessons: select via section" ON public.university_lessons;
DROP POLICY IF EXISTS "lessons: publisher write"    ON public.university_lessons;

CREATE POLICY "lessons: select via section"
  ON public.university_lessons FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.university_sections s
       WHERE s.id = university_lessons.section_id
    )
  );

CREATE POLICY "lessons: publisher write"
  ON public.university_lessons FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.university_sections s
      JOIN public.university_courses c ON c.id = s.course_id
     WHERE s.id = university_lessons.section_id
       AND _is_publisher_admin_of(c.publisher_org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.university_sections s
      JOIN public.university_courses c ON c.id = s.course_id
     WHERE s.id = university_lessons.section_id
       AND _is_publisher_admin_of(c.publisher_org_id)
  ));

-- RESOURCES — visibility follows lesson
DROP POLICY IF EXISTS "resources: select via lesson" ON public.university_lesson_resources;
DROP POLICY IF EXISTS "resources: publisher write"   ON public.university_lesson_resources;

CREATE POLICY "resources: select via lesson"
  ON public.university_lesson_resources FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.university_lessons l
       WHERE l.id = university_lesson_resources.lesson_id
    )
  );

CREATE POLICY "resources: publisher write"
  ON public.university_lesson_resources FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.university_lessons l
      JOIN public.university_sections s ON s.id = l.section_id
      JOIN public.university_courses c ON c.id = s.course_id
     WHERE l.id = university_lesson_resources.lesson_id
       AND _is_publisher_admin_of(c.publisher_org_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.university_lessons l
      JOIN public.university_sections s ON s.id = l.section_id
      JOIN public.university_courses c ON c.id = s.course_id
     WHERE l.id = university_lesson_resources.lesson_id
       AND _is_publisher_admin_of(c.publisher_org_id)
  ));

-- PROGRESS — user only sees their own; no publisher SELECT here. They use the
-- aggregate security-definer fn below for analytics.
DROP POLICY IF EXISTS "progress: own select" ON public.university_progress;
DROP POLICY IF EXISTS "progress: own write"  ON public.university_progress;

CREATE POLICY "progress: own select"
  ON public.university_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "progress: own write"
  ON public.university_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── §10 Aggregate analytics (security definer) ────────────────────────────
-- Publisher admins can call this to get aggregate stats for their course
-- without raw SELECT on the progress table.
CREATE OR REPLACE FUNCTION public.university_course_analytics(p_course_id UUID)
RETURNS TABLE (
  lesson_id          UUID,
  lesson_title       TEXT,
  section_title      TEXT,
  enrolled_users     INT,
  completed_users    INT,
  avg_watch_seconds  NUMERIC,
  completion_rate    NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_publisher UUID;
BEGIN
  SELECT publisher_org_id INTO v_publisher
    FROM university_courses WHERE id = p_course_id;
  IF v_publisher IS NULL THEN
    RAISE EXCEPTION 'course not found';
  END IF;
  IF NOT _is_publisher_admin_of(v_publisher) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.title,
    s.title,
    COUNT(DISTINCT p.user_id)::INT                                                  AS enrolled_users,
    COUNT(DISTINCT p.user_id) FILTER (WHERE p.completed)::INT                       AS completed_users,
    COALESCE(AVG(p.watched_seconds), 0)::NUMERIC                                    AS avg_watch_seconds,
    CASE WHEN COUNT(DISTINCT p.user_id) > 0
         THEN COUNT(DISTINCT p.user_id) FILTER (WHERE p.completed)::NUMERIC
              / COUNT(DISTINCT p.user_id)::NUMERIC
         ELSE 0 END                                                                  AS completion_rate
  FROM university_lessons l
  JOIN university_sections s ON s.id = l.section_id
  LEFT JOIN university_progress p ON p.lesson_id = l.id
  WHERE s.course_id = p_course_id
  GROUP BY l.id, l.title, s.title, l.sort_order
  ORDER BY l.sort_order;
END $$;

GRANT EXECUTE ON FUNCTION public.university_course_analytics(UUID) TO authenticated;

-- ─── §11 Helper RPC: courses with caller progress merged ───────────────────
-- Returns published courses with the caller's progress summary attached.
-- Used by /api/university/courses?mine=true.
CREATE OR REPLACE FUNCTION public.university_courses_for_me()
RETURNS TABLE (
  id                  UUID,
  slug                TEXT,
  title               TEXT,
  emoji               TEXT,
  instructor_name     TEXT,
  description         TEXT,
  cover_image_url     TEXT,
  required_plan       TEXT,
  sort_order          INT,
  total_lessons       INT,
  completed_lessons   INT,
  last_watched_at     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH visible AS (
    SELECT * FROM university_courses c
     WHERE c.status = 'published'
       AND _is_operator()
       AND (c.required_plan IS NULL
            OR _plan_rank(_caller_org_plan()) >= _plan_rank(c.required_plan))
  ),
  lesson_counts AS (
    SELECT s.course_id, COUNT(l.id)::INT AS n
      FROM university_sections s
      LEFT JOIN university_lessons l ON l.section_id = s.id
     GROUP BY s.course_id
  ),
  my_progress AS (
    SELECT s.course_id,
           COUNT(*) FILTER (WHERE p.completed)::INT AS done,
           MAX(p.updated_at)                        AS last_at
      FROM university_sections s
      JOIN university_lessons  l ON l.section_id = s.id
      LEFT JOIN university_progress p
             ON p.lesson_id = l.id
            AND p.user_id   = auth.uid()
     GROUP BY s.course_id
  )
  SELECT v.id, v.slug, v.title, v.emoji, v.instructor_name, v.description,
         v.cover_image_url, v.required_plan, v.sort_order,
         COALESCE(lc.n,    0),
         COALESCE(mp.done, 0),
         mp.last_at
    FROM visible v
    LEFT JOIN lesson_counts lc ON lc.course_id = v.id
    LEFT JOIN my_progress   mp ON mp.course_id = v.id
   ORDER BY v.sort_order, v.title;
$$;

GRANT EXECUTE ON FUNCTION public.university_courses_for_me() TO authenticated;
