// GET /api/jv/search-orgs?q=<query>
// Hub-only. Searches subscriber orgs by name or slug for the JV propose modal.
// Returns orgs that are NOT the hub and do NOT already have an active/proposed JV.
import { requireJvHubAuth, isAdmin } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireJvHubAuth(req, res);
  if (!auth) return;

  const { adminClient, orgId, orgRole } = auth;

  if (!isAdmin(orgRole)) {
    return res.status(403).json({ error: 'Only owners and admins can propose JVs.' });
  }

  const q = (req.query.q || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    return res.status(200).json({ orgs: [] });
  }

  // Search orgs by name or slug (case-insensitive)
  const { data: orgs, error } = await adminClient
    .from('organizations')
    .select('id, name, slug, status')
    .eq('status', 'active')
    .neq('id', orgId)          // exclude self
    .neq('is_jv_hub', true)    // exclude other hub orgs (only one anyway)
    .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });

  // Exclude orgs that already have an active or proposed JV
  const { data: existingJvs } = await adminClient
    .from('joint_ventures')
    .select('partner_organization_id, status')
    .eq('host_organization_id', orgId)
    .in('status', ['proposed', 'active', 'suspended']);

  const blockedIds = new Set((existingJvs || []).map(jv => jv.partner_organization_id));

  const filtered = (orgs || [])
    .filter(o => !blockedIds.has(o.id))
    .map(o => ({ id: o.id, name: o.name, slug: o.slug }));

  return res.status(200).json({ orgs: filtered });
}
