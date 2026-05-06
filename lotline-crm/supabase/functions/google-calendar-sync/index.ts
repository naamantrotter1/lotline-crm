/**
 * google-calendar-sync — Supabase Edge Function
 *
 * Syncs Google Calendar events for all connected team members in an org
 * and upserts them into google_calendar_events for the shared team calendar.
 * Also links CRM meetings to GCal events by title+date, and deletes CRM
 * meetings whose linked GCal event has been removed.
 *
 * Body: { orgId: string, userId?: string }
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
async function syncUser(
  admin: ReturnType<typeof createClient>,
  conn: Record<string, unknown>,
  orgId: string
): Promise<{ count: number; activeIds: string[] }> {
  let accessToken = conn.access_token as string;

  // Refresh if expired or expiring within 60 s
  const expiry = conn.token_expiry ? new Date(conn.token_expiry as string).getTime() : 0;
  if (expiry <= Date.now() + 60_000) {
    if (!conn.refresh_token) {
      console.log(`[gcal-sync] No refresh_token for user ${conn.user_id}, skipping`);
      return { count: 0, activeIds: [] };
    }
    const refreshed = await refreshToken(conn.refresh_token as string);
    if (!refreshed) {
      await admin.from('user_integrations')
        .update({ calendar_is_active: false })
        .eq('id', conn.id);
      console.warn(`[gcal-sync] Token revoked for user ${conn.user_id} — marked calendar_is_active=false`);
      return { count: 0, activeIds: [] };
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
  gcalUrl.searchParams.set('timeMin',      timeMin);
  gcalUrl.searchParams.set('timeMax',      timeMax);
  gcalUrl.searchParams.set('maxResults',   '250');
  gcalUrl.searchParams.set('singleEvents', 'true');
  gcalUrl.searchParams.set('orderBy',      'startTime');

  const eventsRes = await fetch(gcalUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!eventsRes.ok) {
    const err = await eventsRes.json();
    console.error(`[gcal-sync] Google API error for user ${conn.user_id}:`, err?.error?.message);
    return { count: 0, activeIds: [] };
  }

  const { items = [] } = await eventsRes.json();
  const activeItems = (items as any[]).filter((e: any) => e.status !== 'cancelled');
  const activeIds   = activeItems.map((e: any) => e.id as string);

  // Link existing CRM meetings to GCal events by matching title + date.
  // This allows us to detect and delete meetings when their GCal event is removed.
  for (const event of activeItems) {
    const title    = (event.summary || '').trim();
    const gcalDate = event.start?.dateTime?.slice(0, 10) || event.start?.date;
    if (!title || !gcalDate) continue;

    await admin.from('meetings')
      .update({ google_event_id: event.id })
      .eq('organization_id', orgId)
      .ilike('title', title)
      .gte('starts_at', `${gcalDate}T00:00:00Z`)
      .lte('starts_at', `${gcalDate}T23:59:59Z`)
      .is('google_event_id', null);
  }

  // Wipe existing google_calendar_events for this user in the sync window,
  // then re-insert current events — ensures deletions are always reflected.
  await admin.from('google_calendar_events')
    .delete()
    .eq('user_id',         conn.user_id)
    .eq('organization_id', orgId)
    .gte('start_at',       timeMin)
    .lte('start_at',       timeMax);

  const rows = activeItems.map((event: any) => {
    const allDay    = !event.start?.dateTime;
    const startAt   = event.start?.dateTime ?? (event.start?.date ? `${event.start.date}T00:00:00Z` : null);
    const endAt     = event.end?.dateTime   ?? (event.end?.date   ? `${event.end.date}T23:59:59Z`   : null);
    const isPrivate = event.visibility === 'private' || event.visibility === 'confidential';
    return {
      organization_id: orgId,
      user_id:         conn.user_id,
      google_event_id: event.id,
      calendar_id:     'primary',
      title:           isPrivate ? '[Private Event]' : (event.summary    || '(No title)'),
      description:     isPrivate ? null              : (event.description || null),
      location:        isPrivate ? null              : (event.location    || null),
      start_at:        startAt,
      end_at:          endAt,
      all_day:         allDay,
      is_private:      isPrivate,
      html_link:       event.htmlLink || null,
      synced_at:       new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    await admin.from('google_calendar_events').insert(rows);
  }

  // Update last synced timestamp
  await admin.from('user_integrations')
    .update({ calendar_synced_at: new Date().toISOString(), calendar_is_active: true })
    .eq('id', conn.id);

  return { count: activeIds.length, activeIds };
}

// ── Handler ────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { orgId, userId } = await req.json();
    if (!orgId) throw new Error('orgId is required');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let q = admin
      .from('user_integrations')
      .select('*')
      .eq('organization_id',    orgId)
      .eq('provider',           'google')
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

    let totalSynced  = 0;
    const allActiveIds = new Set<string>();

    for (const conn of connections) {
      try {
        const { count, activeIds } = await syncUser(admin, conn, orgId);
        totalSynced += count;
        activeIds.forEach(id => allActiveIds.add(id));
      } catch (e: any) {
        console.error(`[gcal-sync] Failed for user ${conn.user_id}:`, e.message);
      }
    }

    // Delete CRM meetings that were linked to a GCal event that no longer exists
    const { data: linkedMeetings } = await admin
      .from('meetings')
      .select('id, google_event_id')
      .eq('organization_id', orgId)
      .not('google_event_id', 'is', null);

    const toDelete = (linkedMeetings || [])
      .filter((m: any) => !allActiveIds.has(m.google_event_id))
      .map((m: any) => m.id);

    if (toDelete.length > 0) {
      await admin.from('meetings').delete().in('id', toDelete);
      console.log(`[gcal-sync] Deleted ${toDelete.length} CRM meetings removed from GCal`);
    }

    return new Response(
      JSON.stringify({ synced: totalSynced, users: connections.length, meetingsDeleted: toDelete.length }),
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
