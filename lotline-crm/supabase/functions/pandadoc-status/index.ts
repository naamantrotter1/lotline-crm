/**
 * pandadoc-status — Supabase Edge Function
 * Phase 16: Poll PandaDoc for document status and update envelope + recipients.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_MAP: Record<string, string> = {
  document.draft:     'draft',
  document.sent:      'sent',
  document.completed: 'completed',
  document.declined:  'declined',
  document.voided:    'voided',
  document.expired:   'expired',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { envelopeId, orgId, userId } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: envelope } = await admin.from('esign_envelopes')
      .select('pandadoc_doc_id')
      .eq('id', envelopeId)
      .maybeSingle();

    if (!envelope?.pandadoc_doc_id) throw new Error('No PandaDoc document ID');

    const { data: conn } = await admin.from('esign_connections')
      .select('access_token')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!conn) throw new Error('No PandaDoc connection');

    const res = await fetch(`https://api.pandadoc.com/public/v1/documents/${envelope.pandadoc_doc_id}`, {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });

    if (!res.ok) throw new Error(`PandaDoc status error: ${await res.text()}`);
    const doc = await res.json();

    const newStatus = STATUS_MAP[doc.status] ?? doc.status;

    const patch: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'completed') patch.completed_at = doc.date_completed ?? new Date().toISOString();
    if (newStatus === 'declined')  patch.declined_at  = new Date().toISOString();

    await admin.from('esign_envelopes').update(patch).eq('id', envelopeId);

    // Update recipient statuses
    const recipients = doc.recipients ?? [];
    for (const r of recipients) {
      const recipStatus = r.has_completed ? 'signed'
        : r.has_declined   ? 'declined'
        : r.has_viewed     ? 'viewed'
        : 'sent';

      await admin.from('esign_recipients').update({
        status: recipStatus,
        signed_at:   r.has_completed ? new Date().toISOString() : null,
        declined_at: r.has_declined  ? new Date().toISOString() : null,
      }).eq('envelope_id', envelopeId).eq('email', r.email);
    }

    return new Response(JSON.stringify({ status: newStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
