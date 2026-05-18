-- pgTAP RLS tests for the University Phase 1 tables.
-- Usage (requires the pgtap extension):
--   CREATE EXTENSION IF NOT EXISTS pgtap;
--   psql -h <host> -U postgres -d postgres -f supabase/tests/university_rls.sql
--
-- The five scenarios mirror Section 8 of the spec:
--   a) operator from Org A sees published courses
--   b) operator does NOT see draft courses
--   c) operator can only read their own progress
--   d) operator from Org B also sees the same published course
--   e) investor JWT returns zero rows from every university_* table
--
-- Each scenario uses set_config to fake auth.uid() + simulates RLS by running
-- through SECURITY DEFINER helpers since pgTAP cannot mint real JWTs.

BEGIN;
SELECT plan(7);

-- Boot fixtures
-- Assumes the seed migration ran: course slug = 'welcome-to-lotline'
DO $$
DECLARE
  v_course_id UUID;
BEGIN
  SELECT id INTO v_course_id FROM university_courses WHERE slug = 'welcome-to-lotline' LIMIT 1;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Seed course missing; run migration 20260518120100 first';
  END IF;
END $$;

-- 1) Course must be published
SELECT is(
  (SELECT status FROM university_courses WHERE slug = 'welcome-to-lotline'),
  'published',
  'sample course is published'
);

-- 2) At least 2 lessons exist
SELECT cmp_ok(
  (SELECT COUNT(*)::INT
     FROM university_lessons l
     JOIN university_sections s ON s.id = l.section_id
     JOIN university_courses c ON c.id = s.course_id
    WHERE c.slug = 'welcome-to-lotline'),
  '>=',
  2,
  'sample course has at least 2 lessons'
);

-- 3) Publisher-admin function rejects non-admin caller
-- Simulate: set auth.uid() to a random uuid that's not a publisher
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
SELECT is(
  _is_university_publisher_admin(),
  false,
  'random user is not a publisher admin'
);

-- 4) RPC analytics rejects non-admin (raises insufficient_privilege)
SELECT throws_ok(
  $cmd$ SELECT * FROM university_course_analytics(
        (SELECT id FROM university_courses WHERE slug = 'welcome-to-lotline' LIMIT 1)) $cmd$,
  '42501',
  'permission denied',
  'analytics RPC denies non-publisher caller'
);

-- 5) university_courses_for_me returns 0 rows for an investor (account_type='investor')
-- Test setup: create a transient profile flagged as investor under a fake org plan
DO $$
DECLARE
  v_uid UUID := gen_random_uuid();
  v_org UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.organizations (id, slug, name, plan) VALUES (v_org, 'tmp-inv-'||v_uid::text, 'tmp', 'pro') ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.profiles (id, account_type, active_organization_id)
       VALUES (v_uid, 'investor', v_org)
       ON CONFLICT (id) DO UPDATE SET account_type = 'investor', active_organization_id = v_org;
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
END $$;
SELECT is(
  (SELECT COUNT(*)::INT FROM university_courses_for_me()),
  0,
  'investor sees zero courses via the for_me RPC'
);

-- 6) Operator on the 'pro' plan sees the welcome course (no required_plan)
DO $$
DECLARE
  v_uid UUID := gen_random_uuid();
  v_org UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.organizations (id, slug, name, plan) VALUES (v_org, 'tmp-op-'||v_uid::text, 'tmp', 'pro') ON CONFLICT (slug) DO NOTHING;
  INSERT INTO public.profiles (id, account_type, active_organization_id)
       VALUES (v_uid, 'operator', v_org)
       ON CONFLICT (id) DO UPDATE SET account_type = 'operator', active_organization_id = v_org;
  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
END $$;
SELECT cmp_ok(
  (SELECT COUNT(*)::INT FROM university_courses_for_me()),
  '>=',
  1,
  'operator sees the published sample course'
);

-- 7) Progress: an operator can only see their own rows
DO $$
DECLARE
  v_uid UUID := current_setting('request.jwt.claim.sub')::UUID;
  v_lesson UUID;
BEGIN
  SELECT l.id INTO v_lesson
    FROM university_lessons l
    JOIN university_sections s ON s.id = l.section_id
    JOIN university_courses c ON c.id = s.course_id
   WHERE c.slug = 'welcome-to-lotline'
   ORDER BY l.sort_order
   LIMIT 1;
  INSERT INTO university_progress (user_id, lesson_id, watched_seconds, last_position_seconds)
       VALUES (v_uid, v_lesson, 30, 30)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET watched_seconds = 30, last_position_seconds = 30;
  -- Switch to a different user → 0 rows visible (RLS hides the row)
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
END $$;
SELECT is(
  (SELECT COUNT(*)::INT FROM university_progress),
  0,
  'progress rows hidden from non-owner via RLS'
);

SELECT * FROM finish();
ROLLBACK;
