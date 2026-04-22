import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MessageSquare, Mail, MailOpen } from 'lucide-react';
import { fetchMyMessages, markMessageRead } from '../../lib/investorPortalData';

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const now  = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MessageThread({ message, onRead }) {
  const [open, setOpen] = useState(false);
  const isRead = !!message.read_at;

  const handleOpen = async () => {
    setOpen(v => !v);
    if (!isRead && !open) {
      await markMessageRead(message.id);
      onRead(message.id);
    }
  };

  return (
    <div
      className={`border-b border-white/5 last:border-0 transition-colors ${!isRead ? 'bg-accent/3' : ''}`}
    >
      <button
        onClick={handleOpen}
        className="w-full flex items-start gap-4 px-5 py-4 hover:bg-white/3 transition-colors text-left"
      >
        <div className="mt-0.5 flex-shrink-0">
          {isRead
            ? <MailOpen size={16} className="text-gray-600" />
            : <Mail size={16} className="text-accent" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm truncate ${isRead ? 'text-gray-300' : 'text-white font-semibold'}`}>
              {message.subject}
            </p>
            <span className="text-[10px] text-gray-500 flex-shrink-0">{fmtDate(message.created_at)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            From: {message.profiles?.name ?? 'LotLine Team'}
          </p>
          {!open && (
            <p className="text-xs text-gray-600 mt-1 truncate">{message.body}</p>
          )}
        </div>
        {!isRead && (
          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          <div className="bg-[#0f1117] rounded-xl p-5 border border-white/5">
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{message.body}</p>
            <p className="text-[10px] text-gray-600 mt-4">
              {new Date(message.created_at).toLocaleString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestorMessages() {
  const { investor }           = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    if (!investor) return;
    fetchMyMessages(investor.id).then(({ messages: m }) => {
      setMessages(m);
      setLoading(false);
    });
  }, [investor]);

  const unread = messages.filter(m => !m.read_at).length;

  const handleRead = (id) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m));
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Messages</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unread > 0 ? `${unread} unread` : 'All caught up'} · {messages.length} total
          </p>
        </div>
        {unread > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            {unread} new
          </div>
        )}
      </div>

      {/* Messages */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="bg-[#1c2130] rounded-xl p-12 text-center border border-white/8">
          <MessageSquare size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No messages yet.</p>
          <p className="text-gray-600 text-xs mt-1">Your team will send updates and announcements here.</p>
        </div>
      ) : (
        <div className="bg-[#1c2130] rounded-xl border border-white/8 overflow-hidden">
          {messages.map(msg => (
            <MessageThread key={msg.id} message={msg} onRead={handleRead} />
          ))}
        </div>
      )}
    </div>
  );
}
