/**
 * POST /api/pandadoc/void-envelope
 * Voids a document in PandaDoc and updates local status.
 * Body: { envelopeId: string, reason?: string }
 * Requires esign.manage permission.
 */
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';
import { getPandaDocClient } from '../_lib/pandadocClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  if (!isAdmin(auth.orgRole)) {
    return res.status(403).json({ error: 'Only admins can void documents.' });
  }

  const { envelopeId, reason } = req.body ?? {};
  if (!envelopeId) return res.status(400).json({ error: 'Missing envelopeId' });

  // Load envelope
  const { data: envelope } = await auth.adminClient
    .from('esign_envelopes')
    .select('pandadoc_doc_id, status')
    .eq('id', envelopeId)
    .eq('organization_id', auth.orgId)
    .maybeSingle();

  if (!envelope) return res.status(404).json({ error: 'Envelope not found' });
  if (envelope.status === 'voided') return res.status(400).json({ error: 'Already voided' });
  if (envelope.status === 'completed') return res.status(400).json({ error: 'Cannot void a completed document' });

  let client;
  try {
    client = await getPandaDocClient(auth.adminClient, auth.orgId);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Void in PandaDoc
  try {
    await client.delete(`/public/v1/documents/${envelope.pandadoc_doc_id}`);
  } catch (e) {
    if (e.status !== 404) {
      return res.status(502).json({ error: `PandaDoc void failed: ${e.message}` });
    }
  }

  await auth.adminClient
    .from('esign_envelopes')
    .update({
      status:     'voided',
      voided_at:  new Date().toISOString(),
      voided_by:  auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', envelopeId);

  return res.status(200).json({ ok: true });
}
