/**
 * AddEventModal — create a deal event from the quick-action bar or Events tab.
 * Inserts into deal_events and posts an activity note.
 */
import { useState, useEffect } from 'react';
import { X, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createDealEvent, EVENT_TYPES } from '../../lib/dealEvents';
import { useAuth } from '../../lib/AuthContext';

export default function AddEventModal({ deal, onSaved, onClose }) {
  const { profile, activeOrgId } = useAuth();

  const [title,       setTitle]       = useState('');
  const [eventType,   setEventType]   = useState('meeting');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [time,        setTime]        = useState('');
  const [endTime,     setEndTime]     = useState('');
  const [location,    setLocation]    = useState('');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    setError(null);

    const allDay  = !time;
    const startAt = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
    const endAt   = (!allDay && endTime) ? `${date}T${endTime}:00` : null;

    const userName = profile?.name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      || null;

    const { data: event, error: eventErr } = await createDealEvent(
      activeOrgId, deal.id, profile?.id, userName,
      { title: title.trim(), event_type: eventType, start_at: startAt, end_at: endAt,
        all_day: allDay, location: location.trim() || null,
        description: description.trim() || null }
    );

    if (eventErr) { setError(eventErr.message); setSaving(false); return; }

    // Also post an activity note so it shows in the Activity tab
    if (supabase && activeOrgId) {
      const dateLabel = new Date(startAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      await supabase.from('activity_notes').insert({
        organization_id: activeOrgId,
        deal_id:         deal.id,
        author_id:       profile?.id,
        author_name:     userName,
        body:            `Event added: ${title.trim()} on ${dateLabel}`,
        note_type:       'manual',
      });
    }

    onSaved(event);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-accent" />
            <h2 className="text-base font-semibold text-gray-800">Add Event</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="e.g. Septic install inspection"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Event Type
              </label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {/* Start + End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Start Time <span className="text-gray-300 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                End Time <span className="text-gray-300 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Location <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Address or link"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Notes <span className="text-gray-300 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Any additional details…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!title.trim() || !date || saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#c9703a' }}
            >
              {saving ? 'Saving…' : 'Add Event'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
