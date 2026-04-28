/**
 * GET /api/activity-notes?dealId=...&orgId=...
 * Returns activity notes for a deal using the service role key (bypasses RLS).
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { dealId, orgId } = req.query;
  if (!dealId || !orgId) return res.status(400).json({ error: 'dealId and orgId required' });

  // Verify the caller is authenticated
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supa = adminSupabase();

  // Verify the token belongs to a real user
  const { data: { user }, error: authErr } = await supa.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  // Verify the user is a member of the org
  const { data: membership } = await supa
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) return res.status(403).json({ error: 'Not a member of this organization' });

  // Fetch notes with service role (bypasses RLS)
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
