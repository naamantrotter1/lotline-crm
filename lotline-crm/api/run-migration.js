/**
 * Temporary migration runner — DELETE AFTER USE
 * GET /api/run-migration?secret=lotline-migrate-2026
 */
export default async function handler(req, res) {
  if (req.query.secret !== 'lotline-migrate-2026') return res.status(403).json({ error: 'Forbidden' });

  const sql = `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_color_id text;`;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectRef  = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1];

  if (!projectRef || !serviceKey) return res.status(500).json({ error: 'Missing env vars' });

  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });

  const data = await r.json();
  return res.status(r.ok ? 200 : 500).json(data);
}
