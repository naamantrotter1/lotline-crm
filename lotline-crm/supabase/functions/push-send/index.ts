/**
 * push-send — Supabase Edge Function
 * Phase 15: Sends a Web Push notification to a user's subscribed devices.
 *
 * Required env vars:
 *   VAPID_SUBJECT    — e.g. mailto:admin@lotlinehomes.com
 *   VAPID_PUBLIC_KEY — base64url VAPID public key
 *   VAPID_PRIVATE_KEY — base64url VAPID private key
 *
 * Generate keys: npx web-push generate-vapid-keys
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimal VAPID signing without external crypto library
async function buildVapidHeaders(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string, subject: string) {
  const audience = new URL(endpoint).origin;
  const expiry = Math.floor(Date.now() / 1000) + 43200; // 12h

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({ aud: audience, exp: expiry, sub: subject })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signingInput = `${header}.${payload}`;

  // Import VAPID private key for signing
  const privKeyBytes = Uint8Array.from(atob(vapidPrivateKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privKeyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const b64sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${signingInput}.${b64sig}`;

  return {
    Authorization: `vapid t=${token},k=${vapidPublicKey}`,
    'Content-Type': 'application/octet-stream',
    TTL: '86400',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId, notification } = await req.json();
    const subject        = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@lotlinehomes.com';
    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'VAPID not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch subscriptions for user
    const { data: subs } = await admin.from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build payload
    const payload = new TextEncoder().encode(JSON.stringify({
      title: notification.title,
      body:  notification.body,
      icon:  notification.icon || '/icons/icon-192.png',
      data:  { url: notification.url || '/' },
    }));

    let sent = 0;
    for (const sub of subs) {
      try {
        const headers = await buildVapidHeaders(sub.endpoint, vapidPublicKey, vapidPrivateKey, subject);
        const res = await fetch(sub.endpoint, { method: 'POST', headers, body: payload });
        if (res.status === 410 || res.status === 404) {
          // Subscription expired — remove it
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
        } else if (res.ok) {
          sent++;
          await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id);
        }
      } catch { /* ignore per-subscription errors */ }
    }

    return new Response(JSON.stringify({ sent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
