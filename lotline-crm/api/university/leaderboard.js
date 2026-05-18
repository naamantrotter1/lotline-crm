// GET /api/university/leaderboard?window=7d|30d|all&limit=100
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  const w  = ['7d', '30d', 'all'].includes(req.query?.window) ? req.query.window : '7d';
  const n  = Math.min(Math.max(parseInt(req.query?.limit || '100', 10) || 100, 1), 500);

  const r = await fetch(`${url}/rest/v1/rpc/university_leaderboard_top`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ window_kind: w, top_n: n }),
  });
  if (!r.ok) return res.status(r.status).json({ error: 'rpc failed', detail: (await r.text()).slice(0, 200) });
  const rows = await r.json();
  return res.json({ window: w, rows });
}
