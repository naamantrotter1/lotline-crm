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
  let rows = await r.json();

  // If the caller has no points yet they won't appear in the materialized view,
  // so the RPC returns no is_me row. Query their actual points directly from
  // university_points_events and synthesize a stub row.
  const hasMe = rows.some(row => row.is_me);
  if (!hasMe) {
    const windowFilter = w === '7d'  ? `&created_at=gte.${new Date(Date.now() - 7  * 86400000).toISOString()}`
                       : w === '30d' ? `&created_at=gte.${new Date(Date.now() - 30 * 86400000).toISOString()}`
                       : '';
    const [profRes, ptsRes] = await Promise.all([
      fetch(`${url}/rest/v1/profiles?select=id,first_name,last_name,avatar_url,active_organization_id&id=eq.${user.id}&limit=1`,
        { headers: { apikey: anon, Authorization: userAuth } }),
      fetch(`${url}/rest/v1/university_points_events?select=points&user_id=eq.${user.id}${windowFilter}`,
        { headers: { apikey: anon, Authorization: userAuth } }),
    ]);
    if (profRes.ok) {
      const [prof] = await profRes.json();
      if (prof) {
        const ptsRows = ptsRes.ok ? await ptsRes.json() : [];
        const myPoints = ptsRows.reduce((s, r) => s + (r.points || 0), 0);
        let orgName = null;
        if (prof.active_organization_id) {
          const orgRes = await fetch(
            `${url}/rest/v1/organizations?select=name&id=eq.${prof.active_organization_id}&limit=1`,
            { headers: { apikey: anon, Authorization: userAuth } }
          );
          if (orgRes.ok) { const [org] = await orgRes.json(); orgName = org?.name || null; }
        }
        rows = [...rows, {
          user_id:      user.id,
          display_name: [prof.first_name, prof.last_name].filter(Boolean).join(' ') || 'You',
          avatar_url:   prof.avatar_url || null,
          org_name:     orgName,
          points:       myPoints,
          rank:         rows.length + 1,
          is_me:        true,
        }];
      }
    }
  }

  return res.json({ window: w, rows });
}
