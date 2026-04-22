import { useState, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, Image } from 'lucide-react';
import { fetchDealUpdates } from '../../lib/investorPortalData';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ActivityLog({ dealId }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading]  = useState(true);
  const [open, setOpen]        = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!dealId) return;
    fetchDealUpdates(dealId).then(({ updates: u }) => {
      setUpdates(u ?? []);
      setLoading(false);
    });
  }, [dealId]);

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Activity Log</span>
          {!loading && updates.length > 0 && (
            <span className="text-[10px] bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">{updates.length}</span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-500 dark:text-gray-400" /> : <ChevronDown size={15} className="text-gray-500 dark:text-gray-400" />}
      </button>

      {open && (
        loading ? (
          <div className="px-5 pb-4 space-y-3 border-t border-gray-200 dark:border-white/8">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-white/8 rounded-lg animate-pulse" />)}
          </div>
        ) : updates.length === 0 ? (
          <div className="px-5 pb-6 pt-2 flex flex-col items-center gap-2 text-center border-t border-gray-200 dark:border-white/8">
            <Activity size={24} className="text-gray-400 dark:text-gray-500" />
            <p className="text-xs text-gray-400 dark:text-gray-500">No updates yet.<br />Your operator will post progress here.</p>
          </div>
        ) : (
          <div className="border-t border-gray-200 dark:border-white/8">
            {updates.map((u, idx) => (
              <div key={u.id} className="relative">
                {/* Timeline line */}
                {idx < updates.length - 1 && (
                  <div className="absolute left-[29px] top-[52px] bottom-0 w-px bg-gray-200 dark:bg-white/8" />
                )}
                <div className="flex gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  {/* Dot */}
                  <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-accent bg-accent/20 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">{u.title}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">{fmtDate(u.posted_at)}</span>
                    </div>
                    {u.body_md && (
                      <div className="mt-1">
                        <p className={`text-xs text-gray-500 dark:text-gray-400 leading-relaxed ${!expanded[u.id] ? 'line-clamp-2' : ''}`}>
                          {u.body_md}
                        </p>
                        {u.body_md.length > 120 && (
                          <button
                            onClick={() => toggle(u.id)}
                            className="text-[10px] text-accent hover:underline mt-0.5"
                          >
                            {expanded[u.id] ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}
                    {u.photos?.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {u.photos.slice(0, 4).map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-white/8"
                          />
                        ))}
                        {u.photos.length > 4 && (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-white/8 flex items-center justify-center border border-gray-200 dark:border-white/8">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">+{u.photos.length - 4}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
