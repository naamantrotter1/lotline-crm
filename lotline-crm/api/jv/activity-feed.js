// GET /api/jv/activity-feed?limit=20&offset=0
// Returns jv_access_logs where the current org is the TARGET (partner activity transparency feed).
// Also used by hub org to see their own cross-org actions (acting_organization_id = current org).
// Query params: limit, offset, type (partner_on_me | i_on_partner | all)
import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, orgId } = auth;

  const limit  = Math.min(parseInt(req.query.limit  || '20', 10), 100);
  const offset = parseInt(req.query.offset || '0', 10);
  const type   = req.query.type || 'all'; // 'partner_on_me' | 'i_on_partner' | 'all'

  let query = adminClient
    .from('jv_access_logs')
    .select('*')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type === 'partner_on_me') {
    query = query.eq('target_organization_id', orgId);
  } else if (type === 'i_on_partner') {
    query = query.eq('acting_organization_id', orgId).neq('target_organization_id', orgId);
  } else {
    // 'all' — anything involving this org
    query = query.or(`target_organization_id.eq.${orgId},acting_organization_id.eq.${orgId}`);
  }

  const { data: logs, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Enrich with actor display name
  const actorIds = [...new Set((logs || []).map(l => l.acting_user_id))];
  let actorMap = {};
  if (actorIds.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, name, first_name, last_name')
      .in('id', actorIds);
    actorMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
  }

  // Enrich with org names
  const orgIds = [...new Set(
    (logs || []).flatMap(l => [l.acting_organization_id, l.target_organization_id])
  )];
  let orgMap = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await adminClient
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);
    orgMap = Object.fromEntries((orgs || []).map(o => [o.id, o]));
  }

  const enriched = (logs || []).map(l => {
    const actor = actorMap[l.acting_user_id] || {};
    return {
      ...l,
      actor_name:        actor.name || [actor.first_name, actor.last_name].filter(Boolean).join(' ') || 'Unknown',
      acting_org_name:   orgMap[l.acting_organization_id]?.name  || 'Unknown',
      target_org_name:   orgMap[l.target_organization_id]?.name  || 'Unknown',
    };
  });

  return res.status(200).json({ logs: enriched });
}
