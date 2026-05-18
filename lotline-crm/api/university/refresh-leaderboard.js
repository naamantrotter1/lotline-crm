// POST /api/university/refresh-leaderboard
// Calls refresh_university_leaderboard(). Can be hit by:
//   • Vercel cron (nightly)
//   • Frontend on-demand after a points-generating action (debounce in client)
// The DB function is SECURITY DEFINER + GRANTED to authenticated, so this only
// needs an anon-key bearer or a service role key to invoke.
import { getServiceUrl, svcHeaders } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'POST/GET only' });

  const url = getServiceUrl();
  if (!url) return res.status(500).json({ error: 'server misconfigured' });

  const r = await fetch(`${url}/rest/v1/rpc/refresh_university_leaderboard`, {
    method: 'POST', headers: svcHeaders(), body: '{}',
  });
  if (!r.ok) return res.status(502).json({ error: 'refresh failed', detail: (await r.text()).slice(0, 200) });
  return res.json({ ok: true, ts: new Date().toISOString() });
}
