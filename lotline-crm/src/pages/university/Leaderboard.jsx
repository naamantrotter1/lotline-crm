// /university/leaderboard
import { useEffect, useState } from 'react';
import { Loader2, Trophy, HelpCircle, X } from 'lucide-react';
import { fetchLeaderboard, refreshLeaderboard } from '../../lib/university';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

const WINDOWS = [
  { id: '7d',  label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

// Level thresholds — level N requires LEVELS[N-1] points
const LEVELS = [0, 10, 20, 40, 80, 160, 320, 640, 1280];

function getLevel(pts) {
  let lv = 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (pts >= LEVELS[i]) lv = i + 1;
  }
  return lv;
}

function levelProgress(pts) {
  const lv = getLevel(pts);
  if (lv >= LEVELS.length) return { pct: 100, next: null };
  const from = LEVELS[lv - 1];
  const to   = LEVELS[lv];
  return { pct: Math.round(((pts - from) / (to - from)) * 100), next: to };
}

// yellow → purple → blue tiers
function levelStyle(lv) {
  if (lv <= 3) return { bg: 'bg-yellow-100',  text: 'text-yellow-700',  ring: 'ring-yellow-300'  };
  if (lv <= 6) return { bg: 'bg-purple-100',  text: 'text-purple-700',  ring: 'ring-purple-300'  };
  return         { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-300'    };
}

function LevelBadge({ pts, size = 'sm' }) {
  const lv = getLevel(pts);
  const { bg, text, ring } = levelStyle(lv);
  const cls = size === 'lg'
    ? `inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ring-2 ${bg} ${text} ${ring}`
    : `inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ring-1 ${bg} ${text} ${ring}`;
  return <span className={cls}>{lv}</span>;
}

function PointsModal({ onClose }) {
  const EARN = [
    { action: 'Create a forum post',       pts: '+5',  note: 'up to 5/day'  },
    { action: 'Write a comment',           pts: '+2',  note: 'up to 5/day'  },
    { action: 'Your post receives a like', pts: '+1',  note: ''             },
    { action: 'Complete a lesson',         pts: '+10', note: ''             },
    { action: 'Complete a course',         pts: '+50', note: ''             },
    { action: 'Attend a live event',       pts: '+15', note: ''             },
    { action: 'Daily login',               pts: '+3',  note: 'once/day'     },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">How do points work?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Earn points by contributing to the community. The more you participate, the higher your level.
        </p>

        <table className="w-full text-xs mb-6">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left pb-2 text-gray-400 font-medium">Action</th>
              <th className="text-right pb-2 text-gray-400 font-medium">Points</th>
              <th className="text-right pb-2 text-gray-400 font-medium w-24">Limit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {EARN.map(e => (
              <tr key={e.action}>
                <td className="py-2 text-gray-700">{e.action}</td>
                <td className="py-2 text-right font-bold text-accent">{e.pts}</td>
                <td className="py-2 text-right text-gray-400">{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Levels</p>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((threshold, i) => {
            const lv = i + 1;
            const { bg, text, ring } = levelStyle(lv);
            return (
              <div key={lv} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${bg} ring-1 ${ring}`}>
                <span className={`text-base font-bold ${text}`}>{lv}</span>
                <span className={`text-xs ${text}`}>{threshold.toLocaleString()} pts</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function displayName(r) {
  return r.display_name || 'Member';
}

function medal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

function LeaderRow({ r, pinned = false }) {
  const { pct, next } = levelProgress(r.points);
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${r.is_me ? 'bg-orange-50/40' : ''} ${pinned ? 'rounded-2xl' : ''}`}>
      <span className="w-8 text-center text-sm font-semibold text-gray-500 shrink-0">
        {medal(r.rank) || `#${r.rank}`}
      </span>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 overflow-hidden shrink-0">
        {r.avatar_url && <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-800 truncate">{displayName(r)}</p>
          {r.is_me && <span className="text-[10px] text-accent font-semibold">YOU</span>}
        </div>
        {r.org_name && <p className="text-xs text-gray-400 truncate">{r.org_name}</p>}
        {r.is_me && next && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[9px] text-gray-400 shrink-0">{next.toLocaleString()} pts to next</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <LevelBadge pts={r.points} />
        <p className="text-sm font-bold text-gray-800 tabular-nums w-16 text-right">{r.points} pts</p>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { profile } = useAuth();
  const [win, setWin]           = useState('7d');
  const [rows, setRows]         = useState([]);
  const [me, setMe]             = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showModal, setShowModal] = useState(false);

  const reload = async (window_) => {
    try {
      setLoading(true);
      await refreshLeaderboard();
      const { rows } = await fetchLeaderboard(window_, 100);
      const top = rows.filter(r => r.rank <= 100);
      const myRow = rows.find(r => r.is_me);
      setRows(top);
      setMe(myRow);
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  };

  useEffect(() => {
    let alive = true;
    reload(win).catch(() => {}).finally(() => { if (!alive) return; });
    return () => { alive = false; };
  }, [win]); // eslint-disable-line

  // Realtime — re-fetch when any points event changes for this user
  useEffect(() => {
    if (!profile?.id) return;
    const ch = supabase
      .channel('leaderboard_my_points')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'university_points_events',
          filter: `user_id=eq.${profile.id}` },
          () => { reload(win); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id, win]); // eslint-disable-line

  const showMyPin = me && !rows.find(r => r.is_me);

  // Current user level summary card (always shown when me is available)
  const myLevel = me ? getLevel(me.points) : null;
  const myProgress = me ? levelProgress(me.points) : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {showModal && <PointsModal onClose={() => setShowModal(false)} />}

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-accent" />
            <h1 className="text-xl font-bold text-gray-800">Leaderboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent"
            >
              <HelpCircle size={14} /> How points work?
            </button>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
              {WINDOWS.map(w => (
                <button key={w.id} onClick={() => setWin(w.id)}
                  className={`px-3 py-1.5 text-xs ${win === w.id ? 'bg-accent text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current user level card */}
        {me && myLevel && (
          <div className="mb-5 bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
            <LevelBadge pts={me.points} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">
                Level {myLevel} · {me.points.toLocaleString()} points
              </p>
              {myProgress.next ? (
                <>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${myProgress.pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {myProgress.next - me.points} pts to Level {myLevel + 1}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-gray-400 mt-1">Max level reached!</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Your rank</p>
              <p className="text-lg font-bold text-gray-800">#{me.rank}</p>
            </div>
          </div>
        )}

        {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
        {!loading && error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-sm text-gray-400">No activity yet.</div>
        )}

        {rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {rows.map(r => <LeaderRow key={r.user_id} r={r} />)}
          </div>
        )}

        {showMyPin && (
          <div className="mt-3 bg-white rounded-2xl border border-accent/40 ring-1 ring-accent/20 p-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 px-1">Your rank</p>
            <LeaderRow r={me} pinned />
          </div>
        )}
      </div>
    </div>
  );
}
