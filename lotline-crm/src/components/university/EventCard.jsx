import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';

function fmtWhen(starts, tz) {
  const d = new Date(starts);
  return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const TONE = {
  scheduled: 'bg-amber-50  text-amber-700  border-amber-100',
  live:      'bg-rose-50   text-rose-700   border-rose-200',
  completed: 'bg-gray-100  text-gray-500   border-gray-200',
  cancelled: 'bg-gray-100  text-gray-400   border-gray-200',
};

export default function EventCard({ event }) {
  return (
    <Link to={`/university/events/${event.id}`} className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow">
      <div className="aspect-[3/1] bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-4xl">
        {event.cover_image_url
          ? <img src={event.cover_image_url} alt="" className="w-full h-full object-cover" />
          : '🎟️'}
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${TONE[event.status] || TONE.scheduled}`}>{event.status}</span>
          {event.my_rsvp && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent uppercase tracking-wider">
              {event.my_rsvp}
            </span>
          )}
        </div>
        <p className="text-base font-semibold text-gray-900">{event.title}</p>
        {event.host_name && <p className="text-xs text-gray-400 mt-0.5">Hosted by {event.host_name}</p>}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1"><Calendar size={12} /> {fmtWhen(event.starts_at, event.timezone)}</span>
          {event.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {event.location}</span>}
          {event.rsvp_counts && <span className="inline-flex items-center gap-1"><Users size={12} /> {event.rsvp_counts.going}</span>}
        </div>
      </div>
    </Link>
  );
}
