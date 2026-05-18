// /university/:courseSlug — Course detail (table of contents + Start/Resume)
import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, CheckCircle2, Circle, Play, Loader2 } from 'lucide-react';
import { fetchCourseBySlug, fetchMyProgressForCourse } from '../../lib/university';
import ProgressBar from '../../components/university/ProgressBar';

function flattenLessons(course) {
  const out = [];
  (course.university_sections || [])
    .slice().sort((a, b) => a.sort_order - b.sort_order)
    .forEach(s => {
      (s.university_lessons || [])
        .slice().sort((a, b) => a.sort_order - b.sort_order)
        .forEach(l => out.push({ ...l, sectionTitle: s.title, sectionId: s.id }));
    });
  return out;
}

export default function CourseDetail() {
  const { courseSlug } = useParams();
  const navigate = useNavigate();
  const [course,   setCourse]   = useState(null);
  const [progress, setProgress] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const c = await fetchCourseBySlug(courseSlug);
        if (!alive) return;
        if (!c) { setError('Course not found'); return; }
        setCourse(c);
        const p = await fetchMyProgressForCourse(c.id);
        if (alive) setProgress(p);
      } catch (e) { if (alive) setError(e.message); }
      finally   { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [courseSlug]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
  if (error)   return <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl">{error}</div>;
  if (!course) return null;

  const flat = flattenLessons(course);
  const done = flat.filter(l => progress[l.id]?.completed).length;
  const pct  = flat.length ? Math.round((done / flat.length) * 100) : 0;

  // Pick resume target: first incomplete lesson with progress > 0, else first incomplete, else first
  const resumeLesson = flat.find(l => {
    const p = progress[l.id];
    return p && !p.completed && (p.last_position_seconds || 0) > 0;
  }) ?? flat.find(l => !progress[l.id]?.completed) ?? flat[0];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <Link to="/university/classroom" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft size={13} /> Back to Classroom
        </Link>

        {/* Header */}
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden mb-6">
          <div className="aspect-[5/1] bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-6xl">
            {course.cover_image_url
              ? <img src={course.cover_image_url} className="w-full h-full object-cover" alt="" />
              : <span>{course.emoji || '📘'}</span>}
          </div>
          <div className="px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            {course.instructor_name && (
              <p className="text-sm text-gray-500 mt-1">Instructed by {course.instructor_name}</p>
            )}
            {course.description && (
              <p className="text-sm text-gray-700 mt-3 leading-relaxed">{course.description}</p>
            )}
            <div className="flex items-center gap-4 mt-5">
              <button
                onClick={() => resumeLesson && navigate(`/university/classroom/${course.slug}/${resumeLesson.slug}`)}
                disabled={!resumeLesson}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                <Play size={14} className="ml-0.5" />
                {done > 0 ? 'Resume' : 'Start'}
              </button>
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <ProgressBar value={done} max={flat.length || 1} />
                <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
              </div>
              <span className="text-xs text-gray-400">{flat.length} lessons</span>
            </div>
          </div>
        </div>

        {/* Sections / lessons */}
        <div className="space-y-3">
          {(course.university_sections || [])
            .slice().sort((a, b) => a.sort_order - b.sort_order)
            .map((s, idx) => {
              const lessons = (s.university_lessons || []).slice().sort((a, b) => a.sort_order - b.sort_order);
              const isCollapsed = collapsed[s.id] === true;
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setCollapsed(p => ({ ...p, [s.id]: !p[s.id] }))}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 text-left">
                      {isCollapsed
                        ? <ChevronRight size={14} className="text-gray-400" />
                        : <ChevronDown  size={14} className="text-gray-400" />}
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Section {idx + 1}</span>
                      <span className="text-sm font-semibold text-gray-800">{s.title}</span>
                    </div>
                    <span className="text-xs text-gray-400">{lessons.length} lessons</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="divide-y divide-gray-50 border-t border-gray-100">
                      {lessons.map((l) => {
                        const p = progress[l.id];
                        const completed = p?.completed === true;
                        const pcm = l.duration_seconds && p?.last_position_seconds
                          ? Math.min(100, (p.last_position_seconds / l.duration_seconds) * 100)
                          : 0;
                        return (
                          <li key={l.id}>
                            <Link
                              to={`/university/classroom/${course.slug}/${l.slug}`}
                              className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/30"
                            >
                              {completed
                                ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                : <Circle      size={16} className="text-gray-300 shrink-0" />}
                              <span className="text-sm text-gray-800 truncate flex-1">{l.title}</span>
                              {l.duration_seconds && (
                                <span className="text-[10px] text-gray-400 w-10 text-right">
                                  {Math.round(l.duration_seconds / 60)}m
                                </span>
                              )}
                              {!completed && pcm > 0 && (
                                <div className="w-16 shrink-0"><ProgressBar value={pcm} max={100} /></div>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
