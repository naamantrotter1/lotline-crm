/**
 * calendarData.js
 * Phase 14: Calendar data layer.
 *
 * Google Calendar OAuth flow:
 *   1. User clicks "Connect Google Calendar"
 *   2. getGoogleAuthUrl() redirects to Google OAuth consent
 *   3. Google redirects back to /calendar?code=…
 *   4. exchangeGoogleCode() calls the edge function `google-calendar-auth`
 *      which exchanges the code for tokens and stores them in calendar_connections
 *   5. syncGoogleCalendar() calls `google-calendar-sync` edge function
 *      which fetches events and upserts into meetings table
 */
import { supabase } from './supabase';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
].join(' ');

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function getGoogleAuthUrl(redirectUri) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: 'calendar',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code, redirectUri) {
  if (!supabase) return { error: 'no supabase' };
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
      body: { code, redirectUri },
    });
    return { data, error };
  } catch (e) {
    return { error: e.message };
  }
}

export async function fetchCalendarConnection(userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  return data;
}

export async function disconnectCalendar(connectionId) {
  if (!supabase) return;
  await supabase.from('calendar_connections').delete().eq('id', connectionId);
}

export async function syncGoogleCalendar() {
  if (!supabase) return { error: 'no supabase' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/google/calendar-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const data = await r.json();
    if (!r.ok) return { error: data.error || 'Sync failed' };
    return { data };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Sync Google Calendar events for all (or one) connected team member(s)
 * into the google_calendar_events table via the edge function.
 * @param {string} orgId
 * @param {string} [userId] - if provided, only sync that user
 */
export async function syncOrgCalendars(orgId, userId = null) {
  if (!supabase || !orgId) return { error: 'no supabase or orgId' };
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
      body: { orgId, ...(userId ? { userId } : {}) },
    });
    return { data, error };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Fetch Google Calendar events from the shared cache table.
 * Includes the profile (first_name, last_name, avatar_url) of the event owner.
 */
export async function fetchGCalEvents(orgId, { from, to } = {}) {
  if (!supabase || !orgId) return [];
  let q = supabase
    .from('google_calendar_events')
    .select('*, profiles!user_id(id, first_name, last_name, avatar_url)')
    .eq('organization_id', orgId)
    .order('start_at', { ascending: true });
  if (from) q = q.gte('start_at', from);
  if (to)   q = q.lte('start_at', to);
  const { data } = await q;
  return data || [];
}

// ── Meetings CRUD ─────────────────────────────────────────────────────────────

export async function fetchMeetings(orgId, { from, to, contactId, dealId } = {}) {
  if (!supabase || !orgId) return [];
  let q = supabase
    .from('meetings')
    .select('*, contacts(id, first_name, last_name), profiles!created_by(id, first_name, last_name)')
    .eq('organization_id', orgId)
    .order('starts_at', { ascending: true });

  if (from) q = q.gte('starts_at', from);
  if (to)   q = q.lte('starts_at', to);
  if (contactId) q = q.eq('contact_id', contactId);
  if (dealId)    q = q.eq('deal_id', dealId);

  const { data } = await q;
  return data || [];
}

export async function createMeeting(orgId, userId, meeting) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      organization_id: orgId,
      created_by: userId,
      ...meeting,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateMeeting(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('meetings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteMeeting(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  return { error };
}

// ── Scheduler links ───────────────────────────────────────────────────────────

export async function fetchSchedulerLinks(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('scheduler_links')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function fetchSchedulerLink(slug) {
  if (!supabase || !slug) return null;
  const { data } = await supabase
    .from('scheduler_links')
    .select('*, profiles(id, full_name, avatar_url)')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  return data;
}

export async function createSchedulerLink(orgId, userId, link) {
  if (!supabase) return { error: 'no supabase' };
  const slug = link.slug || generateSlug(link.title);
  const { data, error } = await supabase
    .from('scheduler_links')
    .insert({ organization_id: orgId, user_id: userId, slug, ...link })
    .select()
    .single();
  return { data, error };
}

export async function updateSchedulerLink(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('scheduler_links')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteSchedulerLink(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('scheduler_links').delete().eq('id', id);
  return { error };
}

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '-' + Math.random().toString(36).slice(2, 6);
}

// ── Book a meeting (public — called from scheduler page) ──────────────────────

export async function bookMeeting({ schedulerLinkId, orgId, title, startsAt, endsAt, attendeeEmail, name, notes }) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      organization_id: orgId,
      scheduler_link_id: schedulerLinkId,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      attendee_emails: [attendeeEmail],
      description: notes || '',
      status: 'scheduled',
      meeting_type: 'video',
    })
    .select()
    .single();
  return { data, error };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const MEETING_TYPES = [
  { value: 'call',       label: 'Phone Call',    icon: '📞' },
  { value: 'video',      label: 'Video Call',    icon: '💻' },
  { value: 'in-person',  label: 'In Person',     icon: '🤝' },
  { value: 'site-visit', label: 'Site Visit',    icon: '🏠' },
];

export const MEETING_STATUS = {
  scheduled:  { label: 'Scheduled',  cls: 'bg-blue-50 text-blue-700'    },
  completed:  { label: 'Completed',  cls: 'bg-green-50 text-green-700'  },
  cancelled:  { label: 'Cancelled',  cls: 'bg-gray-100 text-gray-500'   },
  'no-show':  { label: 'No-show',    cls: 'bg-red-50 text-red-600'      },
};

export function fmtMeetingTime(startsAt, endsAt) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const date = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const start = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end   = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${start} – ${end}`;
}
