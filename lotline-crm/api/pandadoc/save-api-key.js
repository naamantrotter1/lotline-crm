/**
 * POST /api/pandadoc/save-api-key
 * Saves a PandaDoc API key (alternative to OAuth) for this org.
 * Body: { apiKey: string }
 * Requires admin role.
 */
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';
import { encrypt } from '../_lib/encryption.js';
import { randomBytes } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  if (!isAdmin(auth.orgRole)) {
    return res.status(403).json({ error: 'Only admins can configure PandaDoc.' });
  }

  const { apiKey } = req.body ?? {};
  if (!apiKey?.trim()) return res.status(400).json({ error: 'Missing apiKey' });

  // Validate the key by hitting PandaDoc API
  const testResp = await fetch('https://api.pandadoc.com/public/v1/templates?count=1', {
    headers: { Authorization: `API-Key ${apiKey.trim()}` },
  });

  if (!testResp.ok) {
    return res.status(400).json({ error: 'Invalid PandaDoc API key — validation failed.' });
  }

  const webhookSecret = randomBytes(32).toString('hex');

  const { error } = await auth.adminClient
    .from('esign_connections')
    .upsert({
      organization_id: auth.orgId,
      user_id:         auth.userId,
      provider:        'pandadoc',
      auth_method:     'api_key',
      api_key_enc:     encrypt(apiKey.trim()),
      webhook_secret:  webhookSecret,
      connected_at:    new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    }, {
      onConflict: 'organization_id,provider',
    });

  if (error) {
    console.error('save-api-key error:', error);
    return res.status(500).json({ error: 'Failed to save API key' });
  }

  return res.status(200).json({ ok: true });
}
