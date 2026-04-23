// POST /api/team/cancel-invite
// Marks a pending invitation as canceled.
// Body: { invitationId: string }
// Returns: { success: true }
// Requires: owner | admin.
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can cancel invitations.' });
  }

  const { invitationId } = req.body || {};
  if (!invitationId) return res.status(400).json({ error: 'invitationId is required' });

  const { error } = await adminClient
    .from('organization_invitations')
    .update({ status: 'canceled' })
    .eq('id', invitationId)
    .eq('organization_id', orgId)
    .eq('status', 'pending');

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}
