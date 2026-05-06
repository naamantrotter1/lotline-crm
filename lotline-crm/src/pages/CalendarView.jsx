/**
 * CalendarView.jsx
 * Global calendar — shows CRM meetings, deal events, and each team member's
 * Google Calendar events (color-coded by person).
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Loader2,
  Video, Phone, Users, MapPin,
  RefreshCw, Link2, Trash2, Check, X, Copy, ExternalLink, Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import {
  fetchMeetings, createMeeting, updateMeeting, deleteMeeting,
  fetchCalendarConnection, syncOrgCalendars, fetchGCalEvents,
  fetchSchedulerLinks, createSchedulerLink, deleteSchedulerLink,
  MEETING_TYPES, MEETING_STATUS, fmtMeetingTime,
} from '../lib/calendarData';
import { fetchOrgEvents, eventColor, eventTypeLabel, fmtEventDate, streetAddress, dealDateCategory } from '../lib/dealEvents';
import AddEventModal from '../components/deal/AddEventModal';

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Team member color palette (cycles if > 8 members) ─────────────────────────
const TEAM_PALETTE = [
  '#4285F4', // Google blue
  '#34A853', // Google green
  '#EA4335', // Google red
  '#A142F4', // purple
  '#00ACC1', // teal
  '#FF6D00', // orange
  '#795548', // brown
  '#E91E63', // pink
];

// Assign a stable color to each user_id by sorting and indexing
function buildMemberColors(userIds) {
  const sorted = [...new Set(userIds)].sort();
  const map = {};
  sorted.forEach((uid, i) => { map[uid] = TEAM_PALETTE[i % TEAM_PALETTE.length]; });
  return map;
}

function memberName(profile) {
  if (!profile) return 'Team member';
  const first = profile.first_name || '';
  const last  = profile.last_name  || '';
  return [first, last].filter(Boolean).join(' ') || 'Team member';
}

function memberInitials(profile) {
  if (!profile) return '?';
  return ((profile.first_name?.[0] || '') + (profile.last_name?.[0] || '')).toUpperCase() || '?';
}

function fmtGCalTime(event) {
  if (event.all_day) {
    const d = new Date(event.start_at);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const s = new Date(event.start_at);
  const e = new Date(event.end_at);
  const date  = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end   = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${start} – ${end}`;
}

const FILTER_CHIPS = [
  { key: 'all',       label: 'All'           },
  { key: 'gcal',      label: 'Team Calendar' },
  { key: 'meeting',   label: 'Meetings'      },
  { key: 'task',      label: 'Tasks'         },
  { key: 'milestone', label: 'Milestones'    },
];

// ── Meeting modal ──────────────────────────────────────────────────────────────
function MeetingModal({ orgId, userId, meeting, onSaved, onClose }) {
  const [title, setTitle]         = useState(meeting?.title || '');
  const [type, setType]           = useState(meeting?.meeting_type || 'video');
  const [date, setDate]           = useState(meeting?.starts_at ? meeting.starts_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [startTime, setStart]     = useState(meeting?.starts_at ? meeting.starts_at.slice(11, 16) : '10:00');
  const [endTime, setEnd]         = useState(meeting?.ends_at   ? meeting.ends_at.slice(11, 16)   : '10:30');
  const [location, setLocation]   = useState(meeting?.location || '');
  const [attendees, setAttendees] = useState((meeting?.attendee_emails || []).join(', '));
  const [description, setDesc]    = useState(meeting?.description || '');
  const [saving, setSaving]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const patch = {
      title:           title.trim(),
      meeting_type:    type,
      starts_at:       `${date}T${startTime}:00`,
      ends_at:         `${date}T${endTime}:00`,
      location:        location.trim() || null,
      attendee_emails: attendees.split(',').map(a => a.trim()).filter(Boolean),
      description:     description.trim() || null,
    };
    const { data, error } = meeting
      ? await updateMeeting(meeting.id, patch)
      : await createMeeting(orgId, userId, patch);
    setSaving(false);
    if (!error && data) onSaved(data, !!meeting);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{meeting ? 'Edit Meeting' : 'New Meeting'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="e.g. Property walkthrough"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                {MEETING_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Start time</label>
              <input type="time" value={startTime} onChange={e => setStart(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">End time</label>
              <input type="time" value={endTime} onChange={e => setEnd(e.target.value)} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location / link</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              placeholder="Zoom link, address, or phone number"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Attendee emails <span className="text-gray-300 font-normal">(comma-separated)</span></label>
            <input value={attendees} onChange={e => setAttendees(e.target.value)}
              placeholder="john@example.com, jane@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!title.trim() || saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Saving…' : (meeting ? 'Save Changes' : 'Create Meeting')}
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

// ── Google Calendar event popover ─────────────────────────────────────────────
function GCalEventPopover({ event, color, currentUserId, onClose }) {
  const profile = event.profiles;
  const isOwner = event.user_id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[380px] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Color stripe */}
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-800 leading-snug">{event.title}</h3>
              {/* Owner badge */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: color }}>
                  {memberInitials(profile)}
                </div>
                <span className="text-xs text-gray-500">{memberName(profile)}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500 flex-shrink-0">
              <X size={14} />
            </button>
          </div>

          {/* Date/time */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={12} className="text-gray-400" />
            {fmtGCalTime(event)}
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={12} className="text-gray-400" />
              {event.location}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-50 pt-2">
              {event.description}
            </p>
          )}

          {/* Open in Google Calendar */}
          {event.html_link && (
            <a href={event.html_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors w-fit">
              <ExternalLink size={11} />
              Open in Google Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Deal event popover ─────────────────────────────────────────────────────────
function DealEventPopover({ event, dealAddress, onClose, navigate }) {
  const color = eventColor(event);
  const statusBadge = event._isCompleted
    ? { label: 'Completed', cls: 'bg-green-50 text-green-700 border-green-100' }
    : event._isOverdue
    ? { label: 'Overdue',   cls: 'bg-red-50 text-red-600 border-red-100' }
    : { label: 'Upcoming',  cls: 'bg-blue-50 text-blue-700 border-blue-100' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[380px] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: color }}>
                  {eventTypeLabel(event.event_type)}
                </span>
                {(event._isCompleted || event._isOverdue) && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-gray-800 leading-snug">{event.title}</h3>
              {dealAddress && <p className="text-xs text-gray-400 mt-0.5">{dealAddress}</p>}
            </div>
            <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500 flex-shrink-0"><X size={14} /></button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar size={11} className="text-gray-400 flex-shrink-0" />
            {fmtEventDate(event.start_at, event.end_at, event.all_day)}
          </div>

          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin size={11} className="text-gray-400" />{event.location}
            </div>
          )}
          {event.description && (
            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-50 pt-2">{event.description}</p>
          )}
          {event.deal_id && (
            <button onClick={() => { onClose(); navigate(`/deal/${event.deal_id}`); }}
              className="flex items-center gap-1.5 text-xs text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/5 font-medium w-fit">
              <ExternalLink size={11} /> Go to Deal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Month grid ─────────────────────────────────────────────────────────────────
function MonthGrid({ year, month, allEvents, onDayClick, onEventClick, memberColors }) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();
  const cells       = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allEvents.filter(e => {
      const ts = e._isGCal ? e.start_at : e._isMeeting ? e.starts_at : e.start_at;
      return ts?.startsWith(dateStr);
    });
  };

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-white min-h-[120px]" />;
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const dayEvents = eventsForDay(day);
          return (
            <div key={day} onClick={() => onDayClick(day)}
              className="bg-white min-h-[120px] p-2 cursor-pointer hover:bg-orange-50/50 transition-colors group">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mb-1.5 ${
                isToday ? 'bg-accent text-white' : 'text-gray-600 group-hover:bg-accent/10'
              }`}>
                {day}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 4).map(ev => {
                  // Google Calendar event
                  if (ev._isGCal) {
                    const color = memberColors[ev.user_id] || '#9E9E9E';
                    const name  = ev.profiles?.first_name || 'Team';
                    const label = `${name} — ${ev.title}`;
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                        className="text-xs px-2 py-1 rounded font-medium truncate cursor-pointer text-white opacity-90 hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: color }}
                        title={label}>
                        {label}
                      </div>
                    );
                  }
                  // CRM meeting
                  if (ev._isMeeting) {
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                        className="text-xs px-2 py-1 rounded font-medium truncate transition-colors flex items-center gap-1 cursor-pointer bg-accent/10 text-accent hover:bg-accent/20">
                        <span className="truncate">{ev.title}</span>
                      </div>
                    );
                  }
                  // Deal event
                  const bg      = eventColor(ev);
                  const street  = streetAddress(ev._dealAddress);
                  const fullLbl = street ? `${street} — ${ev.title}` : ev.title;
                  const dispLbl = ev._isCompleted ? `✓ ${fullLbl}` : fullLbl;
                  const isOvr   = ev._isOverdue && !ev._isCompleted;
                  return (
                    <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      className="text-xs px-2 py-1 rounded font-medium truncate cursor-pointer text-white transition-all hover:brightness-110"
                      style={{
                        backgroundColor: bg,
                        opacity: ev._isCompleted ? 0.5 : undefined,
                        borderLeft: isOvr ? '3px solid #b91c1c' : undefined,
                      }}
                      title={fullLbl}>
                      {dispLbl}
                    </div>
                  );
                })}
                {dayEvents.length > 4 && (
                  <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function CalendarView() {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const today    = new Date();
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [meetings, setMeetings]   = useState([]);
  const [dealEvents, setDealEvents] = useState([]);
  const [gcalEvents, setGcalEvents] = useState([]);
  const [deals, setDeals]         = useState({});
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [selectedDealEvent, setSelectedDealEvent] = useState(null);
  const [selectedGCalEvent, setSelectedGCalEvent] = useState(null);
  const [connection, setConn]     = useState(null);
  const [syncing, setSyncing]     = useState(false);
  const [schedulerLinks, setSchedulerLinks] = useState([]);
  const [newSlug, setNewSlug]     = useState('');
  const [copied, setCopied]       = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // People filter — map of user_id → visible (true = shown)
  const [visibleMembers, setVisibleMembers] = useState({});

  // Deal date category filters
  const [dealDateFilters, setDealDateFilters] = useState({
    milestone:      true,
    land_closing:   true,
    home_closing:   true,
    contract:       true,
    listed_delivery: true,
  });
  const toggleDealFilter = (key) =>
    setDealDateFilters(prev => ({ ...prev, [key]: !prev[key] }));

  const canManage = can('calendar.manage');

  // ── Build member colors from unique user_ids in gcalEvents ────────────────
  const memberColors = useMemo(() => {
    const ids = gcalEvents.map(e => e.user_id);
    return buildMemberColors(ids);
  }, [gcalEvents]);

  // Unique members who have gcal events (for the people filter)
  const gcalMembers = useMemo(() => {
    const seen = new Set();
    return gcalEvents.reduce((acc, e) => {
      if (!seen.has(e.user_id)) {
        seen.add(e.user_id);
        acc.push({ user_id: e.user_id, profile: e.profiles });
      }
      return acc;
    }, []);
  }, [gcalEvents]);

  // Initialize visibleMembers when gcalMembers changes (default all visible)
  useEffect(() => {
    setVisibleMembers(prev => {
      const next = { ...prev };
      gcalMembers.forEach(m => {
        if (!(m.user_id in next)) next[m.user_id] = true;
      });
      return next;
    });
  }, [gcalMembers]);

  const loadAll = async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59).toISOString();

    const [m, conn, links, evts, gcal] = await Promise.all([
      fetchMeetings(activeOrgId, { from, to }),
      fetchCalendarConnection(profile?.id),
      fetchSchedulerLinks(activeOrgId),
      fetchOrgEvents(activeOrgId, { from, to }),
      fetchGCalEvents(activeOrgId, { from, to }),
    ]);

    setMeetings(m);
    setConn(conn);
    setSchedulerLinks(links);
    setDealEvents(evts);
    setGcalEvents(gcal);

    if (evts.length > 0 && supabase) {
      const dealIds = [...new Set(evts.map(e => e.deal_id).filter(Boolean))];
      const { data: dealRows } = await supabase
        .from('deals').select('id, address').in('id', dealIds);
      if (dealRows) setDeals(Object.fromEntries(dealRows.map(d => [d.id, d])));
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [activeOrgId, year, month]); // eslint-disable-line

  // Auto-sync Google Calendar: on mount, every 5 min, and on tab focus
  useEffect(() => {
    if (!activeOrgId) return;
    const runSync = () => {
      syncOrgCalendars(activeOrgId).then(() => {
        const from = new Date(year, month, 1).toISOString();
        const to   = new Date(year, month + 1, 0, 23, 59).toISOString();
        fetchGCalEvents(activeOrgId, { from, to }).then(setGcalEvents);
      });
    };
    runSync();
    const interval = setInterval(runSync, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') runSync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeOrgId, year, month]); // eslint-disable-line

  // Real-time: deal_events
  useEffect(() => {
    if (!supabase || !activeOrgId) return;
    const ch = supabase
      .channel(`global-deal-events-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_events' }, () => {
        const from = new Date(year, month, 1).toISOString();
        const to   = new Date(year, month + 1, 0, 23, 59).toISOString();
        fetchOrgEvents(activeOrgId, { from, to }).then(evts => {
          setDealEvents(evts);
          if (evts.length > 0) {
            const dealIds = [...new Set(evts.map(e => e.deal_id).filter(Boolean))];
            supabase.from('deals').select('id, address').in('id', dealIds)
              .then(({ data }) => {
                if (data) setDeals(d => ({ ...d, ...Object.fromEntries(data.map(r => [r.id, r])) }));
              });
          }
        });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeOrgId, year, month]); // eslint-disable-line

  // Real-time: google_calendar_events
  useEffect(() => {
    if (!supabase || !activeOrgId) return;
    const ch = supabase
      .channel(`gcal-events-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'google_calendar_events' }, () => {
        const from = new Date(year, month, 1).toISOString();
        const to   = new Date(year, month + 1, 0, 23, 59).toISOString();
        fetchGCalEvents(activeOrgId, { from, to }).then(setGcalEvents);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeOrgId, year, month]); // eslint-disable-line

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const handleSaved = (meeting, isEdit) => {
    if (isEdit) setMeetings(prev => prev.map(m => m.id === meeting.id ? meeting : m));
    else        setMeetings(prev => [...prev, meeting]);
    setShowNew(false); setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    await deleteMeeting(id);
    setMeetings(prev => prev.filter(m => m.id !== id));
    setEditing(null);
  };

  const handleSync = async () => {
    if (!activeOrgId) return;
    setSyncing(true);
    const { error: syncErr } = await syncOrgCalendars(activeOrgId);
    if (syncErr) { alert('Sync failed: ' + syncErr); setSyncing(false); return; }
    setSyncing(false);
    // Reload gcal events after sync
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59).toISOString();
    fetchGCalEvents(activeOrgId, { from, to }).then(setGcalEvents);
  };

  const copyLink = async (slug) => {
    await navigator.clipboard.writeText(`${window.location.origin}/schedule/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const createLink = async () => {
    if (!newSlug.trim()) return;
    const { data } = await createSchedulerLink(activeOrgId, profile?.id, {
      slug: newSlug.trim(), title: '30-min Meeting', duration_minutes: 30,
    });
    if (data) { setSchedulerLinks(prev => [data, ...prev]); setNewSlug(''); }
  };

  // ── Merge and filter all calendar events ───────────────────────────────────
  const taggedMeetings   = meetings.map(m => ({ ...m, _isMeeting: true }));
  const taggedDealEvents = dealEvents
    .map(e => ({ ...e, _dealAddress: deals[e.deal_id]?.address || null }))
    .filter(e => {
      if (e.event_type === 'stage_change' || e.event_type === 'contractor') return false;
      const cat = dealDateCategory(e);
      if (!cat) return true;
      return dealDateFilters[cat] !== false;
    });

  // Deduplicate gcal events against CRM meetings: if a gcal event has the same
  // title (case-insensitive) on the same calendar day as a CRM meeting, skip it.
  const meetingKeys = new Set(
    taggedMeetings.map(m =>
      `${(m.title || '').toLowerCase().trim()}|${m.starts_at?.slice(0, 10)}`
    )
  );
  const taggedGCal = gcalEvents
    .filter(e => visibleMembers[e.user_id] !== false)
    .filter(e => {
      const key = `${(e.title || '').toLowerCase().trim()}|${e.start_at?.slice(0, 10)}`;
      return !meetingKeys.has(key);
    })
    .map(e => ({ ...e, _isGCal: true }));

  const allCalendarEvents = [...taggedGCal, ...taggedMeetings, ...taggedDealEvents].filter(e => {
    if (activeFilter === 'all')     return true;
    if (activeFilter === 'gcal')    return e._isGCal;
    if (activeFilter === 'meeting') return e._isMeeting;
    return !e._isMeeting && !e._isGCal && e.event_type === activeFilter;
  });

  const upcomingAll = allCalendarEvents
    .filter(e => new Date(e._isGCal ? e.start_at : e._isMeeting ? e.starts_at : e.start_at) >= today)
    .sort((a, b) => {
      const ta = new Date(a._isGCal ? a.start_at : a._isMeeting ? a.starts_at : a.start_at);
      const tb = new Date(b._isGCal ? b.start_at : b._isMeeting ? b.starts_at : b.start_at);
      return ta - tb;
    })
    .slice(0, 12);

  const handleEventClick = (ev) => {
    if (ev._isGCal)    setSelectedGCalEvent(ev);
    else if (ev._isMeeting) setEditing(ev);
    else               setSelectedDealEvent(ev);
  };

  const toggleMember = (uid) =>
    setVisibleMembers(prev => ({ ...prev, [uid]: !prev[uid] }));

  return (
    <div className="w-full flex gap-6">
      {/* ── Left: Calendar ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Google Calendar connection banners */}
        {!connection && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">Google Calendar not connected</p>
              <p className="text-xs text-blue-600 mt-0.5">Connect your Google account in Settings → Integrations to sync your events to the team calendar.</p>
            </div>
            <a href="/settings?tab=integrations"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-xl whitespace-nowrap"
              style={{ backgroundColor: '#4285f4' }}>
              Go to Settings
            </a>
          </div>
        )}
        {connection && (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <p className="text-xs font-medium text-green-700">Google Calendar connected — {connection.gmail_email}</p>
            </div>
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 disabled:opacity-50">
              <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync all'}
            </button>
          </div>
        )}

        {/* Calendar card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                className="px-3 py-1.5 text-xs font-semibold text-accent border border-accent/30 rounded-xl hover:bg-accent/5">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronRight size={16} /></button>
              {canManage && (
                <>
                  <button onClick={() => setShowNew(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 ml-1">
                    <Plus size={12} /> Meeting
                  </button>
                  <button onClick={() => setShowAddEvent(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-xl"
                    style={{ backgroundColor: '#c9703a' }}>
                    <Plus size={12} /> Event
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            {FILTER_CHIPS.map(chip => (
              <button key={chip.key} onClick={() => setActiveFilter(chip.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                  activeFilter === chip.key
                    ? 'bg-accent text-white border-accent'
                    : 'text-gray-500 border-gray-200 hover:border-accent/40 hover:text-accent'
                }`}>
                {chip.label}
              </button>
            ))}
          </div>

          {/* Team member legend */}
          {gcalMembers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-50">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mr-1">People</span>
              {gcalMembers.map(m => {
                const color   = memberColors[m.user_id] || '#9E9E9E';
                const visible = visibleMembers[m.user_id] !== false;
                return (
                  <button key={m.user_id} onClick={() => toggleMember(m.user_id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                      visible
                        ? 'border-transparent text-white'
                        : 'border-gray-200 text-gray-400 bg-white'
                    }`}
                    style={visible ? { backgroundColor: color } : undefined}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: visible ? 'rgba(255,255,255,0.7)' : color }} />
                    {memberName(m.profile).split(' ')[0]}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <MonthGrid
              year={year} month={month}
              allEvents={allCalendarEvents}
              onDayClick={() => { if (canManage) setShowNew(true); }}
              onEventClick={handleEventClick}
              memberColors={memberColors}
            />
          )}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Upcoming */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming</p>
          {upcomingAll.length === 0 ? (
            <p className="text-xs text-gray-300 italic py-2">No upcoming events</p>
          ) : (
            <div className="space-y-2">
              {upcomingAll.map(ev => {
                // Google Calendar event
                if (ev._isGCal) {
                  const color = memberColors[ev.user_id] || '#9E9E9E';
                  const name  = ev.profiles?.first_name || 'Team';
                  return (
                    <button key={ev.id} onClick={() => setSelectedGCalEvent(ev)}
                      className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <p className="text-xs font-semibold text-gray-800 truncate flex-1">{ev.title}</p>
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">{name} · {fmtGCalTime(ev)}</p>
                    </button>
                  );
                }
                // CRM meeting
                if (ev._isMeeting) {
                  return (
                    <button key={ev.id} onClick={() => setEditing(ev)}
                      className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-accent/30 hover:bg-orange-50/30 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">📅</span>
                        <p className="text-xs font-semibold text-gray-800 truncate flex-1">{ev.title}</p>
                      </div>
                      <p className="text-[10px] text-gray-400">{fmtMeetingTime(ev.starts_at, ev.ends_at)}</p>
                    </button>
                  );
                }
                // Deal event
                const addr   = deals[ev.deal_id]?.address;
                const street = streetAddress(addr);
                const color  = eventColor(ev);
                return (
                  <button key={ev.id} onClick={() => setSelectedDealEvent(ev)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      ev._isOverdue
                        ? 'border-red-100 bg-red-50/40 hover:border-red-200'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <p className={`text-xs font-semibold truncate flex-1 ${ev._isOverdue ? 'text-red-700' : 'text-gray-800'}`}>
                        {ev._isCompleted ? '✓ ' : ''}{ev.title}
                      </p>
                      {ev._isOverdue && (
                        <span className="text-[9px] font-bold text-red-500 flex-shrink-0">OVERDUE</span>
                      )}
                    </div>
                    {street && <p className="text-[10px] text-gray-400 truncate pl-3.5">{street}</p>}
                    <p className="text-[10px] text-gray-400 pl-3.5">{fmtEventDate(ev.start_at, ev.end_at, ev.all_day)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Deal Dates filter */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Deal Dates</p>
          <div className="space-y-2">
            {[
              { key: 'milestone',       label: 'Milestones',        color: '#3b82f6' },
              { key: 'land_closing',    label: 'Land Closings',     color: '#10b981' },
              { key: 'home_closing',    label: 'Home Closings',     color: '#059669' },
              { key: 'contract',        label: 'Contract Dates',    color: '#4f46e5' },
              { key: 'listed_delivery', label: 'Listed & Delivery', color: '#0284c7' },
            ].map(({ key, label, color }) => (
              <button key={key} onClick={() => toggleDealFilter(key)}
                className="w-full flex items-center gap-2 text-left group">
                <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-colors"
                  style={dealDateFilters[key]
                    ? { backgroundColor: color, borderColor: color }
                    : { borderColor: '#d1d5db', backgroundColor: 'white' }}>
                  {dealDateFilters[key] && <Check size={8} className="text-white" />}
                </div>
                <span className="text-xs text-gray-600 flex-1 group-hover:text-gray-800 transition-colors">{label}</span>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              </button>
            ))}
          </div>
        </div>

        {/* Scheduler links */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Scheduler Links</p>
          <div className="space-y-2 mb-3">
            {schedulerLinks.map(link => (
              <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 group">
                <Link2 size={12} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{link.title}</p>
                  <p className="text-[10px] text-gray-400">{link.duration_minutes} min</p>
                </div>
                <button onClick={() => copyLink(link.slug)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-accent transition-colors">
                  {copied === link.slug ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
                <button onClick={() => deleteSchedulerLink(link.id).then(() => setSchedulerLinks(prev => prev.filter(l => l.id !== link.id)))}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {schedulerLinks.length === 0 && <p className="text-xs text-gray-300 italic">No scheduler links yet</p>}
          </div>
          {canManage && (
            <div className="flex gap-1.5">
              <input value={newSlug} onChange={e => setNewSlug(e.target.value)}
                placeholder="my-meeting-link"
                className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <button onClick={createLink} disabled={!newSlug.trim()}
                className="px-2.5 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40"
                style={{ backgroundColor: '#c9703a' }}>
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Meeting modal ──────────────────────────────────────────────────── */}
      {(showNew || editing) && (
        <div className="fixed inset-0 z-50">
          {editing ? (
            <div className="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditing(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">{editing.title}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtMeetingTime(editing.starts_at, editing.ends_at)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button onClick={() => handleDelete(editing.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button onClick={() => setEditing(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {editing.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                      <span>{editing.location}</span>
                    </div>
                  )}
                  {editing.attendee_emails?.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Users size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs">{editing.attendee_emails.join(', ')}</span>
                    </div>
                  )}
                  {editing.description && <p className="text-sm text-gray-600 leading-relaxed">{editing.description}</p>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${(MEETING_STATUS[editing.status] || MEETING_STATUS.scheduled).cls}`}>
                    {(MEETING_STATUS[editing.status] || MEETING_STATUS.scheduled).label}
                  </span>
                  {canManage && (
                    <div className="flex gap-2 pt-2">
                      {['completed','no-show','cancelled'].map(s => (
                        <button key={s} onClick={async () => {
                          const { data } = await updateMeeting(editing.id, { status: s });
                          if (data) { setMeetings(prev => prev.map(m => m.id === data.id ? data : m)); setEditing(null); }
                        }}
                          className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-accent/50 hover:text-accent capitalize">
                          {s.replace('-',' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <MeetingModal orgId={activeOrgId} userId={profile?.id} onSaved={handleSaved} onClose={() => setShowNew(false)} />
          )}
        </div>
      )}

      {/* ── Google Calendar event popover ─────────────────────────────────── */}
      {selectedGCalEvent && (
        <GCalEventPopover
          event={selectedGCalEvent}
          color={memberColors[selectedGCalEvent.user_id] || '#9E9E9E'}
          currentUserId={profile?.id}
          onClose={() => setSelectedGCalEvent(null)}
        />
      )}

      {/* ── Deal event popover ────────────────────────────────────────────── */}
      {selectedDealEvent && (
        <DealEventPopover
          event={selectedDealEvent}
          dealAddress={deals[selectedDealEvent.deal_id]?.address}
          onClose={() => setSelectedDealEvent(null)}
          navigate={navigate}
        />
      )}

      {/* ── Add Event modal ───────────────────────────────────────────────── */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[360px] text-center">
            <p className="text-sm font-semibold text-gray-800 mb-2">Add Event</p>
            <p className="text-xs text-gray-500 mb-4">
              To add an event, navigate to a deal and click the <strong>Event</strong> button in the deal actions bar, or use the <strong>Events</strong> tab.
            </p>
            <button onClick={() => setShowAddEvent(false)}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl"
              style={{ backgroundColor: '#c9703a' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
