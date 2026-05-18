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
