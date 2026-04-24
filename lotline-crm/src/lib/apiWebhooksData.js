/**
 * apiWebhooksData.js
 * Phase 10: CRUD for API keys and webhook endpoints.
 * API keys: generate a random key client-side, store only the SHA-256 hash + prefix.
 * Webhooks: store URL, events, signing secret; fire via fetch() from the browser.
 */
import { supabase } from './supabase';

// ── Crypto helpers ──────────────────────────────────────────────────────────

/** Generate a cryptographically random API key string, e.g. "llk_abc123..." */
export function generateApiKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `llk_${hex}`;
}

/** Generate a random webhook signing secret */
export function generateWebhookSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash of a string → hex */
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── API Keys ────────────────────────────────────────────────────────────────

export async function fetchApiKeys(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, created_at, revoked_at')
    .eq('organization_id', orgId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  return data || [];
}

/**
 * Create a new API key. Returns { key (plain, shown once), record }.
 */
export async function createApiKey(orgId, userId, { name, scopes = ['read'] }) {
  if (!supabase) return { error: 'no supabase' };
  const key    = generateApiKey();
  const hash   = await sha256(key);
  const prefix = key.slice(0, 12); // "llk_" + 8 hex chars
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ organization_id: orgId, created_by: userId, name, key_prefix: prefix, key_hash: hash, scopes })
    .select()
    .single();
  return { key, data, error };
}

export async function revokeApiKey(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

// ── Webhook Endpoints ───────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  'deal.created',
  'deal.stage_changed',
  'deal.updated',
  'deal.deleted',
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'task.created',
  'task.completed',
];

export async function fetchWebhooks(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createWebhook(orgId, userId, { url, events }) {
  if (!supabase) return { error: 'no supabase' };
  const secret = generateWebhookSecret();
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ organization_id: orgId, created_by: userId, url, events, secret })
    .select()
    .single();
  return { secret, data, error };
}

export async function updateWebhook(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const allowed = ['url', 'events', 'active'];
  const safe = {};
  for (const k of allowed) if (k in patch) safe[k] = patch[k];
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .update(safe).eq('id', id).select().single();
  return { data, error };
}

export async function deleteWebhook(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
  return { error };
}

export async function fetchDeliveries(endpointId, limit = 20) {
  if (!supabase || !endpointId) return [];
  const { data } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('endpoint_id', endpointId)
    .order('fired_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Webhook firing (client-side delivery) ──────────────────────────────────

/**
 * Fire all active webhooks for an org that subscribe to `event`.
 * Logs each delivery to webhook_deliveries.
 * Called from deal/contact mutation code paths.
 */
export async function fireWebhooks(orgId, event, payload) {
  if (!supabase || !orgId) return;
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('organization_id', orgId)
    .eq('active', true);

  if (!endpoints?.length) return;

  const matching = endpoints.filter(e => e.events?.includes(event));
  if (!matching.length) return;

  const body = JSON.stringify({ event, data: payload, fired_at: new Date().toISOString() });

  await Promise.allSettled(matching.map(async (ep) => {
    let statusCode = null;
    let responseBody = null;
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LotLine-Event': event,
          'X-LotLine-Signature': ep.secret, // simplified; production would use HMAC
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      statusCode = res.status;
      responseBody = await res.text().catch(() => null);
    } catch (err) {
      statusCode = 0;
      responseBody = err.message;
    }
    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      endpoint_id: ep.id, event, payload: JSON.parse(body),
      status_code: statusCode, response_body: responseBody,
    });
    // Update last_fired_at and last_status on endpoint
    await supabase.from('webhook_endpoints')
      .update({ last_fired_at: new Date().toISOString(), last_status: statusCode })
      .eq('id', ep.id);
  }));
}
