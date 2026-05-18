// /university/admin — Publisher admin: list of courses
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../lib/AuthContext';
import { supabase } from '../../../lib/supabase';
import { createCourse } from '../../../lib/university';

const STATUS_TONE = {
  draft:     'bg-amber-50  text-amber-700  border-amber-100',
  published: 'bg-green-50  text-green-700  border-green-100',
  archived:  'bg-gray-100  text-gray-500   border-gray-200',
};

export default function CourseList() {
  const { activeOrgId } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Publishers see all of their own courses regardless of status thanks
      // to the "publisher admin select drafts" RLS policy.
      const { data, error } = await supabase
        .from('university_courses')
        .select('*')
        .order('updated_at', { ascending: false });
      if (alive) {
        if (error) setError(error.message);
        else       setRows(data || []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const onCreate = async () => {
    if (!activeOrgId) return;
    setCreating(true);
    try {
      const title = window.prompt('Course title?');
      if (!title) { setCreating(false); return; }
      const c = await createCourse(activeOrgId, { title });
      navigate(`/university/admin/courses/${c.id}`);
    } catch (e) {
      alert(e.message);
    } finally { setCreating(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <Link to="/university" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft size={13} /> Classroom
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Publisher tools</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage University courses, sections, and lessons.</p>
          </div>
          <button
            onClick={onCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            New course
          </button>
        </div>

        {loading && <div className="flex justify-center py-12"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
        {!loading && error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <p className="text-sm text-gray-400">No courses yet — create your first.</p>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {rows.map(c => (
              <Link
                key={c.id}
                to={`/university/admin/courses/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-orange-50/30"
              >
                <span className="text-2xl">{c.emoji || '📘'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.instructor_name ? `${c.instructor_name} · ` : ''}{c.slug}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${STATUS_TONE[c.status]}`}>
                  {c.status}
                </span>
                <ChevronRight size={14} className="text-gray-300" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
