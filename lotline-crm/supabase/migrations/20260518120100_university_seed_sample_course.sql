-- ═══════════════════════════════════════════════════════════════════════════════
-- University · seed: a small sample course so QA has something to load.
-- Uses Mux's public test HLS asset for both lessons (video_provider='url').
-- Safe to re-run — INSERTs are idempotent on (publisher_org_id, slug).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_hub_org   UUID;
  v_course_id UUID;
  v_sec_id    UUID;
BEGIN
  -- Find the publisher hub (LotLine). If no hub exists, do nothing.
  SELECT id INTO v_hub_org
    FROM public.organizations
   WHERE is_university_publisher = TRUE
   ORDER BY created_at
   LIMIT 1;
  IF v_hub_org IS NULL THEN
    RAISE NOTICE 'No university publisher org found; skipping seed.';
    RETURN;
  END IF;

  -- Course
  INSERT INTO public.university_courses
         (publisher_org_id, slug, title, emoji, instructor_name, description, status, published_at, sort_order)
  VALUES (v_hub_org, 'welcome-to-lotline',
          'Welcome to LotLine',
          '🎓',
          'Naaman Trotter',
          'A 5-minute tour of the LotLine playbook: how we source land, structure mobile-home deals, and turn dirt into cash flow.',
          'published',
          now(),
          0)
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        emoji = EXCLUDED.emoji,
        instructor_name = EXCLUDED.instructor_name,
        description = EXCLUDED.description,
        status = EXCLUDED.status
  RETURNING id INTO v_course_id;

  -- Section
  INSERT INTO public.university_sections (course_id, title, sort_order)
  VALUES (v_course_id, 'Getting started', 0)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_sec_id
    FROM public.university_sections
   WHERE course_id = v_course_id AND title = 'Getting started'
   LIMIT 1;

  -- Lessons (HLS test assets)
  INSERT INTO public.university_lessons
         (section_id, slug, title, description, video_provider, video_id_or_url, duration_seconds, sort_order)
  VALUES
    (v_sec_id, 'meet-the-playbook',
     'Meet the playbook',
     'The big-picture overview: why land + mobile homes beat traditional flips.',
     'url',
     'https://stream.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU.m3u8',
     65, 0),
    (v_sec_id, 'how-we-source-deals',
     'How we source deals',
     'The county-by-county sourcing engine and what we look for in a parcel.',
     'url',
     'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
     180, 1)
  ON CONFLICT (section_id, slug) DO NOTHING;
END $$;
