/**
 * POST /api/email/send
 * Sends an email via the user's connected Gmail account.
 * Falls back to Resend if Gmail is not connected.
 *
 * Auth: Bearer <supabase_access_token>
 * Body: { toEmail, toName, subject, body }
 * Returns: { id, sentVia: 'gmail' | 'resend' }
 */
import { createClient } from '@supabase/supabase-js';

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

/** Get a valid access token, refreshing if expired */
async function getValidGmailToken(integration) {
  const { access_token, refresh_token, token_expiry } = integration;

  // Still valid (with 2-min buffer)
  if (token_expiry && new Date(token_expiry) > new Date(Date.now() + 120_000)) {
    return access_token;
  }

  if (!refresh_token) return null;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  const json = await r.json();
  if (!r.ok || !json.access_token) return null;

  // Persist updated token
  const supa = adminSupabase();
  await supa.from('user_integrations').update({
    access_token:  json.access_token,
    token_expiry:  new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
    updated_at:    new Date().toISOString(),
  }).eq('user_id', integration.user_id).eq('provider', 'google');

  return json.access_token;
}

/**
 * Build a base64url-encoded RFC 2822 message for the Gmail API.
 */
function buildRawMessage({ from, fromName, to, toName, subject, bodyText }) {
  const toField   = toName   ? `"${toName}" <${to}>`     : to;
  const fromField = fromName ? `"${fromName}" <${from}>` : from;

  const message = [
    `From: ${fromField}`,
    `To: ${toField}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    bodyText,
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Send via Gmail API */
async function sendViaGmail({ accessToken, fromEmail, fromName, toEmail, toName, subject, body }) {
  const raw = buildRawMessage({
    from: fromEmail, fromName,
    to: toEmail, toName,
    subject, bodyText: body,
  });

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || 'Gmail API error');
  return json.id;
}

/** Fallback: send via Resend */
async function sendViaResend({ toEmail, toName, subject, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('No email provider configured');

  const toField = toName ? `${toName} <${toEmail}>` : toEmail;
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:32px;">${body.replace(/\n/g,'<br>')}</body></html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'LotLine CRM <crm@lotlinehomes.com>',
      to:      [toField],
      subject, html, text: body,
    }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.message || 'Resend error');
  return json.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { toEmail, toName, subject, body } = req.body || {};
  if (!toEmail || !subject || !body) {
    return res.status(400).json({ error: 'toEmail, subject, and body are required' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const supa  = adminSupabase();

  // Identify caller
  const { data: { user } } = token
    ? await supa.auth.getUser(token)
    : { data: { user: null } };

  // Try Gmail first
  if (user) {
    const { data: integration } = await supa
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single();

    if (integration) {
      try {
        const accessToken = await getValidGmailToken(integration);
        if (accessToken) {
          const gmailId = await sendViaGmail({
            accessToken,
            fromEmail: integration.gmail_email,
            fromName:  user.user_metadata?.full_name || integration.gmail_email,
            toEmail, toName, subject, body,
          });
          return res.status(200).json({ id: gmailId, sentVia: 'gmail' });
        }
      } catch (err) {
        // Fall through to Resend
        console.error('Gmail send failed:', err.message);
      }
    }
  }

  // Resend fallback
  try {
    const id = await sendViaResend({ toEmail, toName, subject, body });
    return res.status(200).json({ id, sentVia: 'resend' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
