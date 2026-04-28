/**
 * GET  /api/activity-notes?dealId=...&orgId=...  — fetch notes for a deal
 * POST /api/activity-notes                        — create a new note
 *
 * Both use the service role key to bypass RLS.
 * Auth: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js';

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function verifyUser(supa, token, orgId) {
  if (!token) return null;
  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return null;
  // Verify org membership
  const { data: membership } = await supa
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return null;
  return user;
}

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const supa  = adminSupabase();

  // ── GET: fetch notes ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { dealId, orgId } = req.query;
    if (!dealId || !orgId) return res.status(400).json({ error: 'dealId and orgId required' });

    const user = await verifyUser(supa, token, orgId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supa
      .from('activity_notes')
      .select('id, author_id, author_name, body, mentioned_user_ids, created_at, parent_note_id, note_type, pinned, metadata')
      .eq('deal_id', dealId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ notes: data || [] });
  }

  // ── POST: create a note ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { orgId, dealId, body, parentNoteId, mentionedUserIds } = req.body || {};
    if (!orgId || !dealId || !body) return res.status(400).json({ error: 'orgId, dealId, and body required' });

    const user = await verifyUser(supa, token, orgId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Get author name from profile
    const { data: profile } = await supa
      .from('profiles')
      .select('name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    const authorName = profile?.name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      || user.email
      || null;

    const payload = {
      organization_id:    orgId,
      deal_id:            dealId,
      author_id:          user.id,
      author_name:        authorName,
      body,
      mentioned_user_ids: mentionedUserIds || [],
      ...(parentNoteId ? { parent_note_id: parentNoteId } : {}),
    };

    const { data: note, error } = await supa
      .from('activity_notes')
      .insert(payload)
      .select('id, author_id, author_name, body, mentioned_user_ids, created_at, parent_note_id, note_type, pinned, metadata')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ note });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
