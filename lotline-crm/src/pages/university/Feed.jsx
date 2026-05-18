// /university/feed
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { fetchFeed, fetchCategories, fetchLeaderboard, fetchEvents, refreshLeaderboard } from '../../lib/university';
import { supabase } from '../../lib/supabase';
import PostCard from '../../components/university/PostCard';
import ForumComposer from '../../components/university/ForumComposer';

export default function Feed() {
  const { profile } = useAuth();
  const [cats, setCats]           = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [myRank, setMyRank]       = useState(null);
  const [upEvents, setUpEvents]   = useState([]);

  const loadCats = async () => { try { setCats(await fetchCategories()); } catch { /* noop */ } };
  const loadFeed = async (cat = activeCat) => {
    setLoading(true); setError(null);
    try { setPosts(await fetchFeed(cat)); }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  };
  const loadRail = async () => {
    try {
      const { rows } = await fetchLeaderboard('7d', 100);
      const me = rows.find(r => r.is_me);
      setMyRank(me || null);
    } catch { /* noop */ }
    try { setUpEvents((await fetchEvents('upcoming')).slice(0, 3)); }
    catch { /* noop */ }
  };

  useEffect(() => { loadCats(); loadRail(); }, []);
  useEffect(() => { loadFeed(activeCat); }, [activeCat]); // eslint-disable-line

  // Realtime — refresh on any insert to posts in the active category
  useEffect(() => {
    const ch = supabase
      .channel('university_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'university_forum_posts' },
          () => { loadFeed(activeCat); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'university_forum_posts' },
          () => { loadFeed(activeCat); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeCat]); // eslint-disable-line

  // Realtime — update points widget whenever a points event is added/removed for this user
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel('university_my_points')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'university_points_events',
          filter: `user_id=eq.${profile.id}` },
          () => { loadRail(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]); // eslint-disable-line

  const defaultCategoryId = useMemo(() => {
    if (activeCat !== 'all') return cats.find(c => c.slug === activeCat)?.id;
    return cats[0]?.id;
  }, [cats, activeCat]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">

        {/* Left rail — categories */}
        <aside className="col-span-12 md:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 sticky top-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-2 pb-2">Categories</p>
            <button
              onClick={() => setActiveCat('all')}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${activeCat === 'all' ? 'bg-orange-50 text-accent font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              All posts
            </button>
            {cats.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.slug)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${activeCat === c.slug ? 'bg-orange-50 text-accent font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Center — composer + posts */}
        <main className="col-span-12 md:col-span-6 space-y-4">
          <ForumComposer
            categories={cats}
            defaultCategoryId={defaultCategoryId}
            onPosted={async () => { loadFeed(activeCat); await refreshLeaderboard(); loadRail(); }}
          />
          {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
          {!loading && error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-sm text-gray-400">No posts yet.</div>
          )}
          {posts.map(p => <PostCard key={p.id} post={p} />)}
        </main>

        {/* Right rail — points + events */}
        <aside className="col-span-12 md:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Your week</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-gray-800">{myRank?.points || 0}</p>
              <p className="text-xs text-gray-400">pts (7d)</p>
            </div>
            {myRank?.rank && (
              <p className="text-xs text-gray-500 mt-1">Rank #{myRank.rank}</p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Upcoming events</p>
            {upEvents.length === 0
              ? <p className="text-xs text-gray-400">None scheduled.</p>
              : upEvents.map(e => (
                  <a key={e.id} href={`/university/events/${e.id}`} className="block py-2 border-b border-gray-50 last:border-b-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
                    <p className="text-[11px] text-gray-400">{new Date(e.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </a>
                ))}
          </div>
          <a href="/university/classroom" className="block bg-orange-50 rounded-2xl border border-orange-100 p-4 text-sm text-accent font-semibold hover:bg-orange-100/60">
            Start a course →
          </a>
        </aside>
      </div>
    </div>
  );
}
