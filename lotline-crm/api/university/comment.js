// POST   /api/university/comment   { post_id, body, parent_comment_id? }
// DELETE /api/university/comment?id=<uuid>
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.post_id || !b.body) return res.status(400).json({ error: 'post_id and body required' });
    const r = await fetch(`${url}/rest/v1/university_forum_comments`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        post_id:           b.post_id,
        parent_comment_id: b.parent_comment_id || null,
        author_user_id:    user.id,
        body:              b.body,
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'insert failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ comment: (await r.json())[0] });
  }

  if (req.method === 'DELETE') {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await fetch(`${url}/rest/v1/university_forum_comments?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'delete failed' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'POST or DELETE' });
}
