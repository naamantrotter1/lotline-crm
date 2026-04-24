/**
 * voice-token — Supabase Edge Function
 * Phase 13: Generates a Twilio Voice Access Token for browser-based calling.
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_API_KEY_SID       — Twilio API Key SID (create at twilio.com/console/keys)
 *   TWILIO_API_KEY_SECRET    — Twilio API Key Secret
 *   TWILIO_TWIML_APP_SID     — TwiML App SID configured to handle outbound calls
 *
 * The returned token is valid for 3600 seconds (1 hour).
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { AccessToken, VoiceGrant } from 'npm:twilio@4/lib/jwt/AccessToken.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accountSid    = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid     = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret  = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid   = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      return new Response(
        JSON.stringify({ error: 'Twilio Voice env vars not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orgId } = await req.json().catch(() => ({}));

    // Create access token
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity: `crm_${orgId || 'user'}`,
      ttl: 3600,
    });

    // Add Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    token.addGrant(voiceGrant);

    return new Response(
      JSON.stringify({ token: token.toJwt() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
