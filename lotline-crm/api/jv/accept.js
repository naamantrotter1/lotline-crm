// POST /api/jv/accept
// Partner-only. Accepts a pending JV proposal — activates immediately.
// Body: { jvId }
import { requireOrgMember, isAdmin, logJvAccess } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can accept JV proposals.' });
  }

  const { jvId } = req.body || {};
  if (!jvId) return res.status(400).json({ error: 'jvId is required.' });

  // Fetch the JV and verify this org is the partner
  const { data: jv } = await adminClient
    .from('joint_ventures')
    .select('*')
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
      status:              'active',
      accepted_by_user_id: userId,
      accepted_at:         now,
      updated_at:          now,
    })
    .eq('id', jvId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Audit log on both sides
  await logJvAccess(adminClient, {
    jvId,
    actingUserId:   userId,
    actingOrgId:    orgId,
    targetOrgId:    jv.host_organization_id,
    action:         'jv.accepted',
    targetType:     'joint_venture',
    targetId:       jvId,
    targetLabel:    'Joint Venture accepted',
    ipAddress:      req.headers['x-forwarded-for'] || null,
    metadata:       { accepted_at: now },
  });

  return res.status(200).json({ jv: updated });
}
