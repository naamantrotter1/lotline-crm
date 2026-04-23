// POST /api/jv/terminate
// Either party (hub or partner, owner/admin) can permanently terminate a JV.
// Revokes all visibility immediately. Not reversible (re-propose creates a new row).
// Body: { jvId, reason }
import { requireOrgMember, isAdmin, logJvAccess } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can terminate a JV.' });
  }

  const { jvId, reason } = req.body || {};
  if (!jvId)   return res.status(400).json({ error: 'jvId is required.' });
  if (!reason) return res.status(400).json({ error: 'A reason is required when terminating.' });

  // Both host and partner can terminate; any non-terminated status is valid
  const { data: jv } = await adminClient
    .from('joint_ventures')
    .select('id, host_organization_id, partner_organization_id, status')
    .eq('id', jvId)
    .not('status', 'eq', 'terminated')
    .or(`host_organization_id.eq.${orgId},partner_organization_id.eq.${orgId}`)
    .maybeSingle();

  if (!jv) {
    return res.status(404).json({ error: 'JV not found, already terminated, or not accessible to your organization.' });
  }

  const now = new Date().toISOString();
  const otherOrgId = jv.host_organization_id === orgId
    ? jv.partner_organization_id
    : jv.host_organization_id;

  const { data: updated, error } = await adminClient
    .from('joint_ventures')
    .update({
      status:                'terminated',
      terminated_at:         now,
      terminated_by_user_id: userId,
      termination_reason:    reason,
      updated_at:            now,
    })
    .eq('id', jvId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await logJvAccess(adminClient, {
    jvId,
    actingUserId:   userId,
    actingOrgId:    orgId,
    targetOrgId:    otherOrgId,
    action:         'jv.terminated',
    targetType:     'joint_venture',
    targetId:       jvId,
    targetLabel:    'Joint Venture terminated',
    ipAddress:      req.headers['x-forwarded-for'] || null,
    metadata:       { reason, terminated_at: now, prior_status: jv.status },
  });

  return res.status(200).json({ jv: updated });
}
