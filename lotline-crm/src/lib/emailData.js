import { supabase } from './supabase';

/** Fetch email logs for a contact (most recent first) */
export async function fetchEmailLogs({ contactId, orgId, limit = 50 } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from('email_logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (contactId) q = q.eq('contact_id', contactId);
  if (orgId)     q = q.eq('organization_id', orgId);
  const { data } = await q;
  return data || [];
}

/**
 * Send an email via /api/email/send and log it in Supabase.
 * Returns { ok, error, log }
 */
export async function sendEmail({ orgId, sentBy, contactId, dealId, toEmail, toName, subject, body }) {
  // 1. Call the Vercel send API
  let resendId = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ toEmail, toName, subject, body }),
    });
    const json = await res.json();
    if (res.ok) resendId = json.id;
  } catch {
    // Continue to log even if send fails
  }

  // 2. Log in Supabase
  const { data, error } = await supabase.from('email_logs').insert({
    organization_id: orgId,
    sent_by:         sentBy,
    contact_id:      contactId || null,
    deal_id:         dealId || null,
    to_email:        toEmail,
    to_name:         toName || null,
    from_email:      'crm@lotlinehomes.com',
    from_name:       'LotLine CRM',
    subject,
    body,
    status:          resendId ? 'sent' : 'failed',
    resend_id:       resendId,
    sent_at:         new Date().toISOString(),
  }).select().single();

  return { ok: !!resendId, error, log: data };
}
