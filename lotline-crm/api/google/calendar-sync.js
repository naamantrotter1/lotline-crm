/**
 * POST /api/google/calendar-sync
 * Fetches events from the user's primary Google Calendar and upserts
 * them into the meetings table (±90 days from today).
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import { requireOrgMember } from '../_lib/teamAuth.js';

async function refreshAccessToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error(data.error || 'Token refresh failed');
  return data;
}

function mapGoogleEvent(event, orgId, userId) {
  const start = event.start?.dateTime || event.start?.date;
  const end   = event.end?.dateTime   || event.end?.date;
  if (!start || !end || !event.summary) return null;
  // Skip declined events
  const selfAttendee = (event.attendees || []).find(a => a.self);
  if (selfAttendee?.responseStatus === 'declined') return null;

  const meetingType = (event.hangoutLink || event.conferenceData) ? 'video'
    : event.location ? 'in-person'
    : 'call';

  return {
    organization_id:  orgId,
    created_by:       userId,
    title:            event.summary,
    description:      event.description || null,
    location:         event.hangoutLink || event.location || null,
    meeting_type:     meetingType,
    status:           'scheduled',
    starts_at:        new Date(start).toISOString(),
    ends_at:          new Date(end).toISOString(),
    all_day:          !!event.start?.date && !event.start?.dateTime,
    google_event_id:  event.id,
    google_meet_link: event.hangoutLink || null,
    google_color_id:  event.colorId || null,
    attendee_emails:  (event.attendees || []).map(a => a.email).filter(Boolean),
    updated_at:       new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireOrgMember(req, res);
  if (!auth) return;
  const { adminClient, userId, orgId } = auth;

  // 1. Get tokens from user_integrations
  const { data: integration } = await adminClient
    .from('user_integrations')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();

  if (!integration?.access_token) {
    return res.status(400).json({ error: 'Google not connected. Connect your account in Settings → Integrations.' });
  }

  // 2. Refresh token if expired or expiring within 60s
  let accessToken = integration.access_token;
  const expiry = integration.token_expiry ? new Date(integration.token_expiry) : null;
  if (!expiry || expiry.getTime() - Date.now() < 60_000) {
    if (!integration.refresh_token) {
      return res.status(400).json({ error: 'Access token expired. Please reconnect Google in Settings → Integrations.' });
    }
    try {
      const fresh = await refreshAccessToken(integration.refresh_token);
      accessToken = fresh.access_token;
      await adminClient.from('user_integrations').update({
        access_token: fresh.access_token,
        token_expiry: fresh.expires_in
          ? new Date(Date.now() + fresh.expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('provider', 'google');
    } catch (err) {
      return res.status(400).json({ error: 'Token refresh failed: ' + err.message });
    }
  }

  // 3. Fetch events from Google Calendar (±90 days)
  const timeMin = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + 90 * 86_400_000).toISOString();

  let googleEvents = [];
  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy:      'startTime',
      maxResults:   '500',
    });
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error?.message || `Calendar API ${r.status}`);
    }
    googleEvents = (await r.json()).items || [];
  } catch (err) {
    return res.status(500).json({ error: 'Google Calendar API error: ' + err.message });
  }

  const rows = googleEvents.map(e => mapGoogleEvent(e, orgId, userId)).filter(Boolean);

  // 4. Delete old synced meetings in this window, then insert fresh
  await adminClient
    .from('meetings')
    .delete()
    .eq('organization_id', orgId)
    .not('google_event_id', 'is', null)
    .gte('starts_at', timeMin)
    .lte('starts_at', timeMax);

  if (rows.length > 0) {
    const { error: insertErr } = await adminClient.from('meetings').insert(rows);
    if (insertErr) return res.status(500).json({ error: 'DB insert failed: ' + insertErr.message });
  }

  return res.status(200).json({ synced: rows.length });
}
