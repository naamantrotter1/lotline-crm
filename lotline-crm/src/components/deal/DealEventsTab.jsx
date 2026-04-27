/**
 * DealEventsTab — calendar view for a single deal's events.
 * Month view + List view toggle. Real-time via Supabase subscription.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, List,
  MapPin, X, Pencil, Trash2, Plus,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import {
  fetchDealEvents, deleteDealEvent, updateDealEvent,
  eventColor, eventTypeLabel, fmtEventDate, EVENT_TYPES,
} from '../../lib/dealEvents';
import AddEventModal from './AddEventModal';
import { PHASES, ALL_MILESTONE_KEYS } from './ImportantDates';

const MILESTONE_LABEL_MAP = Object.fromEntries(
  PHASES.flatMap(p => p.keys.map(k => [k.key, k.label]))
);

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Event detail popover ─────────────────────────────────────────────────────
function EventDetailPopover({ event, onClose, onEdit, onDelete, canEdit }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[360px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Color bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: eventColor(event) }} />
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white mb-1.5 inline-block"
                style={{ backgroundColor: eventColor(event) }}
              >
                {eventTypeLabel(event.event_type)}
              </span>
              <h3 className="text-sm font-semibold text-gray-800 leading-snug mt-1">{event.title}</h3>
            </div>
            <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500 flex-shrink-0">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2 text-xs text-gray-500">
            <p>{fmtEventDate(event.start_at, event.end_at, event.all_day)}</p>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                <span>{event.location}</span>
              </div>
            )}
            {event.description && (
              <p className="text-gray-600 leading-relaxed">{event.description}</p>
            )}
            {event.created_by_name && (
              <p className="text-gray-400">Added by {event.created_by_name}</p>
            )}
          </div>

          {canEdit && !event.source_table && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => onEdit(event)}
                className="flex items-center gap-1.5 text-xs text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/5"
              >
                <Pencil size={11} /> Edit
              </button>
              <button
                onClick={() => onDelete(event.id)}
                className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Edit event modal ──────────────────────────────────────────────────────────
function EditEventModal({ event, onSaved, onClose }) {
  const [title,       setTitle]       = useState(event.title || '');
  const [eventType,   setEventType]   = useState(event.event_type || 'manual');
  const [date,        setDate]        = useState(event.start_at?.slice(0, 10) || '');
  const [time,        setTime]        = useState(event.all_day ? '' : (event.start_at?.slice(11, 16) || ''));
  const [endTime,     setEndTime]     = useState(event.end_at ? event.end_at.slice(11, 16) : '');
  const [location,    setLocation]    = useState(event.location || '');
  const [description, setDescription] = useState(event.description || '');
  const [saving,      setSaving]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    const allDay  = !time;
    const startAt = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
    const endAt   = (!allDay && endTime) ? `${date}T${endTime}:00` : null;
    const { data, error } = await updateDealEvent(event.id, {
      title: title.trim(), event_type: eventType,
      start_at: startAt, end_at: endAt, all_day: allDay,
      location: location.trim() || null, description: description.trim() || null,
    });
    setSaving(false);
    if (!error) onSaved(data);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Edit Event</h2>
          <button onClick={onClose}><X size={14} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Title" />
          <div className="grid grid-cols-2 gap-3">
            <select value={eventType} onChange={e => setEventType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={time} onChange={e => setTime(e.target.value)} placeholder="Start time"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} placeholder="End time"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Notes (optional)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!title.trim() || saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Month grid ────────────────────────────────────────────────────────────────
function MonthGrid({ year, month, events, onEventClick }) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.start_at?.startsWith(dateStr));
  };

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="bg-white min-h-[90px]" />;
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayEvents = eventsForDay(day);
          return (
            <div key={day} className="bg-white min-h-[90px] p-1.5 group">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                isToday ? 'bg-accent text-white' : 'text-gray-500'
              }`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: eventColor(ev) }}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[9px] text-gray-400 px-1">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────
function ListView({ events, onEventClick }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <CalendarDays size={32} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm text-gray-400">No events yet</p>
      </div>
    );
  }

  const upcoming = events.filter(e => new Date(e.start_at) >= new Date());
  const past     = events.filter(e => new Date(e.start_at) < new Date());

  const Section = ({ title, items }) => items.length === 0 ? null : (
    <div className="mb-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-2">
        {items.map(ev => (
          <button
            key={ev.id}
            onClick={() => onEventClick(ev)}
            className="w-full flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 text-left transition-colors group"
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: eventColor(ev) }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmtEventDate(ev.start_at, ev.end_at, ev.all_day)}</p>
              {ev.location && <p className="text-xs text-gray-400 truncate">{ev.location}</p>}
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
              style={{ backgroundColor: eventColor(ev) }}
            >
              {eventTypeLabel(ev.event_type)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <Section title="Upcoming" items={upcoming} />
      <Section title="Past" items={past.slice().reverse()} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DealEventsTab({ deal, readOnly }) {
  const { profile, activeOrgId } = useAuth();
  const today = new Date();

  const [events,      setEvents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState('month');   // 'month' | 'list'
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [selected,    setSelected]    = useState(null);
  const [editing,     setEditing]     = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    if (!deal?.id) return;
    setLoading(true);

    // Fetch manually-created events (exclude milestone-sourced rows to avoid duplication)
    const dealEventsData = await fetchDealEvents(deal.id);
    const nonMilestoneEvents = dealEventsData.filter(e => e.source_table !== 'deal_milestones');

    // Read milestone dates directly from deal_milestones (source of truth)
    let milestoneEvents = [];
    if (supabase) {
      const { data: milestones } = await supabase
        .from('deal_milestones')
        .select('id, milestone_key, eta')
        .eq('deal_id', deal.id)
        .in('milestone_key', ALL_MILESTONE_KEYS)
        .not('eta', 'is', null);
      if (milestones) {
        milestoneEvents = milestones.map(m => ({
          id: `milestone-${m.id}`,
          title: MILESTONE_LABEL_MAP[m.milestone_key] || m.milestone_key,
          event_type: 'milestone',
          start_at: `${m.eta}T00:00:00`,
          all_day: true,
          color: '#3b82f6',
          source_table: 'deal_milestones',
          source_id: m.id,
        }));
      }
    }

    setEvents([...nonMilestoneEvents, ...milestoneEvents]);
    setLoading(false);
  }, [deal?.id]);

  useEffect(() => { load(); }, [load]);

  // Real-time
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const ch = supabase
      .channel(`deal-events-${deal.id}-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_events' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.deal_id === deal.id) load();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [deal?.id, load]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0);  } else setMonth(m => m + 1); };

  const handleDelete = async (id) => {
    await deleteDealEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelected(null);
  };

  const handleEdit = (event) => {
    setSelected(null);
    setEditing(event);
  };

  const handleEditSaved = (updated) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
    setEditing(null);
  };

  const canEdit = !readOnly;

  // Visible events for the current month
  const monthEvents = events.filter(e => {
    const d = new Date(e.start_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view === 'month' && (
            <>
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
                {MONTHS[month]} {year}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                className="px-2.5 py-1 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5"
              >
                Today
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('month')}
              className={`p-1.5 rounded-md transition-colors ${view === 'month' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
              title="Month view"
            >
              <CalendarDays size={13} />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
              title="List view"
            >
              <List size={13} />
            </button>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
              style={{ backgroundColor: '#c9703a' }}
            >
              <Plus size={12} /> Add Event
            </button>
          )}
        </div>
      </div>

      {/* Calendar body */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'month' ? (
        <MonthGrid
          year={year} month={month}
          events={monthEvents}
          onEventClick={setSelected}
        />
      ) : (
        <ListView events={events} onEventClick={setSelected} />
      )}

      {/* Empty state for month view */}
      {!loading && view === 'month' && monthEvents.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-4">
          No events this month
          {canEdit && <> — <button className="text-accent underline" onClick={() => setShowAdd(true)}>add one</button></>}
        </p>
      )}

      {/* Modals */}
      {selected && (
        <EventDetailPopover
          event={selected}
          onClose={() => setSelected(null)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canEdit={canEdit}
        />
      )}
      {editing && (
        <EditEventModal
          event={editing}
          onSaved={handleEditSaved}
          onClose={() => setEditing(null)}
        />
      )}
      {showAdd && (
        <AddEventModal
          deal={deal}
          onSaved={(ev) => { setEvents(prev => [...prev, ev]); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
