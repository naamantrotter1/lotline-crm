// PATCH /api/team/update-member
// Changes a member's role or status (enable/disable).
// Body: { memberId: string, role?: string, status?: 'active'|'disabled' }
// Returns: { membership }
// Requires: owner | admin. Cannot demote/remove owner.
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can change member roles.' });
  }

  const { memberId, role, status } = req.body || {};
  if (!memberId) return res.status(400).json({ error: 'memberId is required' });
  if (!role && !status) return res.status(400).json({ error: 'role or status is required' });

  // Fetch the target membership
  const { data: target } = await adminClient
    .from('memberships')
    .select('id, user_id, role, organization_id')
    .eq('id', memberId)
    .eq('organization_id', orgId)
    .single();

  if (!target) return res.status(404).json({ error: 'Member not found in this organization.' });

  // Cannot change own role
  if (target.user_id === userId) {
    return res.status(403).json({ error: 'You cannot change your own role or status.' });
  }

  // Only owners can change another owner's role
  if (target.role === 'owner' && orgRole !== 'owner') {
    return res.status(403).json({ error: 'Only the owner can change another owner\'s role.' });
  }

  // Cannot assign owner role via this endpoint (use transfer-ownership flow)
  if (role === 'owner') {
    return res.status(403).json({ error: 'Use the transfer ownership flow to assign the owner role.' });
  }

  const updates = {};
  if (role   && ['admin', 'operator', 'viewer'].includes(role)) updates.role   = role;
  if (status && ['active', 'disabled'].includes(status))        updates.status = status;

  const { data: membership, error: updateErr } = await adminClient
    .from('memberships')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single();

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  return res.status(200).json({ membership });
}
