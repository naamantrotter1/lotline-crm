/**
 * SchedulerPage.jsx
 * Phase 14: Public meeting booking page at /schedule/:slug
 * No auth required — anyone can book a meeting.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchSchedulerLink, bookMeeting, fetchMeetings } from '../lib/calendarData';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function generateTimeSlots(date, link, bookedMeetings) {
  const slots = [];
  const avail = link.availability || [];
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const window = avail.find(a => a.day === dayOfWeek);
  if (!window) return [];

  const [startH, startM] = window.start.split(':').map(Number);
  const [endH, endM]     = window.end.split(':').map(Number);
  const duration = link.duration_minutes || 30;
  const buffer   = link.buffer_minutes   || 15;

  let h = startH, m = startM;
  while (h * 60 + m + duration <= endH * 60 + endM) {
    const slotStart = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const endsAt = new Date(`${date}T${slotStart}:00`);
    endsAt.setMinutes(endsAt.getMinutes() + duration);
    const slotEnd = endsAt.toTimeString().slice(0, 5);

    // Check if slot is taken
    const taken = bookedMeetings.some(meeting => {
      const ms = new Date(meeting.starts_at).getTime();
      const me = new Date(meeting.ends_at).getTime();
      const ss = new Date(`${date}T${slotStart}:00`).getTime();
      const se = endsAt.getTime();
      return ms < se && me > ss;
    });

    if (!taken) slots.push({ start: slotStart, end: slotEnd });
    m += duration + buffer;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }
  return slots;
}

export default function SchedulerPage() {
  const { slug } = useParams();
  const [link, setLink]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [selectedDate, setDate]   = useState(null);
  const [selectedSlot, setSlot]   = useState(null);
  const [bookedMeetings, setBooked] = useState([]);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [month, setMonth]         = useState(new Date().getMonth());
  const [step, setStep]           = useState('date'); // date|slot|form|confirm
  const [form, setForm]           = useState({ name: '', email: '', notes: '' });
  const [booking, setBooking]     = useState(false);
  const [booked, setBooked2]      = useState(null);

  useEffect(() => {
    fetchSchedulerLink(slug).then(l => {
      if (!l) { setNotFound(true); } else { setLink(l); }
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (!link || !selectedDate) return;
    fetchMeetings(link.organization_id, {
      from: `${selectedDate}T00:00:00`,
      to:   `${selectedDate}T23:59:59`,
    }).then(setBooked);
  }, [link, selectedDate]);

  const prevMonth = () => { if (month === 0) { setYear(y=>y-1); setMonth(11); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y=>y+1); setMonth(0); } else setMonth(m=>m+1); };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + (link?.max_future_days || 30));

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isAvailable = (day) => {
    if (!link) return false;
    const date = new Date(year, month, day);
    if (date < today || date > maxDate) return false;
    const avail = link.availability || [];
    return avail.some(a => a.day === date.getDay());
  };

  const handleDaySelect = (day) => {
    if (!isAvailable(day)) return;
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setDate(dateStr);
    setSlot(null);
    setStep('slot');
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !form.email.trim()) return;
    setBooking(true);
    const { data, error } = await bookMeeting({
      schedulerLinkId: link.id,
      orgId: link.organization_id,
      title: `${link.title} with ${form.name}`,
      startsAt: `${selectedDate}T${selectedSlot.start}:00`,
      endsAt:   `${selectedDate}T${selectedSlot.end}:00`,
      attendeeEmail: form.email,
      name: form.name,
      notes: form.notes,
    });
    setBooking(false);
    if (!error) { setBooked2(data); setStep('confirm'); }
  };

  const timeSlots = selectedDate
    ? generateTimeSlots(selectedDate, link || {}, bookedMeetings)
    : [];

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f3ee' }}>
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f3ee' }}>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-600">Booking link not found</p>
          <p className="text-sm text-gray-400 mt-1">This link may have been deactivated or doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f3ee' }}>
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">You're booked!</h2>
          <p className="text-sm text-gray-500">{link.title}</p>
          <p className="text-sm text-gray-600 mt-2 font-medium">{fmtDate(selectedDate)}</p>
          <p className="text-sm text-gray-500">{selectedSlot?.start} – {selectedSlot?.end}</p>
          <p className="text-xs text-gray-400 mt-4">A confirmation will be sent to {form.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: '#f5f3ee' }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ backgroundColor: '#c9703a' }}>
              {link.profiles?.full_name?.[0] || '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{link.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{link.profiles?.full_name}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock size={11} />{link.duration_minutes} min</span>
                <span className="flex items-center gap-1"><Calendar size={11} />Video call</span>
              </div>
            </div>
          </div>
          {link.description && <p className="text-sm text-gray-600 mt-4 leading-relaxed">{link.description}</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex min-h-[500px]">
            {/* Calendar picker */}
            <div className={`p-6 border-r border-gray-100 transition-all ${step === 'date' ? 'flex-1' : 'w-64 flex-shrink-0'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">{MONTHS[month]} {year}</h3>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft size={14} /></button>
                  <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight size={14} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400">{d[0]}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} />;
                  const avail = isAvailable(day);
                  const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button key={day} onClick={() => handleDaySelect(day)} disabled={!avail}
                      className={`aspect-square rounded-full text-xs font-medium transition-colors ${
                        isSelected ? 'bg-accent text-white' :
                        avail ? 'hover:bg-accent/10 text-gray-700' :
                        'text-gray-200 cursor-default'
                      }`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time slots / form */}
            {(step === 'slot' || step === 'form') && selectedDate && (
              <div className="flex-1 p-6">
                <button onClick={() => { setStep('date'); setSlot(null); }}
                  className="flex items-center gap-1 text-xs text-accent mb-4 hover:underline">
                  <ChevronLeft size={12} /> Back
                </button>
                <p className="text-sm font-semibold text-gray-700 mb-4">{fmtDate(selectedDate)}</p>

                {step === 'slot' && (
                  timeSlots.length === 0 ? (
                    <p className="text-xs text-gray-400">No available times on this date.</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {timeSlots.map(slot => (
                        <button key={slot.start} onClick={() => { setSlot(slot); setStep('form'); }}
                          className="w-full py-2.5 text-sm text-accent border border-accent/40 rounded-xl hover:bg-accent hover:text-white transition-colors font-medium">
                          {slot.start}
                        </button>
                      ))}
                    </div>
                  )
                )}

                {step === 'form' && selectedSlot && (
                  <form onSubmit={handleBook} className="space-y-4">
                    <div className="p-3 bg-accent/5 rounded-xl border border-accent/10 mb-2">
                      <p className="text-xs font-semibold text-accent">{selectedSlot.start} – {selectedSlot.end}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{link.duration_minutes} min · {fmtDate(selectedDate)}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Your name</label>
                      <input value={form.name} onChange={e => setForm(f=>({...f, name: e.target.value}))} required
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email address</label>
                      <input type="email" value={form.email} onChange={e => setForm(f=>({...f, email: e.target.value}))} required
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes <span className="text-gray-300 font-normal">(optional)</span></label>
                      <textarea value={form.notes} onChange={e => setForm(f=>({...f, notes: e.target.value}))} rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
                    </div>
                    <button type="submit" disabled={booking}
                      className="w-full py-3 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                      style={{ backgroundColor: '#c9703a' }}>
                      {booking ? 'Booking…' : 'Confirm Booking'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
