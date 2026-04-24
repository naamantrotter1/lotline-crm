/**
 * SmsThread.jsx
 * Phase 12: Inline SMS conversation panel for Contact / Deal detail.
 * Shows message history + compose input.
 */
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, AlertCircle, CheckCheck, Check, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { fetchThread, sendSms, checkOptOut, SMS_STATUS } from '../../lib/smsData';

function StatusIcon({ status }) {
  if (status === 'delivered') return <CheckCheck size={11} className="text-blue-400" />;
  if (status === 'sent')      return <Check size={11} className="text-blue-300" />;
  if (status === 'pending' || status === 'queued') return <Clock size={11} className="text-gray-300" />;
  if (status === 'failed' || status === 'undelivered') return <AlertCircle size={11} className="text-red-400" />;
  return null;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SmsThread({ contactId, contactPhone, contactName }) {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [draft, setDraft]         = useState('');
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState(null);
  const [optedOut, setOptedOut]   = useState(false);
  const bottomRef = useRef(null);
  const canSend = can('sms.send');

  useEffect(() => {
    if (!activeOrgId || !contactId) return;
    setLoading(true);
    fetchThread(activeOrgId, contactId).then(msgs => {
      setMessages(msgs);
      setLoading(false);
    });
    checkOptOut(activeOrgId, contactPhone).then(setOptedOut);
  }, [activeOrgId, contactId, contactPhone]);

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
      orgId: activeOrgId,
      userId: profile?.id,
      to: contactPhone,
      body,
      contactId,
    });

    setSending(false);
    if (sendErr && sendErr !== 'quiet_hours' && sendErr !== 'opted_out') {
      setError(sendErr);
      setDraft(body);
    } else if (sendErr === 'quiet_hours') {
      setError('Quiet hours active (9 PM – 8 AM). Message not sent.');
      setDraft(body);
    } else if (data) {
      setMessages(prev => [...prev, data]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!contactPhone) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <MessageSquare size={20} className="text-gray-200 mb-2" />
        <p className="text-xs text-gray-300">No phone number on file</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '320px' }}>
      {/* Opted-out banner */}
      {optedOut && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border-b border-red-100 text-xs text-red-600">
          <AlertCircle size={12} />
          {contactName} has opted out of SMS.
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50 rounded-t-xl">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare size={20} className="text-gray-200 mb-1.5" />
            <p className="text-xs text-gray-300">No messages yet</p>
          </div>
        ) : (
          messages.map(msg => {
            const isOut = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isOut
                    ? 'bg-accent text-white rounded-br-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${isOut ? 'text-white/60' : 'text-gray-300'}`}>
                      {fmtTime(msg.created_at)}
                    </span>
                    {isOut && <StatusIcon status={msg.status} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 text-xs text-red-500 bg-red-50 border-t border-red-100 flex items-center gap-1.5">
          <AlertCircle size={11} />{error}
        </div>
      )}

      {/* Compose */}
      <div className="flex items-end gap-2 p-2 bg-white border-t border-gray-100 rounded-b-xl">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={optedOut ? 'Contact has opted out' : canSend ? 'Type a message…' : 'No permission to send'}
          disabled={!canSend || optedOut}
          rows={2}
          className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-gray-50 disabled:text-gray-300"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending || !canSend || optedOut}
          className="p-2.5 rounded-xl text-white disabled:opacity-40 transition-colors flex-shrink-0"
          style={{ backgroundColor: '#c9703a' }}
        >
          {sending
            ? <Loader2 size={15} className="animate-spin" />
            : <Send size={15} />
          }
        </button>
      </div>
    </div>
  );
}
