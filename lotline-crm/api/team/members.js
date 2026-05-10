// GET /api/team/members
// Returns active members + pending invitations for the caller's active org.
// Requires: owner | admin | operator | viewer membership.
import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return; // response already sent

  const { adminClient, userClient, orgId } = auth;
  // Use adminClient (bypasses RLS) when available; fall back to userClient (RLS-aware).
  // userClient can read all org memberships thanks to the "members_are_viewable_by_org_members" RLS policy.
  const queryClient = adminClient || userClient;

  // All members for this org
  const { data: members, error: memErr } = await queryClient
    .from('memberships')
    .select('id, role, status, created_at, user_id')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });

  if (memErr) return res.status(500).json({ error: memErr.message });

  // Fetch profiles separately and merge (avoids needing a direct FK to profiles)
  let membersWithProfiles = members || [];
  if (membersWithProfiles.length > 0) {
    const userIds = membersWithProfiles.map(m => m.user_id);

    // Fetch profile rows. auth.admin.listUsers requires service role key — skip gracefully if unavailable.
    const { data: profiles } = await queryClient
      .from('profiles')
      .select('id, name, first_name, last_name, avatar_url, email')
      .in('id', userIds);

    // Only call auth.admin.listUsers when the admin client is available (service role key present).
    let authMap = {};
    if (adminClient) {
      const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      authMap = Object.fromEntries(
        ((authData?.users) || []).filter(u => userIds.includes(u.id)).map(u => [u.id, u])
      );
    }

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

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
          // Email: prefer auth.users (full accuracy); fall back to profiles.email
          email:      authUser.email || prof.email || null,
        },
      };
    });
  }

  // Pending (non-expired, non-canceled) invitations
  const { data: invitations, error: invErr } = await queryClient
    .from('organization_invitations')
    .select('id, email, role, status, resent_count, created_at, expires_at, invited_by')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (invErr) return res.status(500).json({ error: invErr.message });

  return res.status(200).json({ members: membersWithProfiles, invitations: invitations || [] });
}
