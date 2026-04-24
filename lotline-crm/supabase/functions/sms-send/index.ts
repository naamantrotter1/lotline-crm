/**
 * sms-send — Supabase Edge Function
 * Phase 12: Sends an SMS via Twilio and updates the sms_messages record.
 *
 * Required env vars (set in Supabase dashboard → Edge Functions → Secrets):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   — your Twilio sender number e.g. +15551234567
 *
 * Invoked by smsData.js:
 *   supabase.functions.invoke('sms-send', { body: { messageId, to, body } })
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messageId, to, body, from } = await req.json();

    const accountSid   = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken    = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber   = from || Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(
        JSON.stringify({ error: 'Twilio env vars not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase admin client to update message record
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Send via Twilio REST API
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
      }
    );

    const twilioData = await twilioResponse.json();

    // Update message record
    const patch = twilioResponse.ok
      ? { status: 'sent', twilio_sid: twilioData.sid, sent_at: new Date().toISOString(), from_number: fromNumber }
      : { status: 'failed', error_message: twilioData.message || 'Twilio error' };

    if (messageId) {
      await supabase.from('sms_messages').update(patch).eq('id', messageId);
    }

    return new Response(
      JSON.stringify(twilioResponse.ok ? { sid: twilioData.sid } : { error: twilioData.message }),
      {
        status: twilioResponse.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
