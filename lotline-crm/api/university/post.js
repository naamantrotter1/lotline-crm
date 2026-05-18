// GET    /api/university/post?id=<uuid>          — post + comments
// PATCH  /api/university/post?id=<uuid>          — author edits within 15 min
// DELETE /api/university/post?id=<uuid>          — soft-delete (author or admin)
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
      + `&select=*,category:university_forum_categories(slug,name),`
      +         `author_profile:profiles!author_user_id(id,first_name,last_name,avatar_url),`
      +         `author_org:organizations!author_org_id(name,is_university_publisher)`
      + `&limit=1`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const post = (await postRes.json())[0];
    if (!post) return res.status(404).json({ error: 'not found or access denied' });

    const cmtRes = await fetch(`${url}/rest/v1/university_forum_comments?post_id=eq.${id}`
      + `&deleted_at=is.null`
      + `&select=*,author_profile:profiles!author_user_id(id,first_name,last_name,avatar_url)`
      + `&order=created_at.asc`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const comments = await cmtRes.json();

    // Lookup which post/comment ids the caller has already liked
    const likeRes = await fetch(`${url}/rest/v1/university_forum_likes?user_id=eq.${user.id}`
      + `&or=(post_id.eq.${id},comment_id.in.(${comments.map(c => c.id).join(',') || '00000000-0000-0000-0000-000000000000'}))`
      + `&select=post_id,comment_id`,
      { headers: { apikey: anon, Authorization: userAuth } });
    const likes = await likeRes.json();
    const liked = { postLiked: likes.some(l => l.post_id === id),
                    commentLiked: new Set(likes.filter(l => l.comment_id).map(l => l.comment_id)) };

    return res.json({
      post,
      comments,
      liked: { post: liked.postLiked, comments: Array.from(liked.commentLiked) },
    });
  }

  if (req.method === 'PATCH') {
    const b = req.body || {};
    const patch = {};
    if (typeof b.body  === 'string') patch.body  = b.body;
    if (typeof b.title === 'string') patch.title = b.title;
    if (Array.isArray(b.image_urls)) patch.image_urls = b.image_urls.slice(0, 4);
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
    // Soft delete
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
