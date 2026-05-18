// GET  /api/university/feed?category=<slug>
// POST /api/university/feed   { category_id, title?, body, image_urls? }
//
// Read uses caller JWT so RLS filters posts. Write goes through PostgREST as
// the caller so the "posts: author insert" RLS check runs.
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  if (req.method === 'GET') {
    const category = req.query?.category || '';
    let q = `${url}/rest/v1/university_forum_posts`
          + `?select=*,category:university_forum_categories(slug,name),`
          +         `author_profile:profiles!author_user_id(id,first_name,last_name,avatar_url),`
          +         `author_org:organizations!author_org_id(name,is_university_publisher)`
          + `&deleted_at=is.null`
          + `&order=is_pinned.desc,last_activity_at.desc`
          + `&limit=50`;
    if (category && category !== 'all') {
      // Resolve slug → id, then filter
      const catRes = await fetch(`${url}/rest/v1/university_forum_categories?select=id&slug=eq.${encodeURIComponent(category)}&limit=1`,
        { headers: { apikey: anon, Authorization: userAuth } });
      const cats = await catRes.json();
      if (cats[0]) q += `&category_id=eq.${cats[0].id}`;
    }
    const r = await fetch(q, { headers: { apikey: anon, Authorization: userAuth } });
    if (!r.ok) return res.status(502).json({ error: 'feed select failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ posts: await r.json() });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.category_id || !b.body) return res.status(400).json({ error: 'category_id and body required' });

    // Resolve author_org_id from caller's profile (server-side, never trust client)
    const profRes = await fetch(`${url}/rest/v1/profiles?select=active_organization_id&id=eq.${user.id}&limit=1`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const prof = (await profRes.json())[0];
    if (!prof?.active_organization_id) return res.status(400).json({ error: 'no active org for caller' });

    const r = await fetch(`${url}/rest/v1/university_forum_posts`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        category_id:    b.category_id,
        author_user_id: user.id,
        author_org_id:  prof.active_organization_id,
        title:          b.title || null,
        body:           b.body,
        image_urls:     Array.isArray(b.image_urls) ? b.image_urls.slice(0, 4) : [],
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'insert failed', detail: (await r.text()).slice(0, 200) });
    const rows = await r.json();
    return res.json({ post: rows[0] });
  }
  return res.status(405).json({ error: 'GET or POST' });
}
