// POST /api/jv/invite-accept
// Public — no auth required. Creates a user account, org, and JV partnership.
// Body: { token, firstName, lastName?, phone?, password }
// Returns: { success: true, orgId }
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

  const { token, firstName, lastName, phone, password } = req.body || {};
  if (!token || !firstName || !password) {
    return res.status(400).json({ error: 'token, firstName, and password are required.' });
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
  const fullName = [firstName.trim(), (lastName || '').trim()].filter(Boolean).join(' ');
  const { data: { user }, error: userErr } = await adminClient.auth.admin.createUser({
    email:          inv.invitee_email,
    password,
    email_confirm:  true,
    user_metadata:  { full_name: fullName },
  });
  if (userErr) {
    const msg = userErr.message.includes('already registered')
      ? 'An account with this email already exists. Please sign in instead.'
      : userErr.message;
    return res.status(400).json({ error: msg });
  }

  // 3. Create a temporary org — user will set the real name in step 2 of the form
  const tempSlug = `partner-${Date.now().toString(36)}`;
  const { data: org, error: orgErr } = await adminClient
    .from('organizations')
    .insert({
      name:          `${firstName.trim()}'s Organization`,
      slug:          tempSlug,
      plan:          'starter',
      owner_user_id: user.id,
      status:        'active',
      is_jv_hub:     false,
    })
    .select()
    .single();

  if (orgErr) {
    await adminClient.auth.admin.deleteUser(user.id);
    return res.status(500).json({ error: orgErr.message });
  }

  // 4. Create owner membership
  await adminClient.from('memberships').insert({
    user_id:         user.id,
    organization_id: org.id,
    role:            'owner',
    status:          'active',
    invited_by:      inv.invited_by_user_id,
  });

  // 5. Auto-create the JV partnership (hub → new org, active immediately)
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

  // 6. Mark invitation accepted
  await adminClient.from('jv_partner_invitations').update({
    status:      'accepted',
    accepted_at: new Date().toISOString(),
    new_org_id:  org.id,
    new_user_id: user.id,
  }).eq('id', inv.id);

  // 7. Wait for Supabase auth trigger to create the profile row, then update
  //    only the safe writable columns (name, first_name, last_name, phone).
  //    active_organization_id is set later when the user completes step 2.
  await new Promise(r => setTimeout(r, 800));
  await adminClient.from('profiles').update({
    name:       fullName,
    first_name: firstName.trim(),
    last_name:  (lastName || '').trim() || null,
    ...(phone?.trim() ? { phone: phone.trim() } : {}),
  }).eq('id', user.id);

  return res.status(201).json({ success: true, orgId: org.id });
}
