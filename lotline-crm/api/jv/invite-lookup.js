// GET /api/jv/invite-lookup?token=ABC
// Public — no auth required. Returns hub org info so the signup page can
// display "You've been invited by {org}" before the user creates an account.
import { makeAdminClient } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token is required' });

  let adminClient;
  try { adminClient = makeAdminClient(); } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { data: inv } = await adminClient
    .from('jv_partner_invitations')
    .select('id, status, expires_at, hub_org_id, invitee_email, notes')
    .eq('token', token)
    .single();

  if (!inv) return res.status(404).json({ error: 'Invitation not found.' });

  if (inv.status !== 'pending') {
    return res.status(410).json({ error: 'This invitation has already been used or revoked.' });
  }
  if (new Date(inv.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This invitation link has expired.' });
  }

  const { data: hubOrg } = await adminClient
    .from('organizations')
    .select('name')
    .eq('id', inv.hub_org_id)
    .single();

  return res.json({
    hubOrgName:   hubOrg?.name || 'LotLine Homes',
    inviteeEmail: inv.invitee_email,
    notes:        inv.notes,
    expiresAt:    inv.expires_at,
  });
}
