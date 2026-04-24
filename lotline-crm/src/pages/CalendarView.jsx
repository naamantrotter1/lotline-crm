/**
 * CalendarView.jsx
 * Phase 14: Calendar page — month view with meeting list, create/edit modal,
 * Google Calendar connect banner, and scheduler link management.
 */
import { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Loader2,
  Video, Phone, Users, MapPin,
  RefreshCw, Link2, Trash2, Check, X, Copy,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchMeetings, createMeeting, updateMeeting, deleteMeeting,
  fetchCalendarConnection, syncGoogleCalendar,
  fetchSchedulerLinks, createSchedulerLink, deleteSchedulerLink,
  MEETING_TYPES, MEETING_STATUS, fmtMeetingTime,
} from '../lib/calendarData';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function typeIcon(type) {
  return MEETING_TYPES.find(t => t.value === type)?.icon || '📅';
}

// ── Meeting modal ─────────────────────────────────────────────────────────────
function MeetingModal({ orgId, userId, meeting, onSaved, onClose }) {
  const [title, setTitle]       = useState(meeting?.title || '');
  const [type, setType]         = useState(meeting?.meeting_type || 'video');
  const [date, setDate]         = useState(meeting?.starts_at ? meeting.starts_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [startTime, setStart]   = useState(meeting?.starts_at ? meeting.starts_at.slice(11, 16) : '10:00');
  const [endTime, setEnd]       = useState(meeting?.ends_at   ? meeting.ends_at.slice(11, 16)   : '10:30');
  const [location, setLocation] = useState(meeting?.location || '');
  const [attendees, setAttendees] = useState((meeting?.attendee_emails || []).join(', '));
  const [description, setDesc]  = useState(meeting?.description || '');
  const [saving, setSaving]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const patch = {
      title: title.trim(),
      meeting_type: type,
      starts_at: `${date}T${startTime}:00`,
      ends_at:   `${date}T${endTime}:00`,
      location:  location.trim() || null,
      attendee_emails: attendees.split(',').map(a => a.trim()).filter(Boolean),
      description: description.trim() || null,
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

// ── Month grid ────────────────────────────────────────────────────────────────
function MonthGrid({ year, month, meetings, onDayClick, onMeetingClick }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const meetingsForDay = (day) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return meetings.filter(m => m.starts_at?.startsWith(dateStr));
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
          const dayMeetings = meetingsForDay(day);
          return (
            <div key={day} onClick={() => onDayClick(day)}
              className="bg-white min-h-[120px] p-2 cursor-pointer hover:bg-orange-50/50 transition-colors group">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mb-1.5 ${
                isToday ? 'bg-accent text-white' : 'text-gray-600 group-hover:bg-accent/10'
              }`}>
                {day}
              </div>
              <div className="space-y-1">
                {dayMeetings.slice(0, 4).map(m => (
                  <div key={m.id} onClick={e => { e.stopPropagation(); onMeetingClick(m); }}
                    className="text-xs px-2 py-1 rounded bg-accent/10 text-accent font-medium truncate hover:bg-accent/20 transition-colors">
                    {m.title}
                  </div>
                ))}
                {dayMeetings.length > 4 && (
                  <div className="text-xs text-gray-400 px-1">+{dayMeetings.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CalendarView() {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const today = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth());
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [editing, setEditing]   = useState(null);
  const [connection, setConn]   = useState(null);
  const [syncing, setSyncing]   = useState(false);
  const [schedulerLinks, setSchedulerLinks] = useState([]);
  const [newSlug, setNewSlug]   = useState('');
  const [copied, setCopied]     = useState(null);
  const canManage = can('calendar.manage');

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59).toISOString();
    Promise.all([
      fetchMeetings(activeOrgId, { from, to }),
      fetchCalendarConnection(profile?.id),
      fetchSchedulerLinks(activeOrgId),
    ]).then(([m, conn, links]) => {
      setMeetings(m);
      setConn(conn);
      setSchedulerLinks(links);
      setLoading(false);
    });
  }, [activeOrgId, year, month]);


  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const handleSaved = (meeting, isEdit) => {
    if (isEdit) {
      setMeetings(prev => prev.map(m => m.id === meeting.id ? meeting : m));
    } else {
      setMeetings(prev => [...prev, meeting]);
    }
    setShowNew(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    await deleteMeeting(id);
    setMeetings(prev => prev.filter(m => m.id !== id));
    setEditing(null);
  };

  const handleSync = async () => {
    if (!connection) return;
    setSyncing(true);
    const { error: syncErr } = await syncGoogleCalendar();
    if (syncErr) { alert('Sync failed: ' + syncErr); setSyncing(false); return; }
    setSyncing(false);
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59).toISOString();
    fetchMeetings(activeOrgId, { from, to }).then(setMeetings);
  };

  const copyLink = async (slug) => {
    await navigator.clipboard.writeText(`${window.location.origin}/schedule/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const createLink = async () => {
    if (!newSlug.trim()) return;
    const { data } = await createSchedulerLink(activeOrgId, profile?.id, {
      slug: newSlug.trim(),
      title: '30-min Meeting',
      duration_minutes: 30,
    });
    if (data) { setSchedulerLinks(prev => [data, ...prev]); setNewSlug(''); }
  };

  const upcomingMeetings = meetings
    .filter(m => new Date(m.starts_at) >= today)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 10);

  return (
    <div className="w-full flex gap-6">
      {/* Left: Calendar + Google connect */}
      <div className="flex-1 min-w-0 space-y-4">
        {!connection && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-800">Google Calendar not connected</p>
              <p className="text-xs text-blue-600 mt-0.5">Connect your Google account in Settings → Integrations to sync meetings.</p>
            </div>
            <a href="/settings?tab=integrations"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-xl whitespace-nowrap"
              style={{ backgroundColor: '#4285f4' }}
            >
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
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>
        )}

        {/* Month nav */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                className="px-3 py-1.5 text-xs font-semibold text-accent border border-accent/30 rounded-xl hover:bg-accent/5">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100"><ChevronRight size={16} /></button>
              {canManage && (
                <button onClick={() => setShowNew(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-xl ml-2"
                  style={{ backgroundColor: '#c9703a' }}>
                  <Plus size={13} /> New
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : (
            <MonthGrid
              year={year} month={month} meetings={meetings}
              onDayClick={(day) => { if (canManage) setShowNew(true); }}
              onMeetingClick={setEditing}
            />
          )}
        </div>
      </div>

      {/* Right panel: Upcoming + Scheduler links */}
      <div className="w-72 flex-shrink-0 space-y-4">
        {/* Upcoming meetings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming</p>
          {upcomingMeetings.length === 0 ? (
            <p className="text-xs text-gray-300 italic py-2">No upcoming meetings</p>
          ) : (
            <div className="space-y-2">
              {upcomingMeetings.map(m => {
                const st = MEETING_STATUS[m.status] || MEETING_STATUS.scheduled;
                return (
                  <button key={m.id} onClick={() => setEditing(m)}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-accent/30 hover:bg-orange-50/30 transition-colors group">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{typeIcon(m.meeting_type)}</span>
                      <p className="text-xs font-semibold text-gray-800 truncate flex-1">{m.title}</p>
                    </div>
                    <p className="text-[10px] text-gray-400">{fmtMeetingTime(m.starts_at, m.ends_at)}</p>
                    {m.location && <p className="text-[10px] text-gray-400 truncate mt-0.5">📍 {m.location}</p>}
                  </button>
                );
              })}
            </div>
          )}
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

      {/* Meeting modal */}
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
                      <>
                        <button onClick={() => { setShowNew(false); /* editing will open modal */ setEditing(null); setTimeout(() => setEditing(editing), 0); }}
                          className="px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(editing.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button onClick={() => setEditing(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>{typeIcon(editing.meeting_type)}</span>
                    <span className="capitalize">{MEETING_TYPES.find(t => t.value === editing.meeting_type)?.label || editing.meeting_type}</span>
                  </div>
                  {editing.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400 flex-shrink-0" />
                      <a href={editing.location.startsWith('http') ? editing.location : undefined}
                        target="_blank" rel="noopener noreferrer"
                        className={editing.location.startsWith('http') ? 'text-accent hover:underline' : ''}>
                        {editing.location}
                      </a>
                    </div>
                  )}
                  {editing.attendee_emails?.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Users size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs">{editing.attendee_emails.join(', ')}</span>
                    </div>
                  )}
                  {editing.description && <p className="text-sm text-gray-600 leading-relaxed">{editing.description}</p>}
                  <div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${(MEETING_STATUS[editing.status] || MEETING_STATUS.scheduled).cls}`}>
                      {(MEETING_STATUS[editing.status] || MEETING_STATUS.scheduled).label}
                    </span>
                  </div>
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
            <MeetingModal
              orgId={activeOrgId} userId={profile?.id}
              onSaved={handleSaved} onClose={() => setShowNew(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
