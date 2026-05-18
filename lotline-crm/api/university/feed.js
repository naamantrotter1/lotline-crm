// GET  /api/university/feed?category=<slug>
// POST /api/university/feed   { category_id, title?, body, image_urls? }
//
// PostgREST embed-via-FK doesn't reach profiles from university_forum_posts
// (the FK on author_user_id points to auth.users, not profiles), so we fetch
// the post rows first, then fan out one extra query each for profiles + orgs
// and merge in code. Categories embed cleanly because their FK is direct.
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
          + `?select=*,category:university_forum_categories(slug,name)`
          + `&deleted_at=is.null`
          + `&order=is_pinned.desc,last_activity_at.desc`
          + `&limit=50`;
    if (category && category !== 'all') {
      const catRes = await fetch(`${url}/rest/v1/university_forum_categories?select=id&slug=eq.${encodeURIComponent(category)}&limit=1`,
        { headers: { apikey: anon, Authorization: userAuth } });
      const cats = await catRes.json();
      if (cats[0]) q += `&category_id=eq.${cats[0].id}`;
    }
    const r = await fetch(q, { headers: { apikey: anon, Authorization: userAuth } });
    if (!r.ok) return res.status(502).json({ error: 'feed select failed', detail: (await r.text()).slice(0, 200) });
    const posts = await r.json();

    // Fan out profile + org lookups
    const userIds = [...new Set(posts.map(p => p.author_user_id).filter(Boolean))];
    const orgIds  = [...new Set(posts.map(p => p.author_org_id ).filter(Boolean))];
    const [profilesRes, orgsRes] = await Promise.all([
      userIds.length
        ? fetch(`${url}/rest/v1/profiles?select=id,first_name,last_name,avatar_url&id=in.(${userIds.join(',')})`,
            { headers: { apikey: anon, Authorization: userAuth } })
        : Promise.resolve({ ok: true, json: () => [] }),
      orgIds.length
        ? fetch(`${url}/rest/v1/organizations?select=id,name,is_university_publisher&id=in.(${orgIds.join(',')})`,
            { headers: { apikey: anon, Authorization: userAuth } })
        : Promise.resolve({ ok: true, json: () => [] }),
    ]);
    const profiles = profilesRes.ok ? await profilesRes.json() : [];
    const orgs     = orgsRes.ok     ? await orgsRes.json()     : [];
    const profileById = Object.fromEntries(profiles.map(p => [p.id, p]));
    const orgById     = Object.fromEntries(orgs.map(o     => [o.id, o]));

    // Fetch which posts the caller has already liked (single batch query)
    const postIds = posts.map(p => p.id);
    const likeRes = postIds.length
      ? await fetch(
          `${url}/rest/v1/university_forum_likes?user_id=eq.${user.id}&post_id=in.(${postIds.join(',')})&select=post_id`,
          { headers: { apikey: anon, Authorization: userAuth } })
      : { ok: true, json: async () => [] };
    const likedIds = new Set((likeRes.ok ? await likeRes.json() : []).map(l => l.post_id));

    const enriched = posts.map(p => ({
      ...p,
      author_profile: profileById[p.author_user_id] || null,
      author_org:     orgById[p.author_org_id]     || null,
      liked_by_me:    likedIds.has(p.id),
    }));
    return res.json({ posts: enriched });
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.category_id || !b.body) return res.status(400).json({ error: 'category_id and body required' });

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
