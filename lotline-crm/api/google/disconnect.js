/**
 * POST /api/google/disconnect
 * Removes the user's Google integration (revokes & deletes tokens).
 * Auth: Bearer <supabase_access_token>
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supa = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });

  // Fetch token so we can revoke it with Google
  const { data: integration } = await supa
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .single();

  if (integration?.access_token) {
    // Best-effort revoke (don't fail if Google rejects)
    fetch(`https://oauth2.googleapis.com/revoke?token=${integration.access_token}`, { method: 'POST' })
      .catch(() => {});
  }

  await supa
    .from('user_integrations')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google');

  return res.status(200).json({ ok: true });
}
