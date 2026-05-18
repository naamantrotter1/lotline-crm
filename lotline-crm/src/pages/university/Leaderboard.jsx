// /university/leaderboard
import { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { fetchLeaderboard } from '../../lib/university';

const WINDOWS = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

function displayName(r) {
  return r.display_name || 'Member';
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

export default function Leaderboard() {
  const [win, setWin]         = useState('7d');
  const [rows, setRows]       = useState([]);
  const [me, setMe]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const { rows } = await fetchLeaderboard(win, 100);
        if (!alive) return;
        const top = rows.filter(r => r.rank <= 100);
        const myRow = rows.find(r => r.is_me);
        setRows(top);
        setMe(myRow);
      } catch (e) { if (alive) setError(e.message); }
      finally    { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [win]);

  const showMyPin = me && !rows.find(r => r.is_me);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            <h1 className="text-xl font-bold text-gray-800">Leaderboard</h1>
          </div>
          <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
            {WINDOWS.map(w => (
              <button key={w.id} onClick={() => setWin(w.id)}
                className={`px-3 py-1.5 text-xs ${win === w.id ? 'bg-accent text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
        {!loading && error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-sm text-gray-400">No activity yet.</div>
        )}

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {rows.map(r => (
              <div key={r.user_id} className={`flex items-center gap-3 px-4 py-3 ${r.is_me ? 'bg-orange-50/40' : ''}`}>
                <span className="w-8 text-center text-sm font-semibold text-gray-500">
                  {medal(r.rank) || `#${r.rank}`}
                </span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 overflow-hidden">
                  {r.avatar_url && <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{displayName(r)}{r.is_me && <span className="ml-2 text-[10px] text-accent">YOU</span>}</p>
                  {r.org_name && <p className="text-xs text-gray-400 truncate">{r.org_name}</p>}
                </div>
                <p className="text-sm font-bold text-gray-800 tabular-nums">{r.points} pts</p>
              </div>
            ))}
          </div>
        )}

        {showMyPin && (
          <div className="mt-3 bg-white rounded-2xl border border-accent/40 ring-1 ring-accent/20 p-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">Your rank</p>
            <div className="flex items-center gap-3 px-1">
              <span className="w-8 text-center text-sm font-semibold text-gray-500">#{me.rank}</span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 overflow-hidden">
                {me.avatar_url && <img src={me.avatar_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{displayName(me)}</p>
                {me.org_name && <p className="text-xs text-gray-400 truncate">{me.org_name}</p>}
              </div>
              <p className="text-sm font-bold text-gray-800 tabular-nums">{me.points} pts</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
