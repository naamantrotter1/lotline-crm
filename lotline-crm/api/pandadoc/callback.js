/**
 * POST /api/pandadoc/callback
 * Exchanges OAuth code for tokens, stores encrypted in esign_connections.
 * Body: { code: string }
 */
import { requireOrgMember } from '../_lib/teamAuth.js';
import { encrypt } from '../_lib/encryption.js';
import { randomBytes } from 'crypto';

const TOKEN_URL = 'https://api.pandadoc.com/oauth2/access_token';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const redirectUri = `${process.env.VITE_APP_URL}/settings?tab=integrations`;

  // Exchange code for tokens
  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     process.env.PANDADOC_CLIENT_ID,
    client_secret: process.env.PANDADOC_CLIENT_SECRET,
  });

  const tokenResp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenResp.ok) {
    const txt = await tokenResp.text();
    return res.status(502).json({ error: `PandaDoc token exchange failed: ${txt}` });
  }

  const tokens = await tokenResp.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Generate a per-org webhook secret
  const webhookSecret = randomBytes(32).toString('hex');

  // Upsert the connection
  const { error: upsertErr } = await auth.adminClient
    .from('esign_connections')
    .upsert({
      organization_id:   auth.orgId,
      user_id:           auth.userId,
      provider:          'pandadoc',
      auth_method:       'oauth',
      access_token_enc:  encrypt(tokens.access_token),
      refresh_token_enc: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      token_expires_at:  expiresAt,
      webhook_secret:    webhookSecret,
      connected_at:      new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    }, {
      onConflict: 'organization_id,provider',
    });

  if (upsertErr) {
    console.error('esign_connections upsert error:', upsertErr);
    return res.status(500).json({ error: 'Failed to save connection' });
  }

  return res.status(200).json({ ok: true });
}
