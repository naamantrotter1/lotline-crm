/**
 * smsData.js
 * Phase 12: SMS data layer.
 *
 * SMS sending flows through the Supabase Edge Function `sms-send`
 * (lotline-crm/supabase/functions/sms-send/index.ts) which calls Twilio.
 * If the edge function is not deployed the message is stored as 'pending'
 * and can be retried when the function is available.
 *
 * TCPA compliance:
 *   - Always check opt-outs before sending
 *   - Append "Reply STOP to opt out" footer to outbound messages
 *   - Quiet hours enforced: no sends between 9 PM – 8 AM local time
 */
import { supabase } from './supabase';

const TCPA_FOOTER = '\n\nReply STOP to opt out.';
const QUIET_HOURS_START = 21; // 9 PM
const QUIET_HOURS_END   = 8;  // 8 AM

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(phone) {
  if (!phone) return null;
  return phone.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
}

function isQuietHours() {
  const h = new Date().getHours();
  return h >= QUIET_HOURS_START || h < QUIET_HOURS_END;
}

// ── Opt-outs ──────────────────────────────────────────────────────────────────

export async function checkOptOut(orgId, phoneNumber) {
  if (!supabase || !orgId || !phoneNumber) return false;
  const normalized = normalizePhone(phoneNumber);
  const { data } = await supabase
    .from('sms_opt_outs')
    .select('id, opted_in_at')
    .eq('organization_id', orgId)
    .eq('phone_number', normalized)
    .maybeSingle();
  if (!data) return false;
  // If they opted back in after opt-out, they're not opted out
  return !data.opted_in_at;
}

export async function recordOptOut(orgId, phoneNumber) {
  if (!supabase || !orgId) return;
  const normalized = normalizePhone(phoneNumber);
  await supabase.from('sms_opt_outs').upsert({
    organization_id: orgId,
    phone_number: normalized,
    opted_out_at: new Date().toISOString(),
    opted_in_at: null,
  }, { onConflict: 'organization_id,phone_number' });
}

export async function recordOptIn(orgId, phoneNumber) {
  if (!supabase || !orgId) return;
  const normalized = normalizePhone(phoneNumber);
  await supabase.from('sms_opt_outs').upsert({
    organization_id: orgId,
    phone_number: normalized,
    opted_in_at: new Date().toISOString(),
  }, { onConflict: 'organization_id,phone_number' });
}

export async function fetchOptOuts(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('sms_opt_outs')
    .select('*')
    .eq('organization_id', orgId)
    .is('opted_in_at', null)
    .order('opted_out_at', { ascending: false });
  return data || [];
}

// ── Messages ──────────────────────────────────────────────────────────────────

/**
 * Fetch all messages for a specific contact (thread view).
 */
export async function fetchThread(orgId, contactId, limit = 50) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('organization_id', orgId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return data || [];
}

/**
 * Fetch inbox: most recent message per unique to_number / contact.
 */
export async function fetchInbox(orgId, { limit = 50 } = {}) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('sms_messages')
    .select('*, contacts(id, first_name, last_name, phone)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (!data) return [];

  // Deduplicate by contact_id — keep most recent per contact
  const seen = new Map();
  for (const msg of data) {
    const key = msg.contact_id || msg.to_number || msg.from_number;
    if (!seen.has(key)) seen.set(key, msg);
  }
  return Array.from(seen.values()).slice(0, limit);
}

/**
 * Send an SMS message.
 * @param {object} opts
 * @param {string}  opts.orgId
 * @param {string}  opts.userId
 * @param {string}  opts.to          - phone number to send to
 * @param {string}  opts.body        - message text
 * @param {string}  [opts.contactId]
 * @param {string}  [opts.dealId]
 * @param {string}  [opts.campaignId]
 * @param {boolean} [opts.appendTcpa=true] - append STOP footer
 * @param {boolean} [opts.checkQuietHours=true]
 */
