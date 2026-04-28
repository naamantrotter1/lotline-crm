/**
 * POST /api/email/send
 * Sends an email via the user's connected Gmail account.
 * Falls back to Resend if Gmail is not connected.
 *
 * Auth: Bearer <supabase_access_token>
 * Body: { toEmail, toName, subject, body, bodyHtml?, dealId?, orgId?, cc? }
 * Returns: { id, threadId?, sentVia: 'gmail' | 'resend', trackingPixelId? }
 */
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.APP_URL || 'https://lotline-crm.vercel.app';

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

  const supa = adminSupabase();
  await supa.from('user_integrations').update({
    access_token: json.access_token,
    token_expiry: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('user_id', integration.user_id).eq('provider', 'google');

  return json.access_token;
}

/** Build an HTML email body with a tracking pixel injected before </body>. */
function buildEmailHtml(bodyHtml, bodyText, trackingPixelId) {
  const pixel = trackingPixelId
    ? `<img src="${APP_URL}/api/track-open?id=${trackingPixelId}" width="1" height="1" style="display:none;border:0;" alt="">`
    : '';

  if (bodyHtml) {
    return bodyHtml.includes('</body>')
      ? bodyHtml.replace('</body>', `${pixel}</body>`)
      : bodyHtml + pixel;
  }

  const escaped = bodyText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:32px;color:#1a2332;">${escaped.replace(/\n/g, '<br>')}${pixel}</body></html>`;
}

/**
 * Extract a body preview: full text if ≤100 words, otherwise first 2–3 sentences.
 */
function buildBodyPreview(text) {
  if (!text) return '';
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plain.split(/\s+/);
  if (words.length <= 100) return plain;

  // First 2–3 sentences
  const sentenceEnd = /[.!?]+\s+/g;
  let match;
  let count = 0;
  let lastIdx = 0;
  while ((match = sentenceEnd.exec(plain)) !== null) {
    count++;
    lastIdx = match.index + match[0].length;
    if (count >= 3) break;
  }
  return lastIdx > 0 ? plain.slice(0, lastIdx).trim() + '…' : plain.slice(0, 300) + '…';
}

/** Build a base64url-encoded RFC 2822 MIME message for the Gmail API. */
function buildRawMessage({ from, fromName, to, toName, cc, subject, html, bodyText }) {
  const toField   = toName   ? `"${toName}" <${to}>`     : to;
  const fromField = fromName ? `"${fromName}" <${from}>` : from;
  const ccField   = cc && cc.length > 0 ? cc.join(', ') : null;
  const boundary  = `----=_Part_${Date.now()}`;

  const headers = [
    `From: ${fromField}`,
    `To: ${toField}`,
    ...(ccField ? [`Cc: ${ccField}`] : []),
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n');

  const plainPart = [`--${boundary}`, `Content-Type: text/plain; charset=UTF-8`, ``, bodyText || ''].join('\r\n');
  const htmlPart  = [`--${boundary}`, `Content-Type: text/html; charset=UTF-8`, ``, html, `--${boundary}--`].join('\r\n');
  const message   = `${headers}\r\n\r\n${plainPart}\r\n\r\n${htmlPart}`;

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Send via Gmail API — returns { id, threadId } */
async function sendViaGmail({ accessToken, fromEmail, fromName, toEmail, toName, cc, subject, html, body }) {
  const raw = buildRawMessage({ from: fromEmail, fromName, to: toEmail, toName, cc, subject, html, bodyText: body });
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || 'Gmail API error');
  return { id: json.id, threadId: json.threadId };
}

/** Fallback: send via Resend */
async function sendViaResend({ toEmail, toName, cc, subject, html, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('No email provider configured');

  const toField = toName ? `${toName} <${toEmail}>` : toEmail;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'LotLine CRM <crm@lotlinehomes.com>',
      to:      [toField],
      ...(cc && cc.length > 0 ? { cc } : {}),
      subject, html, text: body,
    }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.message || 'Resend error');
  return { id: json.id, threadId: null };
}

/** Log the email activity note on the deal — both success and failure. */
async function logEmailActivityNote({ supa, orgId, dealId, user, subject, toEmail, toName, body, status, sentVia }) {
  const fullName   = user.user_metadata?.full_name || user.email || '';
  const toDisplay  = toName ? `${toName} (${toEmail})` : toEmail;
  const preview    = buildBodyPreview(body);
  const today      = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const noteBody = status === 'sent'
    ? `📧 Email sent to ${toDisplay} — ${subject}`
    : `📧 Email to ${toDisplay} failed to send — ${subject}`;

  const metadata = {
    subject,
    to_name:      toName || null,
    to_email:     toEmail,
    body_preview: preview,
    sent_by:      fullName,
    sent_via:     sentVia || null,
    status,
    date:         today,
  };

  await supa.from('activity_notes').insert({
    organization_id: orgId,
    deal_id:         dealId,
    author_id:       user.id,
    author_name:     fullName,
    note_type:       'email',
    body:            noteBody,
    metadata,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { toEmail, toName, subject, body, bodyHtml, dealId, orgId, cc } = req.body || {};
  if (!toEmail || !subject || !body) {
    return res.status(400).json({ error: 'toEmail, subject, and body are required' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const supa  = adminSupabase();

  const { data: { user } } = token
    ? await supa.auth.getUser(token)
    : { data: { user: null } };

  const trackingPixelId = crypto.randomUUID();
  const html = buildEmailHtml(bodyHtml, body, trackingPixelId);

  let result    = null;
  let sentVia   = null;
  let fromEmail = null;
  let sendError = null;

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
          fromEmail = integration.gmail_email || user.email;
          result    = await sendViaGmail({
            accessToken,
            fromEmail,
            fromName: user.user_metadata?.full_name || fromEmail,
            toEmail, toName, cc, subject, html, body,
          });
          sentVia = 'gmail';
        }
      } catch (err) {
        sendError = err.message;
        console.error('Gmail send failed:', err.message);
      }
    }
  }

  // Resend fallback
  if (!result) {
    try {
      result    = await sendViaResend({ toEmail, toName, cc, subject, html, body });
      sentVia   = 'resend';
      fromEmail = 'crm@lotlinehomes.com';
      sendError = null;
    } catch (err) {
      sendError = err.message;
    }
  }

  const sendSucceeded = !!result && !sendError;

  // Log to deal_emails (activity note is created client-side by ComposeEmailModal)
  if (dealId && orgId && user && sendSucceeded) {
    try {
      const fullName = user.user_metadata?.full_name || user.email || '';
      await supa.from('deal_emails').insert({
        organization_id:   orgId,
        deal_id:           dealId,
        sent_by_user_id:   user.id,
        sent_by_name:      fullName,
        from_email:        fromEmail,
        to_emails:         [toEmail],
        cc_emails:         cc && cc.length > 0 ? cc : [],
        subject,
        body_html:         html,
        body_text:         body,
        gmail_message_id:  result.id || null,
        gmail_thread_id:   result.threadId || null,
        status:            'sent',
        tracking_pixel_id: trackingPixelId,
        sent_at:           new Date().toISOString(),
      });
    } catch (err) {
      console.error('deal_emails logging error:', err.message);
    }
  }

  if (!sendSucceeded) {
    return res.status(500).json({ error: sendError || 'Send failed' });
  }

  return res.status(200).json({
    id:              result.id,
    threadId:        result.threadId || null,
    sentVia,
    trackingPixelId,
  });
}
