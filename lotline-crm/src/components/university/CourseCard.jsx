// Single course tile on the Classroom grid.
import { Link } from 'react-router-dom';
import { Play, Lock } from 'lucide-react';
import ProgressBar from './ProgressBar';

export default function CourseCard({ course, locked }) {
  const pct = course.total_lessons > 0
    ? Math.round((course.completed_lessons / course.total_lessons) * 100)
    : 0;
  const cover = course.cover_image_url;
  return (
    <Link
      to={`/university/classroom/${course.slug}`}
      className={`group block rounded-2xl border border-gray-100 bg-white overflow-hidden transition-shadow ${locked ? 'opacity-60 pointer-events-none' : 'hover:shadow-md'}`}
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-5xl relative">
        {cover
          ? <img src={cover} alt="" className="w-full h-full object-cover" />
          : <span>{course.emoji || '📘'}</span>}
        {locked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Lock size={22} className="text-white" />
          </div>
        )}
        {!locked && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center">
              <Play size={18} className="text-accent ml-0.5" />
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-800 truncate">{course.title}</p>
        {course.instructor_name && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{course.instructor_name}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <ProgressBar value={course.completed_lessons || 0} max={course.total_lessons || 1} />
          <span className="text-[10px] text-gray-400 w-9 text-right shrink-0">{pct}%</span>
        </div>
      </div>
    </Link>
  );
}
