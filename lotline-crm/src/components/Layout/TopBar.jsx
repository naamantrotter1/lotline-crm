import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Bell, Moon, Sun, Search, X, Trash2, Settings, LogOut, UserPlus, CheckSquare, HelpCircle, AtSign } from 'lucide-react';
import HelpModal from '../Help/HelpModal';
import CreateContactModal from '../Contacts/CreateContactModal';
import CreateTaskModal from '../Tasks/CreateTaskModal';
import { useNavigate } from 'react-router-dom';
import { ALL_DEALS } from '../../data/deals';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchNotifications,
  markAllNotifsRead,
  clearAllNotifs,
  subscribeToNotifications,
} from '../../lib/notificationsData';
import { supabase } from '../../lib/supabase';
import JvScopeSwitcher from '../JV/JvScopeSwitcher';

function GlobalSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // "/" shortcut to focus
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setResults([]); setOpen(false); return; }

    const seen = new Set();
    const deals = ALL_DEALS.filter(d => {
      const text = [d.address, d.county, d.state, d.investor, d.financing, d.ownerName, d.sellerName, d.parcelId, d.zip, ...(d.tags || [])].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    }).slice(0, 6).map(d => ({ type: 'deal', id: d.id, label: d.address, sub: [d.county, d.state].filter(Boolean).join(', '), pipeline: d.pipeline, stage: d.stage }));

    // Unique investors
    const investors = ALL_DEALS.filter(d => d.investor && d.investor.toLowerCase().includes(q) && !seen.has(d.investor) && seen.add(d.investor))
      .slice(0, 3).map(d => ({ type: 'investor', id: d.investor, label: d.investor, sub: `${ALL_DEALS.filter(x => x.investor === d.investor).length} deals` }));

    // Unique counties
    const countySet = new Set();
    const counties = ALL_DEALS.filter(d => d.county && d.county.toLowerCase().includes(q) && !countySet.has(d.county) && countySet.add(d.county))
      .slice(0, 3).map(d => ({ type: 'county', id: d.county, label: `${d.county} County`, sub: d.state }));

    setResults([...deals, ...investors, ...counties]);
    setOpen(true);
  }, [query]);

  const handleSelect = (r) => {
    setOpen(false);
    setQuery('');
    if (r.type === 'deal') {
      if (r.pipeline === 'deal-overview') navigate(`/deal/${r.id}`);
      else if (r.pipeline === 'land-acquisition') navigate('/pipelines/land');
      else navigate('/pipelines/deal-overview');
    }
  };

  const typeIcon = (t) => t === 'deal' ? '📋' : t === 'investor' ? '👤' : '📍';
  const typeColor = (t) => t === 'deal' ? 'text-blue-600' : t === 'investor' ? 'text-purple-600' : 'text-green-600';

  return (
    <div className="relative flex-1 max-w-xl mx-4">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search deals, contacts, investors, counties..."
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none"
        />
        {query ? (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">/</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <span className="text-base">{typeIcon(r.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{r.label}</p>
                {r.sub && <p className="text-xs text-gray-400 truncate">{r.sub}</p>}
              </div>
              <span className={`text-xs font-medium capitalize ${typeColor(r.type)}`}>{r.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Mentions tab inside the NotifPanel ────────────────────────────────────────
function MentionsTab({ onNavigate }) {
  const [mentions, setMentions] = useState([]);
  const [filter,   setFilter]   = useState('unread'); // 'unread' | 'all'
  const [loading,  setLoading]  = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;
      const res = await fetch(`/api/mentions?status=${filter}&limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { mentions: data } = await res.json();
        setMentions(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    await fetch(`/api/mentions/read?id=${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    setMentions(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m));
  };

  const markAllRead = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    await fetch('/api/mentions/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    setMentions(prev => prev.map(m => ({ ...m, read_at: m.read_at || new Date().toISOString() })));
  };

  const goToMention = (m) => {
    markRead(m.id);
    if (m.deal_id) {
      navigate(`/deal/${m.deal_id}?activity=${m.target_id}`);
    }
    onNavigate && onNavigate();
  };

  const unreadCount = mentions.filter(m => !m.read_at).length;

  return (
    <div>
      {/* Filter tabs + mark-all-read */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-50 dark:border-gray-700">
        <div className="flex gap-2">
          {['unread', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] font-semibold px-2 py-1 rounded-lg capitalize transition-colors ${
                filter === f ? 'bg-accent/10 text-accent' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] text-accent hover:text-accent/80 font-medium transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : mentions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No mentions yet</p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-700">
            {mentions.map(m => (
              <li key={m.id}>
                <button
                  onClick={() => goToMention(m)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    !m.read_at ? 'bg-accent/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-white leading-tight">
                      {m.author_name} mentioned you
                      {m.deal_address ? ` in ${m.deal_address}` : ''}
                    </p>
                    {!m.read_at && (
                      <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1" />
                    )}
                  </div>
                  {m.body_preview && (
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                      "{m.body_preview}"
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">{timeAgo(m.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const NOTIF_ICONS = {
  mention:      '💬',
  task_assigned:'✅',
  task_due:     '⏰',
  task_overdue: '⏰',
  stage_change: '➡️',
  new_note:     '📝',
  new_document: '📎',
  deal_dead:    '❌',
  general:      '🔔',
};

function NotifPanel({ onClose, onRead, unreadMentions }) {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' | 'mentions'
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications().then(data => { setNotifs(data); setLoading(false); });
    markAllNotifsRead().then(() => onRead && onRead());
  }, []);

  const handleNotifClick = (n) => {
    // Use action_url if available (new format)
    if (n.action_url) {
      onClose();
      navigate(n.action_url);
      return;
    }
    // Legacy: entity_type-based navigation
    if (n.entity_type === 'activity_note' && n.entity_id) {
      try {
        const { dealId, noteId } = JSON.parse(n.entity_id);
        onClose();
        navigate(`/deal/${dealId}?activity=${noteId}`);
        return;
      } catch {}
    }
    if (n.entity_type === 'task') {
      onClose();
      navigate('/tasks');
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`text-sm font-semibold px-2 py-1 rounded-lg transition-colors ${
              activeTab === 'notifications'
                ? 'text-sidebar dark:text-white bg-gray-100 dark:bg-gray-800'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('mentions')}
            className={`relative flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-lg transition-colors ${
              activeTab === 'mentions'
                ? 'text-sidebar dark:text-white bg-gray-100 dark:bg-gray-800'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <AtSign size={13} />
            Mentions
            {unreadMentions > 0 && (
              <span className="w-4 h-4 bg-accent text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none">
                {unreadMentions > 9 ? '9+' : unreadMentions}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'notifications' && notifs.length > 0 && (
            <button
              onClick={() => { clearAllNotifs(); setNotifs([]); onRead && onRead(); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
              title="Clear all"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'notifications' ? (
        <div className="max-h-[500px] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
          ) : notifs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No notifications yet</p>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-700">
              {notifs.map(n => {
                const clickable = !!(n.action_url || n.entity_type === 'activity_note' || n.entity_type === 'task' || n.entity_type === 'deal');
                const icon = NOTIF_ICONS[n.type] || NOTIF_ICONS.general;
                return (
                  <li
                    key={n.id}
                    onClick={() => clickable && handleNotifClick(n)}
                    className={`px-4 py-3 flex gap-3 ${!n.read ? 'bg-accent/5' : ''} ${clickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors' : ''}`}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-medium text-sidebar dark:text-white leading-tight">{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1" />}
                      </div>
                      {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">"{n.body}"</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {n.deal_address && <span className="font-medium text-gray-500">{n.deal_address} · </span>}
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <MentionsTab onNavigate={onClose} />
      )}
    </div>
  );
}

export default function TopBar({ onToggleSidebar }) {
  const { profile } = useAuth();
  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email ? profile.email.slice(0, 2).toUpperCase() : '?');

  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateTask, setShowCreateTask]       = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  );
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [showUserMenu,  setShowUserMenu]  = useState(false);
  const [showHelp,      setShowHelp]      = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const bellRef     = useRef(null);
  const userMenuRef = useRef(null);

  // '?' shortcut to open help modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '?' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        setShowHelp(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load initial unread counts and subscribe to realtime inserts
  useEffect(() => {
    if (!profile?.id) return;

    // Initial notification count
    import('../../lib/notificationsData').then(({ fetchUnreadCount }) => {
      fetchUnreadCount().then(setUnreadCount);
    });

    // Initial mentions unread count
    supabase?.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      fetch('/api/mentions?status=unread&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.ok ? r.json() : null)
        .then(j => { if (j?.unread_count != null) setUnreadMentions(j.unread_count); });
    });

    // Realtime: increment notification badge
    const notifChannel = subscribeToNotifications(profile.id, () => {
      setUnreadCount(c => c + 1);
    });

    // Realtime: increment mention badge when a new mention row arrives
    const mentionChannel = supabase
      ?.channel(`mentions-bell-${profile.id}-${Date.now()}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'mentions',
        filter: `mentioned_user_id=eq.${profile.id}`,
      }, () => setUnreadMentions(c => c + 1))
      .subscribe();

    return () => {
      notifChannel?.unsubscribe();
      supabase?.removeChannel(mentionChannel);
    };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close panels on outside click
  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  // Show avatar photo if profile has one
  const avatarUrl = profile?.avatar_url;

  return (
    <>
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
      >
        <Menu size={18} />
      </button>

      <GlobalSearch />

      <div className="flex items-center gap-1 flex-shrink-0">
        <JvScopeSwitcher />

        {/* Quick-add contact */}
        <button
          onClick={() => setShowCreateContact(true)}
          title="New Contact (C)"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <UserPlus size={16} />
        </button>

        {/* Quick-add task */}
        <button
          onClick={() => setShowCreateTask(true)}
          title="New Task (T)"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <CheckSquare size={16} />
        </button>

        <button
          onClick={() => setShowHelp(v => !v)}
          title="Help & Shortcuts (?)"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <HelpCircle size={16} />
        </button>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setShowNotifs(v => !v)}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Bell size={16} />
            {(unreadCount + unreadMentions) > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {(unreadCount + unreadMentions) > 9 ? '9+' : (unreadCount + unreadMentions)}
              </span>
            )}
          </button>
          {showNotifs && (
            <NotifPanel
              onClose={() => setShowNotifs(false)}
              onRead={() => setUnreadCount(0)}
              unreadMentions={unreadMentions}
            />
          )}
        </div>

        <div className="relative ml-1" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold overflow-hidden hover:ring-2 hover:ring-accent/50 transition-all"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              : initials
            }
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden py-1">
              <button
                onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings size={14} className="text-gray-400" />
                Settings
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button
                onClick={() => { setShowUserMenu(false); signOut().then(() => navigate('/login', { replace: true })); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {showCreateContact && (
      <CreateContactModal
        onClose={() => setShowCreateContact(false)}
        onCreated={(c) => { setShowCreateContact(false); navigate(`/contacts/${c.id}`); }}
      />
    )}
    {showCreateTask && (
      <CreateTaskModal
        onClose={() => setShowCreateTask(false)}
        onCreated={() => { setShowCreateTask(false); navigate('/tasks'); }}
      />
    )}
    {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
  </>
  );
}
