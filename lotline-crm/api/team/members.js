// GET /api/team/members
// Returns active members + pending invitations for the caller's active org.
// Requires: owner | admin | operator | viewer membership.
import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return; // response already sent

  const { adminClient, orgId } = auth;

  // Active members
  const { data: members, error: memErr } = await adminClient
    .from('memberships')
    .select('id, role, status, created_at, user_id')
    .eq('organization_id', orgId)
    .in('status', ['active', 'disabled'])
    .order('created_at', { ascending: true });

  if (memErr) return res.status(500).json({ error: memErr.message });

  // Fetch profiles separately and merge (avoids needing a direct FK to profiles)
  let membersWithProfiles = members || [];
  if (membersWithProfiles.length > 0) {
    const userIds = membersWithProfiles.map(m => m.user_id);

    // Fetch profile rows (name fields) and auth users (email) in parallel
    const [{ data: profiles }, { data: authData }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, name, first_name, last_name, avatar_url')
        .in('id', userIds),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    // authData is { users: [...] } from the auth admin API
    const authMap = Object.fromEntries(
      ((authData?.users) || []).filter(u => userIds.includes(u.id)).map(u => [u.id, u])
    );

    membersWithProfiles = membersWithProfiles.map(m => {
      const prof = profileMap[m.user_id] || {};
      const authUser = authMap[m.user_id] || {};
      return {
        ...m,
        profiles: {
          ...prof,
          // Prefer profile name fields; fall back to auth user metadata
          // Google OAuth stores full name as full_name or name; given/family for first/last
          name:       prof.name
                      || authUser.user_metadata?.full_name
                      || authUser.user_metadata?.name
                      || [authUser.user_metadata?.given_name, authUser.user_metadata?.family_name].filter(Boolean).join(' ')
                      || null,
          first_name: prof.first_name || authUser.user_metadata?.given_name  || authUser.user_metadata?.first_name || null,
          last_name:  prof.last_name  || authUser.user_metadata?.family_name || authUser.user_metadata?.last_name  || null,
          // Email always from auth.users (profiles table may not have it)
          email:      authUser.email  || null,
        },
      };
    });
  }

  // Pending (non-expired, non-canceled) invitations
  const { data: invitations, error: invErr } = await adminClient
    .from('organization_invitations')
    .select('id, email, role, status, resent_count, created_at, expires_at, invited_by')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (invErr) return res.status(500).json({ error: invErr.message });

  return res.status(200).json({ members: membersWithProfiles, invitations: invitations || [] });
}
