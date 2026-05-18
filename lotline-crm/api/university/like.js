// POST   /api/university/like    { post_id? | comment_id? }     — adds a like (idempotent)
// DELETE /api/university/like?post_id=… | ?comment_id=…           — removes it
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.post_id && !b.comment_id) return res.status(400).json({ error: 'post_id or comment_id required' });
    if (b.post_id && b.comment_id)   return res.status(400).json({ error: 'pass exactly one of post_id/comment_id' });
    const r = await fetch(`${url}/rest/v1/university_forum_likes`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id:    user.id,
        post_id:    b.post_id    || null,
        comment_id: b.comment_id || null,
      }),
    });
    if (r.status === 409) return res.json({ ok: true, already: true });
    if (!r.ok) return res.status(r.status).json({ error: 'like failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const pid = req.query?.post_id;
    const cid = req.query?.comment_id;
    if (!pid && !cid) return res.status(400).json({ error: 'post_id or comment_id required' });
    const q = pid ? `user_id=eq.${user.id}&post_id=eq.${pid}`
                  : `user_id=eq.${user.id}&comment_id=eq.${cid}`;
    const r = await fetch(`${url}/rest/v1/university_forum_likes?${q}`, {
      method: 'DELETE',
      headers: { apikey: anon, Authorization: userAuth, Prefer: 'return=minimal' },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'unlike failed' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'POST or DELETE' });
}
