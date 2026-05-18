// GET /api/university/lesson-playback?id=<lesson_id>
// Returns a signed Cloudflare Stream playback URL (HLS) with a 15-minute TTL.
// The caller must have RLS-level access to the lesson (we check by hitting the
// lessons table with the user's JWT — if RLS hides the row, we 403).
import { getCallerUser, unauthorized, forbidden, getServiceUrl } from '../_lib/supabaseAuth.js';

const CF_ACCOUNT       = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN     = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const CF_SIGN_KEY_ID   = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
const CF_SIGN_KEY_JWK  = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK; // RS256 JWK JSON

const TTL_SECONDS = 15 * 60;

async function importJwkKey(jwkJson) {
  const jwk = typeof jwkJson === 'string' ? JSON.parse(jwkJson) : jwkJson;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function b64url(input) {
  let s = (typeof input === 'string')
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signStreamToken(videoUid) {
  const header  = { alg: 'RS256', kid: CF_SIGN_KEY_ID };
  const now     = Math.floor(Date.now() / 1000);
  const payload = {
    sub: videoUid,
    kid: CF_SIGN_KEY_ID,
    exp: now + TTL_SECONDS,
    nbf: now - 60,
  };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const data = `${head}.${body}`;
  const key  = await importJwkKey(CF_SIGN_KEY_JWK);
  const sig  = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

export default async function handler(req, res) {
  const user = await getCallerUser(req);
  if (!user) return unauthorized(res);

  const lessonId = req.query?.id;
  if (!lessonId) return res.status(400).json({ error: 'id required' });

  // Fetch the lesson row through PostgREST using the caller's JWT — RLS will
  // either return the lesson or filter it out (no row → 403).
  const userAuth = req.headers.authorization || '';
  const r = await fetch(
    `${getServiceUrl()}/rest/v1/university_lessons?select=id,video_provider,video_id_or_url&id=eq.${encodeURIComponent(lessonId)}&limit=1`,
    { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, Authorization: userAuth } }
  );
  if (!r.ok) return res.status(502).json({ error: 'supabase lookup failed' });
  const rows = await r.json();
  const lesson = rows[0];
  if (!lesson) return forbidden(res, 'Lesson not accessible');

  // Provider abstraction
  if (lesson.video_provider === 'url') {
    return res.json({
      provider: 'url',
      manifestUrl: lesson.video_id_or_url,
      expiresIn: null,
    });
  }
  if (lesson.video_provider === 'mux') {
    // Mux signed playback would be implemented here. For Phase 1 we emit the
    // raw playback id — callers should know how to handle it. Not used by
    // current UI.
    return res.json({
      provider: 'mux',
      playbackId: lesson.video_id_or_url,
      expiresIn: null,
    });
  }
  // cf_stream
  if (!CF_ACCOUNT) return res.status(500).json({ error: 'CLOUDFLARE_ACCOUNT_ID missing' });
  if (!CF_SIGN_KEY_ID || !CF_SIGN_KEY_JWK) {
    // No signing key configured → fall back to the unsigned manifest URL.
    // Only safe if the video is NOT marked requireSignedURLs.
    return res.json({
      provider: 'cf_stream',
      manifestUrl: `https://customer-${CF_ACCOUNT}.cloudflarestream.com/${lesson.video_id_or_url}/manifest/video.m3u8`,
      expiresIn: null,
      unsigned: true,
    });
  }

  try {
    const token = await signStreamToken(lesson.video_id_or_url);
    return res.json({
      provider:    'cf_stream',
      manifestUrl: `https://customer-${CF_ACCOUNT}.cloudflarestream.com/${token}/manifest/video.m3u8`,
      expiresIn:   TTL_SECONDS,
    });
  } catch (e) {
    return res.status(502).json({ error: `sign failed: ${e.message}` });
  }
}
