/**
 * pandadocClient.js
 * PandaDoc REST API client with automatic token refresh.
 * Reads the esign_connection for the org and refreshes if needed.
 */
import { decrypt, encrypt } from './encryption.js';

const PANDADOC_API = 'https://api.pandadoc.com';
const TOKEN_URL    = 'https://api.pandadoc.com/oauth2/access_token';
const BUFFER_SECS  = 300; // refresh 5 min before expiry

/**
 * Returns a PandaDoc client bound to the org's connection.
 * Automatically refreshes the access token if expired/near-expiry.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} adminClient
 * @param {string} orgId
 * @returns {{ get, post, delete: del, patch }} - async fetch wrappers
 */
export async function getPandaDocClient(adminClient, orgId) {
  const { data: conn, error } = await adminClient
    .from('esign_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('provider', 'pandadoc')
    .maybeSingle();

  if (error || !conn) throw new Error('No PandaDoc connection found for this organization.');

  let accessToken;

  if (conn.auth_method === 'api_key') {
    accessToken = decrypt(conn.api_key_enc);
  } else {
    // OAuth: check expiry and refresh if needed
    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    const nowMs     = Date.now();
    const needsRefresh = expiresAt - nowMs < BUFFER_SECS * 1000;

    if (needsRefresh && conn.refresh_token_enc) {
      const refreshToken = decrypt(conn.refresh_token_enc);
      const body = new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     process.env.PANDADOC_CLIENT_ID,
        client_secret: process.env.PANDADOC_CLIENT_SECRET,
      });

      const resp = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`PandaDoc token refresh failed: ${txt}`);
      }

      const tokens = await resp.json();
      const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await adminClient
        .from('esign_connections')
        .update({
          access_token_enc:  encrypt(tokens.access_token),
          refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : conn.refresh_token_enc,
          token_expires_at:  newExpiry,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', conn.id);

      accessToken = tokens.access_token;
    } else {
      accessToken = decrypt(conn.access_token_enc);
    }
  }

  async function pandaFetch(method, path, body) {
    const resp = await fetch(`${PANDADOC_API}${path}`, {
      method,
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      throw Object.assign(new Error(`PandaDoc ${method} ${path} failed: ${resp.status}`), {
        status: resp.status,
        body:   data,
      });
    }
    return data;
  }

  return {
    get:    (path)        => pandaFetch('GET',    path),
    post:   (path, body)  => pandaFetch('POST',   path, body),
    patch:  (path, body)  => pandaFetch('PATCH',  path, body),
    delete: (path)        => pandaFetch('DELETE', path),
  };
}
