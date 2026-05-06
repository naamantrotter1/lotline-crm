/**
 * dealEmailsData.js
 * Data layer for the deal_emails table.
 */
import { supabase } from './supabase';

/** Fetch all emails for a deal, newest first. */
export async function fetchDealEmails(dealId) {
  if (!supabase || !dealId) return [];
  const { data } = await supabase
    .from('deal_emails')
    .select('*')
    .eq('deal_id', dealId)
    .order('sent_at', { ascending: false });
  return data || [];
}

/** Send an email and log it (calls the Vercel API route). */
export async function sendDealEmail({ toEmail, toName, subject, body, bodyHtml, cc, dealId, orgId }) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const r = await fetch('/api/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ toEmail, toName, subject, body, bodyHtml, cc, dealId, orgId }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Send failed');
  return data; // { id, threadId, sentVia, trackingPixelId }
}
