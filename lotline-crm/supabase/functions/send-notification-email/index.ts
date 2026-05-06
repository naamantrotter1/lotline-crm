/**
 * send-notification-email — Supabase Edge Function
 *
 * Polls for unsent notification emails and sends them via Resend.
 * Run on a schedule (e.g. every 1–2 minutes via Supabase cron or external cron).
 *
 * Also accepts a direct webhook call from Supabase Database Webhooks
 * (INSERT on notifications) — body: { type: 'INSERT', record: Notification }
 *
 * Required env vars: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: APP_URL (for the "Open in CRM" link, defaults to lotline-crm.vercel.app)
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_KEY  = Deno.env.get('RESEND_API_KEY')           ?? '';
const SUPA_URL    = Deno.env.get('SUPABASE_URL')             ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  ?? '';
const APP_URL     = Deno.env.get('APP_URL') ?? 'https://lotline-crm.vercel.app';
const FROM_EMAIL  = 'notifications@lotlinehomes.com';

async function sendResendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `LotLine CRM <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Resend error');
  }
  return res.json();
}

function buildEmailHtml(notif: Record<string, unknown>): string {
  const title  = notif.title as string;
  const body   = notif.body  as string | null;
  const url    = notif.action_url ? `${APP_URL}${notif.action_url}` : APP_URL;
  const addr   = notif.deal_address as string | null;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;background:#f8f7f4;margin:0;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#c9703a;padding:20px 24px;">
      <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">LotLine CRM</p>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 8px;font-size:17px;color:#1a2332;">${title}</h2>
      ${body ? `<p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.5;">"${body}"</p>` : ''}
      ${addr ? `<p style="margin:0 0 16px;font-size:13px;color:#9ca3af;">${addr}</p>` : ''}
      <a href="${url}" style="display:inline-block;background:#c9703a;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">Open in CRM →</a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you have email notifications enabled. <a href="${APP_URL}/settings" style="color:#c9703a;">Manage preferences</a></p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPA_URL, SERVICE_KEY);

  try {
    // Support direct webhook call (single notification) or scheduled poll (batch)
    let notifications: Record<string, unknown>[] = [];

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => null);
      // Database webhook payload: { type: 'INSERT', record: {...} }
      if (body?.type === 'INSERT' && body?.record) {
        notifications = [body.record];
      }
    }

    // If no webhook payload, poll for unsent notifications (cron mode)
    if (notifications.length === 0) {
      const { data } = await admin
        .from('notifications')
        .select('*')
        .eq('email_sent', false)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // last 10 min
        .order('created_at', { ascending: true })
        .limit(50);
      notifications = data || [];
    }

    if (notifications.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    for (const notif of notifications) {
      try {
        const userId = notif.user_id as string;

        // Look up user email + notification_prefs
        const { data: profileData } = await admin
          .from('profiles')
          .select('notification_prefs')
          .eq('id', userId)
          .single();

        const prefs = profileData?.notification_prefs || {};
        if (prefs.email_notifications === false) {
          // User opted out — mark as "sent" so we don't retry
          await admin.from('notifications').update({ email_sent: true }).eq('id', notif.id);
          continue;
        }

        // Get user's email from auth.users
        const { data: authUser } = await admin.auth.admin.getUserById(userId);
        const email = authUser?.user?.email;
        if (!email) {
          await admin.from('notifications').update({ email_sent: true }).eq('id', notif.id);
          continue;
        }

        const html = buildEmailHtml(notif);
        await sendResendEmail({ to: email, subject: notif.title as string, html });
        await admin.from('notifications').update({ email_sent: true }).eq('id', notif.id as string);
        sent++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[send-notif-email] Failed for notif ${notif.id}:`, msg);
        // Mark sent=true to avoid infinite retry on permanent failures
        await admin.from('notifications').update({ email_sent: true }).eq('id', notif.id as string);
      }
    }

    return new Response(JSON.stringify({ sent, total: notifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[send-notif-email]', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
