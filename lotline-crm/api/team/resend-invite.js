// POST /api/team/resend-invite
// Resets the token + extends expiry on a pending invitation.
// Body: { invitationId: string }
// Returns: { inviteUrl, invitation }
// Requires: owner | admin.
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can resend invitations.' });
  }

  const { invitationId } = req.body || {};
  if (!invitationId) return res.status(400).json({ error: 'invitationId is required' });

  const newToken     = randomBytes(32).toString('hex');
  const newExpiry    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch current resent_count first
  const { data: current } = await adminClient
    .from('organization_invitations')
    .select('resent_count')
    .eq('id', invitationId)
    .eq('organization_id', orgId)
    .single();

  const { data: invitation, error } = await adminClient
    .from('organization_invitations')
    .update({
      token:        newToken,
      expires_at:   newExpiry,
      status:       'pending',
      resent_count: (current?.resent_count ?? 0) + 1,
    })
    .eq('id', invitationId)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });

  const origin = req.headers.origin ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://lotline-crm.vercel.app');

  return res.status(200).json({
    inviteUrl: `${origin}/invite/${invitation.token}`,
    invitation,
  });
}
