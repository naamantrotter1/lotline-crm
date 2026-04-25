/**
 * POST /api/pandadoc/send-reminder
 * Sends a reminder to all pending signers for an envelope.
 * Body: { envelopeId: string }
 */
import { requireOrgMember } from '../_lib/teamAuth.js';
import { getPandaDocClient } from '../_lib/pandadocClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { envelopeId } = req.body ?? {};
  if (!envelopeId) return res.status(400).json({ error: 'Missing envelopeId' });

  const { data: envelope } = await auth.adminClient
    .from('esign_envelopes')
    .select('pandadoc_doc_id, status, remind_count')
    .eq('id', envelopeId)
    .eq('organization_id', auth.orgId)
    .maybeSingle();

  if (!envelope) return res.status(404).json({ error: 'Envelope not found' });
  if (!['sent', 'partially_signed'].includes(envelope.status)) {
    return res.status(400).json({ error: 'Can only remind on sent or partially-signed envelopes' });
  }

  let client;
  try {
    client = await getPandaDocClient(auth.adminClient, auth.orgId);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // PandaDoc reminder endpoint
  try {
    await client.post(`/public/v1/documents/${envelope.pandadoc_doc_id}/send`, {
      message: 'Please sign this document at your earliest convenience.',
      silent:  false,
    });
  } catch (e) {
    return res.status(502).json({ error: `PandaDoc reminder failed: ${e.message}` });
  }

  await auth.adminClient
    .from('esign_envelopes')
    .update({
      remind_count:     (envelope.remind_count ?? 0) + 1,
      last_reminded_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', envelopeId);

  return res.status(200).json({ ok: true });
}
