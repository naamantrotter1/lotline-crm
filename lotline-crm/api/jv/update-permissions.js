// PATCH /api/jv/update-permissions
// Hub-only. Updates permissions_on_partner for an active JV. Always applies immediately.
// Body: { jvId, permissionsOnPartner }
import { requireJvHubAuth, isAdmin, logJvAccess } from '../_lib/teamAuth.js';

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
    .select('id, partner_organization_id, status')
    .eq('id', jvId)
    .eq('host_organization_id', orgId)
    .in('status', ['active', 'suspended'])
    .maybeSingle();

  if (!jv) {
    return res.status(404).json({ error: 'Active JV not found for your organization.' });
  }

  const { data: updated, error } = await adminClient
    .from('joint_ventures')
    .update({
      permissions_on_partner: permissionsOnPartner,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jvId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await logJvAccess(adminClient, {
    jvId,
    actingUserId:   userId,
    actingOrgId:    orgId,
    targetOrgId:    jv.partner_organization_id,
    action:         'jv.permissions_updated',
    targetType:     'joint_venture',
    targetId:       jvId,
    targetLabel:    'JV permissions updated',
    ipAddress:      req.headers['x-forwarded-for'] || null,
    metadata:       { new_permissions: permissionsOnPartner },
  });

  return res.status(200).json({ jv: updated });
}
