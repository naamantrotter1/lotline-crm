// src/lib/university.js
// ─────────────────────────────────────────────────────────────────────────────
// Client wrappers around /api/university/* + a few direct PostgREST helpers
// for the editor pages where we want to bypass an API hop.
import { supabase } from './supabase';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

const PROXY = import.meta.env.VITE_API_URL || '';

// ─── Public reads via PostgREST + RLS ───────────────────────────────────────
export async function fetchPublishedCourses({ mine = true } = {}) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/courses?mine=${mine ? 'true' : 'false'}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'fetch courses failed');
  const { courses } = await r.json();
  return courses;
}

export async function fetchCourseBySlug(slug) {
  // Course + nested sections + lessons in one round trip.
  const { data, error } = await supabase
    .from('university_courses')
    .select(`
      *,
      university_sections (
        id, title, sort_order,
        university_lessons (
          id, slug, title, description, video_provider, video_id_or_url,
          duration_seconds, sort_order,
          university_lesson_resources ( id, label, file_url, mime_type, sort_order )
        )
      )
    `)
    .eq('slug', slug)
    .order('sort_order', { foreignTable: 'university_sections',                                  ascending: true })
    .order('sort_order', { foreignTable: 'university_sections.university_lessons',                ascending: true })
    .order('sort_order', { foreignTable: 'university_sections.university_lessons.university_lesson_resources', ascending: true })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyProgressForCourse(courseId) {
  // Get the IDs of all lessons in the course, then fetch progress rows.
  const { data: secs } = await supabase
    .from('university_sections')
    .select('id, university_lessons ( id )')
    .eq('course_id', courseId);
  const lessonIds = (secs || []).flatMap(s => (s.university_lessons || []).map(l => l.id));
  if (!lessonIds.length) return {};

  const { data: prog } = await supabase
    .from('university_progress')
    .select('lesson_id, watched_seconds, last_position_seconds, completed, completed_at')
    .in('lesson_id', lessonIds);

  const out = {};
  (prog || []).forEach(p => { out[p.lesson_id] = p; });
  return out;
}

// ─── Playback URL ───────────────────────────────────────────────────────────
export async function getLessonPlayback(lessonId) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/lesson-playback?id=${encodeURIComponent(lessonId)}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'playback denied');
  return r.json();
}

// ─── Progress reporting ─────────────────────────────────────────────────────
export async function postProgress({ lessonId, lastPositionSeconds, watchedSeconds, completed, durationSeconds }) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/progress`, {
    method:  'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lesson_id: lessonId,
      last_position_seconds: Math.round(lastPositionSeconds || 0),
      watched_seconds:       Math.round(watchedSeconds || 0),
      completed:             !!completed,
      duration_seconds:      durationSeconds || null,
    }),
  });
  if (!r.ok) return null;
  return r.json();
}

// ─── Admin: upload URL ──────────────────────────────────────────────────────
export async function requestCloudflareUploadUrl(maxDurationSeconds = 3600) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/upload-url`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxDurationSeconds }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'upload-url failed');
  return r.json(); // { uploadUrl, uid }
}

// ─── Admin: analytics ───────────────────────────────────────────────────────
export async function fetchCourseAnalytics(courseId) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/admin-progress?courseId=${encodeURIComponent(courseId)}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'analytics failed');
  return r.json();
}

