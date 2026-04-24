/**
 * GET  /api/google/sso-config  — returns { enabled: bool }
 * POST /api/google/sso-config  — body { enabled: bool }, toggles Google SSO
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (to verify caller is an admin)
 *   SUPABASE_MANAGEMENT_TOKEN               (Supabase personal access token)
 *   SUPABASE_PROJECT_REF                    (project ref, e.g. kukwppzrhbbaxppkvtjs)
 */

import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'kukwppzrhbbaxppkvtjs';
const MGMT_TOKEN  = process.env.SUPABASE_MANAGEMENT_TOKEN;
const MGMT_URL    = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

async function getGoogleEnabled() {
  const r = await fetch(MGMT_URL, {
    headers: { Authorization: `Bearer ${MGMT_TOKEN}` },
  });
  if (!r.ok) throw new Error(`Management API error: ${r.status}`);
  const cfg = await r.json();
  return !!cfg.external_google_enabled;
}

async function setGoogleEnabled(enabled) {
  const r = await fetch(MGMT_URL, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ external_google_enabled: enabled }),
  });
  if (!r.ok) throw new Error(`Management API error: ${r.status}`);
}

export default async function handler(req, res) {
  if (!MGMT_TOKEN) {
    return res.status(500).json({ error: 'SUPABASE_MANAGEMENT_TOKEN not configured' });
  }

  // Verify caller is an org admin/owner
  const auth = await requireOrgMember(req, res);
  if (!auth) return;
  if (!isAdmin(auth.orgRole)) {
    return res.status(403).json({ error: 'Only admins can change SSO settings' });
  }

  if (req.method === 'GET') {
    try {
      const enabled = await getGoogleEnabled();
      return res.status(200).json({ enabled });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Body must include { enabled: boolean }' });
    }
    try {
      await setGoogleEnabled(enabled);
      return res.status(200).json({ enabled });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
