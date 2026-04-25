// PATCH /api/mentions/read?id=<uuid>   — mark a single mention as read
// POST  /api/mentions/read             — mark all mentions as read (body: { deal_id? })
//
// Sets read_at = now() on the caller's own mention rows (RLS enforces ownership).

import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method === 'PATCH') {
    // ── Mark single mention read ──────────────────────────────────────────
    const auth = await requireOrgMember(req, res);
    if (!auth) return;

    const { adminClient, userId } = auth;
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const { error } = await adminClient
      .from('mentions')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('mentioned_user_id', userId)
      .is('read_at', null);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    // ── Mark all (or deal-scoped) mentions read ───────────────────────────
    const auth = await requireOrgMember(req, res);
    if (!auth) return;

    const { adminClient, userId, orgId } = auth;
    const dealId = req.body?.deal_id || null;

    let query = adminClient
      .from('mentions')
      .update({ read_at: new Date().toISOString() })
      .eq('mentioned_user_id', userId)
      .eq('org_id', orgId)
      .is('read_at', null);

    if (dealId) query = query.eq('deal_id', dealId);

    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
