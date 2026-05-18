-- pgTAP RLS tests for University Phase 2 (forum, events, leaderboard).
-- Apply phase 1 + phase 2 + triggers + seed first.
--
--   CREATE EXTENSION IF NOT EXISTS pgtap;
--   psql $SUPABASE_DB_URL -f supabase/tests/university_phase_2_rls.sql
--
-- Tests mirror Section 9 scenarios in the spec.

BEGIN;
SELECT plan(7);

-- Bootstrap two ops + an investor + a hub admin
DO $$
DECLARE
  v_hub      UUID;
  v_op_a     UUID := gen_random_uuid();
  v_op_b     UUID := gen_random_uuid();
  v_inv      UUID := gen_random_uuid();
  v_org_a    UUID := gen_random_uuid();
  v_org_b    UUID := gen_random_uuid();
  v_org_inv  UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_hub FROM organizations WHERE is_university_publisher = TRUE LIMIT 1;
  IF v_hub IS NULL THEN RAISE EXCEPTION 'Run Phase 1 seed first'; END IF;

  -- Create temp orgs + profiles
  INSERT INTO organizations (id, slug, name, plan) VALUES
    (v_org_a,   'tmp-a-'||v_op_a::text,  'Tmp Org A',  'pro'),
    (v_org_b,   'tmp-b-'||v_op_b::text,  'Tmp Org B',  'pro'),
    (v_org_inv, 'tmp-i-'||v_inv::text,   'Tmp Inv',    'pro')
    ON CONFLICT (slug) DO NOTHING;

  INSERT INTO profiles (id, account_type, active_organization_id) VALUES
    (v_op_a, 'operator', v_org_a),
    (v_op_b, 'operator', v_org_b),
    (v_inv,  'investor', v_org_inv)
    ON CONFLICT (id) DO UPDATE SET account_type = EXCLUDED.account_type, active_organization_id = EXCLUDED.active_organization_id;

  -- Memberships
  INSERT INTO memberships (user_id, organization_id, role, status) VALUES
    (v_op_a, v_org_a,   'operator', 'active'),
    (v_op_b, v_org_b,   'operator', 'active'),
    (v_inv,  v_org_inv, 'operator', 'active')
    ON CONFLICT DO NOTHING;
END $$;

-- Helper: set JWT
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user UUID) RETURNS VOID AS $$
  SELECT set_config('request.jwt.claim.sub', p_user::text, true)
$$ LANGUAGE sql;

-- 1) Op A inserts a post → visible to Op B (cross-org community)
DO $$
DECLARE
  v_op_a UUID;
  v_op_b UUID;
  v_cat  UUID;
  v_post UUID;
BEGIN
  SELECT id INTO v_op_a FROM profiles WHERE account_type='operator' AND active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-a-%') LIMIT 1;
  SELECT id INTO v_op_b FROM profiles WHERE account_type='operator' AND active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-b-%') LIMIT 1;
  SELECT id INTO v_cat  FROM university_forum_categories WHERE slug='wins' LIMIT 1;
  PERFORM pg_temp.act_as(v_op_a);
  INSERT INTO university_forum_posts (category_id, author_user_id, author_org_id, body)
    VALUES (v_cat, v_op_a, (SELECT active_organization_id FROM profiles WHERE id=v_op_a), 'Closed my first deal!')
    RETURNING id INTO v_post;
  PERFORM set_config('test.last_post', v_post::text, true);
END $$;

SELECT cmp_ok(
  (SELECT COUNT(*)::INT
     FROM university_forum_posts p
    WHERE p.id = current_setting('test.last_post')::UUID
      AND p.deleted_at IS NULL),
  '>=', 1,
  'op A created a forum post'
);

-- Now switch to op B → should see it
SELECT is(
  (DO $$
   BEGIN
     PERFORM pg_temp.act_as((SELECT id FROM profiles WHERE account_type='operator' AND active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-b-%') LIMIT 1));
   END $$ ; SELECT EXISTS(SELECT 1 FROM university_forum_posts WHERE id = current_setting('test.last_post')::UUID)::TEXT),
  'true',
  'op B can SELECT op A''s post (cross-org community)'
);

-- 2) Op B cannot delete or pin op A's post (RLS update fails silently → row unchanged)
DO $$
DECLARE v_op_b UUID;
BEGIN
  SELECT id INTO v_op_b FROM profiles WHERE active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-b-%') LIMIT 1;
  PERFORM pg_temp.act_as(v_op_b);
  -- Should be a no-op (no matching row in RLS USING clause)
  UPDATE university_forum_posts SET is_pinned = TRUE WHERE id = current_setting('test.last_post')::UUID;
END $$;
SELECT is(
  (SELECT is_pinned FROM university_forum_posts WHERE id = current_setting('test.last_post')::UUID),
  false,
  'op B cannot pin a foreign post'
);

-- 3) Hub admin CAN pin
DO $$
DECLARE
  v_admin UUID;
  v_hub   UUID;
