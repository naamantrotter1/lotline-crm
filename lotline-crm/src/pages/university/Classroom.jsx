// /university — Classroom
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { fetchPublishedCourses } from '../../lib/university';
import CourseCard from '../../components/university/CourseCard';

export default function Classroom() {
  const { orgIsUniversityPublisher } = useAuth();
  const [tab, setTab]         = useState('all');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const rows = await fetchPublishedCourses({ mine: tab === 'mine' });
        if (alive) setCourses(rows || []);
      } catch (e) { if (alive) setError(e.message); }
      finally   { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [tab]);

  // "My courses" tab → only show courses with any progress
  const visible = tab === 'mine'
    ? courses.filter(c => (c.completed_lessons || 0) > 0 || c.last_watched_at)
    : courses;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center">
              <GraduationCap size={22} className="text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">University</h1>
              <p className="text-sm text-gray-400 mt-0.5">Learn the LotLine land-acquisition playbook.</p>
            </div>
          </div>
          {orgIsUniversityPublisher && (
            <Link
              to="/university/admin"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:border-accent/40 text-sm text-gray-700"
            >
              <Settings size={13} /> Publisher tools
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-100">
          {[
            { id: 'all',  label: 'All courses' },
            { id: 'mine', label: 'My courses'  },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        )}
        {!loading && error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <GraduationCap size={28} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm text-gray-400">
              {tab === 'mine' ? 'No courses in progress yet' : 'No courses available yet'}
            </p>
          </div>
        )}
        {!loading && visible.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map(c => <CourseCard key={c.id} course={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
