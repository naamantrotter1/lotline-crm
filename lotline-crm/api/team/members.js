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
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', userIds);
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    membersWithProfiles = membersWithProfiles.map(m => ({
      ...m,
      profiles: profileMap[m.user_id] || null,
    }));
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
