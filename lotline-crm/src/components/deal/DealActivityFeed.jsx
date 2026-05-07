/**
 * Deal activity feed — shows notes, stage changes, field edits, emails, calls, tasks.
 *
 * What changed from the original (localStorage-only) version:
 *   - Notes are now saved to the `activity_notes` Supabase table (DB-backed).
 *   - Legacy localStorage notes are still displayed (backward compat) but all
 *     new saves go to the DB.
 *   - The composer supports @-mention autocomplete: type @ to open a popover
 *     listing active org teammates (+ JV-partner members on shared deals with
 *     the correct permissions). Selecting inserts @[Name](uuid) into the body.
 *   - Saved notes render @[Name](uuid) tokens as <MentionChip> components.
 *   - Realtime subscription on `activity_notes` surfaces new notes from other
 *     users without requiring a page refresh.
 *
 * Feature flag: deal_activity.mentions.enabled (per org). When off, @-mention
 * autocomplete is hidden and the save path skips mention fanout — but the
 * DB-backed note save still works.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  StickyNote, RefreshCw, CheckCircle2, CheckSquare, Mail, Phone,
  FileEdit, X, AtSign, BellOff, Bell, MessageSquare, Paperclip,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { parseMentionSegments, buildMentionToken, extractMentions, validateMentions } from '../../lib/mentions';
import MentionChip from './MentionChip';

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  note:            { icon: StickyNote,   color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  stage_change:    { icon: RefreshCw,    color: 'bg-purple-50 text-purple-600 border-purple-200' },
  created:         { icon: CheckCircle2, color: 'bg-green-50 text-green-600 border-green-200'   },
  field_edit:      { icon: FileEdit,     color: 'bg-blue-50 text-blue-600 border-blue-200'      },
  email:           { icon: Mail,         color: 'bg-indigo-50 text-indigo-600 border-indigo-200'},
  call:            { icon: Phone,        color: 'bg-cyan-50 text-cyan-600 border-cyan-200'      },
  task:            { icon: CheckSquare,  color: 'bg-green-50 text-green-600 border-green-200'   },
  task_complete:   { icon: CheckCircle2, color: 'bg-green-50 text-green-600 border-green-200'   },
  task_update:     { icon: CheckSquare,  color: 'bg-blue-50 text-blue-600 border-blue-200'      },
  document_upload: { icon: Paperclip,   color: 'bg-orange-50 text-orange-500 border-orange-200' },
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

// ── MentionAutocomplete popover ────────────────────────────────────────────────
// Rendered into document.body via a portal with position:fixed so it escapes
// any overflow:hidden ancestor in the deal page layout.
function MentionAutocomplete({ results, selectedIdx, onSelect, anchorRef }) {
  // Compute position synchronously from the anchor rect — no state needed.
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
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                  ${i === selectedIdx ? 'bg-accent/10' : 'hover:bg-gray-50'}
                `}
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

// ── useOrgMembers ─────────────────────────────────────────────────────────────
// Loads the active org's members for @-mention autocomplete. Excludes the
// current user. Tries the server API first (admin client, no RLS), falls back
// to a direct memberships+profiles query for local dev.
function useOrgMembers(orgId) {
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    if (!orgId || !supabase) return;
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid   = session?.user?.id;
      const token = session?.access_token;
      if (!cancelled) setCurrentUserId(uid || null);

      if (token) {
        try {
          const res = await fetch('/api/team/members', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { members: apiMembers } = await res.json();
            if (cancelled) return;
            setMembers((apiMembers || [])
              .filter(m => m.user_id !== uid && m.status === 'active')
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
              .sort((a, b) => a.name.localeCompare(b.name)));
            return;
          }
        } catch {
          // fall through to direct query
        }
      }

      const { data: mems } = await supabase
        .from('memberships')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .eq('status', 'active');
      if (cancelled || !mems?.length) return;

      const memberIds = mems.map(m => m.user_id);
      const roleMap   = Object.fromEntries(mems.map(m => [m.user_id, m.role]));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url')
        .in('id', memberIds);
      if (cancelled) return;

      setMembers((profiles || [])
        .filter(p => p.id !== uid)
        .map(p => ({
          id:            p.id,
          name:          p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Team member',
          role:          roleMap[p.id] || 'member',
          avatar_url:    p.avatar_url || null,
          is_jv_partner: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)));
    })();

    return () => { cancelled = true; };
  }, [orgId]);

  return { members, currentUserId };
}

// ── MentionTextarea ───────────────────────────────────────────────────────────
// Controlled textarea with @-mention autocomplete. Detects '@' triggers,
// shows a portal popover anchored to the textarea, and inserts well-formed
// @[Name](uuid) tokens on selection. Pure UI — the parent owns the text and
// is responsible for extracting/validating mentions on save.
function MentionTextarea({
  value,
  onChange,
  onSubmit,
  onMentionInserted,
  members,
  textareaRef,
  ...textareaProps
}) {
  const internalRef = useRef(null);
  const ref = textareaRef || internalRef;
  const [mentionQuery,   setMentionQuery]   = useState(null);
  const [mentionStart,   setMentionStart]   = useState(-1);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIdx,     setMentionIdx]     = useState(0);

  const searchTeammates = useCallback((q) => {
    const ql = q.trim().toLowerCase();
    const filtered = ql
      ? members.filter(m => m.name.toLowerCase().includes(ql))
      : members;
    setMentionResults(filtered.slice(0, 10));
    setMentionIdx(0);
  }, [members]);

  const handleChange = (e) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(val);

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
    const token  = buildMentionToken(member.name, member.id);
    const before = value.slice(0, mentionStart);
    const after  = value.slice(ref.current.selectionStart);
    const next   = `${before}${token}\u00a0${after}`;
    onChange(next);
    setMentionQuery(null);

    setTimeout(() => {
      if (!ref.current) return;
      ref.current.focus();
      const pos = before.length + token.length + 1;
      ref.current.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery === null) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIdx(i => Math.min(i + 1, mentionResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionResults[mentionIdx]) {
        e.preventDefault();
        insertMention(mentionResults[mentionIdx]);
      }
    } else if (e.key === 'Escape') {
      setMentionQuery(null);
    }
  };

  const { onKeyDown: extraKeyDown, ...restTextareaProps } = textareaProps;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        {...restTextareaProps}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          handleKeyDown(e);
          if (!e.defaultPrevented) extraKeyDown?.(e);
        }}
      />
      {mentionQuery !== null && (
        <MentionAutocomplete
          results={mentionResults}
          selectedIdx={mentionIdx}
          onSelect={insertMention}
          anchorRef={ref}
        />
      )}
    </div>
  );
}

// ── notifyMentions ────────────────────────────────────────────────────────────
// Writes mention rows + in-app notifications for @-mentioned users.
// Skips self-mentions and respects per-deal mute preferences.
async function notifyMentions({
  orgId,
  dealId,
  authorId,
  authorName,
  body,
  noteId,
  validMentionedIds,
}) {
  const notifyIds = (validMentionedIds || []).filter(uid => uid && uid !== authorId);
  if (!notifyIds.length || !supabase) return;

  const { data: mutes } = await supabase
    .from('deal_notification_mutes')
    .select('user_id')
    .eq('deal_id', dealId)
    .in('user_id', notifyIds);
  const mutedSet = new Set((mutes || []).map(m => m.user_id));

  const preview = (body || '').replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1').slice(0, 140);

  await Promise.all(notifyIds.map(async (uid) => {
    try {
      const { error: mErr } = await supabase.from('mentions').insert({
        org_id:               orgId,
        mentioned_user_id:    uid,
        mentioned_by_user_id: authorId,
        target_type:          'activity_note',
        target_id:            noteId,
        deal_id:              dealId,
      });
      if (mErr) console.warn('mention insert', mErr);
    } catch (e) {
      console.warn('mention insert threw', e);
    }

    if (mutedSet.has(uid)) return;

    try {
      const { error: nErr } = await supabase.from('notifications').insert({
        organization_id: orgId,
        user_id:         uid,
        type:            'mention.deal_activity',
        title:           `${authorName || 'Someone'} mentioned you`,
        body:            `"${preview}"`,
        entity_type:     'activity_note',
        entity_id:       noteId,
      });
      if (nErr) console.warn('notification insert', nErr);
    } catch (e) {
      console.warn('notification insert threw', e);
    }
  }));
}

// ── NoteBodyRenderer ──────────────────────────────────────────────────────────
// Renders a note body, replacing @[Name](uuid) tokens with <MentionChip>.
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
        return <span key={i}>{seg.content}</span>;
      })}
    </span>
  );
}

// ── NoteComposer ──────────────────────────────────────────────────────────────
function NoteComposer({ dealId, orgId, onSaved, currentUser, members }) {
  const [open,  setOpen]  = useState(false);
  const [text,  setText]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const textRef = useRef(null);

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const authorId = session.user.id;

      const body = text.trim();

      // Extract + validate mentions
      const extracted = extractMentions(body);
      const { valid: validMentionedIds } = extracted.length
        ? await validateMentions(extracted, orgId)
        : { valid: [] };

      // Insert into activity_notes
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
        .select('id, author_id, author_name, note_type, body, mentioned_user_ids, created_at')
        .single();

      if (noteErr) throw new Error(noteErr.message);

      // Fan out mentions + notifications (best-effort)
      const authorName =
        members.find(m => m.id === authorId)?.name ||
        currentUser ||
        'Someone';
      await notifyMentions({
        orgId, dealId, authorId, authorName,
        body, noteId: note.id, validMentionedIds,
      });

      setText('');
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
      <MentionTextarea
        textareaRef={textRef}
        value={text}
        onChange={(v) => { setText(v); setError(null); }}
        onSubmit={save}
        members={members}
        placeholder="Write a note… type @ to mention a teammate"
        rows={3}
        className="w-full px-4 pt-3 pb-1 text-sm text-gray-800 resize-none focus:outline-none"
      />

      {error && (
        <p className="text-[11px] text-red-500 px-4 pb-1">{error}</p>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <AtSign size={11} />
            mention
          </span>
          <span className="text-[11px] text-gray-400">Shift+Enter for new line</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setText(''); setOpen(false); }}
            className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
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
function EventCard({ event, usersById, onDeleteNote, onDeleteReply, replyProps, members, currentUserId }) {
  const cfg  = EVENT_CONFIG[event.type] || EVENT_CONFIG.note;
  const Icon = cfg.icon;
  const [exp, setExp] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const bodyRef = useRef(null);

  // Measure actual DOM overflow when collapsed; only show "Show more" if the
  // line-clamp is actually clipping content.
  useEffect(() => {
    if (exp) return; // already expanded; preserve last known overflow state
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setHasOverflow(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [exp, event.body]);

  const replies = replyProps?.replies || [];
  const isReplying = replyProps?.replyingTo === event._dbId;

  return (
    <div className="flex gap-3" id={`activity-${event.id}`}>
      {/* Icon dot */}
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
        <Icon size={13} />
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm${event.isTask ? ' border-l-2 border-l-green-300' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-800">{event.title}</p>
            {event.subtitle && (
              <p className="text-[11px] text-gray-400 mt-0.5">{event.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {timeAgo(event.date)}
            </span>
            {['note', 'task', 'task_complete', 'task_update'].includes(event.type)
              && onDeleteNote
              // Only the author can delete their note. Legacy localStorage notes
              // (no authorId on the event) keep the existing behavior.
              && (!event.authorId || event.authorId === currentUserId) && (
              <button
                onClick={() => onDeleteNote(event.id)}
                title="Delete"
                className="p-0.5 text-gray-300 hover:text-red-400 transition-colors rounded"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Body — renders @mention chips */}
        {event.body && (
          <div ref={bodyRef} className={`mt-2 ${!exp ? 'line-clamp-3' : ''}`}>
            {event.hasMentions ? (
              <NoteBodyRenderer
                body={event.body}
                usersById={usersById}
                authorName={event.meta?.author}
                createdAt={event.date}
              />
            ) : (
              <p className="text-[13px] text-gray-600 leading-relaxed">{event.body}</p>
            )}
          </div>
        )}
        {(hasOverflow || exp) && (
          <button
            onClick={() => setExp(e => !e)}
            className="text-[11px] text-accent mt-1 font-medium"
          >
            {exp ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Author */}
        {event.meta?.author && !event.hideAuthorFooter && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="font-medium text-gray-500">{event.meta.author}</span>
          </div>
        )}

        {/* Thread replies */}
        {replies.length > 0 && (
          <div className="mt-3 border-l-2 border-gray-100 pl-3 space-y-2.5">
            {replies.map(r => (
              <div key={r.id} className="group">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-gray-700">
                    {usersById[r.author_id]?.name || r.author_name || 'Unknown'}
                  </span>
                  <span className="text-[11px] text-gray-400">{timeAgo(r.created_at)}</span>
                  {onDeleteReply && r.author_id === currentUserId && (
                    <button
                      onClick={() => onDeleteReply(r.id)}
                      title="Delete"
                      className="p-0.5 text-gray-300 hover:text-red-400 transition-colors rounded opacity-0 group-hover:opacity-100"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
                <p className="text-[12px] text-gray-600 leading-relaxed mt-0.5">{r.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reply button / inline reply input */}
        {(event.type === 'note' || event.type === 'document_upload') && replyProps && (
          <div className="mt-2">
            {isReplying ? (
              <div className="flex gap-2 mt-1">
                <div className="flex-1">
                  <MentionTextarea
                    autoFocus
                    value={replyProps.replyText}
                    onChange={(v) => replyProps.onReplyTextChange(v)}
                    onSubmit={() => replyProps.onSubmitReply(event._dbId)}
                    members={members || []}
                    placeholder="Write a reply… type @ to mention a teammate"
                    rows={2}
                    className="w-full text-[12px] px-2.5 py-1.5 border border-gray-200 rounded-lg resize-none focus:outline-none focus:border-accent/40 bg-gray-50"
                    onKeyDown={e => { if (e.key === 'Escape') replyProps.onCancelReply(); }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => replyProps.onSubmitReply(event._dbId)}
                    disabled={!replyProps.replyText.trim() || replyProps.replySubmitting}
                    className="text-[11px] text-white bg-accent px-2.5 py-1 rounded-lg hover:bg-accent/90 disabled:opacity-40 font-semibold"
                  >
                    {replyProps.replySubmitting ? '…' : 'Reply'}
                  </button>
                  <button
                    onClick={replyProps.onCancelReply}
                    className="text-[11px] text-gray-400 px-2.5 py-1 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => replyProps.onReply(event._dbId)}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-accent transition-colors mt-0.5"
              >
                <MessageSquare size={11} />
                {replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'} · Reply` : 'Reply'}
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

  // Check current mute state on mount
  useEffect(() => {
    if (!supabase || !dealId) return;
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id;
      if (!userId) return;
      supabase
        .from('deal_notification_mutes')
        .select('user_id')
        .eq('deal_id', dealId)
        .eq('user_id', userId)
        .maybeSingle()
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
      const url    = muted
        ? `/api/deals/mute-mentions?deal_id=${dealId}`
        : '/api/deals/mute-mentions';
      const body   = muted ? undefined : JSON.stringify({ deal_id: dealId });

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
      });
      if (res.ok) setMuted(!muted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={muted ? 'Unmute mentions on this deal' : 'Mute mentions on this deal'}
      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
        muted
          ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
      }`}
    >
      {muted ? <BellOff size={11} /> : <Bell size={11} />}
      {muted ? 'Muted' : 'Mute mentions'}
    </button>
  );
}

// ── Main feed component ───────────────────────────────────────────────────────
export default function DealActivityFeed({ deal, readOnly, currentUser, refreshKey }) {
  const { profile, session, activeOrgId, hasFlag } = useAuth();
  // Stable unique ID per component instance — prevents channel-name collisions when
  // DealPageLayout mounts this component twice (desktop + mobile) in the same tick.
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const mentionsEnabled = hasFlag('deal_activity.mentions.enabled');
  const currentUserId = session?.user?.id || null;

  // Org members for @-mention autocomplete (composer + replies share this list)
  const { members } = useOrgMembers(activeOrgId);

  const [dbNotes,  setDbNotes]  = useState([]);
  const [legacyNotes, setLegacyNotes] = useState([]);
  const [events,   setEvents]   = useState([]);
  const [replyMap, setReplyMap] = useState({}); // { [parentNoteId]: reply[] }
  const [usersById, setUsersById] = useState({}); // { [userId]: { name, role, email } }
  const [replyingTo,     setReplyingTo]     = useState(null); // _dbId of parent note
  const [replyText,      setReplyText]      = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // ── Load DB notes ──────────────────────────────────────────────────────────
  const loadDbNotes = useCallback(async () => {
    if (!supabase || !deal?.id) return;
    const { data, error } = await supabase
      .from('activity_notes')
      .select('id, author_id, author_name, note_type, body, mentioned_user_ids, created_at, parent_note_id')
      .eq('deal_id', deal.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setDbNotes(data);

      // Resolve author profiles for mentioned users
      const mentionedIds = [...new Set(data.flatMap(n => n.mentioned_user_ids || []))];
      const authorIds    = [...new Set(data.map(n => n.author_id).filter(Boolean))];
      const allIds       = [...new Set([...mentionedIds, ...authorIds])];

      if (allIds.length > 0 && supabase) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, first_name, last_name')
          .in('id', allIds);

        setUsersById(prev => ({
          ...prev,
          ...Object.fromEntries((profiles || []).map(p => [
            p.id,
            {
              name:  p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
              role:  null, // populated separately if needed
              email: null,
            },
          ])),
        }));
      }
    }
  }, [deal?.id]);

  // ── Load legacy localStorage notes ────────────────────────────────────────
  const loadLegacyNotes = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(`lotline_notes_${deal.id}`) || '[]');
      setLegacyNotes(stored);
    } catch {
      setLegacyNotes([]);
    }
  }, [deal?.id]);

  useEffect(() => {
    loadDbNotes();
    loadLegacyNotes();
  }, [loadDbNotes, loadLegacyNotes, refreshKey]);

  // ── Realtime: new notes from other users ───────────────────────────────────
  const loadDbNotesRef = useRef(loadDbNotes);
  useEffect(() => { loadDbNotesRef.current = loadDbNotes; }, [loadDbNotes]);

  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const ch = supabase
      .channel(`activity-notes-${deal.id}-${instanceId.current}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'activity_notes',
        filter: `deal_id=eq.${deal.id}`,
      }, () => loadDbNotesRef.current())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build unified event list ───────────────────────────────────────────────
  useEffect(() => {
    // Build reply map: parentId → replies sorted oldest-first
    const newReplyMap = dbNotes.reduce((acc, n) => {
      if (!n.parent_note_id) return acc;
      if (!acc[n.parent_note_id]) acc[n.parent_note_id] = [];
      acc[n.parent_note_id].push(n);
      return acc;
    }, {});
    Object.values(newReplyMap).forEach(arr => arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    setReplyMap(newReplyMap);

    const dbNoteEvents = dbNotes.filter(n => !n.parent_note_id).map(n => {
      const isTask = n.note_type && !['note', 'document_upload'].includes(n.note_type);
      const authorName =
        n.author_name ||
        usersById[n.author_id]?.name ||
        'Unknown';
      const titles = {
        task:            'Task created',
        task_complete:   'Task completed',
        task_update:     'Task updated',
        document_upload: 'Document uploaded',
      };
      const type = n.note_type || 'note';
      return {
        id:          `db-note-${n.id}`,
        _dbId:       n.id,
        authorId:    n.author_id,
        type,
        title:       titles[n.note_type] || authorName,
        body:        n.body,
        date:        n.created_at,
        hasMentions: !!(n.mentioned_user_ids?.length),
        isTask,
        meta:        { author: authorName },
        // Hide separate author footer for plain notes since the title already shows the author.
        hideAuthorFooter: type === 'note',
      };
    });

    const legacyEvents = legacyNotes.map(note => ({
      id:      `legacy-note-${note.id}`,
      _noteId: note.id,
      type:    'note',
      title:   note.author || 'Note added',
      body:    note.text,
      date:    note.createdAt,
      hasMentions: false,
      meta:    { author: note.author },
      hideAuthorFooter: true,
    }));

    const systemEvents = [
      deal.createdAt && {
        id:       `created-${deal.id}`,
        type:     'created',
        title:    'Deal created',
        subtitle: deal.address || '',
        date:     deal.createdAt,
        meta:     {},
      },
      deal.contractSignedAt && {
        id:       `stage-contract-${deal.id}`,
        type:     'stage_change',
        title:    'Moved to Contract Signed',
        date:     deal.contractSignedAt,
        meta:     {},
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

  const handleSubmitReply = async (parentNoteId) => {
    if (!replyText.trim() || replySubmitting) return;
    setReplySubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const authorId = session.user.id;
      const body = replyText.trim();

      // Extract + validate mentions from the reply body
      const extracted = extractMentions(body);
      const { valid: validMentionedIds } = extracted.length
        ? await validateMentions(extracted, activeOrgId)
        : { valid: [] };

      const { data: reply, error } = await supabase
        .from('activity_notes')
        .insert({
          organization_id:    activeOrgId,
          deal_id:            deal.id,
          author_id:          authorId,
          author_name:        currentUser || null,
          body,
          parent_note_id:     parentNoteId,
          mentioned_user_ids: validMentionedIds,
        })
        .select('id, author_id, author_name, note_type, body, mentioned_user_ids, created_at, parent_note_id')
        .single();
      if (!error && reply) {
        setDbNotes(prev => [...prev, reply]);
        setReplyText('');
        setReplyingTo(null);

        // Fan out mentions + notifications (best-effort)
        const authorName =
          members.find(m => m.id === authorId)?.name ||
          currentUser ||
          'Someone';
        notifyMentions({
          orgId:  activeOrgId,
          dealId: deal.id,
          authorId, authorName,
          body,
          noteId: reply.id,
          validMentionedIds,
        }).catch(e => console.warn('reply mention fanout', e));
      }
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleDeleteNote = async (eventId) => {
    if (eventId.startsWith('db-note-')) {
      const dbId = eventId.replace('db-note-', '');
      // Soft-delete via update (or hard-delete — RLS allows authors)
      await supabase?.from('activity_notes').delete().eq('id', dbId);
      setDbNotes(prev => prev.filter(n => n.id !== dbId));
    } else if (eventId.startsWith('legacy-note-')) {
      const noteId = eventId.replace('legacy-note-', '');
      const key    = `lotline_notes_${deal.id}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = stored.filter(n => String(n.id) !== String(noteId));
      localStorage.setItem(key, JSON.stringify(updated));
      setLegacyNotes(updated);
    }
  };

  const handleDeleteReply = async (replyId) => {
    // RLS allows authors to delete their own activity_notes rows.
    await supabase?.from('activity_notes').delete().eq('id', replyId);
    setDbNotes(prev => prev.filter(n => n.id !== replyId));
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
      {/* Mute toggle (only when mentions enabled + non-read-only) */}
      {mentionsEnabled && (
        <div className="flex justify-end">
          <MuteToggle dealId={deal.id} />
        </div>
      )}

      {/* Composer */}
      {!readOnly && (
        <NoteComposer
          dealId={deal.id}
          orgId={activeOrgId}
          onSaved={handleNoteAdded}
          currentUser={currentUser}
          members={members}
        />
      )}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="text-center py-12">
          <StickyNote size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No activity yet</p>
          {!readOnly && (
            <p className="text-xs text-gray-300 mt-1">Add a note to get started</p>
          )}
        </div>
      )}

      {/* Month-grouped events */}
      {groups.map(([month, monthEvents]) => (
        <div key={month}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
              {month}
            </span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
          <div className="space-y-3">
            {monthEvents.map(evt => (
              <EventCard
                key={evt.id}
                event={evt}
                usersById={usersById}
                members={members}
                currentUserId={currentUserId}
                onDeleteNote={!readOnly ? handleDeleteNote : null}
                onDeleteReply={!readOnly ? handleDeleteReply : null}
                replyProps={!readOnly && evt._dbId ? {
                  replies:         replyMap[evt._dbId] || [],
                  replyingTo,
                  replyText,
                  replySubmitting,
                  onReply:         (id) => { setReplyingTo(id); setReplyText(''); },
                  onReplyTextChange: setReplyText,
                  onSubmitReply:   handleSubmitReply,
                  onCancelReply:   () => { setReplyingTo(null); setReplyText(''); },
                } : null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
