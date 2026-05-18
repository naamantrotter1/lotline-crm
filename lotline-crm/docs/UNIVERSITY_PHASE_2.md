# University · Phase 2 (planned)

Phase 1 (already shipped) covers courses, sections, lessons, resources, progress, and Cloudflare Stream playback. The schema deliberately reserves the following table names for Phase 2 so that the migration order is unambiguous and so nothing in Phase 1 needs to be ALTERed when Phase 2 lands.

## Reserved names — DO NOT create these in Phase 1

| Table                            | Purpose                                                                 |
|----------------------------------|-------------------------------------------------------------------------|
| `university_forum_posts`         | Thread root posts attached to a course or a lesson.                     |
| `university_forum_comments`      | Threaded replies on a forum post.                                       |
| `university_events`              | Live cohort calls / office hours. Each event optionally maps to a course. |
| `university_event_attendance`    | Who RSVP'd / attended an event.                                         |
| `university_leaderboard_points`  | Per-user point ledger; aggregated for the leaderboard view.             |

## Intended schema shape

```sql
-- forum_posts
id uuid pk
course_id uuid null fk → university_courses(id)        -- optional course context
lesson_id uuid null fk → university_lessons(id)        -- optional lesson context
author_user_id uuid fk → auth.users(id)
title text
body  text
created_at timestamptz, updated_at timestamptz

-- forum_comments
id uuid pk
post_id uuid fk → university_forum_posts(id) on delete cascade
parent_comment_id uuid null fk → university_forum_comments(id)
author_user_id uuid
body text
created_at timestamptz

-- events
id uuid pk
publisher_org_id uuid fk → organizations(id)
course_id uuid null fk → university_courses(id)
title text
description text
starts_at timestamptz, ends_at timestamptz
meeting_url text
created_at timestamptz

-- event_attendance
event_id uuid fk → university_events(id) on delete cascade
user_id  uuid fk → auth.users(id)
rsvp text check (rsvp in ('yes','maybe','no'))
attended boolean default false
primary key (event_id, user_id)

-- leaderboard_points
id bigserial pk
user_id uuid fk → auth.users(id)
points int not null
reason text  -- 'lesson_completed','course_completed','forum_comment',…
ref_id uuid  -- lesson/course/post id for traceability
created_at timestamptz
```

## RLS principles for Phase 2

- Forum posts/comments: SELECT for any operator who can see the parent course (same plan/tier rules as Phase 1). INSERT for operators only. Authors can UPDATE/DELETE their own; publisher admins can DELETE any.
- Events: SELECT for any operator on the right plan; INSERT/UPDATE/DELETE for publisher admins.
- Event attendance: SELECT/INSERT/UPDATE own rows only; publisher admins read aggregate via security-definer fn.
- Leaderboard points: insert-only via security-definer function (never client-side INSERT); SELECT for the owning user or the publisher admin.

## Frontend wireframe

- `/university` Classroom now grows a "Live events" rail at the top with upcoming events.
- `/university/leaderboard` — new top-level page showing the points leaderboard for the current month.
- Course detail gains a "Discussion" tab listing forum posts; lesson player gains an inline comments panel below the description.
- Admin: `/university/admin/events` for scheduling; analytics gains an "Engagement" subtab.

## Migration ordering

When Phase 2 lands, the migration filename should sort *after* the Phase 1 ones:

```
20260518120000_university_phase_1.sql        ← Phase 1 schema (shipped)
20260518120100_university_seed_sample_course.sql ← Phase 1 seed (shipped)
20260518130000_university_phase_2.sql        ← TODO  (reserve this slot)
```
