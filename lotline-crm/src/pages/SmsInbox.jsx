/**
 * SmsInbox.jsx
 * Phase 12: Full SMS inbox — conversation list + thread view.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Search, Send, Loader2, Plus,
  AlertCircle, CheckCheck, Check, Clock, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchInbox, fetchThread, sendSms, checkOptOut,
} from '../lib/smsData';
import { supabase } from '../lib/supabase';

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function StatusIcon({ status, size = 12 }) {
  if (status === 'delivered') return <CheckCheck size={size} className="text-blue-400" />;
  if (status === 'sent')      return <Check size={size} className="text-blue-300" />;
  if (status === 'pending' || status === 'queued') return <Clock size={size} className="text-gray-300" />;
  if (status === 'failed' || status === 'undelivered') return <AlertCircle size={size} className="text-red-400" />;
  return null;
}

function contactName(msg) {
  const c = msg.contacts;
  if (!c) return msg.to_number || msg.from_number || 'Unknown';
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone || 'Unknown';
}

function initials(msg) {
  const n = contactName(msg);
  return n.slice(0, 2).toUpperCase();
}

// ── Thread panel ──────────────────────────────────────────────────────────────
function ThreadPanel({ thread: convMsg, orgId, userId, canSend, onNewMsg }) {
  const navigate = useNavigate();
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [draft, setDraft]         = useState('');
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState(null);
  const [optedOut, setOptedOut]   = useState(false);
  const bottomRef = useRef(null);
  const contactId = convMsg?.contact_id;
  const contactPhone = convMsg?.contacts?.phone || convMsg?.to_number || convMsg?.from_number;
  const name = contactName(convMsg || {});

  useEffect(() => {
    if (!contactId) return;
    setLoading(true);
    fetchThread(orgId, contactId).then(msgs => {
      setMessages(msgs);
      setLoading(false);
    });
    checkOptOut(orgId, contactPhone).then(setOptedOut);
  }, [contactId, orgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!draft.trim() || sending || !canSend || optedOut) return;
    setSending(true);
    setError(null);
    const body = draft.trim();
    setDraft('');

    const { data, error: sendErr } = await sendSms({
      orgId, userId,
      to: contactPhone,
      body,
      contactId,
    });

    setSending(false);
    if (sendErr === 'quiet_hours') {
      setError('Quiet hours (9 PM – 8 AM). Message not sent.');
      setDraft(body);
    } else if (sendErr) {
      setError(sendErr);
      setDraft(body);
    } else if (data) {
      setMessages(prev => [...prev, data]);
      onNewMsg?.(data);
    }
  };

  if (!convMsg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <MessageSquare size={36} className="text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-400">Select a conversation</p>
        <p className="text-xs text-gray-300 mt-1">or start a new SMS</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thread header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{name}</p>
          <p className="text-xs text-gray-400">{contactPhone}</p>
        </div>
        {convMsg.contact_id && (
          <button
            onClick={() => navigate(`/contacts/${convMsg.contact_id}`)}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            View contact <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Opted-out banner */}
      {optedOut && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-xs text-red-600">
          <AlertCircle size={12} />{name} has opted out of SMS.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: '#f8f7f4' }}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : messages.map(msg => {
          const isOut = msg.direction === 'outbound';
          return (
            <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                isOut
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
              }`}>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : ''}`}>
                  <span className={`text-[10px] ${isOut ? 'text-white/60' : 'text-gray-300'}`}>
                    {timeAgo(msg.created_at)}
                  </span>
                  {isOut && <StatusIcon status={msg.status} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-500 bg-red-50 flex items-center gap-1.5">
          <AlertCircle size={11} />{error}
        </div>
      )}

      {/* Compose */}
      <div className="flex-shrink-0 flex items-end gap-2 p-3 bg-white border-t border-gray-100">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={optedOut ? 'Contact has opted out' : canSend ? 'Type a message… (Enter to send)' : 'No permission to send'}
          disabled={!canSend || optedOut}
          rows={2}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-gray-50"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending || !canSend || optedOut}
          className="p-3 rounded-xl text-white disabled:opacity-40"
          style={{ backgroundColor: '#c9703a' }}
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SmsInbox() {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [inbox, setInbox]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [query, setQuery]         = useState('');
  const canSend = can('sms.send');

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    fetchInbox(activeOrgId).then(d => { setInbox(d); setLoading(false); });
  }, [activeOrgId]);

  const filtered = inbox.filter(msg => {
    const n = contactName(msg).toLowerCase();
    const q = query.toLowerCase();
    return !q || n.includes(q) || (msg.body || '').toLowerCase().includes(q);
  });

  const handleNewMsg = () => {
    fetchInbox(activeOrgId).then(setInbox);
  };

  return (
    <div className="flex h-full bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
      {/* Left: conversation list */}
      <div className="w-72 flex-shrink-0 border-r border-gray-100 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800">SMS Inbox</h2>
            <button
              onClick={() => navigate('/sms/campaigns')}
              className="text-xs text-accent hover:underline"
            >
              Campaigns
            </button>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageSquare size={24} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-300">{query ? 'No results' : 'No conversations yet'}</p>
            </div>
          ) : filtered.map(msg => {
            const name = contactName(msg);
            const isSelected = selected?.contact_id === msg.contact_id;
            const isOut = msg.direction === 'outbound';
            return (
              <button
                key={msg.id}
                onClick={() => setSelected(msg)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${isSelected ? 'bg-orange-50 border-l-2 border-l-accent' : ''}`}
              >
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-accent">{initials(msg)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-800 truncate">{name}</p>
                    <span className="text-[10px] text-gray-300 ml-1">{timeAgo(msg.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {isOut && <StatusIcon status={msg.status} size={10} />}
                    <p className="text-[11px] text-gray-400 truncate">{msg.body}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: thread */}
      <ThreadPanel
        thread={selected}
        orgId={activeOrgId}
        userId={profile?.id}
        canSend={canSend}
        onNewMsg={handleNewMsg}
      />
    </div>
  );
}
