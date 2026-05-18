// api/_lib/supabaseAuth.js
// ─────────────────────────────────────────────────────────────────────────────
// Tiny helper that extracts a Supabase JWT from the Authorization header and
// verifies it against the project's GoTrue /auth/v1/user endpoint. Returns the
// authenticated user record or null. Used by the /api/university/* endpoints
// to enforce RLS-style checks before hitting the DB with the service role key.

export async function getCallerUser(req) {
  const PROJECT_URL = process.env.VITE_SUPABASE_URL;
  const ANON_KEY    = process.env.VITE_SUPABASE_ANON_KEY;
  if (!PROJECT_URL || !ANON_KEY) return null;

  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  try {
    const r = await fetch(`${PROJECT_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? u : null;
  } catch {
    return null;
  }
}

export function unauthorized(res, msg = 'Unauthorized') {
  res.status(401).json({ error: msg });
}

export function forbidden(res, msg = 'Forbidden') {
  res.status(403).json({ error: msg });
}

export function getServiceUrl() {
  return process.env.VITE_SUPABASE_URL;
}

export function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function svcHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'Content-Type':  'application/json',
    'apikey':        key,
    'Authorization': `Bearer ${key}`,
  };
}
