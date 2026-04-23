// POST /api/jv/suspend
// Either party (hub or partner, owner/admin) can suspend an active JV.
// Revokes visibility immediately. Reversible via /api/jv/reactivate.
// Body: { jvId, reason }
import { requireOrgMember, isAdmin, logJvAccess } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can suspend a JV.' });
  }

  const { jvId, reason } = req.body || {};
  if (!jvId)   return res.status(400).json({ error: 'jvId is required.' });
  if (!reason) return res.status(400).json({ error: 'A reason is required when suspending.' });

  // Both host and partner can suspend
  const { data: jv } = await adminClient
    .from('joint_ventures')
    .select('id, host_organization_id, partner_organization_id')
    .eq('id', jvId)
    .eq('status', 'active')
    .or(`host_organization_id.eq.${orgId},partner_organization_id.eq.${orgId}`)
    .maybeSingle();

  if (!jv) {
    return res.status(404).json({ error: 'Active JV not found for your organization.' });
  }

  const now = new Date().toISOString();
  const otherOrgId = jv.host_organization_id === orgId
    ? jv.partner_organization_id
    : jv.host_organization_id;

  const { data: updated, error } = await adminClient
    .from('joint_ventures')
    .update({
      status:               'suspended',
      suspended_at:         now,
      suspended_by_user_id: userId,
      suspension_reason:    reason,
      updated_at:           now,
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
    action:         'jv.suspended',
    targetType:     'joint_venture',
    targetId:       jvId,
    targetLabel:    'Joint Venture suspended',
    ipAddress:      req.headers['x-forwarded-for'] || null,
    metadata:       { reason, suspended_at: now },
  });

  return res.status(200).json({ jv: updated });
}
