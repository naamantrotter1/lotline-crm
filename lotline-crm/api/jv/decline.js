// POST /api/jv/decline
// Partner-only. Permanently declines a pending JV proposal (status → terminated).
// Body: { jvId, reason }
import { requireOrgMember, isAdmin, logJvAccess } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can decline JV proposals.' });
  }

  const { jvId, reason } = req.body || {};
  if (!jvId)   return res.status(400).json({ error: 'jvId is required.' });
  if (!reason) return res.status(400).json({ error: 'A reason is required when declining.' });

  const { data: jv } = await adminClient
    .from('joint_ventures')
    .select('id, host_organization_id')
    .eq('id', jvId)
    .eq('partner_organization_id', orgId)
    .eq('status', 'proposed')
    .maybeSingle();

  if (!jv) {
    return res.status(404).json({ error: 'Proposal not found or not addressed to your organization.' });
  }

  const now = new Date().toISOString();

  const { data: updated, error } = await adminClient
    .from('joint_ventures')
    .update({
      status:                'terminated',
      terminated_at:         now,
      terminated_by_user_id: userId,
      termination_reason:    `Declined by partner: ${reason}`,
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
    targetOrgId:    jv.host_organization_id,
    action:         'jv.declined',
    targetType:     'joint_venture',
    targetId:       jvId,
    targetLabel:    'Joint Venture proposal declined',
    ipAddress:      req.headers['x-forwarded-for'] || null,
    metadata:       { reason, declined_at: now },
  });

  return res.status(200).json({ jv: updated });
}
