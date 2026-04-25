/**
 * POST /api/pandadoc/send-envelope
 * Creates and sends a PandaDoc document from a template.
 * Body: {
 *   templateId: string,        -- esign_templates.id (local UUID)
 *   name: string,
 *   contactId?: string,
 *   dealId?: string,
 *   recipients: Array<{ email, firstName, lastName, role }>,
 *   tokens?: Array<{ name, value }>,
 * }
 */
import { requireOrgMember } from '../_lib/teamAuth.js';
import { getPandaDocClient } from '../_lib/pandadocClient.js';
import { canUserServer } from '../../src/lib/permissions.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  if (!canUserServer(auth.orgRole, 'esign.send')) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  const { templateId, name, contactId, dealId, recipients, tokens } = req.body ?? {};
  if (!templateId || !name || !recipients?.length) {
    return res.status(400).json({ error: 'Missing required fields: templateId, name, recipients' });
  }

  // Load the template to get pandadoc_id
  const { data: template } = await auth.adminClient
    .from('esign_templates')
    .select('pandadoc_id, name')
    .eq('id', templateId)
    .eq('organization_id', auth.orgId)
    .maybeSingle();

  if (!template) return res.status(404).json({ error: 'Template not found' });

  let client;
  try {
    client = await getPandaDocClient(auth.adminClient, auth.orgId);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Create document from template
  const docPayload = {
    name,
    template_uuid: template.pandadoc_id,
    recipients: recipients.map(r => ({
      email:      r.email,
      first_name: r.firstName,
      last_name:  r.lastName,
      role:       r.role,
    })),
    tokens: tokens ?? [],
    send_after: true,  // send immediately after creation
  };

  let pandaDoc;
  try {
    pandaDoc = await client.post('/public/v1/documents', docPayload);
  } catch (e) {
    console.error('PandaDoc create document error:', e);
    return res.status(502).json({ error: `PandaDoc error: ${e.message}`, detail: e.body });
  }

  // Insert envelope row
  const { data: envelope, error: envErr } = await auth.adminClient
    .from('esign_envelopes')
    .insert({
      organization_id: auth.orgId,
      created_by:      auth.userId,
      template_id:     templateId,
      contact_id:      contactId ?? null,
      deal_id:         dealId ?? null,
      name,
      provider:        'pandadoc',
      pandadoc_doc_id: pandaDoc.uuid,
      pandadoc_status: pandaDoc.status,
      status:          mapPandaStatus(pandaDoc.status),
      sent_at:         new Date().toISOString(),
    })
    .select()
    .single();

  if (envErr) {
    console.error('envelope insert error:', envErr);
    return res.status(500).json({ error: 'Document created in PandaDoc but failed to save locally' });
  }

  // Insert recipients
  if (recipients.length) {
    const recipRows = recipients.map((r, i) => ({
      envelope_id:    envelope.id,
      name:           `${r.firstName} ${r.lastName}`.trim(),
      email:          r.email,
      role:           r.role ?? 'signer',
      signing_order:  i + 1,
      status:         'sent',
    }));
    await auth.adminClient.from('esign_recipients').insert(recipRows);
  }

  return res.status(200).json({ envelopeId: envelope.id, pandadocDocId: pandaDoc.uuid });
}

function mapPandaStatus(s) {
  if (!s) return 'draft';
  const m = {
    document_draft:            'draft',
    document_sent:             'sent',
    document_viewed:           'sent',
    document_waiting_approval: 'sent',
    document_approved:         'sent',
    document_completed:        'completed',
    document_declined:         'declined',
    document_voided:           'voided',
    document_expired:          'expired',
  };
  return m[s] ?? 'sent';
}
