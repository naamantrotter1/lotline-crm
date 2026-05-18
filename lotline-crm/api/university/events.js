// GET    /api/university/events?range=upcoming|past  — list
// POST   /api/university/events                       — hub-admin create
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  if (req.method === 'GET') {
    const range = req.query?.range || 'upcoming';
    let q = `${url}/rest/v1/university_events?select=*,rsvps:university_event_rsvps(state,attended,user_id)`;
    if (range === 'upcoming') {
      q += `&or=(status.eq.scheduled,status.eq.live)&order=starts_at.asc`;
    } else {
      q += `&status=eq.completed&order=starts_at.desc`;
    }
    const r = await fetch(q, { headers: { apikey: anon, Authorization: userAuth } });
    if (!r.ok) return res.status(502).json({ error: 'events select failed' });
    const rows = await r.json();

    // Strip join_url unless RSVP=going AND within 30 min before start through end
    const now = Date.now();
    const visibleJoin = rows.map(e => {
      const start = new Date(e.starts_at).getTime();
      const end   = new Date(e.ends_at).getTime();
      const myRsvp = (e.rsvps || []).find(r => r.user_id === user.id);
      const inWindow = now >= start - 30 * 60 * 1000 && now <= end;
      const expose = !!(myRsvp?.state === 'going' && inWindow);
      const counts = {
        going:      (e.rsvps || []).filter(r => r.state === 'going').length,
        interested: (e.rsvps || []).filter(r => r.state === 'interested').length,
        declined:   (e.rsvps || []).filter(r => r.state === 'declined').length,
      };
      return {
        ...e,
        join_url:    expose ? e.join_url : null,
        my_rsvp:     myRsvp?.state || null,
        my_attended: myRsvp?.attended || false,
        rsvp_counts: counts,
        rsvps:       undefined, // don't leak full roster to non-admins
      };
    });
    return res.json({ events: visibleJoin });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title || !b.starts_at || !b.ends_at) return res.status(400).json({ error: 'title, starts_at, ends_at required' });

    // Get caller's hub org id; only admins of a publisher org can insert (RLS enforces)
    const profRes = await fetch(`${url}/rest/v1/profiles?select=active_organization_id&id=eq.${user.id}&limit=1`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const prof = (await profRes.json())[0];

    const r = await fetch(`${url}/rest/v1/university_events`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        publisher_org_id: prof?.active_organization_id || null,
        title:            b.title,
        description:      b.description || null,
        cover_image_url:  b.cover_image_url || null,
        host_name:        b.host_name || null,
        starts_at:        b.starts_at,
        ends_at:          b.ends_at,
        timezone:         b.timezone || 'America/New_York',
        join_url:         b.join_url || null,
        location:         b.location || 'Virtual',
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'insert failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ event: (await r.json())[0] });
  }

  return res.status(405).json({ error: 'GET or POST' });
}
