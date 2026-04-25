// POST   /api/deals/mute-mentions  — mute @mention notifications for a deal
// DELETE /api/deals/mute-mentions  — unmute
//
// Body (POST): { deal_id: uuid }
// Query param (DELETE): ?deal_id=<uuid>
//
// A muted deal still gets mention rows written (for audit + "All" inbox filter)
// but in-app, email, and push notifications are suppressed.

import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId } = auth;

  if (req.method === 'POST') {
    const { deal_id: dealId } = req.body || {};
    if (!dealId) return res.status(400).json({ error: 'deal_id required' });

    const { error } = await adminClient
      .from('deal_notification_mutes')
      .upsert({ user_id: userId, deal_id: dealId }, { onConflict: 'user_id,deal_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ muted: true });
  }

  if (req.method === 'DELETE') {
    const dealId = req.query.deal_id;
    if (!dealId) return res.status(400).json({ error: 'deal_id required' });

    const { error } = await adminClient
      .from('deal_notification_mutes')
      .delete()
      .eq('user_id', userId)
      .eq('deal_id', dealId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ muted: false });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
