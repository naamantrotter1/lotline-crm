/**
 * esignData.js
 * Phase 16: E-sign / PandaDoc data layer.
 *
 * PandaDoc OAuth flow:
 *   1. User clicks "Connect PandaDoc" → redirected to PandaDoc OAuth
 *   2. PandaDoc redirects back with ?code=... to /settings?pandadoc=connected
 *   3. Front-end calls exchangePandaDocCode() → pandadoc-auth edge function
 *   4. Tokens stored in esign_connections
 *
 * Env vars needed:
 *   VITE_PANDADOC_CLIENT_ID   — for building auth URL
 *   PANDADOC_CLIENT_SECRET    — edge function secret
 */
import { supabase } from './supabase';

const PANDADOC_API = 'https://api.pandadoc.com';

// ── OAuth ──────────────────────────────────────────────────────────────────

export function getPandaDocAuthUrl(redirectUri) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: import.meta.env.VITE_PANDADOC_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    scope: 'read+write',
  });
  return `https://app.pandadoc.com/oauth2/authorize?${params}`;
}

export async function exchangePandaDocCode(code, redirectUri, orgId, userId) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('pandadoc-auth', {
    body: { code, redirectUri, orgId, userId },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchEsignConnection(orgId, userId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('esign_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function disconnectEsign(connectionId) {
  if (!supabase) return;
  await supabase.from('esign_connections').delete().eq('id', connectionId);
}

// ── Templates ──────────────────────────────────────────────────────────────

export async function syncEsignTemplates(orgId, userId) {
  if (!supabase) return [];
  const { data, error } = await supabase.functions.invoke('pandadoc-sync-templates', {
    body: { orgId, userId },
  });
  if (error) throw new Error(error.message);
  return data?.templates ?? [];
}

export async function fetchEsignTemplates(orgId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('esign_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('name');
  return data ?? [];
}

// ── Envelopes ──────────────────────────────────────────────────────────────

export async function fetchEnvelopes(orgId, { contactId, dealId, status } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from('esign_envelopes')
    .select(`
      *,
      esign_recipients(*),
      esign_templates(name),
      contacts(first_name, last_name)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (contactId) q = q.eq('contact_id', contactId);
  if (dealId)    q = q.eq('deal_id', dealId);
  if (status)    q = q.eq('status', status);

  const { data } = await q;
  return data ?? [];
}

export async function fetchEnvelope(id) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('esign_envelopes')
    .select('*, esign_recipients(*), esign_templates(*)')
    .eq('id', id)
    .maybeSingle();
  return data;
}

/**
 * Create and send a document from a PandaDoc template.
 * Calls edge function which creates the doc in PandaDoc and updates DB.
 */
export async function sendEnvelope({ orgId, userId, templateId, pandadocTemplateId, name, contactId, dealId, recipients, fieldsData }) {
  if (!supabase) throw new Error('Supabase not configured');

  // Insert draft envelope first
  const { data: envelope, error: insertErr } = await supabase
    .from('esign_envelopes')
    .insert({
      organization_id: orgId,
      created_by: userId,
      contact_id: contactId ?? null,
      deal_id: dealId ?? null,
      template_id: templateId ?? null,
      name,
      status: 'draft',
      fields_data: fieldsData ?? {},
    })
    .select()
    .single();
  if (insertErr) throw new Error(insertErr.message);

  // Insert recipients
  if (recipients?.length) {
    await supabase.from('esign_recipients').insert(
      recipients.map(r => ({
        envelope_id: envelope.id,
        name: r.name,
        email: r.email,
        role: r.role ?? 'signer',
      }))
    );
  }

  // Call edge function to send via PandaDoc
  const { data, error } = await supabase.functions.invoke('pandadoc-send', {
    body: {
      envelopeId: envelope.id,
      orgId,
      userId,
      pandadocTemplateId,
      recipients,
      fieldsData,
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function voidEnvelope(id) {
  if (!supabase) return;
  await supabase.from('esign_envelopes').update({
    status: 'voided',
    voided_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
}

export async function refreshEnvelopeStatus(envelopeId, orgId, userId) {
  if (!supabase) return;
  const { data, error } = await supabase.functions.invoke('pandadoc-status', {
    body: { envelopeId, orgId, userId },
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Display helpers ────────────────────────────────────────────────────────

export const ENVELOPE_STATUS = {
  draft:            { label: 'Draft',            color: 'gray' },
  sent:             { label: 'Sent',             color: 'blue' },
  partially_signed: { label: 'Partially Signed', color: 'amber' },
  completed:        { label: 'Completed',        color: 'green' },
  declined:         { label: 'Declined',         color: 'red' },
  voided:           { label: 'Voided',           color: 'gray' },
  expired:          { label: 'Expired',          color: 'orange' },
};

export const RECIPIENT_STATUS = {
  pending:  { label: 'Pending',  color: 'gray' },
  sent:     { label: 'Sent',     color: 'blue' },
  viewed:   { label: 'Viewed',   color: 'amber' },
  signed:   { label: 'Signed',   color: 'green' },
  declined: { label: 'Declined', color: 'red' },
};

export function envelopeStatusBadge(status) {
  return ENVELOPE_STATUS[status] ?? { label: status, color: 'gray' };
}
