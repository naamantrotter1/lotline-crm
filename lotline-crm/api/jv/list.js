// GET /api/jv/list
// Returns all JVs for the current org (as host or as partner).
// Hub org sees all JVs they proposed.
// Partner org sees all JVs proposed to them.
import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, orgId } = auth;

  const { data: jvs, error } = await adminClient
    .from('joint_ventures')
    .select('*')
    .or(`host_organization_id.eq.${orgId},partner_organization_id.eq.${orgId}`)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Enrich with org names for display
  const orgIds = [...new Set(
    (jvs || []).flatMap(jv => [jv.host_organization_id, jv.partner_organization_id])
  )];

  let orgMap = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await adminClient
      .from('organizations')
      .select('id, name, slug')
      .in('id', orgIds);
    orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o]));
  }

  const enriched = (jvs || []).map(jv => ({
    ...jv,
    host_org:    orgMap[jv.host_organization_id]    ?? null,
    partner_org: orgMap[jv.partner_organization_id] ?? null,
  }));

  return res.status(200).json({ jvs: enriched });
}
