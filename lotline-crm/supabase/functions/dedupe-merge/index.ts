/**
 * dedupe-merge — Supabase Edge Function
 * Phase 18: Merge contact B (mergeId) into contact A (keepId).
 * - Reassigns: sms_messages, calls, meetings, esign_envelopes, lead_submissions, tasks, contact_deals
 * - Deletes contact B
 * - Marks candidate as merged
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RELATED_TABLES = [
  'sms_messages',
  'calls',
  'meetings',
  'esign_envelopes',
  'lead_submissions',
  'tasks',
  'contact_deals',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { candidateId, keepId, mergeId, orgId, userId } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Reassign related records from mergeId → keepId
    for (const table of RELATED_TABLES) {
      await admin.from(table)
        .update({ contact_id: keepId })
        .eq('contact_id', mergeId)
        .catch(() => {/* table may not have contact_id or may not exist yet */});
    }

    // Delete the merged contact
    await admin.from('contacts').delete().eq('id', mergeId);

    // Mark candidate as merged
    await admin.from('dedupe_candidates').update({
      status: 'merged',
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    }).eq('id', candidateId);

    return new Response(JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
