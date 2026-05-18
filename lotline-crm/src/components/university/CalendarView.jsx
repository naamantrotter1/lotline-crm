// Simple month calendar grid — no external deps.
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function startOfMonth(d) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }
function endOfMonth(d)   { const x = new Date(d); x.setMonth(x.getMonth() + 1, 0); x.setHours(23, 59, 59, 999); return x; }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarView({ events }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const last  = endOfMonth(cursor);
    const padStart = first.getDay();
    const totalDays = last.getDate();
    const cells = [];
    for (let i = 0; i < padStart; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const day = new Date(first.getFullYear(), first.getMonth(), d);
      cells.push({
        date: day,
        events: events.filter(e => {
          const ed = new Date(e.starts_at);
          return ed.getFullYear() === day.getFullYear()
              && ed.getMonth()    === day.getMonth()
              && ed.getDate()     === day.getDate();
        }),
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor, events]);

  const title = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          ><ChevronLeft size={14} /></button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800"
          >Today</button>
          <button
            onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          ><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-[10px] uppercase tracking-widest text-gray-400 px-3 pt-2">
        {WEEKDAYS.map(d => <div key={d} className="py-1 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 px-3 pb-3 gap-1">
        {cells.map((c, i) => (
          <div key={i} className={`min-h-[80px] rounded-lg border ${c ? 'border-gray-100 bg-white' : 'border-transparent'}`}>
            {c && (
              <>
                <p className="text-[11px] text-gray-400 px-2 pt-1">{c.date.getDate()}</p>
                <div className="px-1 space-y-0.5">
                  {c.events.slice(0, 3).map(e => (
                    <Link
                      key={e.id} to={`/university/events/${e.id}`}
                      className="block truncate text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-accent hover:bg-orange-100"
                    >
                      {new Date(e.starts_at).toLocaleTimeString([], { hour: 'numeric' })} {e.title}
                    </Link>
                  ))}
                  {c.events.length > 3 && (
                    <p className="text-[10px] text-gray-400 px-1.5">+{c.events.length - 3} more</p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
