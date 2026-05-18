// GET    /api/university/post?id=<uuid>          — post + comments
// PATCH  /api/university/post?id=<uuid>          — author edits within 15 min
// DELETE /api/university/post?id=<uuid>          — soft-delete (author or admin)
//
// Uses the same two-query pattern as feed.js for profile + org enrichment.
import { getCallerUser, unauthorized, getServiceUrl } from '../_lib/supabaseAuth.js';

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);
  const userAuth = req.headers.authorization || '';
  const anon     = process.env.VITE_SUPABASE_ANON_KEY;
  const url      = getServiceUrl();

  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') {
    const postRes = await fetch(`${url}/rest/v1/university_forum_posts?id=eq.${id}`
      + `&select=*,category:university_forum_categories(slug,name)`
      + `&limit=1`,
      { headers: { apikey: anon, Authorization: userAuth } });
    if (!postRes.ok) return res.status(502).json({ error: 'post fetch failed', detail: (await postRes.text()).slice(0, 200) });
    const post = (await postRes.json())[0];
    if (!post) return res.status(404).json({ error: 'not found or access denied' });

    const cmtRes = await fetch(`${url}/rest/v1/university_forum_comments?post_id=eq.${id}`
      + `&deleted_at=is.null&select=*&order=created_at.asc`,
      { headers: { apikey: anon, Authorization: userAuth } });
    if (!cmtRes.ok) return res.status(502).json({ error: 'comments fetch failed', detail: (await cmtRes.text()).slice(0, 200) });
    const comments = await cmtRes.json();

    // Fan out profile + org lookups for the post author and every comment author
    const userIds = [...new Set([post.author_user_id, ...comments.map(c => c.author_user_id)].filter(Boolean))];
    const orgIds  = [post.author_org_id].filter(Boolean);
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

    const enrichedPost = {
      ...post,
      author_profile: profileById[post.author_user_id] || null,
      author_org:     orgById[post.author_org_id]     || null,
    };
    const enrichedComments = comments.map(c => ({
      ...c,
      author_profile: profileById[c.author_user_id] || null,
    }));

    // Lookup which post/comment ids the caller has already liked
    const commentIdList = comments.map(c => c.id).join(',') || '00000000-0000-0000-0000-000000000000';
    const likeRes = await fetch(`${url}/rest/v1/university_forum_likes?user_id=eq.${user.id}`
      + `&or=(post_id.eq.${id},comment_id.in.(${commentIdList}))`
      + `&select=post_id,comment_id`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const likes = likeRes.ok ? await likeRes.json() : [];
    const liked = {
      post:     likes.some(l => l.post_id === id),
      comments: likes.filter(l => l.comment_id).map(l => l.comment_id),
    };

    return res.json({ post: enrichedPost, comments: enrichedComments, liked });
  }

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const patch = {};
    if (typeof b.body  === 'string') patch.body  = b.body;
    if (typeof b.title === 'string') patch.title = b.title;
    if (Array.isArray(b.image_urls)) patch.image_urls = b.image_urls.slice(0, 4);
    if (typeof b.is_pinned     === 'boolean') patch.is_pinned     = b.is_pinned;
    if (typeof b.is_admin_post === 'boolean') patch.is_admin_post = b.is_admin_post;
    if (b.deleted_at === null || typeof b.deleted_at === 'string') patch.deleted_at = b.deleted_at;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const r = await fetch(`${url}/rest/v1/university_forum_posts?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'update failed', detail: (await r.text()).slice(0, 200) });
    return res.json({ post: (await r.json())[0] });
  }

  if (req.method === 'DELETE') {
    const r = await fetch(`${url}/rest/v1/university_forum_posts?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: anon, Authorization: userAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(r.status).json({ error: 'delete failed' });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'GET/PATCH/DELETE only' });
}
