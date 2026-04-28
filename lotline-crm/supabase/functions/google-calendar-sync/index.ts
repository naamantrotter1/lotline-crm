/**
 * google-calendar-sync — Supabase Edge Function
 *
 * Syncs Google Calendar events for all connected team members in an org
 * and upserts them into google_calendar_events for the shared team calendar.
 *
 * Body: { orgId: string, userId?: string }
 *   orgId   — required; which org to sync
 *   userId  — optional; if provided, sync only that user (e.g. after connect)
 *
 * Token source: user_integrations (populated by the /api/google/auth OAuth flow)
 * Event storage: google_calendar_events (shared, readable by all org members)
 *
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *                    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID')          ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')      ?? '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Token refresh ──────────────────────────────────────────────────────────────
async function refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) return null;
  return { access_token: data.access_token, expires_in: data.expires_in };
}

// ── Sync one user's Google Calendar ───────────────────────────────────────────
async function syncUser(admin: ReturnType<typeof createClient>, conn: Record<string, unknown>, orgId: string): Promise<number> {
  let accessToken = conn.access_token as string;

  // Refresh if expired or expiring within 60 s
  const expiry = conn.token_expiry ? new Date(conn.token_expiry as string).getTime() : 0;
  if (expiry <= Date.now() + 60_000) {
    if (!conn.refresh_token) {
      console.log(`[gcal-sync] No refresh_token for user ${conn.user_id}, skipping`);
      return 0;
    }
    const refreshed = await refreshToken(conn.refresh_token as string);
    if (!refreshed) {
      // Token revoked — mark this connection inactive and notify by flag
      await admin.from('user_integrations')
        .update({ calendar_is_active: false })
        .eq('id', conn.id);
      console.warn(`[gcal-sync] Token revoked for user ${conn.user_id} — marked calendar_is_active=false`);
      return 0;
    }
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin.from('user_integrations')
      .update({ access_token: accessToken, token_expiry: newExpiry })
      .eq('id', conn.id);
  }

  // Fetch Google Calendar events: -7 days → +60 days
  const timeMin = new Date(Date.now() -  7 * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + 60 * 86_400_000).toISOString();
  const gcalUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  gcalUrl.searchParams.set('timeMin',       timeMin);
  gcalUrl.searchParams.set('timeMax',       timeMax);
  gcalUrl.searchParams.set('maxResults',    '250');
  gcalUrl.searchParams.set('singleEvents',  'true');
  gcalUrl.searchParams.set('orderBy',       'startTime');

  const eventsRes = await fetch(gcalUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!eventsRes.ok) {
    const err = await eventsRes.json();
    console.error(`[gcal-sync] Google API error for user ${conn.user_id}:`, err?.error?.message);
    return 0;
  }

  const { items = [] } = await eventsRes.json();
  const activeIds: string[] = [];

  for (const event of items) {
    if (event.status === 'cancelled') continue;

    const allDay    = !event.start?.dateTime;
    const startAt   = event.start?.dateTime ?? (event.start?.date  ? `${event.start.date}T00:00:00Z`  : null);
    const endAt     = event.end?.dateTime   ?? (event.end?.date    ? `${event.end.date}T23:59:59Z`    : null);
    const isPrivate = event.visibility === 'private' || event.visibility === 'confidential';

    activeIds.push(event.id);

    await admin.from('google_calendar_events').upsert({
      organization_id: orgId,
      user_id:         conn.user_id,
      google_event_id: event.id,
      calendar_id:     'primary',
      title:           isPrivate ? '[Private Event]' : (event.summary   || '(No title)'),
      description:     isPrivate ? null              : (event.description || null),
      location:        isPrivate ? null              : (event.location    || null),
      start_at:        startAt,
      end_at:          endAt,
      all_day:         allDay,
      is_private:      isPrivate,
      html_link:       event.htmlLink || null,
      synced_at:       new Date().toISOString(),
    }, { onConflict: 'user_id,google_event_id' });
  }

  // Delete events removed from Google Calendar within the sync window
  if (activeIds.length > 0) {
    await admin.from('google_calendar_events')
      .delete()
      .eq('user_id',         conn.user_id)
      .eq('organization_id', orgId)
      .gte('start_at',       timeMin)
      .lte('start_at',       timeMax)
      .not('google_event_id', 'in', `(${activeIds.join(',')})`);
  } else {
    // Nothing returned — clear the entire sync window for this user
    await admin.from('google_calendar_events')
      .delete()
      .eq('user_id',         conn.user_id)
      .eq('organization_id', orgId)
      .gte('start_at',       timeMin)
      .lte('start_at',       timeMax);
  }

  // Update last synced timestamp
  await admin.from('user_integrations')
    .update({ calendar_synced_at: new Date().toISOString(), calendar_is_active: true })
    .eq('id', conn.id);

  return activeIds.length;
}

// ── Handler ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { orgId, userId } = await req.json();
    if (!orgId) throw new Error('orgId is required');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch all active Google integrations for this org (optionally filtered to one user)
    let q = admin
      .from('user_integrations')
      .select('*')
      .eq('organization_id',   orgId)
      .eq('provider',          'google')
      .eq('calendar_is_active', true);
    if (userId) q = q.eq('user_id', userId);

    const { data: connections, error: connErr } = await q;
    if (connErr) throw connErr;
    if (!connections?.length) {
      return new Response(
        JSON.stringify({ synced: 0, users: 0, message: 'No active Google Calendar connections' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;
    for (const conn of connections) {
      try {
        totalSynced += await syncUser(admin, conn, orgId);
      } catch (e: any) {
        console.error(`[gcal-sync] Failed for user ${conn.user_id}:`, e.message);
      }
    }

    return new Response(
      JSON.stringify({ synced: totalSynced, users: connections.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[gcal-sync]', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
