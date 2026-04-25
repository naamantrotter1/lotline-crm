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
import {
  StickyNote, RefreshCw, CheckCircle2, Mail, Phone,
  FileEdit, X, AtSign, BellOff, Bell,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { parseMentionSegments, buildMentionToken, extractMentions, validateMentions } from '../../lib/mentions';
import MentionChip from './MentionChip';

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  note:         { icon: StickyNote,   color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  stage_change: { icon: RefreshCw,    color: 'bg-purple-50 text-purple-600 border-purple-200' },
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
// Positioned relative to the composer textarea.
function MentionAutocomplete({ results, selectedIdx, onSelect }) {
  if (!results) return null;
  return (
    <div className="
      absolute left-0 z-50 mt-1 w-72
      bg-white rounded-xl shadow-xl border border-gray-100
      overflow-hidden
    " style={{ top: '100%' }}>
      {results.length === 0 ? (
        <p className="text-[12px] text-gray-400 px-3 py-2">No teammates found</p>
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
                {/* Avatar */}
                <div className="
                  w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center
                  text-[11px] font-bold text-accent flex-shrink-0
                ">
                  {getInitials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{m.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="
                      text-[10px] font-medium px-1.5 py-0.5 rounded-full
                      bg-gray-100 text-gray-500 capitalize leading-none
                    ">{m.role}</span>
                    {m.is_jv_partner && (
                      <span className="
                        text-[10px] font-medium px-1.5 py-0.5 rounded-full
                        bg-orange-50 text-orange-500 leading-none
                      ">JV partner</span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
function NoteComposer({ dealId, orgId, onSaved, currentUser, mentionsEnabled }) {
  const [open,  setOpen]  = useState(false);
  const [text,  setText]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Mention autocomplete state
  const [mentionQuery,   setMentionQuery]   = useState(null); // null = closed
  const [mentionStart,   setMentionStart]   = useState(-1);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIdx,     setMentionIdx]     = useState(0);

  const textRef      = useRef(null);
  const allMembersRef = useRef([]); // cached full list — filtered client-side
  const sessionRef   = useRef(null); // cached session for save

  // On open: pre-fetch all active org members from Supabase directly.
  // Filtering is done client-side on every keystroke — no per-keystroke API calls.
  useEffect(() => {
    if (!open || !orgId || !supabase) return;

    (async () => {
      // Cache session for save
      const { data: { session } } = await supabase.auth.getSession();
      sessionRef.current = session;
      const currentUserId = session?.user?.id;

      // Step 1: get active org members
      const { data: mems } = await supabase
        .from('memberships')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .eq('status', 'active');

      if (!mems?.length) return;

      const memberIds = mems.map(m => m.user_id);
      const roleMap   = Object.fromEntries(mems.map(m => [m.user_id, m.role]));

      // Step 2: fetch profiles by user ID (not by active_organization_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url')
        .in('id', memberIds);

      allMembersRef.current = (profiles || [])
        .filter(p => p.id !== currentUserId)
        .map(p => ({
          id:            p.id,
          name:          p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
          role:          roleMap[p.id] || 'viewer',
          avatar_url:    p.avatar_url || null,
          is_jv_partner: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    })();
  }, [open, orgId]);

  // Filter the cached member list client-side — instant, no debounce needed
  const searchTeammates = useCallback((q) => {
    const all = allMembersRef.current;
    const ql  = q.trim().toLowerCase();
    const filtered = ql
      ? all.filter(m => m.name.toLowerCase().includes(ql))
      : all;
    setMentionResults(filtered.slice(0, 10));
    setMentionIdx(0);
  }, []);

  // Parse textarea input for @ trigger
  const handleChange = (e) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart;
    setText(val);
    setError(null);

    if (!mentionsEnabled) return;

    // Look backwards from cursor for an @ that started a mention token
    const before = val.slice(0, cursor);
    const atIdx  = before.lastIndexOf('@');

    if (atIdx === -1) {
      setMentionQuery(null);
      return;
    }

    const fragment = before.slice(atIdx + 1);
    // Only trigger if the fragment has no space (space = mention closed)
    if (/\s/.test(fragment)) {
      setMentionQuery(null);
      return;
    }

    setMentionStart(atIdx);
    setMentionQuery(fragment);
    searchTeammates(fragment);
  };

  const insertMention = (member) => {
    const token  = buildMentionToken(member.name, member.id);
    const before = text.slice(0, mentionStart);
    const after  = text.slice(textRef.current.selectionStart);
    const next   = `${before}${token}\u00a0${after}`;
    setText(next);
    setMentionQuery(null);

    // Restore focus + move cursor after the inserted token
    setTimeout(() => {
      if (!textRef.current) return;
      textRef.current.focus();
      const pos = before.length + token.length + 1;
      textRef.current.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionQuery === null) {
      // Ctrl/Cmd+Enter or plain Enter (no shift) → save
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      }
      return;
    }

    // Autocomplete keyboard nav
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
      e.preventDefault();
      setMentionQuery(null);
    }
  };

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);

    try {
      // Refresh session if needed
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
          body,
          mentioned_user_ids: validMentionedIds,
        })
        .select('id, author_id, body, mentioned_user_ids, created_at')
        .single();

      if (noteErr) throw new Error(noteErr.message);

      // Fan out mentions rows + notifications (non-blocking, best-effort)
      const notifyIds = validMentionedIds.filter(uid => uid !== authorId);
      if (notifyIds.length > 0) {
        const authorName =
          allMembersRef.current.find(m => m.id === authorId)?.name ||
          currentUser ||
          'Someone';

        // Check mutes for all notifyIds
        const { data: mutes } = await supabase
          .from('deal_notification_mutes')
          .select('user_id')
          .eq('deal_id', dealId)
          .in('user_id', notifyIds);

        const mutedSet = new Set((mutes || []).map(m => m.user_id));

        await Promise.all(notifyIds.map(async (uid) => {
          // Always write the mention row
          await supabase.from('mentions').insert({
            org_id:               orgId,
            mentioned_user_id:    uid,
            mentioned_by_user_id: authorId,
            target_type:          'activity_note',
            target_id:            note.id,
            deal_id:              dealId,
          }).catch(e => console.warn('mention insert', e));

          // Skip in-app notification if muted
          if (mutedSet.has(uid)) return;

          const preview = body.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1').slice(0, 140);
          await supabase.from('notifications').insert({
            organization_id: orgId,
            user_id:         uid,
            type:            'mention.deal_activity',
            title:           `${authorName} mentioned you`,
            body:            `"${preview}"`,
            entity_type:     'activity_note',
            entity_id:       note.id,
          }).catch(e => console.warn('notification insert', e));
        }));
      }

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
      <div className="relative">
        <textarea
          ref={textRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            mentionsEnabled
              ? 'Write a note… type @ to mention a teammate'
              : 'Write a note about this deal…'
          }
          rows={3}
          className="w-full px-4 pt-3 pb-1 text-sm text-gray-800 resize-none focus:outline-none"
        />

        {/* Mention autocomplete popover */}
        {mentionsEnabled && mentionQuery !== null && (
          <div className="relative">
            <MentionAutocomplete
              results={mentionResults}
              selectedIdx={mentionIdx}
              onSelect={insertMention}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-500 px-4 pb-1">{error}</p>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {mentionsEnabled && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <AtSign size={11} />
              mention
            </span>
          )}
          <span className="text-[11px] text-gray-400">Shift+Enter for new line</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setText(''); setOpen(false); setMentionQuery(null); }}
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
function EventCard({ event, usersById, onDeleteNote }) {
  const cfg  = EVENT_CONFIG[event.type] || EVENT_CONFIG.note;
  const Icon = cfg.icon;
  const [exp, setExp] = useState(false);

  const isLong = (event.body || '').length > 200;

  return (
    <div className="flex gap-3" id={`activity-${event.id}`}>
      {/* Icon dot */}
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
        <Icon size={13} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
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
            {event.type === 'note' && onDeleteNote && (
              <button
                onClick={() => onDeleteNote(event.id)}
                className="p-0.5 text-gray-300 hover:text-red-400 transition-colors rounded"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Body — renders @mention chips */}
        {event.body && (
          <div className={`mt-2 ${!exp && isLong ? 'line-clamp-3' : ''}`}>
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
        {isLong && (
          <button
            onClick={() => setExp(e => !e)}
            className="text-[11px] text-accent mt-1 font-medium"
          >
            {exp ? 'Show less' : 'Show more'}
          </button>
        )}

        {/* Author */}
        {event.meta?.author && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="font-medium text-gray-500">{event.meta.author}</span>
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
export default function DealActivityFeed({ deal, readOnly, currentUser }) {
  const { profile, activeOrgId, hasFlag } = useAuth();
  const mentionsEnabled = hasFlag('deal_activity.mentions.enabled');

  const [dbNotes,  setDbNotes]  = useState([]);
  const [legacyNotes, setLegacyNotes] = useState([]);
  const [events,   setEvents]   = useState([]);
  const [usersById, setUsersById] = useState({}); // { [userId]: { name, role, email } }

  // ── Load DB notes ──────────────────────────────────────────────────────────
  const loadDbNotes = useCallback(async () => {
    if (!supabase || !deal?.id) return;
    const { data, error } = await supabase
      .from('activity_notes')
      .select('id, author_id, body, mentioned_user_ids, created_at')
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
  }, [loadDbNotes, loadLegacyNotes]);

  // ── Realtime: new notes from other users ───────────────────────────────────
  const loadDbNotesRef = useRef(loadDbNotes);
  useEffect(() => { loadDbNotesRef.current = loadDbNotes; }, [loadDbNotes]);

  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const ch = supabase
      .channel(`activity-notes-${deal.id}-${Date.now()}`)
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
    const dbNoteEvents = dbNotes.map(n => ({
      id:          `db-note-${n.id}`,
      _dbId:       n.id,
      type:        'note',
      title:       'Note added',
      body:        n.body,
      date:        n.created_at,
      hasMentions: !!(n.mentioned_user_ids?.length),
      meta:        { author: usersById[n.author_id]?.name || 'Unknown' },
    }));

    const legacyEvents = legacyNotes.map(note => ({
      id:      `legacy-note-${note.id}`,
      _noteId: note.id,
      type:    'note',
      title:   'Note added',
      body:    note.text,
      date:    note.createdAt,
      hasMentions: false,
      meta:    { author: note.author },
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
          mentionsEnabled={mentionsEnabled}
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
                onDeleteNote={!readOnly ? handleDeleteNote : null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
