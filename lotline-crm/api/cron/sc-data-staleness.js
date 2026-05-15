// api/cron/sc-data-staleness.js
// ═════════════════════════════════════════════════════════════════════════════
// Watchdog cron — checks the freshness of sc_parcels and the recent
// sc_data_refresh_log. If no successful refresh has happened in the last
// STALE_DAYS days, returns 200 with status='stale' (Vercel cron logs surface
// the response body, so it's visible in the dashboard).
//
// Triggered by vercel.json crons. No-ops outside Vercel cron context.

const PROJECT_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STALE_DAYS  = parseInt(process.env.SC_PARCELS_STALE_DAYS || '14', 10);

export default async function handler(req, res) {
  if (!PROJECT_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    // Most recent successful refresh
    const r = await fetch(
      `${PROJECT_URL}/rest/v1/sc_data_refresh_log?select=ran_at,rows_inserted,rows_updated,status&status=eq.ok&order=ran_at.desc&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const rows = await r.json();
    const last = rows?.[0];

    // Parcel count
    const cr = await fetch(
      `${PROJECT_URL}/rest/v1/sc_parcels?select=id&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact' } }
    );
    const totalParcels = parseInt((cr.headers.get('content-range') || '0-0/0').split('/').pop(), 10) || 0;

    let staleDays = null;
    let status = 'unknown';
    if (last?.ran_at) {
      staleDays = (Date.now() - new Date(last.ran_at).getTime()) / 86400000;
      status = staleDays > STALE_DAYS ? 'stale' : 'fresh';
    } else if (totalParcels === 0) {
      status = 'empty';
    } else {
      status = 'no-log';
    }

    return res.json({
      status,
      stale_days: staleDays === null ? null : Math.round(staleDays * 10) / 10,
      threshold_days: STALE_DAYS,
      last_refresh: last || null,
      total_parcels: totalParcels,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
