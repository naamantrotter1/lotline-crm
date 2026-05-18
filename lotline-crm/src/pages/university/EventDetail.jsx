// /university/events/:id
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Calendar, MapPin, Users, ExternalLink, Download, Globe } from 'lucide-react';
import { fetchEvent, rsvpEvent } from '../../lib/university';
import { buildIcs, downloadIcs, googleCalendarUrl } from '../../lib/ics';

const RSVP_OPTIONS = [
  { id: 'going',      label: 'Going' },
  { id: 'interested', label: 'Interested' },
  { id: 'declined',   label: 'Decline' },
];

export default function EventDetail() {
  const { id } = useParams();
  const [event,   setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  const load = async () => {
    try { setLoading(true); setEvent(await fetchEvent(id)); }
    catch (e) { setError(e.message); }
    finally   { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const onRsvp = async (state) => {
    setSaving(true);
    try { await rsvpEvent(id, state); await load(); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
  if (error)   return <div className="p-6 text-sm text-red-600 bg-red-50 m-6 rounded-xl">{error}</div>;
  if (!event)  return null;

  const start = new Date(event.starts_at);
  const end   = new Date(event.ends_at);
  const isPast = event.status === 'completed';

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <Link to="/university/events" className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft size={13} /> Events
        </Link>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="aspect-[3/1] bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-5xl">
            {event.cover_image_url
              ? <img src={event.cover_image_url} alt="" className="w-full h-full object-cover" />
              : '🎟️'}
          </div>
          <div className="px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            {event.host_name && <p className="text-sm text-gray-500 mt-1">Hosted by {event.host_name}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1"><Calendar size={13} /> {start.toLocaleString()}</span>
              <span className="inline-flex items-center gap-1"><Globe size={13} /> {event.timezone}</span>
              {event.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {event.location}</span>}
              {event.rsvp_counts && <span className="inline-flex items-center gap-1"><Users size={13} /> {event.rsvp_counts.going} going</span>}
            </div>
            {event.description && (
              <p className="text-sm text-gray-700 mt-4 whitespace-pre-wrap leading-relaxed">{event.description}</p>
            )}

            {/* RSVP + actions */}
            {!isPast && (
              <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-gray-100">
                {RSVP_OPTIONS.map(o => (
                  <button
                    key={o.id}
                    onClick={() => onRsvp(o.id)}
                    disabled={saving}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${
                      event.my_rsvp === o.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-gray-200 text-gray-700 hover:border-accent/40'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
                <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 hover:border-accent/40">
                  <Calendar size={12} /> Google Cal
                </a>
                <button onClick={() => downloadIcs(event)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 hover:border-accent/40">
                  <Download size={12} /> .ics
                </button>
              </div>
            )}

            {/* Join link (only when going + within 30 min before start) */}
            {!isPast && event.join_url && (
              <a href={event.join_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">
                <ExternalLink size={14} /> Join event
              </a>
            )}
            {!isPast && !event.join_url && event.my_rsvp === 'going' && (
              <p className="mt-4 text-xs text-gray-400">Join link will appear 30 minutes before start.</p>
            )}

            {/* Recording */}
            {isPast && event.recording_url && (
              <a href={event.recording_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90">
                <ExternalLink size={14} /> Watch recording
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
