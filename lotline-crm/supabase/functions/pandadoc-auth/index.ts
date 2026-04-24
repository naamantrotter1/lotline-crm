/**
 * pandadoc-auth — Supabase Edge Function
 * Phase 16: Exchange PandaDoc OAuth code for tokens and store connection.
 *
 * Required env vars:
 *   PANDADOC_CLIENT_ID
 *   PANDADOC_CLIENT_SECRET
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { code, redirectUri, orgId, userId } = await req.json();

    const clientId     = Deno.env.get('PANDADOC_CLIENT_ID');
    const clientSecret = Deno.env.get('PANDADOC_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'PandaDoc credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://api.pandadoc.com/oauth2/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        scope: 'read write',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return new Response(JSON.stringify({ error: `PandaDoc token error: ${err}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tokens = await tokenRes.json();

    // Fetch workspace info
    const meRes = await fetch('https://api.pandadoc.com/public/v1/members/current/', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : {};

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await admin.from('esign_connections').upsert({
      organization_id: orgId,
      user_id: userId,
      provider: 'pandadoc',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: expiresAt,
      connected_email: me?.email ?? null,
      pandadoc_workspace_id: me?.workspace_id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id,provider' });

    return new Response(JSON.stringify({ ok: true, email: me?.email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
