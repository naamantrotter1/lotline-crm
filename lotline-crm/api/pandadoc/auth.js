/**
 * GET /api/pandadoc/auth
 * Returns the PandaDoc OAuth authorization URL.
 * The front-end redirects the browser to this URL.
 */
import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const redirectUri = `${process.env.VITE_APP_URL}/esign`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.PANDADOC_CLIENT_ID,
    redirect_uri:  redirectUri,
    scope:         'read+write',
  });

  const url = `https://app.pandadoc.com/oauth2/authorize?${params.toString()}`;
  return res.status(200).json({ url });
}
