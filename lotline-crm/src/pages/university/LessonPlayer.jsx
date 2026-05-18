// /university/:courseSlug/:lessonSlug — Lesson player
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { fetchCourseBySlug, fetchMyProgressForCourse, getLessonPlayback, postProgress } from '../../lib/university';
import VideoPlayer from '../../components/university/VideoPlayer';
import ResourceList from '../../components/university/ResourceList';

function flatten(course) {
  const out = [];
  (course.university_sections || [])
    .slice().sort((a, b) => a.sort_order - b.sort_order)
    .forEach(s =>
      (s.university_lessons || [])
        .slice().sort((a, b) => a.sort_order - b.sort_order)
        .forEach(l => out.push({ ...l, sectionTitle: s.title }))
    );
  return out;
}

export default function LessonPlayer() {
  const { courseSlug, lessonSlug } = useParams();
  const navigate = useNavigate();

  const [course,   setCourse]   = useState(null);
  const [progress, setProgress] = useState({});
  const [playback, setPlayback] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const flat = useMemo(() => course ? flatten(course) : [], [course]);
  const currentIdx = flat.findIndex(l => l.slug === lessonSlug);
  const lesson  = flat[currentIdx] || null;
  const prev    = currentIdx > 0                ? flat[currentIdx - 1] : null;
  const next    = currentIdx < flat.length - 1 ? flat[currentIdx + 1] : null;
  const myProgress = lesson ? progress[lesson.id] : null;

  // Load course + progress
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

  // Load playback URL once we know the lesson
  useEffect(() => {
    if (!lesson) return;
    let alive = true;
    (async () => {
      try {
        const p = await getLessonPlayback(lesson.id);
        if (alive) setPlayback(p);
      } catch (e) { if (alive) setError(e.message); }
    })();
    return () => { alive = false; };
  }, [lesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTime = async ({ currentTime, duration, flush }) => {
    if (!lesson) return;
    const watched = Math.max(myProgress?.watched_seconds || 0, currentTime);
    const isComplete = !!duration && currentTime / duration >= 0.9;
    const r = await postProgress({
      lessonId:            lesson.id,
      lastPositionSeconds: currentTime,
      watchedSeconds:      watched,
      completed:           isComplete,
      durationSeconds:     duration || lesson.duration_seconds,
    });
    if (r && !r.throttled) {
      setProgress(p => ({
        ...p,
        [lesson.id]: {
          ...(p[lesson.id] || {}),
          watched_seconds:       Math.round(watched),
          last_position_seconds: Math.round(currentTime),
          completed:             isComplete || p[lesson.id]?.completed === true,
        },
      }));
    }
    if (flush) { /* nothing else — fire-and-forget */ }
  };

  const toggleComplete = async () => {
    if (!lesson) return;
    const completed = !(myProgress?.completed === true);
    await postProgress({
      lessonId:            lesson.id,
      lastPositionSeconds: myProgress?.last_position_seconds || 0,
      watchedSeconds:      myProgress?.watched_seconds || 0,
      completed,
      durationSeconds:     lesson.duration_seconds,
    });
    setProgress(p => ({
      ...p,
      [lesson.id]: { ...(p[lesson.id] || {}), completed },
    }));
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
  if (error)   return <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl">{error}</div>;
  if (!lesson) return <div className="p-6 text-sm text-gray-500">Lesson not found.</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <Link to={`/university/classroom/${courseSlug}`} className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft size={13} /> {course.title}
        </Link>

        {/* Player */}
        <div className="rounded-2xl overflow-hidden mb-4 bg-black">
          {playback?.manifestUrl
            ? <VideoPlayer
                manifestUrl={playback.manifestUrl}
                startSeconds={myProgress?.last_position_seconds || 0}
                onTimeUpdate={handleTime}
                autoPlay
              />
            : <div className="aspect-video flex items-center justify-center text-gray-400 text-sm">
                <Loader2 size={18} className="animate-spin" />
              </div>}
        </div>

        {/* Title + complete checkbox */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{lesson.sectionTitle}</p>
            <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
            {lesson.description && (
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">{lesson.description}</p>
            )}
          </div>
          <button
            onClick={toggleComplete}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
              myProgress?.completed
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-accent/40'
            }`}
          >
            {myProgress?.completed
              ? <CheckCircle2 size={14} className="text-green-500" />
              : <Circle      size={14} className="text-gray-300" />}
            {myProgress?.completed ? 'Completed' : 'Mark as complete'}
          </button>
        </div>

        {/* Resources */}
        {lesson.university_lesson_resources?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <ResourceList resources={lesson.university_lesson_resources} />
          </div>
        )}

        {/* Prev / Next */}
        <div className="flex items-center justify-between">
          <button
            disabled={!prev}
            onClick={() => prev && navigate(`/university/classroom/${courseSlug}/${prev.slug}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-40 hover:border-accent/40"
          >
            <ChevronLeft size={13} /> Previous
          </button>
          <button
            disabled={!next}
            onClick={() => next && navigate(`/university/classroom/${courseSlug}/${next.slug}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 disabled:opacity-40 hover:border-accent/40"
          >
            Next <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
