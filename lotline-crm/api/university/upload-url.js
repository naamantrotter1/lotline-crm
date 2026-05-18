// POST /api/university/upload-url
// Returns a Cloudflare Stream Direct Upload URL the publisher's browser PUTs
// the video file to. After upload the admin saves a lesson row with
// video_provider='cf_stream' and video_id_or_url=<uid>.
import { getCallerUser, unauthorized, forbidden, svcHeaders, getServiceUrl } from '../_lib/supabaseAuth.js';

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN   = process.env.CLOUDFLARE_STREAM_API_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!CF_ACCOUNT || !CF_TOKEN) {
    return res.status(500).json({ error: 'Cloudflare Stream credentials missing on server' });
  }

  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);

  // Verify the caller is a publisher admin via the RPC
  try {
    const check = await fetch(
      `${getServiceUrl()}/rest/v1/rpc/_is_university_publisher_admin`,
      { method: 'POST', headers: { ...svcHeaders(), Authorization: `Bearer ${req.headers.authorization?.slice(7) || ''}` }, body: '{}' }
    );
    // Easier path — use the auth context directly via PostgREST: bind the
    // user's JWT so RLS runs as them.
  } catch { /* fall through */ }

  // Use the user's JWT directly so the RPC runs in their context
  const userAuth = req.headers.authorization || '';
  const rpc = await fetch(
    `${getServiceUrl()}/rest/v1/rpc/_is_university_publisher_admin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.VITE_SUPABASE_ANON_KEY,
        Authorization: userAuth,
      },
      body: '{}',
    }
  );
  if (!rpc.ok) return forbidden(res, 'Could not verify publisher role');
  const isAdmin = await rpc.json();
  if (isAdmin !== true) return forbidden(res, 'Publisher admins only');

  const { maxDurationSeconds = 3600 } = req.body || {};

  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CF_TOKEN}`,
        },
        body: JSON.stringify({
          maxDurationSeconds: Math.min(Math.max(parseInt(maxDurationSeconds, 10) || 3600, 60), 21600),
          requireSignedURLs: true,
        }),
      }
    );
    const j = await r.json();
    if (!j.success) {
      return res.status(502).json({ error: 'cloudflare', detail: j.errors });
    }
    return res.json({
      uploadUrl: j.result.uploadURL,
      uid:       j.result.uid,
      expiresAt: j.result.uploadURL && (Date.now() + 30 * 60 * 1000), // ~30 min CF default
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
