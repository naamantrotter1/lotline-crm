// GET /api/mentions?status=unread|all&deal_id=<uuid>&limit=50&offset=0
//
// Returns the caller's mentions inbox, newest first.
// RLS on the mentions table ensures only the caller's own mentions are visible.
//
// Query params:
//   status   'unread' | 'all'  (default 'all')
//   deal_id  optional uuid — filter to one deal
//   limit    default 50, max 100
//   offset   default 0
//
// Response: { mentions: [...], unread_count: number }

import { requireOrgMember } from '../_lib/teamAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId, orgId } = auth;

  const status  = req.query.status === 'unread' ? 'unread' : 'all';
  const dealId  = req.query.deal_id || null;
  const limit   = Math.min(parseInt(req.query.limit  || '50',  10), 100);
  const offset  = parseInt(req.query.offset || '0', 10);

  // Build query — RLS scopes to caller, but we use adminClient for join efficiency
  let query = adminClient
    .from('mentions')
    .select('id, org_id, mentioned_by_user_id, target_type, target_id, deal_id, read_at, created_at')
    .eq('mentioned_user_id', userId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status === 'unread') query = query.is('read_at', null);
  if (dealId)              query = query.eq('deal_id', dealId);

  const { data: mentions, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Unread count (for badge; always org-scoped, not deal-filtered)
  const { count: unreadCount } = await adminClient
    .from('mentions')
    .select('id', { count: 'exact', head: true })
    .eq('mentioned_user_id', userId)
    .eq('org_id', orgId)
    .is('read_at', null);

  // Enrich: author names + deal addresses
  const mentionList = mentions || [];
  const authorIds   = [...new Set(mentionList.map(m => m.mentioned_by_user_id))];
  const dealIds     = [...new Set(mentionList.map(m => m.deal_id).filter(Boolean))];

  const [{ data: profiles }, { data: deals }] = await Promise.all([
    authorIds.length
      ? adminClient.from('profiles').select('id, name, first_name, last_name').in('id', authorIds)
      : Promise.resolve({ data: [] }),
    dealIds.length
      ? adminClient.from('deals').select('id, address').in('id', dealIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map(p => [
    p.id,
    p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
  ]));
  const dealMap = Object.fromEntries((deals || []).map(d => [d.id, d.address || 'a deal']));

  // Enrich mention rows with body preview from the source table
  const noteIds    = mentionList.filter(m => m.target_type === 'activity_note').map(m => m.target_id);
  const threadIds  = mentionList.filter(m => m.target_type === 'thread_message').map(m => m.target_id);

  const [{ data: noteBodies }, { data: msgBodies }] = await Promise.all([
    noteIds.length
      ? adminClient.from('activity_notes').select('id, body').in('id', noteIds)
      : Promise.resolve({ data: [] }),
    threadIds.length
      ? adminClient.from('deal_thread_messages').select('id, body').in('id', threadIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bodyMap = {
    ...Object.fromEntries((noteBodies  || []).map(n => [n.id, n.body])),
    ...Object.fromEntries((msgBodies   || []).map(n => [n.id, n.body])),
  };

  const enriched = mentionList.map(m => ({
    ...m,
    author_name:  profileMap[m.mentioned_by_user_id] || 'Unknown',
    deal_address: dealMap[m.deal_id] || null,
    body_preview: (() => {
      const b = bodyMap[m.target_id] || '';
      const plain = b.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1');
      return plain.length > 140 ? plain.slice(0, 140).trimEnd() + '…' : plain;
    })(),
  }));

  return res.status(200).json({ mentions: enriched, unread_count: unreadCount ?? 0 });
}
