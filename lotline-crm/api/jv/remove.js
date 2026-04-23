// DELETE /api/jv/remove
// Hub-only. Hard-deletes a JV record entirely.
// Body: { jv_id }
import { requireJvHubAuth, isAdmin } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireJvHubAuth(req, res);
  if (!auth) return;

  const { adminClient, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can remove JV partners.' });
  }

  const { jv_id } = req.body || {};
  if (!jv_id) return res.status(400).json({ error: 'jv_id is required.' });

  // Verify JV belongs to this hub org
  const { data: jv } = await adminClient
    .from('joint_ventures')
    .select('id')
    .eq('id', jv_id)
    .eq('host_organization_id', orgId)
    .single();

  if (!jv) return res.status(404).json({ error: 'JV not found.' });

  const { error } = await adminClient
    .from('joint_ventures')
    .delete()
    .eq('id', jv_id);

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}
