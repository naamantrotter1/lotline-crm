/**
 * Deal activity feed — notes, threaded replies, stage-change logs, and system events.
 *
 * Features:
 *   - DB-backed notes (activity_notes table) with real-time sync
 *   - Threaded replies: click "Reply" on any note to post inline
 *   - Auto-logged stage changes (note_type = 'stage_change') from DB trigger
 *   - @-mention autocomplete for notes and replies
 *   - Legacy localStorage notes (backward compat)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  StickyNote, RefreshCw, CheckCircle2, Mail, Phone,
  FileEdit, X, AtSign, BellOff, Bell, Pencil, MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { parseMentionSegments, buildMentionToken, extractMentions, validateMentions } from '../../lib/mentions';
import MentionChip from './MentionChip';

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  note:         { icon: StickyNote,   color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  stage_change: { icon: ArrowRight,   color: 'bg-purple-50 text-purple-600 border-purple-200' },
  created:      { icon: CheckCircle2, color: 'bg-green-50 text-green-600 border-green-200'   },
  field_edit:   { icon: FileEdit,     color: 'bg-blue-50 text-blue-600 border-blue-200'      },
  email:        { icon: Mail,         color: 'bg-indigo-50 text-indigo-600 border-indigo-200'},
  call:         { icon: Phone,        color: 'bg-cyan-50 text-cyan-600 border-cyan-200'      },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const s    = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function fmtNoteDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function monthLabel(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
    return 'This Month';
  }
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

// ── MentionAutocomplete ────────────────────────────────────────────────────────
function MentionAutocomplete({ results, selectedIdx, onSelect, anchorRef }) {
  const coords = (() => {
    if (!anchorRef?.current) return { top: 0, left: 0, width: 280 };
    const rect = anchorRef.current.getBoundingClientRect();
    return { top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) };
  })();

  if (!results) return null;

  return createPortal(
    <div
      className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      {results.length === 0 ? (
        <p className="text-[12px] text-gray-400 px-3 py-2.5">No teammates found</p>
      ) : (
        <ul>
          {results.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(m); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === selectedIdx ? 'bg-accent/10' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-[11px] font-bold text-accent flex-shrink-0">
                  {getInitials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{m.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize leading-none">
                      {m.role}
                    </span>
                    {m.is_jv_partner && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-500 leading-none">
                        JV partner
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}

// ── NoteBodyRenderer ──────────────────────────────────────────────────────────
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

function renderTextWithLinks(text, baseKey) {
  const parts = [];
  let last = 0;
  let match;
  MD_LINK_RE.lastIndex = 0;
  while ((match = MD_LINK_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={`${baseKey}-t${last}`}>{text.slice(last, match.index)}</span>);
    parts.push(
      <a key={`${baseKey}-l${match.index}`} href={match[2]} target="_blank" rel="noopener noreferrer"
        className="text-accent underline hover:text-accent/80 font-medium"
        onClick={e => e.stopPropagation()}
      >{match[1]}</a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={`${baseKey}-t${last}`}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : [<span key={baseKey}>{text}</span>];
}

function NoteBodyRenderer({ body, usersById = {}, authorName, createdAt }) {
  const segments = parseMentionSegments(body, usersById);
  return (
    <span className="text-[13px] text-gray-600 leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'mention') {
          const user = usersById[seg.userId] || {};
          return (
            <MentionChip
              key={i}
              userId={seg.userId}
              displayName={seg.displayName}
              role={user.role}
              email={user.email}
              mentionedBy={authorName}
              mentionedAt={createdAt}
            />
          );
        }
        return renderTextWithLinks(seg.content, i);
      })}
    </span>
  );
}

// ── ReplyCard ─────────────────────────────────────────────────────────────────
function ReplyCard({ reply, usersById, currentUserId, onDeleteReply }) {
  const authorName = reply.author_name || usersById[reply.author_id]?.name || 'Unknown';
  const avatarUrl  = usersById[reply.author_id]?.avatar_url;
  const isOwn      = reply.author_id === currentUserId;

  return (
    <div className="flex gap-2 mt-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden bg-accent/10">
        {avatarUrl
          ? <img src={avatarUrl} alt={authorName} className="w-full h-full object-cover" />
          : <span className="text-[9px] font-bold text-accent">{getInitials(authorName)}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[12px] font-semibold text-gray-800">{authorName}</span>
          <span className="text-[10px] text-gray-400">{fmtNoteDate(reply.created_at)}</span>
          {isOwn && onDeleteReply && (
            <button
              onClick={() => onDeleteReply(reply.id)}
              className="p-0.5 text-gray-300 hover:text-red-400 transition-colors rounded ml-auto"
              title="Delete reply"
            >
              <X size={10} />
            </button>
          )}
        </div>
        <p className="text-[12px] text-gray-600 leading-relaxed mt-0.5 whitespace-pre-wrap">{reply.body}</p>
      </div>
    </div>
  );
}

// ── Inline reply composer ─────────────────────────────────────────────────────
function ReplyComposer({ parentDbId, dealId, orgId, currentUserName, usersById, onSaved, onCancel }) {
  const [text, setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const textRef = useRef(null);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: reply, error: insertErr } = await supabase
        .from('activity_notes')
        .insert({
          organization_id: orgId,
          deal_id:         dealId,
          author_id:       session.user.id,
          author_name:     currentUserName || null,
          body:            text.trim(),
          parent_note_id:  parentDbId,
        })
        .select('id, author_id, author_name, body, created_at, parent_note_id, note_type')
        .single();

      if (insertErr) throw new Error(insertErr.message);
      setText('');
      onSaved(reply);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 pl-2 border-l-2 border-gray-100">
      <textarea
        ref={textRef}
        value={text}
        onChange={e => { setText(e.target.value); setError(null); }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
        placeholder="Write a reply…"
        rows={2}
        className="w-full text-[12px] text-gray-800 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-accent/40"
      />
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
      <div className="flex gap-2 mt-1.5 justify-end">
        <button
          onClick={onCancel}
          className="text-[11px] text-gray-500 px-2.5 py-1 rounded-lg hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!text.trim() || saving}
          className="text-[11px] text-white bg-accent px-2.5 py-1 rounded-lg hover:bg-accent/90 font-semibold disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Reply'}
        </button>
      </div>
    </div>
  );
}

// ── NoteComposer ──────────────────────────────────────────────────────────────
function NoteComposer({ dealId, orgId, onSaved, currentUser, currentUserName, mentionsEnabled }) {
  const [open,  setOpen]  = useState(false);
  const [text,  setText]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const [mentionQuery,   setMentionQuery]   = useState(null);
  const [mentionStart,   setMentionStart]   = useState(-1);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIdx,     setMentionIdx]     = useState(0);
  const [mentionMap,     setMentionMap]     = useState({}); // { name → userId }

  const textRef       = useRef(null);
  const allMembersRef = useRef([]);
  const sessionRef    = useRef(null);

  useEffect(() => {
    if (!orgId || !supabase) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      sessionRef.current = session;
      const currentUserId = session?.user?.id;
      const token = session?.access_token;

      if (token) {
        try {
          const res = await fetch('/api/team/members', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { members } = await res.json();
            allMembersRef.current = (members || [])
              .filter(m => m.user_id !== currentUserId && m.status === 'active')
              .map(m => ({
                id:            m.user_id,
                name:          m.profiles?.name
                               || [m.profiles?.first_name, m.profiles?.last_name].filter(Boolean).join(' ')
                               || m.profiles?.email?.split('@')[0]
                               || 'Team member',
                role:          m.role || 'member',
                avatar_url:    m.profiles?.avatar_url || null,
                is_jv_partner: false,
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            return;
          }
        } catch { /* fall through */ }
      }

      const { data: mems } = await supabase
        .from('memberships')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .eq('status', 'active');
      if (!mems?.length) return;
      const memberIds = mems.map(m => m.user_id);
      const roleMap   = Object.fromEntries(mems.map(m => [m.user_id, m.role]));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url')
        .in('id', memberIds);
      allMembersRef.current = (profiles || [])
        .filter(p => p.id !== currentUserId)
        .map(p => ({
          id:            p.id,
          name:          p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Team member',
          role:          roleMap[p.id] || 'member',
          avatar_url:    p.avatar_url || null,
          is_jv_partner: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    })();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchTeammates = useCallback((q) => {
    const all = allMembersRef.current;
    const ql  = q.trim().toLowerCase();
    const filtered = ql ? all.filter(m => m.name.toLowerCase().includes(ql)) : all;
    setMentionResults(filtered.slice(0, 10));
    setMentionIdx(0);
  }, []);

  const handleChange = (e) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart;
    setText(val);
    setError(null);
    const before = val.slice(0, cursor);
    const atIdx  = before.lastIndexOf('@');
    if (atIdx === -1) { setMentionQuery(null); return; }
    const fragment = before.slice(atIdx + 1);
    if (/\s/.test(fragment)) { setMentionQuery(null); return; }
    setMentionStart(atIdx);
    setMentionQuery(fragment);
    searchTeammates(fragment);
  };

  const insertMention = (member) => {
    const displayToken = `@${member.name}`;
    const before = text.slice(0, mentionStart);
    const after  = text.slice(textRef.current.selectionStart);
    const next   = `${before}${displayToken}\u00a0${after}`;
    setText(next);
    setMentionMap(prev => ({ ...prev, [member.name]: member.id }));
    setMentionQuery(null);
    setTimeout(() => {
      if (!textRef.current) return;
      textRef.current.focus();
      const pos = before.length + displayToken.length + 1;
      textRef.current.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery === null) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIdx(i => Math.min(i + 1, mentionResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionResults[mentionIdx]) { e.preventDefault(); insertMention(mentionResults[mentionIdx]); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionQuery(null);
    }
  };

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const authorId = session.user.id;
      // Reconstruct full mention tokens from display text (@Name → @[Name](uuid))
      let body = text.trim();
      Object.entries(mentionMap).forEach(([name, id]) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        body = body.replace(new RegExp(`@${escaped}`, 'g'), buildMentionToken(name, id));
      });
      const extracted = extractMentions(body);
      const { valid: validMentionedIds } = extracted.length
        ? await validateMentions(extracted, orgId)
        : { valid: [] };

      const { data: note, error: noteErr } = await supabase
        .from('activity_notes')
        .insert({
          organization_id:    orgId,
          deal_id:            dealId,
          author_id:          authorId,
          author_name:        currentUser || null,
          body,
          mentioned_user_ids: validMentionedIds,
        })
        .select('id, author_id, author_name, body, mentioned_user_ids, created_at, parent_note_id, note_type')
        .single();

      if (noteErr) throw new Error(noteErr.message);

      const notifyIds = validMentionedIds.filter(uid => uid !== authorId);
      if (notifyIds.length > 0) {
        const authorName = currentUserName || currentUser || 'Someone';
        const { data: mutes } = await supabase
          .from('deal_notification_mutes').select('user_id')
          .eq('deal_id', dealId).in('user_id', notifyIds);
        const mutedSet = new Set((mutes || []).map(m => m.user_id));
        await Promise.all(notifyIds.map(async (uid) => {
          const { error: mentionErr } = await supabase.from('mentions').insert({
            org_id: orgId, mentioned_user_id: uid, mentioned_by_user_id: authorId,
            target_type: 'activity_note', target_id: note.id, deal_id: dealId,
          });
          if (mentionErr) console.warn('mention insert failed:', mentionErr.message);
          if (mutedSet.has(uid)) return;
          const preview = body.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1').slice(0, 140);
          const { error: notifErr } = await supabase.from('notifications').insert({
            organization_id: orgId, user_id: uid, type: 'mention.deal_activity',
            title: `${authorName} mentioned you`, body: `"${preview}"`,
            entity_type: 'activity_note', entity_id: JSON.stringify({ dealId, noteId: note.id }),
          });
          if (notifErr) console.error('notification insert failed:', notifErr.message, notifErr);
        }));
      }

      setText('');
      setMentionMap({});
      setOpen(false);
      onSaved(note);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => textRef.current?.focus(), 50); }}
        className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm text-gray-400 bg-white border border-gray-200 rounded-xl hover:border-accent/40 hover:text-gray-600 transition-colors"
      >
        <StickyNote size={14} className="flex-shrink-0" />
        Add a note…
      </button>
    );
  }

  return (
    <div className="bg-white border border-accent/30 rounded-xl shadow-sm overflow-visible">
      <div className="relative">
        <textarea
          ref={textRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Write a note… type @ to mention a teammate"
          rows={3}
          className="w-full px-4 pt-3 pb-1 text-sm text-gray-800 resize-none focus:outline-none"
        />
        {mentionQuery !== null && (
          <MentionAutocomplete
            results={mentionResults}
            selectedIdx={mentionIdx}
            onSelect={insertMention}
            anchorRef={textRef}
          />
        )}
      </div>
      {error && <p className="text-[11px] text-red-500 px-4 pb-1">{error}</p>}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 flex items-center gap-1"><AtSign size={11} />mention</span>
          <span className="text-[11px] text-gray-400">Shift+Enter for new line</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setText(''); setMentionMap({}); setOpen(false); setMentionQuery(null); }}
            className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >Cancel</button>
          <button
            onClick={save}
            disabled={!text.trim() || saving}
            className="text-xs text-white bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/90 font-semibold disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single event card ─────────────────────────────────────────────────────────