// ─── Admin: course / section / lesson CRUD via PostgREST ────────────────────
export async function createCourse(publisherOrgId, partial) {
  const slug = (partial.slug || partial.title || 'course')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const { data, error } = await supabase
    .from('university_courses')
    .insert({
      publisher_org_id: publisherOrgId,
      slug,
      title: partial.title || 'Untitled course',
      emoji: partial.emoji || '📘',
      instructor_name: partial.instructor_name || null,
      description: partial.description || null,
      cover_image_url: partial.cover_image_url || null,
      required_plan: partial.required_plan || null,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(id, patch) {
  const { data, error } = await supabase
    .from('university_courses')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCourse(id) {
  const { error } = await supabase.from('university_courses').delete().eq('id', id);
  if (error) throw error;
}

export async function addSection(courseId, title, sortOrder) {
  const { data, error } = await supabase
    .from('university_sections')
    .insert({ course_id: courseId, title, sort_order: sortOrder ?? 0 })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateSection(id, patch) {
  const { data, error } = await supabase
    .from('university_sections')
    .update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSection(id) {
  const { error } = await supabase.from('university_sections').delete().eq('id', id);
  if (error) throw error;
}

export async function addLesson(sectionId, lesson) {
  const slug = (lesson.slug || lesson.title || 'lesson')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const { data, error } = await supabase
    .from('university_lessons')
    .insert({
      section_id:       sectionId,
      slug,
      title:            lesson.title || 'Untitled lesson',
      description:      lesson.description || null,
      video_provider:   lesson.video_provider || 'cf_stream',
      video_id_or_url:  lesson.video_id_or_url || '',
      duration_seconds: lesson.duration_seconds || null,
      sort_order:       lesson.sort_order ?? 0,
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateLesson(id, patch) {
  const { data, error } = await supabase
    .from('university_lessons').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLesson(id) {
  const { error } = await supabase.from('university_lessons').delete().eq('id', id);
  if (error) throw error;
}

export async function reorder(table, items) {
  // items: [{ id, sort_order }, …]
  const updates = items.map((it, idx) =>
    supabase.from(table).update({ sort_order: idx }).eq('id', it.id)
  );
  await Promise.all(updates);
}

export async function addResource(lessonId, label, fileUrl, mimeType) {
  const { data, error } = await supabase
    .from('university_lesson_resources')
    .insert({ lesson_id: lessonId, label, file_url: fileUrl, mime_type: mimeType || null })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteResource(id) {
  const { error } = await supabase.from('university_lesson_resources').delete().eq('id', id);
  if (error) throw error;
}

// ═══ Phase 2 — Forum / Events / Leaderboard ════════════════════════════════

// Forum
export async function fetchFeed(category = 'all') {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/feed?category=${encodeURIComponent(category)}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'feed fetch failed');
  const { posts } = await r.json();
  return posts;
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('university_forum_categories')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function createPost({ category_id, title, body, image_urls }) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/feed`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id, title, body, image_urls }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'post failed');
  const { post } = await r.json();
  return post;
}

export async function fetchPostDetail(id) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/post?id=${encodeURIComponent(id)}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'post fetch failed');
  return r.json();
}

export async function patchPost(id, patch) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/post?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'edit failed');
  return (await r.json()).post;
}

export async function deletePost(id) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/post?id=${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: h,
  });
  if (!r.ok) throw new Error((await r.json()).error || 'delete failed');
}

export async function postComment({ post_id, body, parent_comment_id }) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/comment`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id, body, parent_comment_id }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'comment failed');
  return (await r.json()).comment;
}

export async function deleteComment(id) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/comment?id=${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: h,
  });
  if (!r.ok) throw new Error((await r.json()).error || 'delete failed');
}

export async function toggleLike({ post_id, comment_id, liked }) {
  const h = await authHeaders();
  const method = liked ? 'DELETE' : 'POST';
  const url = liked
    ? `${PROXY}/api/university/like?${post_id ? 'post_id=' + post_id : 'comment_id=' + comment_id}`
    : `${PROXY}/api/university/like`;
  const r = await fetch(url, {
    method,
    headers: { ...h, 'Content-Type': 'application/json' },
    body: liked ? undefined : JSON.stringify({ post_id: post_id || null, comment_id: comment_id || null }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'like failed');
  return r.json();
}

// Events
export async function fetchEvents(range = 'upcoming') {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/events?range=${range}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'events fetch failed');
  return (await r.json()).events;
}

export async function fetchEvent(id) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/event?id=${encodeURIComponent(id)}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'event fetch failed');
  return (await r.json()).event;
}

export async function rsvpEvent(event_id, state) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/event`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id, state }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'rsvp failed');
}

export async function createEvent(partial) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/events`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'create event failed');
  return (await r.json()).event;
}

export async function patchEvent(id, patch) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/event?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'patch event failed');
  return (await r.json()).event;
}

export async function deleteEvent(id) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/event?id=${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: h,
  });
  if (!r.ok) throw new Error((await r.json()).error || 'delete failed');
}

// Leaderboard
export async function fetchLeaderboard(window_ = '7d', limit = 100) {
  const h = await authHeaders();
  const r = await fetch(`${PROXY}/api/university/leaderboard?window=${window_}&limit=${limit}`, { headers: h });
  if (!r.ok) throw new Error((await r.json()).error || 'leaderboard fetch failed');
  return r.json();
}

export async function refreshLeaderboard() {
  await fetch(`${PROXY}/api/university/refresh-leaderboard`, { method: 'POST' });
}

// Admin: forum moderation
export async function adminListPosts({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('university_forum_posts')
    .select('*, category:university_forum_categories(slug,name), author_profile:profiles!author_user_id(id,first_name,last_name,avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function adminPatchPost(id, patch) {
  const { data, error } = await supabase
    .from('university_forum_posts')
    .update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Forum categories CRUD (admin)
export async function addCategory({ slug, name, description, sort_order }) {
  const { data, error } = await supabase
    .from('university_forum_categories')
    .insert({ slug, name, description: description || null, sort_order: sort_order ?? 0 })
    .select().single();
  if (error) throw error;
  return data;
}

export async function patchCategory(id, patch) {
  const { data, error } = await supabase
    .from('university_forum_categories')
    .update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