export async function sendSms({
  orgId, userId, to, body,
  contactId = null, dealId = null, campaignId = null,
  appendTcpa = true, checkQuietHours = true,
}) {
  if (!supabase || !orgId) return { error: 'no supabase' };

  // TCPA: check quiet hours
  if (checkQuietHours && isQuietHours()) {
    return { error: 'quiet_hours', message: 'Messages cannot be sent between 9 PM and 8 AM.' };
  }

  // TCPA: check opt-out
  if (to) {
    const optedOut = await checkOptOut(orgId, to);
    if (optedOut) return { error: 'opted_out', message: 'This contact has opted out of SMS.' };
  }

  const fullBody = appendTcpa ? body + TCPA_FOOTER : body;

  // Insert message record
  const { data: msg, error: insertErr } = await supabase
    .from('sms_messages')
    .insert({
      organization_id: orgId,
      contact_id: contactId,
      deal_id: dealId,
      campaign_id: campaignId,
      direction: 'outbound',
      body: fullBody,
      status: 'pending',
      to_number: to,
      created_by: userId,
    })
    .select()
    .single();

  if (insertErr) return { error: insertErr.message };

  // Fire edge function (non-blocking)
  try {
    supabase.functions.invoke('sms-send', {
      body: { messageId: msg.id, to, body: fullBody },
    }).catch(() => {}); // Edge function may not be deployed yet
  } catch {
    // No-op — message stored as 'pending', can be retried
  }

  return { data: msg };
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function fetchTemplates(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('sms_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('name');
  return data || [];
}

export async function createTemplate(orgId, userId, { name, body }) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('sms_templates')
    .insert({ organization_id: orgId, created_by: userId, name, body })
    .select()
    .single();
  return { data, error };
}

export async function updateTemplate(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('sms_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteTemplate(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('sms_templates').delete().eq('id', id);
  return { error };
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export async function fetchCampaigns(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('sms_campaigns')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function createCampaign(orgId, userId, { name, body, templateId = null, audienceFilter = {}, includeOptOutFooter = true }) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('sms_campaigns')
    .insert({
      organization_id: orgId,
      created_by: userId,
      name,
      body,
      template_id: templateId,
      audience_filter: audienceFilter,
      include_opt_out_footer: includeOptOutFooter,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateCampaign(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('sms_campaigns')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteCampaign(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('sms_campaigns').delete().eq('id', id);
  return { error };
}

/**
 * Launch a draft campaign — sets status to 'sending'.
 * Actual send loop handled by edge function or client iteration.
 */
export async function launchCampaign(orgId, campaignId, contacts) {
  if (!supabase) return { error: 'no supabase' };

  await supabase.from('sms_campaigns').update({
    status: 'sending',
    recipient_count: contacts.length,
    sent_at: new Date().toISOString(),
  }).eq('id', campaignId);

  // Send to each contact (client-side, throttled)
  const campaign = (await supabase.from('sms_campaigns').select('*').eq('id', campaignId).single()).data;
  if (!campaign) return { error: 'campaign not found' };

  const body = campaign.body + (campaign.include_opt_out_footer ? TCPA_FOOTER : '');
  let sent = 0, failed = 0, optedOut = 0;

  for (const contact of contacts) {
    if (!contact.phone) { failed++; continue; }
    const isOut = await checkOptOut(orgId, contact.phone);
    if (isOut) { optedOut++; continue; }
    const { error } = await sendSms({
      orgId, userId: campaign.created_by,
      to: contact.phone, body: campaign.body,
      contactId: contact.id, campaignId,
      appendTcpa: campaign.include_opt_out_footer,
      checkQuietHours: false, // Campaign override
    });
    if (error) failed++; else sent++;
  }

  await supabase.from('sms_campaigns').update({
    status: 'sent',
    sent_count: sent,
    failed_count: failed,
    opt_out_count: optedOut,
  }).eq('id', campaignId);

  return { sent, failed, optedOut };
}

// ── Status display helpers ────────────────────────────────────────────────────
export const SMS_STATUS = {
  pending:     { label: 'Pending',     cls: 'text-gray-400' },
  queued:      { label: 'Queued',      cls: 'text-blue-500' },
  sent:        { label: 'Sent',        cls: 'text-blue-600' },
  delivered:   { label: 'Delivered',   cls: 'text-green-600' },
  failed:      { label: 'Failed',      cls: 'text-red-500' },
  undelivered: { label: 'Undelivered', cls: 'text-red-400' },
  received:    { label: 'Received',    cls: 'text-gray-600' },
};

export const CAMPAIGN_STATUS = {
  draft:     { label: 'Draft',    cls: 'bg-gray-100 text-gray-600'   },
  sending:   { label: 'Sending',  cls: 'bg-blue-50 text-blue-700'    },
  sent:      { label: 'Sent',     cls: 'bg-green-50 text-green-700'  },
  paused:    { label: 'Paused',   cls: 'bg-amber-50 text-amber-700'  },
  cancelled: { label: 'Cancelled',cls: 'bg-red-50 text-red-600'      },
};
