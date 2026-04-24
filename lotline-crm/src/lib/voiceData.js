/**
 * voiceData.js
 * Phase 13: Voice / Twilio data layer.
 *
 * Browser-based calling uses the Twilio Voice JS SDK (@twilio/voice-sdk).
 * A Supabase Edge Function (`voice-token`) generates the Twilio Access Token
 * with a Voice grant so the browser can make/receive calls.
 *
 * Call lifecycle:
 *   1. User clicks "Call" → getVoiceToken() → Twilio.Device.connect(to)
 *   2. Call record inserted in `calls` table with status 'initiated'
 *   3. As call progresses, status updated via updateCall()
 *   4. On hangup, duration_seconds and ended_at recorded
 */
import { supabase } from './supabase';

// ── Call CRUD ─────────────────────────────────────────────────────────────────

export async function fetchCalls(orgId, { contactId, dealId, limit = 30 } = {}) {
  if (!supabase || !orgId) return [];
  let q = supabase
    .from('calls')
    .select('*, contacts(id, first_name, last_name, phone)')
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (contactId) q = q.eq('contact_id', contactId);
  if (dealId)    q = q.eq('deal_id', dealId);
  const { data } = await q;
  return data || [];
}

export async function createCall(orgId, userId, { to, from, direction = 'outbound', contactId = null, dealId = null, twilioSid = null }) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('calls')
    .insert({
      organization_id: orgId,
      created_by: userId,
      contact_id: contactId,
      deal_id: dealId,
      direction,
      status: 'initiated',
      from_number: from,
      to_number: to,
      twilio_sid: twilioSid,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data, error };
}

export async function updateCall(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('calls')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function endCall(id, { duration, status = 'completed', outcome = 'answered', notes = '' } = {}) {
  return updateCall(id, {
    status,
    outcome,
    notes,
    duration_seconds: duration,
    ended_at: new Date().toISOString(),
  });
}

// ── Twilio Access Token ────────────────────────────────────────────────────────

/**
 * Fetches a Twilio Voice Access Token from the edge function.
 * The token grants the browser permission to make/receive calls.
 * Returns null if edge function is not deployed.
 */
export async function getVoiceToken(orgId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('voice-token', {
      body: { orgId },
    });
    if (error) return null;
    return data?.token || null;
  } catch {
    return null;
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────

export const CALL_STATUS = {
  initiated:    { label: 'Initiating', cls: 'text-gray-400' },
  ringing:      { label: 'Ringing',    cls: 'text-blue-500' },
  'in-progress':{ label: 'Live',       cls: 'text-green-600' },
  completed:    { label: 'Completed',  cls: 'text-gray-600'  },
  busy:         { label: 'Busy',       cls: 'text-amber-500' },
  'no-answer':  { label: 'No Answer',  cls: 'text-gray-400'  },
  canceled:     { label: 'Canceled',   cls: 'text-gray-400'  },
  failed:       { label: 'Failed',     cls: 'text-red-500'   },
};

export const CALL_OUTCOME = {
  answered:   { label: 'Answered',   icon: '✅' },
  voicemail:  { label: 'Voicemail',  icon: '📧' },
  busy:       { label: 'Busy',       icon: '🔴' },
  'no-answer':{ label: 'No Answer',  icon: '📵' },
  failed:     { label: 'Failed',     icon: '❌' },
};

export function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
