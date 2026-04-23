// PATCH /api/jv/update-permissions
// Hub-only. Updates permissions_on_partner for an active JV.
// Expanding access (adding true capabilities) requires re-acceptance by partner
// → sets status back to 'proposed'. Narrowing applies immediately.
// Body: { jvId, permissionsOnPartner }
import { requireJvHubAuth, isAdmin, logJvAccess } from '../_lib/teamAuth.js';
import { sendJvProposalEmail } from '../_lib/sendJvEmail.js';

function isExpanding(current, next) {
  // Returns true if any capability goes from false/missing → true
  for (const [key, val] of Object.entries(next)) {
    if (val === true && !current[key]) return true;
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireJvHubAuth(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can update JV permissions.' });
  }

  const { jvId, permissionsOnPartner } = req.body || {};
  if (!jvId)                return res.status(400).json({ error: 'jvId is required.' });
  if (!permissionsOnPartner) return res.status(400).json({ error: 'permissionsOnPartner is required.' });

  const { data: jv } = await adminClient
    .from('joint_ventures')
    .select('id, partner_organization_id, permissions_on_partner, status')
    .eq('id', jvId)
    .eq('host_organization_id', orgId)
    .in('status', ['active', 'suspended'])
    .maybeSingle();

  if (!jv) {
    return res.status(404).json({ error: 'Active JV not found for your organization.' });
  }

  const expanding = isExpanding(jv.permissions_on_partner, permissionsOnPartner);
  const now = new Date().toISOString();

  // If expanding, partner must re-accept
  const newStatus = expanding ? 'proposed' : jv.status;

  const { data: updated, error } = await adminClient
    .from('joint_ventures')
    .update({
      permissions_on_partner: permissionsOnPartner,
      status:                 newStatus,
      // Clear acceptance when re-proposing
      ...(expanding ? { accepted_at: null, accepted_by_user_id: null } : {}),
      updated_at: now,
    })
    .eq('id', jvId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // If re-proposing, notify partner admins
  if (expanding) {
    const { data: partnerAdmins } = await adminClient
      .from('memberships')
      .select('user_id')
      .eq('organization_id', jv.partner_organization_id)
      .in('role', ['owner', 'admin'])
      .eq('status', 'active');

    const adminIds = (partnerAdmins || []).map(m => m.user_id);
    if (adminIds.length > 0) {
      const { data: authData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const emails = (authData?.users || [])
        .filter(u => adminIds.includes(u.id)).map(u => u.email).filter(Boolean);

      const [{ data: hubOrg }, { data: partnerOrg }, { data: proposer }] = await Promise.all([
        adminClient.from('organizations').select('name').eq('id', orgId).single(),
        adminClient.from('organizations').select('name').eq('id', jv.partner_organization_id).single(),
        adminClient.from('profiles').select('name, first_name').eq('id', userId).single(),
      ]);

      const origin = req.headers.origin ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://lotline-crm.vercel.app');

      await sendJvProposalEmail({
        to:           emails,
        proposerName: proposer?.name || proposer?.first_name || 'LotLine Homes',
        hubOrgName:   hubOrg?.name || 'LotLine Homes',
        partnerName:  partnerOrg?.name || 'your organization',
        ownershipPct: null,
        reviewUrl:    `${origin}/settings/joint-ventures?tab=pending&jv=${jvId}`,
        notes:        'The JV permissions have been updated and require your re-acceptance.',
      });
    }
  }

  await logJvAccess(adminClient, {
    jvId,
    actingUserId:   userId,
    actingOrgId:    orgId,
    targetOrgId:    jv.partner_organization_id,
    action:         expanding ? 'jv.permissions_expanded' : 'jv.permissions_narrowed',
    targetType:     'joint_venture',
    targetId:       jvId,
    targetLabel:    'JV permissions updated',
    ipAddress:      req.headers['x-forwarded-for'] || null,
    metadata:       { expanding, new_permissions: permissionsOnPartner },
  });

  return res.status(200).json({ jv: updated, requiresReAcceptance: expanding });
}
