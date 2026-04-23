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

/**
 * Like requireOrgMember, but additionally verifies the caller's org is the JV hub.
 * Used by hub-only endpoints: propose, update-permissions, search-orgs.
 */
export async function requireJvHubAuth(req, res) {
  const auth = await requireOrgMember(req, res);
  if (!auth) return null;

  const { data: org } = await auth.adminClient
    .from('organizations')
    .select('is_jv_hub')
    .eq('id', auth.orgId)
    .single();

  if (!org?.is_jv_hub) {
    res.status(403).json({ error: 'Only the JV hub organization can perform this action.' });
    return null;
  }

  return auth;
}

/**
 * Resolves the joint_venture_id for a given (host_org, partner_org) active pair.
 * Returns null if no active JV exists.
 */
export async function resolveActiveJv(adminClient, hostOrgId, partnerOrgId) {
  const { data } = await adminClient
    .from('joint_ventures')
    .select('id, permissions_on_partner')
    .eq('host_organization_id',    hostOrgId)
    .eq('partner_organization_id', partnerOrgId)
    .eq('status', 'active')
    .not('accepted_at', 'is', null)
    .maybeSingle();
  return data ?? null;
}

/**
 * Appends a row to jv_access_logs AND writes to both orgs' audit_logs
 * via the SECURITY DEFINER append_jv_audit function.
 */
export async function logJvAccess(adminClient, {
  jvId, actingUserId, actingOrgId, targetOrgId,
  action, targetType, targetId, targetLabel, ipAddress, metadata = {},
}) {
  // 1. jv_access_logs
  await adminClient.from('jv_access_logs').insert({
    joint_venture_id:       jvId,
    acting_user_id:         actingUserId,
    acting_organization_id: actingOrgId,
    target_organization_id: targetOrgId,
    action,
    target_type:  targetType,
    target_id:    targetId    ?? null,
    target_label: targetLabel ?? null,
    ip_address:   ipAddress   ?? null,
    metadata,
  });

  // 2. Dual audit_log writes via SECURITY DEFINER RPC
  await Promise.all([
    // Actor's org audit log
    adminClient.rpc('append_jv_audit', {
      p_org_id:       actingOrgId,
      p_actor_id:     actingUserId,
      p_action:       action,
      p_target_table: targetType,
      p_target_id:    targetId ?? null,
      p_jv_id:        jvId,
      p_metadata:     { ...metadata, target_org_id: targetOrgId },
    }),
    // Target org audit log
    adminClient.rpc('append_jv_audit', {
      p_org_id:       targetOrgId,
      p_actor_id:     actingUserId,
      p_action:       action,
      p_target_table: targetType,
      p_target_id:    targetId ?? null,
      p_jv_id:        jvId,
      p_metadata:     { ...metadata, acting_org_id: actingOrgId },
    }),
  ]);
}
