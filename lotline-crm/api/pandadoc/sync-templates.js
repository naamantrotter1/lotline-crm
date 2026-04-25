/**
 * POST /api/pandadoc/sync-templates
 * Fetches templates from PandaDoc API and upserts them into esign_templates.
 * Requires admin role.
 */
import { requireOrgMember, isAdmin } from '../_lib/teamAuth.js';
import { getPandaDocClient } from '../_lib/pandadocClient.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  if (!isAdmin(auth.orgRole)) {
    return res.status(403).json({ error: 'Only admins can sync templates.' });
  }

  let client;
  try {
    client = await getPandaDocClient(auth.adminClient, auth.orgId);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Fetch all templates from PandaDoc (paginate if needed)
  let templates = [];
  let page = 1;
  while (true) {
    const data = await client.get(`/public/v1/templates?count=50&page=${page}&tag=active`);
    if (!data.results?.length) break;
    templates = templates.concat(data.results);
    if (data.results.length < 50) break;
    page++;
  }

  if (!templates.length) {
    // Update last_sync_at on the connection anyway
    await auth.adminClient
      .from('esign_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('organization_id', auth.orgId)
      .eq('provider', 'pandadoc');
    return res.status(200).json({ synced: 0 });
  }

  // Fetch roles and tokens for each template (up to 10 in parallel)
  const enriched = await Promise.all(templates.map(async (tmpl) => {
    let roles = [];
    let tokens = [];
    try {
      const detail = await client.get(`/public/v1/templates/${tmpl.id}/details`);
      roles  = detail.roles  ?? [];
      tokens = detail.tokens ?? [];
    } catch { /* ignore — just store without roles/tokens */ }

    return {
      organization_id: auth.orgId,
      provider:        'pandadoc',
      pandadoc_id:     tmpl.id,
      name:            tmpl.name,
      roles:           roles.map(r => ({ role: r.name, required: !r.preassigned })),
      tokens:          tokens.map(t => ({ name: t.name, page: t.page })),
      thumbnail_url:   tmpl.thumbnail?.url ?? null,
      last_synced_at:  new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    };
  }));

  const { error } = await auth.adminClient
    .from('esign_templates')
    .upsert(enriched, { onConflict: 'organization_id,pandadoc_id' });

  if (error) {
    console.error('sync-templates upsert error:', error);
    return res.status(500).json({ error: 'Failed to save templates' });
  }

  // Update last_sync_at on connection
  await auth.adminClient
    .from('esign_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('organization_id', auth.orgId)
    .eq('provider', 'pandadoc');

  return res.status(200).json({ synced: enriched.length });
}
