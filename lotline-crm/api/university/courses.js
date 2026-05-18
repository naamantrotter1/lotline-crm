// GET /api/university/courses?mine=true|false
// Returns courses with the caller's progress merged in when mine=true,
// otherwise plain published courses (RLS will filter to the caller's tier).
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);

  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();
  const mine     = String(req.query?.mine || '').toLowerCase() === 'true';

  if (mine) {
    const r = await fetch(`${url}/rest/v1/rpc/university_courses_for_me`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json' },
      body:    '{}',
    });
    if (!r.ok) return res.status(502).json({ error: 'rpc failed', detail: await r.text().catch(() => '') });
    const rows = await r.json();
    return res.json({ courses: rows });
  }

  const r = await fetch(
    `${url}/rest/v1/university_courses?select=*&order=sort_order.asc,title.asc`,
    { headers: { apikey: anon, Authorization: userAuth } },
  );
  if (!r.ok) return res.status(502).json({ error: 'select failed' });
  const rows = await r.json();
  return res.json({ courses: rows });
}
