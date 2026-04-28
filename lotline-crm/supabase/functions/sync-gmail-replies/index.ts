/**
 * sync-gmail-replies — Supabase Edge Function
 *
 * Polls Gmail for replies to tracked threads (deal_emails with gmail_thread_id).
 * Run on a schedule (e.g. every 15 minutes).
 *
 * Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPA_URL    = Deno.env.get('SUPABASE_URL')              ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function getValidToken(integration: Record<string, unknown>, admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { access_token, refresh_token, token_expiry, user_id } = integration as {
    access_token: string; refresh_token: string; token_expiry: string; user_id: string;
  };

  if (token_expiry && new Date(token_expiry) > new Date(Date.now() + 120_000)) {
    return access_token;
  }
  if (!refresh_token) return null;

  const clientId     = Deno.env.get('GOOGLE_CLIENT_ID')     ?? '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' }),
  });
  const json = await r.json();
  if (!r.ok || !json.access_token) return null;

  await admin.from('user_integrations').update({
    access_token: json.access_token,
    token_expiry: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user_id).eq('provider', 'google');

  return json.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPA_URL, SERVICE_KEY);
  let checked = 0;
  let updated = 0;

  try {
    // Find all deal_emails that have a gmail_thread_id but no reply yet
    const { data: emails } = await admin
      .from('deal_emails')
      .select('id, gmail_thread_id, sent_by_user_id, replied_at, organization_id, deal_id, subject')
      .not('gmail_thread_id', 'is', null)
      .is('replied_at', null)
      .gte('sent_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // last 30 days
      .limit(100);

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ checked: 0, updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by user so we only fetch the token once per user
    const byUser = new Map<string, typeof emails>();
    for (const email of emails) {
      const uid = email.sent_by_user_id as string;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(email);
    }

    for (const [userId, userEmails] of byUser.entries()) {
      const { data: integration } = await admin
        .from('user_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .maybeSingle();

      if (!integration) continue;

      const accessToken = await getValidToken(integration, admin);
      if (!accessToken) continue;

      for (const email of userEmails) {
        checked++;
        try {
          // List messages in this thread
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${email.gmail_thread_id}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!r.ok) continue;
          const thread = await r.json();

          // If there's more than one message in the thread, someone replied
          const messages = thread.messages || [];
          if (messages.length <= 1) continue;

          // The reply is the last message not sent by us (simplified heuristic: just take the last one)
          const replyMsg = messages[messages.length - 1];
          const replyId  = replyMsg.id;

          const now = new Date().toISOString();
          await admin.from('deal_emails').update({
            replied_at: now,
            reply_gmail_message_id: replyId,
          }).eq('id', email.id);

          // Create an activity note
          await admin.from('activity_notes').insert({
            organization_id: email.organization_id,
            deal_id: email.deal_id,
            created_by: userId,
            note_type: 'email',
            body: `📬 Reply received on email — Subject: ${email.subject}`,
          });

          updated++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[sync-gmail-replies] thread ${email.gmail_thread_id}:`, msg);
        }
      }
    }

    return new Response(JSON.stringify({ checked, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-gmail-replies]', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
