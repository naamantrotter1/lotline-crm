/**
 * GET /api/track-open?id=<trackingPixelId>
 * Records an email open event and returns a 1×1 transparent GIF.
 */
import { createClient } from '@supabase/supabase-js';

// 1×1 transparent GIF (base64)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export default async function handler(req, res) {
  // Always return the pixel immediately — never block on DB
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.status(200).end(TRANSPARENT_GIF);

  const { id } = req.query;
  if (!id) return;

  try {
    const supa = adminSupabase();
    const now  = new Date().toISOString();

    // Increment open_count, set opened_at on first open
    const { data } = await supa
      .from('deal_emails')
      .select('id, open_count, opened_at')
      .eq('tracking_pixel_id', id)
      .maybeSingle();

    if (!data) return;

    await supa
      .from('deal_emails')
      .update({
        open_count: (data.open_count || 0) + 1,
        ...(data.opened_at ? {} : { opened_at: now }),
      })
      .eq('id', data.id);
  } catch (err) {
    console.error('[track-open]', err.message);
  }
}
