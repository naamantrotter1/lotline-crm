// Tiny ICS-file generator. No external deps. Returns a Blob URL + Google Calendar URL.

function pad(n) { return String(n).padStart(2, '0'); }
function toIcsDate(d) {
  const dt = new Date(d);
  return (
    dt.getUTCFullYear().toString() +
    pad(dt.getUTCMonth() + 1) +
    pad(dt.getUTCDate()) + 'T' +
    pad(dt.getUTCHours()) +
    pad(dt.getUTCMinutes()) +
    pad(dt.getUTCSeconds()) + 'Z'
  );
}
function escapeIcs(s = '') {
  return String(s).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
}

export function buildIcs(event) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LotLine Homes//University//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id || (Date.now() + '@lotline.app')}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(event.starts_at)}`,
    `DTEND:${toIcsDate(event.ends_at)}`,
    `SUMMARY:${escapeIcs(event.title || 'LotLine University event')}`,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    event.location    ? `LOCATION:${escapeIcs(event.location)}`       : null,
    event.join_url    ? `URL:${event.join_url}`                       : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadIcs(event, filename = 'lotline-event.ics') {
  const ics  = buildIcs(event);
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     event.title || 'LotLine University',
    details:  event.description || '',
    location: event.location || '',
    dates:    `${toIcsDate(event.starts_at)}/${toIcsDate(event.ends_at)}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
