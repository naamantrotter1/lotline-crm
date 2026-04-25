/**
 * DELETE /api/pandadoc/disconnect
 * Removes the PandaDoc OAuth connection for this org.
 * Requires owner or admin role.
 */
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  if (!isAdmin(auth.orgRole)) {
    return res.status(403).json({ error: 'Only admins can disconnect PandaDoc.' });
  }

  const { error } = await auth.adminClient
    .from('esign_connections')
    .delete()
    .eq('organization_id', auth.orgId)
    .eq('provider', 'pandadoc');

  if (error) {
    console.error('disconnect error:', error);
    return res.status(500).json({ error: 'Failed to disconnect' });
  }

  return res.status(200).json({ ok: true });
}
