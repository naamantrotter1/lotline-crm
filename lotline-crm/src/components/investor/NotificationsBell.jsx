import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Briefcase, DollarSign, FileText, Bell as BellIcon } from 'lucide-react';
import { fetchNotifications, markNotificationRead } from '../../lib/investorPortalData';

const TYPE_ICON = {
  deal_update:   Briefcase,
  distribution:  DollarSign,
  document:      FileText,
};

function fmtDate(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsBell({ investorId }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]  = useState(false);
  const ref              = useRef(null);

  useEffect(() => {
    if (!investorId) return;
    fetchNotifications(investorId).then(({ notifications: n }) => setNotifications(n ?? []));
  }, [investorId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifications.filter(n => !n.read_at).length;

  const handleRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
    await Promise.all(unreadIds.map(id => markNotificationRead(id)));
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/8 transition-colors text-gray-400 hover:text-white"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#1c2130] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-accent hover:underline">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <BellIcon size={24} className="text-gray-700" />
                <p className="text-xs text-gray-600">No notifications yet.</p>
              </div>
            ) : notifications.map(n => {
              const Icon = TYPE_ICON[n.type] ?? BellIcon;
              const isRead = !!n.read_at;
              return (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                    isRead ? 'opacity-60' : 'bg-accent/5'
                  }`}
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center mt-0.5">
                    <Icon size={13} className={isRead ? 'text-gray-500' : 'text-accent'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white leading-snug">{n.title}</p>
                    {n.body && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[9px] text-gray-600 mt-1">{fmtDate(n.created_at)}</p>
                  </div>
                  {!isRead && (
                    <button
                      onClick={() => handleRead(n.id)}
                      className="flex-shrink-0 text-gray-600 hover:text-accent mt-0.5"
                      title="Mark read"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
