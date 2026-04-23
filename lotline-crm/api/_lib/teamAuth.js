/**
 * Shared auth helper for team API endpoints.
 * Verifies the caller's JWT, resolves their active org, and returns
 * their membership role.
 */
import { createClient } from '@supabase/supabase-js';

export function makeAdminClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server misconfigured: missing Supabase credentials');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Authenticates the request and returns { adminClient, userId, orgId, orgRole }.
 * Sends an HTTP error response and returns null if auth fails.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse}  res
 */
export async function requireOrgMember(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization header' });
    return null;
  }

  let adminClient;
  try {
    adminClient = makeAdminClient();
  } catch (e) {
    res.status(500).json({ error: e.message });
    return null;
  }

  const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .single();

  const orgId = profile?.active_organization_id;
  if (!orgId) {
    res.status(403).json({ error: 'No active organization. Complete onboarding first.' });
    return null;
  }

  const { data: mem } = await adminClient
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();

  return { adminClient, userId: user.id, orgId, orgRole: mem?.role ?? null };
}

/** Returns true if the role is owner or admin */
export function isAdmin(orgRole) {
  return orgRole === 'owner' || orgRole === 'admin';
}
