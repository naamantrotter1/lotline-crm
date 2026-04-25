/**
 * esignData.js
 * E-sign / PandaDoc data layer.
 * All mutations go through our Vercel API routes (/api/pandadoc/*).
 * Read-only queries go directly to Supabase.
 */
import { supabase } from './supabase';

// ── Auth helpers ────────────────────────────────────────────────────────────

async function authHeaders() {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost(path, body) {
  const headers = await authHeaders();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

async function apiDelete(path) {
  const headers = await authHeaders();
  const res = await fetch(path, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

// ── OAuth ───────────────────────────────────────────────────────────────────

/**
 * Fetches the PandaDoc OAuth authorization URL from our API.
 * The caller should then redirect: window.location.href = url
 */
export async function getPandaDocAuthUrl() {
  const headers = await authHeaders();
  const res = await fetch('/api/pandadoc/auth', { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get auth URL');
  return data.url;
}

/**
 * Exchanges the OAuth code received in the callback URL.
 * @param {string} code
 */
export async function exchangePandaDocCode(code) {
  return apiPost('/api/pandadoc/callback', { code });
}

export async function fetchEsignConnection(orgId) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('esign_connections')
    .select('id, provider, auth_method, connected_at, last_sync_at, pandadoc_workspace_id')
    .eq('organization_id', orgId)
    .eq('provider', 'pandadoc')
    .maybeSingle();
  return data;
}

export async function disconnectEsign() {
  return apiDelete('/api/pandadoc/disconnect');
}

/**
 * Save a PandaDoc API key (alternative to OAuth).
 * @param {string} apiKey
 */
export async function savePandaDocApiKey(apiKey) {
  return apiPost('/api/pandadoc/save-api-key', { apiKey });
}

// ── Templates ───────────────────────────────────────────────────────────────

export async function syncEsignTemplates() {
  return apiPost('/api/pandadoc/sync-templates', {});
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

// ── Envelopes ───────────────────────────────────────────────────────────────

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
 * Send a document via PandaDoc.
 * @param {{ templateId, name, contactId?, dealId?, recipients, tokens? }} params
 */
export async function sendEnvelope(params) {
  return apiPost('/api/pandadoc/send-envelope', params);
}

export async function voidEnvelope(envelopeId, reason) {
  return apiPost('/api/pandadoc/void-envelope', { envelopeId, reason });
}

export async function sendReminder(envelopeId) {
  return apiPost('/api/pandadoc/send-reminder', { envelopeId });
}

// ── Display helpers ─────────────────────────────────────────────────────────

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
