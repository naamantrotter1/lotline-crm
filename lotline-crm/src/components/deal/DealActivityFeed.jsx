/**
 * Deal activity feed — shows notes, stage changes, field edits, emails, calls, tasks.
 * PR 3 scope: notes (localStorage), deal created event, stage history.
 * Emails/calls/tasks/threads wire in subsequent PRs.
 */
import { useState, useEffect, useRef } from 'react';
import {
  StickyNote, TrendingRight, CheckCircle2, Mail, Phone,
  ChevronDown, ChevronUp, Plus, User, Calendar, RefreshCw,
  FileEdit, Check, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  note:         { icon: StickyNote,     color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  stage_change: { icon: RefreshCw,      color: 'bg-purple-50 text-purple-600 border-purple-200' },
  created:      { icon: CheckCircle2,   color: 'bg-green-50 text-green-600 border-green-200'   },
  field_edit:   { icon: FileEdit,       color: 'bg-blue-50 text-blue-600 border-blue-200'      },
  email:        { icon: Mail,           color: 'bg-indigo-50 text-indigo-600 border-indigo-200'},
  call:         { icon: Phone,          color: 'bg-cyan-50 text-cyan-600 border-cyan-200'      },
  task:         { icon: CheckCircle2,   color: 'bg-orange-50 text-orange-600 border-orange-200'},
};

// ── Relative time ─────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7)  return `${day}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

// ── Month group label ─────────────────────────────────────────────────────────
function monthLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return 'This Month';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Note composer (inline) ────────────────────────────────────────────────────
function NoteComposer({ dealId, onSaved, currentUser }) {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState('');
  const textRef           = useRef(null);

  const save = () => {
    if (!text.trim()) return;
    const key   = `lotline_notes_${dealId}`;
    const notes = JSON.parse(localStorage.getItem(key) || '[]');
    const note  = {
      id:        Date.now(),
      text:      text.trim(),
      createdAt: new Date().toISOString(),
      author:    currentUser || 'You',
    };
    notes.unshift(note);
    localStorage.setItem(key, JSON.stringify(notes));
    setText('');
    setOpen(false);
    onSaved(note);
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
    <div className="bg-white border border-accent/30 rounded-xl shadow-sm overflow-hidden">
      <textarea
        ref={textRef}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Write a note about this deal…"
        rows={3}
        className="w-full px-4 pt-3 pb-1 text-sm text-gray-800 resize-none focus:outline-none"
      />
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">Shift+Enter for new line</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setText(''); setOpen(false); }}
            className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >Cancel</button>
          <button
            onClick={save}
            disabled={!text.trim()}
            className="text-xs text-white bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/90 font-semibold disabled:opacity-40"
          >Save Note</button>
        </div>
      </div>
    </div>
  );
}

// ── Single event card ─────────────────────────────────────────────────────────
function EventCard({ event, onDeleteNote }) {
  const cfg   = EVENT_CONFIG[event.type] || EVENT_CONFIG.note;
  const Icon  = cfg.icon;
  const [exp, setExp] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Icon dot */}
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.color}`}>
        <Icon size={13} />
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-800">{event.title}</p>
            {event.subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{event.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(event.date)}</span>
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
        {event.body && (
          <div className="mt-2">
            <p className={`text-[13px] text-gray-600 leading-relaxed ${!exp && event.body.length > 200 ? 'line-clamp-3' : ''}`}>
              {event.body}
            </p>
            {event.body.length > 200 && (
              <button
                onClick={() => setExp(e => !e)}
                className="text-[11px] text-accent mt-1 font-medium"
              >
                {exp ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
        {event.meta && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
            {event.meta.author && <span className="font-medium text-gray-500">{event.meta.author}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main feed component ───────────────────────────────────────────────────────
export default function DealActivityFeed({ deal, readOnly, currentUser }) {
  const [notes,  setNotes]  = useState([]);
  const [events, setEvents] = useState([]);

  // Load notes from localStorage
  const loadNotes = () => {
    try {
      return JSON.parse(localStorage.getItem(`lotline_notes_${deal.id}`) || '[]');
    } catch { return []; }
  };

  useEffect(() => {
    const n = loadNotes();
    setNotes(n);
  }, [deal.id]);

  // Build event list from notes + deal metadata
  useEffect(() => {
    const n = loadNotes();

    const evts = [
      // Deal created
      deal.createdAt && {
        id:       `created-${deal.id}`,
        type:     'created',
        title:    'Deal created',
        subtitle: deal.address || '',
        date:     deal.createdAt,
        meta:     {},
      },
      // Stage changes — pull from localStorage history (simple heuristic)
      deal.contractSignedAt && {
        id:       `stage-contract-${deal.id}`,
        type:     'stage_change',
        title:    'Moved to Contract Signed',
        date:     deal.contractSignedAt,
        meta:     {},
      },
      // Notes
      ...n.map(note => ({
        id:       `note-${note.id}`,
        type:     'note',
        title:    'Note added',
        body:     note.text,
        date:     note.createdAt,
        meta:     { author: note.author },
        _noteId:  note.id,
      })),
    ].filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));

    setEvents(evts);
  }, [deal.id, notes]);

  const handleNoteAdded = (note) => {
    setNotes(prev => [note, ...prev]);
  };

  const handleDeleteNote = (eventId) => {
    const noteId = eventId.replace('note-', '');
    const key    = `lotline_notes_${deal.id}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = stored.filter(n => String(n.id) !== String(noteId));
    localStorage.setItem(key, JSON.stringify(updated));
    setNotes(updated);
  };

  // Group by month
  const grouped = events.reduce((acc, evt) => {
    const label = monthLabel(evt.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(evt);
    return acc;
  }, {});

  const groups = Object.entries(grouped);

  return (
    <div className="space-y-4">
      {/* Inline note composer */}
      {!readOnly && (
        <NoteComposer
          dealId={deal.id}
          onSaved={handleNoteAdded}
          currentUser={currentUser}
        />
      )}

      {/* Empty state */}
      {groups.length === 0 && (
        <div className="text-center py-12">
          <StickyNote size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No activity yet</p>
          {!readOnly && <p className="text-xs text-gray-300 mt-1">Add a note to get started</p>}
        </div>
      )}

      {/* Month-grouped events */}
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
                onDeleteNote={!readOnly ? (id) => handleDeleteNote(id) : null}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
