// POST /api/activity/notes          — save a new note, fan out @mention notifications
// GET  /api/activity/notes?deal_id= — fetch notes for a deal (paginated)
//
// POST body: { deal_id: uuid, body: string }
//
// On save:
//   1. Parse @[Name](uuid) mention tokens from body.
//   2. Validate each mentioned user is an active member of the caller's org
//      (or a JV-partner org member with thread.reply/comment.create permission).
//   3. Insert activity_notes row with mentioned_user_ids.
//   4. For each valid non-self mentioned user:
//        a. Check deal_notification_mutes — skip in-app/email if muted.
//        b. Write a mentions row.
//        c. Write a notification row (triggers realtime push to bell badge).
//
// All DB writes are done with the admin client (service role) so we can write
// notification rows for other users. Auth + org isolation are enforced manually.

import { requireOrgMember } from '../_lib/teamAuth.js';
import { canUserServer } from '../../src/lib/permissions.js';

// Reuse the pure JS mention utilities (no DOM; no Supabase client import needed)
const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

function extractMentions(markdown) {
  const re      = new RegExp(MENTION_RE.source, 'gi');
  const results = [];
  let match;
  while ((match = re.exec(markdown)) !== null) {
    results.push({ display_name: match[1], user_id: match[2] });
  }
  return results;
}

function mentionsToPlainText(markdown) {
  return markdown.replace(new RegExp(MENTION_RE.source, 'gi'), '@$1');
}

function mentionPreview(markdown, maxLen = 140) {
  const plain = mentionsToPlainText(markdown);
  return plain.length > maxLen ? plain.slice(0, maxLen).trimEnd() + '…' : plain;
}

export default async function handler(req, res) {
  // ── GET: fetch notes for a deal ──────────────────────────────────────────
  if (req.method === 'GET') {
    const auth = await requireOrgMember(req, res);
    if (!auth) return;

    const { adminClient, orgId } = auth;
    const dealId = req.query.deal_id;
    if (!dealId) return res.status(400).json({ error: 'deal_id required' });

    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    const { data: notes, error } = await adminClient
      .from('activity_notes')
      .select('id, author_id, body, mentioned_user_ids, created_at')
      .eq('deal_id', dealId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ notes: notes || [] });
  }

  // ── POST: save note + fan out mentions ───────────────────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;

  const { adminClient, userId: authorId, orgId, orgRole } = auth;

  // Permission check
  if (!canUserServer(orgRole, 'mention.create')) {
    return res.status(403).json({ error: 'Viewers cannot post notes.' });
  }

  const { deal_id: dealId, body } = req.body || {};
  if (!dealId || typeof dealId !== 'string') {
    return res.status(400).json({ error: 'deal_id is required' });
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'body is required' });
  }
  if (body.length > 10000) {
    return res.status(400).json({ error: 'Note body too long (max 10 000 chars).' });
  }

  // Verify the deal belongs to this org
  const { data: deal } = await adminClient
    .from('deals')
    .select('id, address, organization_id')
    .eq('id', dealId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!deal) {
    return res.status(404).json({ error: 'Deal not found or not in your org.' });
  }

  // ── Parse mentions ─────────────────────────────────────────────────────
  const extracted = extractMentions(body.trim());
  const mentionedIds = [...new Set(extracted.map(m => m.user_id))];

  // ── Validate org membership for each mentioned user ────────────────────
  let validMentionedIds = [];
  const invalidMentioned = [];

  if (mentionedIds.length > 0) {
    const { data: members } = await adminClient
      .from('memberships')
      .select('user_id, status')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .in('user_id', mentionedIds);

    const activeSet = new Set((members || []).map(m => m.user_id));

    for (const uid of mentionedIds) {
      if (activeSet.has(uid)) {
        validMentionedIds.push(uid);
      } else {
        invalidMentioned.push({ user_id: uid, reason: 'User is not an active member of this org.' });
      }
    }
  }

  if (invalidMentioned.length > 0) {
    return res.status(400).json({
      error: 'Some mentioned users are not active members of your org.',
      invalid: invalidMentioned,
    });
  }

  // ── Insert activity_notes row ──────────────────────────────────────────
  const { data: note, error: noteErr } = await adminClient
    .from('activity_notes')
    .insert({
      organization_id:    orgId,
      deal_id:            dealId,
      author_id:          authorId,
      body:               body.trim(),
      mentioned_user_ids: validMentionedIds,
    })
    .select('id, author_id, body, mentioned_user_ids, created_at')
    .single();

  if (noteErr) return res.status(500).json({ error: noteErr.message });

  // ── Fan out mention rows + notifications ───────────────────────────────
  // (Only for non-self mentioned users)
  const notifyIds = validMentionedIds.filter(uid => uid !== authorId);

  if (notifyIds.length > 0) {
    // Fetch author name for notification body
    const { data: authorProfile } = await adminClient
      .from('profiles')
      .select('name, first_name, last_name')
      .eq('id', authorId)
      .single();

    const authorName = authorProfile?.name
      || [authorProfile?.first_name, authorProfile?.last_name].filter(Boolean).join(' ')
      || 'Someone';

    const preview  = mentionPreview(body.trim());
    const dealAddr = deal.address || 'a deal';

    // Fetch mute states for all notifyIds on this deal
    const { data: mutes } = await adminClient
      .from('deal_notification_mutes')
      .select('user_id')
      .eq('deal_id', dealId)
      .in('user_id', notifyIds);

    const mutedSet = new Set((mutes || []).map(m => m.user_id));

    // Write mentions rows + notification rows in parallel per user
    await Promise.all(notifyIds.map(async (uid) => {
      // Always write the mention row (even if muted — for audit + "All" inbox)
      await adminClient.from('mentions').insert({
        org_id:               orgId,
        mentioned_user_id:    uid,
        mentioned_by_user_id: authorId,
        target_type:          'activity_note',
        target_id:            note.id,
        deal_id:              dealId,
      }).catch(e => console.error('mentions insert', e));

      // Skip in-app notification if muted
      if (mutedSet.has(uid)) return;

      await adminClient.from('notifications').insert({
        organization_id: orgId,
        user_id:         uid,
        type:            'mention.deal_activity',
        title:           `${authorName} mentioned you in ${dealAddr}`,
        body:            `"${preview}"`,
        entity_type:     'activity_note',
        entity_id:       note.id,
      }).catch(e => console.error('notification insert', e));
    }));
  }

  return res.status(201).json({ note, invalid_mentions: invalidMentioned });
}
