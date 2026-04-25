/**
 * POST /api/webhooks/pandadoc
 * Handles PandaDoc webhook events.
 * Verifies HMAC-SHA256 signature, processes event idempotently.
 *
 * PandaDoc sends X-Pandadoc-Signature: <hmac-sha256-hex>
 * Signature is computed over the raw request body using the org's webhook_secret.
 *
 * Since the webhook doesn't include org info directly in all cases,
 * we look up the envelope by pandadoc_doc_id to find the org.
 */
import { makeAdminClient } from '../_lib/teamAuth.js';
import { verifyWebhookSignature } from '../_lib/encryption.js';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody  = await getRawBody(req);
  const signature = req.headers['x-pandadoc-signature'] ?? '';

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // PandaDoc wraps events in an array
  const events = Array.isArray(payload) ? payload : [payload];
  const adminClient = makeAdminClient();

  for (const event of events) {
    const pandadocEventId = event.event?.id ?? event.id ?? null;
    const eventType       = event.event?.type ?? event.type ?? '';
    const docUuid         = event.data?.uuid ?? event.document?.uuid ?? null;

    if (!docUuid) continue;

    // Find the envelope by pandadoc_doc_id
    const { data: envelope } = await adminClient
      .from('esign_envelopes')
      .select('id, organization_id, name, status, deal_id, contact_id')
      .eq('pandadoc_doc_id', docUuid)
      .maybeSingle();

    if (!envelope) continue; // Not our envelope

    // Verify webhook signature using the org's secret
    const { data: conn } = await adminClient
      .from('esign_connections')
      .select('webhook_secret')
      .eq('organization_id', envelope.organization_id)
      .eq('provider', 'pandadoc')
      .maybeSingle();

    if (conn?.webhook_secret && signature) {
      const valid = verifyWebhookSignature(rawBody, signature, conn.webhook_secret);
      if (!valid) {
        console.warn(`[pandadoc webhook] Invalid signature for event ${pandadocEventId}`);
        continue; // skip this event silently
      }
    }

    // Idempotency: skip if already processed
    if (pandadocEventId) {
      const { error: dupErr } = await adminClient
        .from('esign_events')
        .insert({
          organization_id: envelope.organization_id,
          envelope_id:     envelope.id,
          pandadoc_event_id: pandadocEventId,
          provider:        'pandadoc',
          event_type:      eventType,
          payload:         event,
        });

      if (dupErr?.code === '23505') continue; // unique violation = duplicate
      if (dupErr) console.error('esign_events insert error:', dupErr);
    }

    // Process event
    await processEvent(adminClient, envelope, eventType, event);
  }

  return res.status(200).json({ ok: true });
}

async function processEvent(adminClient, envelope, eventType, event) {
  const pandaStatus = event.data?.status ?? event.document?.status ?? null;

  switch (eventType) {
    case 'document_state_changed': {
      const newStatus = mapPandaStatus(pandaStatus);
      const updates = {
        pandadoc_status: pandaStatus,
        status:          newStatus,
        updated_at:      new Date().toISOString(),
      };
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      await adminClient
        .from('esign_envelopes')
        .update(updates)
        .eq('id', envelope.id);

      if (newStatus === 'completed') {
        await notifyCompletion(adminClient, envelope);
      }
      break;
    }

    case 'document_viewed': {
      // Mark the recipient as viewed
      const viewerEmail = event.data?.email ?? null;
      if (viewerEmail) {
        await adminClient
          .from('esign_recipients')
          .update({ status: 'viewed', viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('envelope_id', envelope.id)
          .eq('email', viewerEmail);
      }
      break;
    }

    case 'recipient_completed': {
      const signerEmail = event.data?.email ?? null;
      if (signerEmail) {
        await adminClient
          .from('esign_recipients')
          .update({ status: 'signed', signed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('envelope_id', envelope.id)
          .eq('email', signerEmail);
      }
      // Update envelope to partially_signed if not already completed
      if (envelope.status === 'sent') {
        await adminClient
          .from('esign_envelopes')
          .update({ status: 'partially_signed', pandadoc_status: 'document_sent', updated_at: new Date().toISOString() })
          .eq('id', envelope.id);
      }
      break;
    }

    case 'document_completed': {
      await adminClient
        .from('esign_envelopes')
        .update({
          status:          'completed',
          pandadoc_status: 'document_completed',
          completed_at:    new Date().toISOString(),
          updated_at:      new Date().toISOString(),
        })
        .eq('id', envelope.id);

      // Mark all recipients signed
      await adminClient
        .from('esign_recipients')
        .update({ status: 'signed', signed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('envelope_id', envelope.id)
        .neq('status', 'signed');

      await notifyCompletion(adminClient, envelope);
      break;
    }

    default:
      // Unknown event type — logged via esign_events insert above
      break;
  }
}

async function notifyCompletion(adminClient, envelope) {
  // Broadcast notification to all active org members
  const { data: members } = await adminClient
    .from('memberships')
    .select('user_id')
    .eq('organization_id', envelope.organization_id)
    .eq('status', 'active');

  if (members?.length) {
    await adminClient.from('notifications').insert(
      members.map(m => ({
        organization_id: envelope.organization_id,
        user_id:         m.user_id,
        type:            'esign_completed',
        title:           'Document Signed',
        body:            `"${envelope.name}" has been completed by all parties.`,
        entity_type:     'esign_envelope',
        entity_id:       envelope.id,
        read:            false,
      }))
    );
  }
}

function mapPandaStatus(s) {
  if (!s) return 'sent';
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
