/**
 * DealThreads — Slack-style threaded chat for a deal.
 * Uses Supabase Realtime for live updates.
 * @mentions auto-complete, reactions, typing indicators in this file.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Plus, ChevronDown, ChevronRight,
  SmilePlus, Check, X, Edit3, Trash2, AtSign, Hash,
  CheckCircle2, Circle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const d = new Date(dateStr), now = new Date(), diff = now - d;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ name, size = 'sm' }) {
  const init = (name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-[12px]';
  return (
    <div className={`${sz} rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 font-bold text-accent`}>
      {init}
    </div>
  );
}

// ── Reaction picker (minimal) ─────────────────────────────────────────────────
const QUICK_REACTIONS = ['👍','👎','❤️','🔥','✅','🚀'];

function ReactionBar({ reactions = {}, messageId, currentUserId, onReact }) {
  const [show, setShow] = useState(false);
  const counts = Object.entries(reactions).filter(([, users]) => users.length > 0);

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {counts.map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReact(messageId, emoji)}
          className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${
            users.includes(currentUserId)
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span>{emoji}</span>
          <span className="font-semibold">{users.length}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setShow(s => !s)}
          className="p-1 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded transition-colors"
        >
          <SmilePlus size={12} />
        </button>
        {show && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1.5 z-10">
            {QUICK_REACTIONS.map(e => (
              <button key={e} onClick={() => { onReact(messageId, e); setShow(false); }} className="text-base hover:scale-110 transition-transform">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single message ────────────────────────────────────────────────────────────
function Message({ msg, currentUserId, orgMembers, onReact, onEdit, onDelete }) {
  const [hovering, setHovering] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(msg.body);
  const isOwn = msg.author_id === currentUserId;

  const commitEdit = async () => {
    if (!draft.trim() || draft === msg.body) { setEditing(false); return; }
    await onEdit(msg.id, draft.trim());
    setEditing(false);
  };

  // Render @mentions highlighted
  const renderBody = (text) => {
    if (!text) return null;
    return text.split(/(@\w[\w\s]*\w)/g).map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-accent font-semibold">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  if (msg.deleted_at) {
    return (
      <div className="flex gap-2 py-1.5">
        <div className="w-6 h-6 flex-shrink-0" />
        <p className="text-[12px] text-gray-300 italic">Message deleted</p>
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 py-1.5 group relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Avatar name={msg._authorName} />
      <div className="flex-1 min-w-0">
        {/* Author + time */}
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-[12px] font-semibold text-gray-800">{msg._authorName || 'Team member'}</span>
          <span className="text-[10px] text-gray-400">{timeAgo(msg.created_at)}</span>
          {msg.edited_at && <span className="text-[9px] text-gray-300 italic">(edited)</span>}
        </div>

        {/* Body */}
        {editing ? (
          <div className="space-y-1">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              rows={2}
              className="w-full text-[13px] text-gray-800 border border-accent/40 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
            />
            <div className="flex gap-1.5">
              <button onClick={commitEdit} className="text-[11px] text-white bg-accent px-2.5 py-1 rounded-md font-semibold">Save</button>
              <button onClick={() => { setDraft(msg.body); setEditing(false); }} className="text-[11px] text-gray-500 px-2 py-1 rounded-md hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {renderBody(msg.body)}
          </p>
        )}

        {/* Reactions */}
        {!editing && (
          <ReactionBar
            reactions={msg.reactions || {}}
            messageId={msg.id}
            currentUserId={currentUserId}
            onReact={onReact}
          />
        )}
      </div>

      {/* Hover actions */}
      {hovering && !editing && (
        <div className="absolute right-0 top-1 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 z-10">
          {isOwn && (
            <>
              <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-gray-700 rounded" title="Edit">
                <Edit3 size={12} />
              </button>
              <button onClick={() => onDelete(msg.id)} className="p-1 text-gray-400 hover:text-red-500 rounded" title="Delete">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mention autocomplete ──────────────────────────────────────────────────────
function MentionMenu({ query, members, onSelect, style }) {
  const filtered = members.filter(m =>
    m.name?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  if (!filtered.length) return null;

  return (
    <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden" style={style}>
      {filtered.map(m => (
        <button
          key={m.id}
          onClick={() => onSelect(m)}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] hover:bg-gray-50 transition-colors"
        >
          <Avatar name={m.name} size="sm" />
          <span className="font-medium text-gray-800">{m.name}</span>
        </button>
      ))}
    </div>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────
function ThreadComposer({ onSend, orgMembers, placeholder = 'Reply…' }) {
  const [text, setText]           = useState('');
  const [mentionQ, setMentionQ]   = useState(null); // null or query string
  const [cursorPos, setCursorPos] = useState(0);
  const textRef                   = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    const pos = e.target.selectionStart;
    setCursorPos(pos);

    // Detect @mention trigger
    const before = val.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    setMentionQ(match ? match[1] : null);
  };

  const insertMention = (member) => {
    const before = text.slice(0, cursorPos);
    const after  = text.slice(cursorPos);
    const replaced = before.replace(/@\w*$/, `@${member.name} `);
    setText(replaced + after);
    setMentionQ(null);
    setTimeout(() => textRef.current?.focus(), 0);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') setMentionQ(null);
  };

  const submit = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    setMentionQ(null);
  };

  return (
    <div className="relative border-t border-gray-100 p-3 bg-white flex-shrink-0">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder={placeholder}
            rows={1}
            className="w-full text-[13px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 resize-none transition-all"
            style={{ minHeight: '36px', maxHeight: '120px', overflow: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
          {mentionQ !== null && (
            <MentionMenu
              query={mentionQ}
              members={orgMembers}
              onSelect={insertMention}
              style={{ bottom: '100%', left: 0, right: 0, marginBottom: '4px' }}
            />
          )}
        </div>
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="flex-shrink-0 w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-0.5"
        >
          <Send size={14} />
        </button>
      </div>
      <p className="text-[10px] text-gray-300 mt-1">Enter to send · Shift+Enter for new line · @name to mention</p>
    </div>
  );
}

// ── Single thread view ────────────────────────────────────────────────────────
function ThreadView({ thread, orgMembers, currentUser, onResolve, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const bottomRef               = useRef(null);
  const { activeOrgId }         = useAuth();

  const loadMessages = useCallback(async () => {
    if (!supabase || !thread?.id) return;
    const { data } = await supabase
      .from('deal_thread_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    const withNames = (data || []).map(m => ({
      ...m,
      _authorName: orgMembers.find(u => u.id === m.author_id)?.name || 'Team member',
    }));
    setMessages(withNames);
    setLoading(false);
  }, [thread?.id, orgMembers]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !thread?.id) return;
    const channel = supabase
      .channel(`thread-${thread.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deal_thread_messages',
        filter: `thread_id=eq.${thread.id}`,
      }, () => loadMessages())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [thread?.id, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const sendMessage = async (body) => {
    if (!supabase || !body.trim()) return;
    const mentions = [...body.matchAll(/@([\w\s]+)/g)].map(m => {
      const member = orgMembers.find(u => u.name?.toLowerCase() === m[1].trim().toLowerCase());
      return member ? { userId: member.id, name: member.name } : null;
    }).filter(Boolean);

    await supabase.from('deal_thread_messages').insert({
      thread_id:       thread.id,
      organization_id: activeOrgId,
      author_id:       currentUser.id,
      body,
      mentions,
    });
  };

  const handleReact = async (msgId, emoji) => {
    if (!supabase) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const reactions = { ...(msg.reactions || {}) };
    const users = reactions[emoji] || [];
    if (users.includes(currentUser.id)) {
      reactions[emoji] = users.filter(u => u !== currentUser.id);
    } else {
      reactions[emoji] = [...users, currentUser.id];
    }
    await supabase.from('deal_thread_messages').update({ reactions }).eq('id', msgId);
  };

  const handleEdit = async (msgId, newBody) => {
    if (!supabase) return;
    await supabase.from('deal_thread_messages')
      .update({ body: newBody, edited_at: new Date().toISOString() })
      .eq('id', msgId);
  };

  const handleDelete = async (msgId) => {
    if (!supabase) return;
    await supabase.from('deal_thread_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', msgId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <ChevronDown size={16} className="rotate-90" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-800 truncate">{thread.title || 'Thread'}</p>
          <p className="text-[11px] text-gray-400">{thread.message_count} {thread.message_count === 1 ? 'reply' : 'replies'}</p>
        </div>
        {thread.resolved_at
          ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">Resolved</span>
          : (
            <button
              onClick={() => onResolve(thread.id)}
              className="text-[10px] font-medium text-gray-500 border border-gray-200 rounded-full px-2 py-0.5 hover:border-green-400 hover:text-green-600 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 size={11} /> Resolve
            </button>
          )
        }
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
        {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}
        {!loading && messages.length === 0 && (
          <p className="text-center text-[12px] text-gray-300 py-8">No messages yet. Start the conversation.</p>
        )}
        {messages.map(msg => (
          <Message
            key={msg.id}
            msg={msg}
            currentUserId={currentUser?.id}
            orgMembers={orgMembers}
            onReact={handleReact}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <ThreadComposer onSend={sendMessage} orgMembers={orgMembers} placeholder="Reply to thread…" />
    </div>
  );
}

// ── Thread list item ──────────────────────────────────────────────────────────
function ThreadListItem({ thread, onOpen }) {
  return (
    <button
      onClick={() => onOpen(thread)}
      className="w-full flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-left transition-colors group"
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${thread.resolved_at ? 'bg-green-400' : 'bg-accent'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-accent">{thread.title || 'Untitled thread'}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(thread.last_message_at || thread.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-gray-400">{thread.message_count} {thread.message_count === 1 ? 'reply' : 'replies'}</span>
          {thread.resolved_at && <span className="text-[10px] font-semibold text-green-600">Resolved</span>}
        </div>
      </div>
      <ChevronRight size={13} className="text-gray-300 group-hover:text-accent flex-shrink-0 mt-1" />
    </button>
  );
}

// ── Main DealThreads component ────────────────────────────────────────────────
export default function DealThreads({ deal, readOnly }) {
  const { profile, activeOrgId } = useAuth();
  const { can } = usePermissions();

  const [threads,    setThreads]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [creating,   setCreating]   = useState(false);
  const [newTitle,   setNewTitle]   = useState('');
  const [orgMembers, setOrgMembers] = useState([]);

  // Load org members for @mentions
  useEffect(() => {
    if (!supabase || !activeOrgId) return;
    supabase
      .from('memberships')
      .select('user_id, profiles(id, first_name, last_name)')
      .eq('organization_id', activeOrgId)
      .eq('status', 'active')
      .then(({ data }) => {
        if (data) {
          setOrgMembers(data
            .filter(m => m.profiles)
            .map(m => ({
              id:   m.user_id,
              name: [m.profiles.first_name, m.profiles.last_name].filter(Boolean).join(' ') || 'Team member',
            }))
          );
        }
      });
  }, [activeOrgId]);

  // Load threads
  const loadThreads = useCallback(async () => {
    if (!supabase || !deal?.id) return;
    const { data } = await supabase
      .from('deal_threads')
      .select('*')
      .eq('deal_id', deal.id)
      .is('archived_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    setThreads(data || []);
    setLoading(false);
  }, [deal?.id]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  // Keep a stable ref to loadThreads so the Realtime effect never needs to
  // re-subscribe just because loadThreads was recreated by useCallback.
  const loadThreadsRef = useRef(loadThreads);
  useEffect(() => { loadThreadsRef.current = loadThreads; }, [loadThreads]);

  // Realtime — only re-subscribe when deal.id changes, not on every render.
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const ch = supabase
      .channel(`deal-threads-${deal.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deal_threads',
        filter: `deal_id=eq.${deal.id}`,
      }, () => loadThreadsRef.current())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createThread = async () => {
    if (!supabase || !newTitle.trim() || !activeOrgId) return;
    const { data } = await supabase
      .from('deal_threads')
      .insert({
        organization_id: activeOrgId,
        deal_id:         deal.id,
        target_type:     'deal',
        target_id:       String(deal.id),
        title:           newTitle.trim(),
        created_by:      profile?.id,
      })
      .select()
      .single();

    setNewTitle('');
    setCreating(false);
    if (data) setActiveThread(data);
  };

  const resolveThread = async (threadId) => {
    if (!supabase) return;
    await supabase.from('deal_threads').update({
      resolved_at: new Date().toISOString(),
      resolved_by: profile?.id,
    }).eq('id', threadId);
    loadThreads();
    setActiveThread(prev => prev?.id === threadId ? { ...prev, resolved_at: new Date().toISOString() } : prev);
  };

  if (activeThread) {
    return (
      <ThreadView
        thread={activeThread}
        orgMembers={orgMembers}
        currentUser={profile}
        onResolve={resolveThread}
        onBack={() => setActiveThread(null)}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-gray-400" />
          <p className="text-[13px] font-semibold text-gray-700">Threads</p>
          {threads.length > 0 && (
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{threads.length}</span>
          )}
        </div>
        {!readOnly && can('thread.create') && (
          <button
            onClick={() => setCreating(c => !c)}
            className="flex items-center gap-1 text-[12px] font-semibold text-accent hover:bg-accent/5 px-2 py-1 rounded-lg transition-colors"
          >
            <Plus size={13} /> New thread
          </button>
        )}
      </div>

      {/* New thread form */}
      {creating && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createThread(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="Thread title…"
            className="w-full text-[13px] text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={createThread} disabled={!newTitle.trim()} className="text-[12px] text-white bg-accent px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40">Create</button>
            <button onClick={() => setCreating(false)} className="text-[12px] text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}
        {!loading && threads.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[13px] text-gray-400">No threads yet</p>
            {!readOnly && <p className="text-[11px] text-gray-300 mt-1">Start a thread to discuss this deal with your team</p>}
          </div>
        )}
        {threads.map(t => (
          <ThreadListItem key={t.id} thread={t} onOpen={setActiveThread} />
        ))}
      </div>
    </div>
  );
}
