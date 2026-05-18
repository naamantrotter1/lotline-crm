// /university/admin/courses/:id — Edit a single course.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronUp, ChevronDown, GripVertical, Loader2, Plus, Trash2, Save, BarChart2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import {
  updateCourse, addSection, updateSection, deleteSection,
  addLesson, deleteLesson, reorder, fetchCourseAnalytics,
} from '../../../lib/university';
import LessonEditor from './LessonEditor';

const PLAN_OPTIONS = [
  { value: '',         label: 'All subscribers' },
  { value: 'starter',  label: 'Starter+' },
  { value: 'pro',      label: 'Pro+' },
  { value: 'scale',    label: 'Scale only' },
];

export default function CourseEditor() {
  const { id } = useParams();
  const [tab, setTab]               = useState('content');
  const [course, setCourse]         = useState(null);
  const [sections, setSections]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [analytics, setAnalytics]   = useState(null);
  const formRef = useRef({});

  const reload = async () => {
    const [{ data: c }, { data: secs }] = await Promise.all([
      supabase.from('university_courses').select('*').eq('id', id).single(),
      supabase
        .from('university_sections')
        .select('*, university_lessons ( id, title, sort_order, duration_seconds )')
        .eq('course_id', id)
        .order('sort_order'),
    ]);
    setCourse(c);
    formRef.current = { ...c };
    setSections((secs || []).map(s => ({
      ...s,
      university_lessons: (s.university_lessons || []).slice().sort((a, b) => a.sort_order - b.sort_order),
    })));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await reload(); } catch (e) { if (alive) setError(e.message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const onChangeForm = (k, v) => {
    formRef.current[k] = v;
    setCourse(prev => ({ ...prev, [k]: v }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const f = formRef.current;
      const patch = {
        title:           f.title,
        emoji:           f.emoji,
        instructor_name: f.instructor_name,
        description:     f.description,
        cover_image_url: f.cover_image_url,
        required_plan:   f.required_plan || null,
        status:          f.status || 'draft',
        published_at:    f.status === 'published' && !f.published_at ? new Date().toISOString() : f.published_at,
      };
      const updated = await updateCourse(id, patch);
      setCourse(updated);
    } catch (e) { setError(e.message); }
    finally     { setSaving(false); }
  };

  const onAddSection = async () => {
    const title = window.prompt('Section title?');
    if (!title) return;
    await addSection(id, title, sections.length);
    await reload();
  };

  const onDeleteSection = async (sid) => {
    if (!window.confirm('Delete this section and all its lessons?')) return;
    await deleteSection(sid);
    await reload();
  };

  const onAddLesson = async (sectionId) => {
    const title = window.prompt('Lesson title?');
    if (!title) return;
    const sec = sections.find(s => s.id === sectionId);
    const newLesson = await addLesson(sectionId, {
      title, video_provider: 'cf_stream', video_id_or_url: '',
      sort_order: (sec?.university_lessons?.length || 0),
    });
    await reload();
    setEditingLesson(newLesson.id);
  };

  const onDeleteLesson = async (lid) => {
    if (!window.confirm('Delete this lesson?')) return;
    await deleteLesson(lid);
    await reload();
  };

  const moveSection = async (idx, dir) => {
    const next = sections.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections(next);
    await reorder('university_sections', next);
  };

  const moveLesson = async (sid, idx, dir) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const next = s.university_lessons.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return s;
      [next[idx], next[j]] = [next[j], next[idx]];
      reorder('university_lessons', next);
      return { ...s, university_lessons: next };
    }));
  };

  const onLoadAnalytics = async () => {
    try {
      const j = await fetchCourseAnalytics(id);
      setAnalytics(j.lessons || []);
    } catch (e) { setError(e.message); }
  };

  const enrolledTotal = useMemo(() => {
    if (!analytics) return 0;
    // Approximate "enrolled" = max distinct users across lessons
    return analytics.reduce((m, r) => Math.max(m, r.enrolled_users || 0), 0);
  }, [analytics]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
  if (error)   return <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl">{error}</div>;
  if (!course) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <Link to="/university/admin" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft size={13} /> Publisher tools
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-800 truncate">{course.title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">/{course.slug}</p>
          </div>
          <select
            value={course.status}
            onChange={e => onChangeForm('status', e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-gray-100">
          {[
            { id: 'content',   label: 'Content' },
            { id: 'details',   label: 'Details' },
            { id: 'analytics', label: 'Analytics' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); if (t.id === 'analytics' && !analytics) onLoadAnalytics(); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {tab === 'content' && (
          <div className="space-y-3">
            {sections.map((s, idx) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical size={14} className="text-gray-300" />
                  <input
                    value={s.title}
                    onChange={e => setSections(prev => prev.map(x => x.id === s.id ? { ...x, title: e.target.value } : x))}
                    onBlur={e => updateSection(s.id, { title: e.target.value })}
                    className="flex-1 text-sm font-semibold text-gray-800 px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-accent focus:outline-none"
                  />
                  <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronUp size={14} /></button>
                  <button onClick={() => moveSection(idx,  1)} disabled={idx === sections.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronDown size={14} /></button>
                  <button onClick={() => onDeleteSection(s.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
                <ul className="ml-6 space-y-1">
                  {s.university_lessons.map((l, li) => (
                    <li key={l.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-orange-50/30">
                      <button onClick={() => moveLesson(s.id, li, -1)} disabled={li === 0} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={12} /></button>
                      <button onClick={() => moveLesson(s.id, li,  1)} disabled={li === s.university_lessons.length - 1} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={12} /></button>
                      <button onClick={() => setEditingLesson(l.id)} className="flex-1 text-left text-sm text-gray-800 truncate hover:text-accent">
                        {l.title}
                      </button>
                      {l.duration_seconds ? <span className="text-[10px] text-gray-400">{Math.round(l.duration_seconds / 60)}m</span> : null}
                      <button onClick={() => onDeleteLesson(l.id)} className="p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 size={11} /></button>
                    </li>
                  ))}
                </ul>
                <button onClick={() => onAddLesson(s.id)} className="mt-2 ml-4 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  <Plus size={11} /> Add lesson
                </button>
              </div>
            ))}
            <button onClick={onAddSection} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-accent/40 hover:text-accent">
              <Plus size={13} /> Add section
            </button>
          </div>
        )}

        {/* DETAILS */}
        {tab === 'details' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <Field label="Title">
              <input value={course.title || ''} onChange={e => onChangeForm('title', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Emoji">
                <input value={course.emoji || ''} onChange={e => onChangeForm('emoji', e.target.value)} placeholder="📘" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" maxLength={4} />
              </Field>
              <Field label="Instructor name">
                <input value={course.instructor_name || ''} onChange={e => onChangeForm('instructor_name', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={4} value={course.description || ''} onChange={e => onChangeForm('description', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </Field>
            <Field label="Cover image URL">
              <input value={course.cover_image_url || ''} onChange={e => onChangeForm('cover_image_url', e.target.value)} placeholder="https://…" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            </Field>
            <Field label="Plan required">
              <select value={course.required_plan || ''} onChange={e => onChangeForm('required_plan', e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
        )}

        {/* ANALYTICS */}
        {tab === 'analytics' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={14} className="text-accent" />
              <p className="text-sm font-semibold text-gray-800">Course analytics</p>
              <span className="text-xs text-gray-400 ml-auto">{enrolledTotal} learners</span>
            </div>
            {!analytics && <button onClick={onLoadAnalytics} className="text-sm text-accent hover:underline">Load analytics →</button>}
            {analytics && analytics.length === 0 && <p className="text-sm text-gray-400">No progress recorded yet.</p>}
            {analytics && analytics.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-gray-400 text-left">
                  <tr><th className="pb-2">Section</th><th>Lesson</th><th className="text-right">Enrolled</th><th className="text-right">Completed</th><th className="text-right">Avg watch</th><th className="text-right">Rate</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.map(r => (
                    <tr key={r.lesson_id}>
                      <td className="py-2 text-gray-500 text-xs">{r.section_title}</td>
                      <td className="py-2 text-gray-800">{r.lesson_title}</td>
                      <td className="py-2 text-right">{r.enrolled_users}</td>
                      <td className="py-2 text-right">{r.completed_users}</td>
                      <td className="py-2 text-right">{Math.round(r.avg_watch_seconds / 60)}m</td>
                      <td className="py-2 text-right">{Math.round((r.completion_rate || 0) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Lesson editor modal */}
        {editingLesson && (
          <LessonEditor
            lessonId={editingLesson}
            onClose={async () => { setEditingLesson(null); await reload(); }}
          />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{label}</label>
      {children}
    </div>
  );
}