function EventCard({
  event, replies = [], usersById,
  onDeleteNote, onEditNote, onAddReply, onDeleteReply,
  currentUserId, currentUserName, dealId, orgId, readOnly,
}) {
  const cfg  = EVENT_CONFIG[event.type] || EVENT_CONFIG.note;
  const Icon = cfg.icon;

  const [exp,            setExp]            = useState(false);
  const [editing,        setEditing]        = useState(false);
  const [editText,       setEditText]       = useState(event.body || '');
  const [saving,         setSaving]         = useState(false);
  const [showReplies,    setShowReplies]    = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);

  const isLong    = (event.body || '').length > 200;
  const isOwnNote = event.type === 'note' && event._dbId && currentUserId && event.author_id === currentUserId;
  const replyCount = replies.length;

  const saveEdit = async () => {
    if (!editText.trim() || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('activity_notes').update({ body: editText.trim() }).eq('id', event._dbId);
      if (!error) { onEditNote?.(event._dbId, editText.trim()); setEditing(false); }
    } finally { setSaving(false); }
  };

  // ── Stage-change card (auto-generated, muted style) ──────────────────────
  if (event.type === 'stage_change') {
    return (
      <div className="flex gap-3" id={`activity-${event.id}`}>
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0 bg-purple-50/60 rounded-xl border border-purple-100 px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-purple-700">{event.title}</p>
            <span className="text-[10px] text-purple-400 whitespace-nowrap flex-shrink-0">
              {timeAgo(event.date)}
            </span>
          </div>
          {event.meta?.author && event.meta.author !== 'System' && (
            <p className="text-[10px] text-purple-400 mt-0.5">by {event.meta.author}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Non-note system events (created, field_edit, etc.) ────────────────────
  if (event.type !== 'note') {
    return (
      <div className="flex gap-3" id={`activity-${event.id}`}>
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800">{event.title}</p>
              {event.subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{event.subtitle}</p>}
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(event.date)}</span>
          </div>
          {event.body && <p className="text-[13px] text-gray-600 leading-relaxed mt-2">{event.body}</p>}
          {event.meta?.author && (
            <div className="mt-2 text-[11px] text-gray-400">
              <span className="font-medium text-gray-500">{event.meta.author}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Note card: author-centric layout with threading ───────────────────────
  const authorName = event.meta?.author || 'Unknown';
  const avatarUrl  = event.meta?.avatar_url;

  return (
    <div className="flex gap-3" id={`activity-${event.id}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden bg-accent/15">
        {avatarUrl
          ? <img src={avatarUrl} alt={authorName} className="w-full h-full object-cover" />
          : <span className="text-[11px] font-bold text-accent">{getInitials(authorName)}</span>
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="text-[13px] font-semibold text-gray-800">{authorName}</span>
            <span className="text-[11px] text-gray-400 ml-2">{fmtNoteDate(event.date)}</span>
          </div>
          {isOwnNote && !editing && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => { setEditText(event.body || ''); setEditing(true); }}
                className="p-0.5 text-gray-300 hover:text-accent transition-colors rounded"
                title="Edit note"
              >
                <Pencil size={12} />
              </button>
              {onDeleteNote && (
                <button
                  onClick={() => onDeleteNote(event.id)}
                  className="p-0.5 text-gray-300 hover:text-red-400 transition-colors rounded"
                  title="Delete note"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Note body or edit mode */}
        {editing ? (
          <div>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={3}
              autoFocus
              className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-accent/50"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
              <button
                onClick={saveEdit}
                disabled={!editText.trim() || saving}
                className="text-xs text-white bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/90 font-semibold disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : event.body ? (
          <>
            <div className={!exp && isLong ? 'line-clamp-3' : ''}>
              <NoteBodyRenderer body={event.body} usersById={usersById} authorName={authorName} createdAt={event.date} />
            </div>
            {isLong && (
              <button onClick={() => setExp(e => !e)} className="text-[11px] text-accent mt-1 font-medium">
                {exp ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        ) : null}

        {/* Thread: replies */}
        {replyCount > 0 && showReplies && (
          <div className="mt-3 pl-3 border-l-2 border-gray-100 space-y-0">
            {replies.map(r => (
              <ReplyCard
                key={r.id}
                reply={r}
                usersById={usersById}
                currentUserId={currentUserId}
                onDeleteReply={!readOnly ? (id) => onDeleteReply?.(event._dbId, id) : null}
              />
            ))}
          </div>
        )}

        {/* Inline reply composer */}
        {showReplyInput && !readOnly && (
          <ReplyComposer
            parentDbId={event._dbId}
            dealId={dealId}
            orgId={orgId}
            currentUserName={currentUserName}
            usersById={usersById}
            onSaved={(reply) => {
              onAddReply?.(event._dbId, reply);
              setShowReplyInput(false);
              setShowReplies(true);
            }}
            onCancel={() => setShowReplyInput(false)}
          />
        )}

        {/* Footer: reply button + reply count */}
        {!editing && event._dbId && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-50">
            {!readOnly && (
              <button
                onClick={() => setShowReplyInput(v => !v)}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-accent transition-colors font-medium"
              >
                <MessageSquare size={11} />
                Reply
              </button>
            )}
            {replyCount > 0 && (
              <button
                onClick={() => setShowReplies(v => !v)}
                className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 transition-colors font-medium"
              >
                {showReplies
                  ? `Hide ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`
                  : `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MuteToggle ────────────────────────────────────────────────────────────────
function MuteToggle({ dealId }) {
  const [muted,   setMuted]   = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase || !dealId) return;
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      supabase.from('deal_notification_mutes').select('user_id')
        .eq('deal_id', dealId).eq('user_id', userId).maybeSingle()
        .then(({ data: row }) => setMuted(!!row));
    });
  }, [dealId]);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;
      const method = muted ? 'DELETE' : 'POST';
      const url    = muted ? `/api/deals/mute-mentions?deal_id=${dealId}` : '/api/deals/mute-mentions';
      const body   = muted ? undefined : JSON.stringify({ deal_id: dealId });
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body,
      });
      if (res.ok) setMuted(!muted);
    } finally { setLoading(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={muted ? 'Unmute mentions on this deal' : 'Mute mentions on this deal'}
      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
        muted ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
      }`}
    >
      {muted ? <BellOff size={11} /> : <Bell size={11} />}
      {muted ? 'Muted' : 'Mute mentions'}
    </button>
  );
}

// ── Main feed component ───────────────────────────────────────────────────────
export default function DealActivityFeed({ deal, readOnly, currentUser }) {
  const { profile, activeOrgId, hasFlag } = useAuth();
  const currentUserId   = profile?.id || null;
  const currentUserName = profile?.name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || currentUser
    || null;
  const instanceId      = useRef(Math.random().toString(36).slice(2));
  const mentionsEnabled = hasFlag('deal_activity.mentions.enabled');

  const [dbNotes,          setDbNotes]          = useState([]);
  const [repliesByParentId, setRepliesByParentId] = useState({});
  const [legacyNotes,      setLegacyNotes]      = useState([]);
  const [events,           setEvents]           = useState([]);
  const [usersById,        setUsersById]        = useState({});

  // ── Load notes + replies ──────────────────────────────────────────────────
  const loadDbNotes = useCallback(async () => {
    if (!supabase || !deal?.id) return;
    const { data, error } = await supabase
      .from('activity_notes')
      .select('id, author_id, author_name, body, mentioned_user_ids, created_at, parent_note_id, note_type')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      const topLevel = data.filter(n => !n.parent_note_id);
      const replyRows = data.filter(n => !!n.parent_note_id);

      const repliesMap = {};
      for (const r of replyRows) {
        if (!repliesMap[r.parent_note_id]) repliesMap[r.parent_note_id] = [];
        repliesMap[r.parent_note_id].push(r);
      }
      for (const pid in repliesMap) {
        repliesMap[pid].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }

      setDbNotes(topLevel);
      setRepliesByParentId(repliesMap);

      // Resolve author profiles
      const mentionedIds = [...new Set(data.flatMap(n => n.mentioned_user_ids || []))];
      const authorIds    = [...new Set(data.map(n => n.author_id).filter(Boolean))];
      const allIds       = [...new Set([...mentionedIds, ...authorIds])];

      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, first_name, last_name, avatar_url')
          .in('id', allIds);
        setUsersById(prev => ({
          ...prev,
          ...Object.fromEntries((profiles || []).map(p => [p.id, {
            name:       p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
            avatar_url: p.avatar_url || null,
            role: null, email: null,
          }])),
        }));
      }
    }
  }, [deal?.id]);

  const loadLegacyNotes = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`lotline_notes_${deal.id}`) || '[]');
      setLegacyNotes(stored);
    } catch { setLegacyNotes([]); }
  }, [deal?.id]);

  useEffect(() => {
    loadDbNotes();
    loadLegacyNotes();
  }, [loadDbNotes, loadLegacyNotes]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  const loadDbNotesRef = useRef(loadDbNotes);
  useEffect(() => { loadDbNotesRef.current = loadDbNotes; }, [loadDbNotes]);

  // Listen for activity notes created by other components (doc upload, DD, Dev)
  useEffect(() => {
    if (!deal?.id) return;
    const handler = (e) => {
      if (e.detail?.dealId === deal.id) loadDbNotesRef.current();
    };
    window.addEventListener('activity-note-created', handler);
    return () => window.removeEventListener('activity-note-created', handler);
  }, [deal?.id]);

  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const dealId = deal.id;
    const ch = supabase
      .channel(`activity-notes-${dealId}-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_notes' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.deal_id === dealId) loadDbNotesRef.current();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build event list (top-level only; replies handled per-card) ───────────
  useEffect(() => {
    const dbNoteEvents = dbNotes.map(n => ({
      id:          `db-note-${n.id}`,
      _dbId:       n.id,
      type:        n.note_type === 'stage_change' ? 'stage_change' : 'note',
      title:       n.note_type === 'stage_change' ? n.body : 'Note added',
      body:        n.note_type === 'stage_change' ? null : n.body,
      date:        n.created_at,
      hasMentions: !!(n.mentioned_user_ids?.length),
      author_id:   n.author_id,
      meta: {
        author:     n.author_name || usersById[n.author_id]?.name || 'Unknown',
        avatar_url: usersById[n.author_id]?.avatar_url || null,
      },
    }));

    const legacyEvents = legacyNotes.map(note => ({
      id:          `legacy-note-${note.id}`,
      _noteId:     note.id,
      type:        'note',
      title:       'Note added',
      body:        note.text,
      date:        note.createdAt,
      hasMentions: false,
      meta:        { author: note.author },
    }));

    const systemEvents = [
      deal.createdAt && {
        id: `created-${deal.id}`, type: 'created', title: 'Deal created',
        subtitle: deal.address || '', date: deal.createdAt, meta: {},
      },
      deal.contractSignedAt && {
        id: `stage-contract-${deal.id}`, type: 'stage_change',
        title: 'Moved to Contract Signed', date: deal.contractSignedAt, meta: {},
      },
    ].filter(Boolean);

    const all = [...dbNoteEvents, ...legacyEvents, ...systemEvents]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setEvents(all);
  }, [deal, dbNotes, legacyNotes, usersById]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNoteAdded = (note) => {
    setDbNotes(prev => [note, ...prev]);
  };

  const handleEditNote = (dbId, newBody) => {
    setDbNotes(prev => prev.map(n => n.id === dbId ? { ...n, body: newBody } : n));
  };

  const handleDeleteNote = async (eventId) => {
    if (eventId.startsWith('db-note-')) {
      const dbId = eventId.replace('db-note-', '');
      await supabase?.from('activity_notes').delete().eq('id', dbId);
      setDbNotes(prev => prev.filter(n => n.id !== dbId));
    } else if (eventId.startsWith('legacy-note-')) {
      const noteId = eventId.replace('legacy-note-', '');
      const key    = `lotline_notes_${deal.id}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(stored.filter(n => String(n.id) !== String(noteId))));
      setLegacyNotes(stored.filter(n => String(n.id) !== String(noteId)));
    }
  };

  const handleAddReply = (parentDbId, reply) => {
    setRepliesByParentId(prev => {
      const existing = prev[parentDbId] || [];
      return { ...prev, [parentDbId]: [...existing, reply].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) };
    });
  };

  const handleDeleteReply = async (parentDbId, replyId) => {
    await supabase?.from('activity_notes').delete().eq('id', replyId);
    setRepliesByParentId(prev => ({
      ...prev,
      [parentDbId]: (prev[parentDbId] || []).filter(r => r.id !== replyId),
    }));
  };

  // ── Group by month ─────────────────────────────────────────────────────────
  const grouped = events.reduce((acc, evt) => {
    const label = monthLabel(evt.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(evt);
    return acc;
  }, {});
  const groups = Object.entries(grouped);

  return (
    <div className="space-y-4">
      {mentionsEnabled && (
        <div className="flex justify-end">
          <MuteToggle dealId={deal.id} />
        </div>
      )}

      {!readOnly && (
        <NoteComposer
          dealId={deal.id}
          orgId={activeOrgId}
          onSaved={handleNoteAdded}
          currentUser={currentUser}
          currentUserName={currentUserName}
          mentionsEnabled={mentionsEnabled}
        />
      )}

      {groups.length === 0 && (
        <div className="text-center py-12">
          <StickyNote size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No activity yet</p>
          {!readOnly && <p className="text-xs text-gray-300 mt-1">Add a note to get started</p>}
        </div>
      )}

      {groups.map(([month, monthEvents]) => (
        <div key={month}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{month}</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          <div className="space-y-3">
            {monthEvents.map(evt => (
              <EventCard
                key={evt.id}
                event={evt}
                replies={evt._dbId ? (repliesByParentId[evt._dbId] || []) : []}
                usersById={usersById}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                dealId={deal.id}
                orgId={activeOrgId}
                readOnly={readOnly}
                onDeleteNote={!readOnly ? handleDeleteNote : null}
                onEditNote={!readOnly ? handleEditNote : null}
                onAddReply={!readOnly ? handleAddReply : null}
                onDeleteReply={!readOnly ? handleDeleteReply : null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
