// POST /api/team/accept-invite
// Accepts an invitation token and creates a membership for the caller.
// Body: { token: string }
// Returns: { membership }
// Requires: valid user session (any authenticated user).
import { makeAdminClient } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'Missing authorization header' });

  let adminClient;
  try {
    adminClient = makeAdminClient();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { data: { user }, error: userErr } = await adminClient.auth.getUser(bearer);
  if (userErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required' });

  // Look up the invitation
  const { data: inv, error: invErr } = await adminClient
    .from('organization_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (invErr) return res.status(500).json({ error: invErr.message });
  if (!inv) return res.status(404).json({ error: 'Invitation not found.' });
  if (inv.status === 'accepted') return res.status(409).json({ error: 'This invitation has already been accepted.' });
  if (inv.status === 'canceled') return res.status(410).json({ error: 'This invitation has been canceled.' });
  if (new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'This invitation has expired.' });

  // Verify the user's email matches
  if (user.email?.toLowerCase() !== inv.email?.toLowerCase()) {
    return res.status(403).json({
      error: `This invitation was sent to ${inv.email}. Please sign in with that email address.`,
    });
  }

  // Check for existing active membership
  const { data: existing } = await adminClient
    .from('memberships')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('organization_id', inv.organization_id)
    .maybeSingle();

  let membership;
  if (existing) {
    // Re-activate if disabled, update role
    const { data: updated, error: updErr } = await adminClient
      .from('memberships')
      .update({ role: inv.role, status: 'active' })
      .eq('id', existing.id)
      .select()
      .single();
    if (updErr) return res.status(500).json({ error: updErr.message });
    membership = updated;
  } else {
    const { data: created, error: createErr } = await adminClient
      .from('memberships')
      .insert({
        user_id:         user.id,
        organization_id: inv.organization_id,
        role:            inv.role,
        status:          'active',
      })
      .select()
      .single();
    if (createErr) return res.status(500).json({ error: createErr.message });
    membership = created;
  }

  // Mark invitation accepted
  await adminClient
    .from('organization_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', inv.id);

  // Set the user's active_organization_id to this org (if they don't have one)
  await adminClient
    .from('profiles')
    .update({ active_organization_id: inv.organization_id })
    .eq('id', user.id)
    .is('active_organization_id', null);

  return res.status(200).json({ membership, organizationId: inv.organization_id });
}
