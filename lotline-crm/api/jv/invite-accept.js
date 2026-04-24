// POST /api/jv/invite-accept
// Public — no auth required. Creates a user account, org, and JV partnership.
// Body: { token, firstName, lastName?, orgName, password }
import { makeAdminClient } from '../_lib/teamAuth.js';

const DEFAULT_JV_PERMISSIONS = {
  'deal.view':          true,
  'investor.view':      true,
  'capital_stack.view': true,
  'document.view':      true,
  'distribution.view':  true,
  'draw_schedule.view': true,
  'deal.edit':          false,
  'investor.edit':      false,
  'capital_stack.edit': false,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, firstName, lastName, orgName, password } = req.body || {};
  if (!token || !firstName || !orgName || !password) {
    return res.status(400).json({ error: 'token, firstName, orgName, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  let adminClient;
  try { adminClient = makeAdminClient(); } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  // 1. Validate invitation token
  const { data: inv } = await adminClient
    .from('jv_partner_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (!inv) return res.status(404).json({ error: 'Invitation not found or already used.' });
  if (new Date(inv.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This invitation link has expired.' });
  }

  // 2. Create Supabase auth user (pre-confirmed so they can log in immediately)
  const { data: { user }, error: userErr } = await adminClient.auth.admin.createUser({
    email:           inv.invitee_email,
    password,
    email_confirm:   true,
  });
  if (userErr) {
    const msg = userErr.message.includes('already registered')
      ? 'An account with this email already exists. Please sign in instead.'
      : userErr.message;
    return res.status(400).json({ error: msg });
  }

  // 3. Create the new organization
  const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'org';
  const slug     = `${baseSlug}-${Date.now().toString(36)}`;

  const { data: org, error: orgErr } = await adminClient
    .from('organizations')
    .insert({
      name:          orgName.trim(),
      slug,
      plan:          'starter',
      owner_user_id: user.id,
      status:        'active',
      is_jv_hub:     false,
    })
    .select()
    .single();

  if (orgErr) {
    // Roll back the user if org creation fails
    await adminClient.auth.admin.deleteUser(user.id);
    return res.status(500).json({ error: orgErr.message });
  }

  // 4. Create the user's profile
  const fullName = [firstName.trim(), (lastName || '').trim()].filter(Boolean).join(' ');
  await adminClient.from('profiles').upsert({
    id:                      user.id,
    name:                    fullName,
    email:                   inv.invitee_email,
    role:                    'operator',
    active_organization_id:  org.id,
  });

  // 5. Create owner membership
  await adminClient.from('memberships').insert({
    user_id:         user.id,
    organization_id: org.id,
    role:            'owner',
    status:          'active',
    invited_by:      inv.invited_by_user_id,
  });

  // 6. Auto-create the JV partnership (hub → new org, active immediately)
  await adminClient.from('joint_ventures').insert({
    host_organization_id:    inv.hub_org_id,
    partner_organization_id: org.id,
    permissions_on_partner:  DEFAULT_JV_PERMISSIONS,
    status:                  'active',
    proposed_by_user_id:     inv.invited_by_user_id,
    proposed_at:             new Date().toISOString(),
    accepted_by_user_id:     user.id,
    accepted_at:             new Date().toISOString(),
    notes:                   'Created via partner invitation link',
  });

  // 7. Mark invitation accepted
  await adminClient.from('jv_partner_invitations').update({
    status:      'accepted',
    accepted_at: new Date().toISOString(),
    new_org_id:  org.id,
    new_user_id: user.id,
  }).eq('id', inv.id);

  return res.status(201).json({ success: true });
}
