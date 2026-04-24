/**
 * google-calendar-sync — Supabase Edge Function
 * Phase 14: Syncs Google Calendar events → meetings table.
 * Fetches events for the next 30 days and upserts into meetings.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get connection
    const { data: conn } = await admin.from('calendar_connections')
      .select('*').eq('user_id', userId).eq('provider', 'google').single();
    if (!conn) throw new Error('No Google Calendar connection found');

    let accessToken = conn.access_token;

    // Refresh token if expired
    if (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date()) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: conn.refresh_token,
          client_id:     Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          grant_type:    'refresh_token',
        }),
      });
      const refreshed = await refreshRes.json();
      if (refreshed.access_token) {
        accessToken = refreshed.access_token;
        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
        await admin.from('calendar_connections').update({
          access_token: accessToken,
          token_expires_at: newExpiry,
        }).eq('id', conn.id);
      }
    }

    // Fetch events from Google Calendar
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${future}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const events = await eventsRes.json();
    if (!eventsRes.ok) throw new Error(events.error?.message || 'Failed to fetch calendar events');

    // Get org_id for the user
    const { data: member } = await admin.from('org_members')
      .select('organization_id').eq('user_id', userId).eq('status', 'active').limit(1).single();
    if (!member) throw new Error('User not in any organization');

    // Upsert events as meetings
    for (const event of (events.items || [])) {
      if (!event.start || event.status === 'cancelled') continue;
      const startsAt = event.start.dateTime || event.start.date + 'T00:00:00Z';
      const endsAt   = event.end?.dateTime   || event.end?.date + 'T23:59:59Z';

      await admin.from('meetings').upsert({
        organization_id: member.organization_id,
        created_by: userId,
        title: event.summary || '(No title)',
        description: event.description || null,
        location: event.location || null,
        starts_at: startsAt,
        ends_at:   endsAt,
        all_day: !event.start.dateTime,
        meeting_type: 'video',
        status: 'scheduled',
        google_event_id: event.id,
        google_meet_link: event.conferenceData?.entryPoints?.[0]?.uri || null,
        attendee_emails: (event.attendees || []).map((a: any) => a.email),
      }, { onConflict: 'google_event_id' });
    }

    await admin.from('calendar_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id);

    return new Response(JSON.stringify({ synced: events.items?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
