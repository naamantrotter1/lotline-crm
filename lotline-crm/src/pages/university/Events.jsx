// /university/events
import { useEffect, useState } from 'react';
import { Loader2, List, Calendar as CalIcon } from 'lucide-react';
import { fetchEvents } from '../../lib/university';
import EventCard from '../../components/university/EventCard';
import CalendarView from '../../components/university/CalendarView';

export default function Events() {
  const [range, setRange]     = useState('upcoming');
  const [view, setView]       = useState('list');
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { setLoading(true); setEvents(await fetchEvents(range)); }
      catch (e) { if (alive) setError(e.message); }
      finally   { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [range]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Events</h1>
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button onClick={() => setRange('upcoming')}
                className={`px-3 py-1.5 text-xs ${range === 'upcoming' ? 'bg-accent text-white' : 'text-gray-500'}`}>Upcoming</button>
              <button onClick={() => setRange('past')}
                className={`px-3 py-1.5 text-xs ${range === 'past' ? 'bg-accent text-white' : 'text-gray-500'}`}>Past</button>
            </div>
            <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button onClick={() => setView('list')}
                className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-accent text-white' : 'text-gray-500'}`}><List size={13} /></button>
              <button onClick={() => setView('calendar')}
                className={`px-2.5 py-1.5 ${view === 'calendar' ? 'bg-accent text-white' : 'text-gray-500'}`}><CalIcon size={13} /></button>
            </div>
          </div>
        </div>

        {loading && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>}
        {!loading && error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-sm text-gray-400">No events {range === 'upcoming' ? 'scheduled yet' : 'in the archive'}.</div>
        )}

        {!loading && view === 'list' && events.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        )}
        {!loading && view === 'calendar' && <CalendarView events={events} />}
      </div>
    </div>
  );
}
