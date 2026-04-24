/**
 * Temporary migration runner — DELETE AFTER USE
 * GET /api/run-migration?secret=lotline-migrate-2026
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.query.secret !== 'lotline-migrate-2026') return res.status(403).json({ error: 'Forbidden' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Missing env vars', url: !!url, key: !!key });

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Try via pg_query RPC (available in some Supabase projects)
  const sql = 'ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_color_id text;';
  const { data, error } = await admin.rpc('pg_query', { query: sql });

  if (error) {
    // Fallback: try exec_sql
    const { data: d2, error: e2 } = await admin.rpc('exec_sql', { sql });
    if (e2) return res.status(500).json({ error_pg_query: error.message, error_exec_sql: e2.message });
    return res.status(200).json({ success: true, method: 'exec_sql', result: d2 });
  }

  return res.status(200).json({ success: true, method: 'pg_query', result: data });
}
