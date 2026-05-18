// GET    /api/university/event?id=<uuid>                   — single event detail
// PATCH  /api/university/event?id=<uuid>                   — hub-admin edits
// DELETE /api/university/event?id=<uuid>                   — hub-admin deletes
// POST   /api/university/event/rsvp { event_id, state }    — RSVP (going/interested/declined)
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  // Allow RSVP via POST with { event_id, state }
  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.event_id || !['going','interested','declined'].includes(b.state)) {
      return res.status(400).json({ error: 'event_id + state in (going,interested,declined) required' });
    }
    const r = await fetch(`${url}/rest/v1/university_event_rsvps?on_conflict=event_id,user_id`, {
      method: 'POST',
      headers: {
        apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ event_id: b.event_id, user_id: user.id, state: b.state }),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'rsvp failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ ok: true });
  }

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    const r = await fetch(`${url}/rest/v1/university_events?id=eq.${id}`
      + `&select=*,rsvps:university_event_rsvps(state,attended,user_id)`
      + `&limit=1`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const ev = (await r.json())[0];
    if (!ev) return res.status(404).json({ error: 'not found' });
    const now = Date.now();
    const start = new Date(ev.starts_at).getTime();
    const end   = new Date(ev.ends_at).getTime();
    const myRsvp = (ev.rsvps || []).find(x => x.user_id === user.id);
    const inWindow = now >= start - 30 * 60 * 1000 && now <= end;
    const exposeJoin = !!(myRsvp?.state === 'going' && inWindow);
    return res.json({
      event: {
        ...ev,
        join_url: exposeJoin ? ev.join_url : null,
        my_rsvp:  myRsvp?.state || null,
        my_attended: myRsvp?.attended || false,
        rsvp_counts: {
          going:      (ev.rsvps || []).filter(r => r.state === 'going').length,
          interested: (ev.rsvps || []).filter(r => r.state === 'interested').length,
          declined:   (ev.rsvps || []).filter(r => r.state === 'declined').length,
        },
        rsvps: undefined,
      },
    });
  }

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const allowed = ['title','description','cover_image_url','host_name','starts_at','ends_at','timezone','join_url','recording_url','location','status'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k];
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const r = await fetch(`${url}/rest/v1/university_events?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'update failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ event: (await r.json())[0] });
  }

  if (req.method === 'DELETE') {
    const r = await fetch(`${url}/rest/v1/university_events?id=eq.${id}`, {
      method: 'DELETE', headers: { apikey: anon, Authorization: userAuth, Prefer: 'return=minimal' },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'delete failed' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'GET/PATCH/DELETE/POST' });
}