BEGIN
  SELECT id INTO v_hub FROM organizations WHERE is_university_publisher = TRUE LIMIT 1;
  SELECT m.user_id INTO v_admin
    FROM memberships m WHERE m.organization_id = v_hub AND m.role IN ('owner','admin') LIMIT 1;
  IF v_admin IS NULL THEN
    -- Create a fake admin for the test
    v_admin := gen_random_uuid();
    INSERT INTO profiles (id, account_type, active_organization_id) VALUES (v_admin, 'operator', v_hub) ON CONFLICT (id) DO NOTHING;
    INSERT INTO memberships (user_id, organization_id, role, status) VALUES (v_admin, v_hub, 'owner', 'active') ON CONFLICT DO NOTHING;
  END IF;
  PERFORM pg_temp.act_as(v_admin);
  UPDATE university_forum_posts SET is_pinned = TRUE WHERE id = current_setting('test.last_post')::UUID;
END $$;
SELECT is(
  (SELECT is_pinned FROM university_forum_posts WHERE id = current_setting('test.last_post')::UUID),
  true,
  'hub admin can pin any post'
);

-- 4) Investor sees zero rows from every Phase 2 table
DO $$
DECLARE v_inv UUID;
BEGIN
  SELECT id INTO v_inv FROM profiles WHERE account_type='investor' LIMIT 1;
  PERFORM pg_temp.act_as(v_inv);
END $$;
SELECT is(
  (SELECT
     (SELECT COUNT(*) FROM university_forum_posts)         +
     (SELECT COUNT(*) FROM university_forum_comments)      +
     (SELECT COUNT(*) FROM university_forum_likes)         +
     (SELECT COUNT(*) FROM university_events)              +
     (SELECT COUNT(*) FROM university_event_rsvps)         +
     (SELECT COUNT(*) FROM university_points_events))::INT,
  0,
  'investor sees zero rows from all phase-2 tables'
);

-- 5) Subscriber cannot insert directly into university_points_events
DO $$
DECLARE
  v_op_a UUID;
  v_err  TEXT;
BEGIN
  SELECT id INTO v_op_a FROM profiles WHERE active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-a-%') LIMIT 1;
  PERFORM pg_temp.act_as(v_op_a);
  BEGIN
    INSERT INTO university_points_events (user_id, points, reason) VALUES (v_op_a, 9999, 'forum_post');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    v_err := 'denied';
  END;
  PERFORM set_config('test.points_err', COALESCE(v_err, 'allowed'), true);
END $$;
SELECT is(
  current_setting('test.points_err'),
  'denied',
  'operator cannot direct-insert into university_points_events'
);

-- 6) Trigger awarded forum_post points for the original post
DO $$ BEGIN PERFORM pg_temp.act_as((SELECT user_id FROM memberships WHERE role IN ('owner','admin') AND organization_id IN (SELECT id FROM organizations WHERE is_university_publisher) LIMIT 1)); END $$;
SELECT cmp_ok(
  (SELECT COUNT(*)::INT FROM university_points_events
    WHERE subject_id = current_setting('test.last_post')::UUID AND reason = 'forum_post'),
  '>=', 1,
  'forum_post trigger awarded points'
);

-- 7) Liking your own post does NOT award post_received_like to yourself
DO $$
DECLARE v_op_a UUID;
BEGIN
  SELECT id INTO v_op_a FROM profiles WHERE active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-a-%') LIMIT 1;
  PERFORM pg_temp.act_as(v_op_a);
  BEGIN
    INSERT INTO university_forum_likes (user_id, post_id) VALUES (v_op_a, current_setting('test.last_post')::UUID);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
SELECT is(
  (SELECT COUNT(*)::INT FROM university_points_events
    WHERE reason = 'post_received_like'
      AND subject_id = current_setting('test.last_post')::UUID
      AND user_id = (SELECT id FROM profiles WHERE active_organization_id IN (SELECT id FROM organizations WHERE slug LIKE 'tmp-a-%') LIMIT 1)),
  0,
  'self-like does NOT award post_received_like to the liker (their own post)'
);

SELECT * FROM finish();
ROLLBACK;
