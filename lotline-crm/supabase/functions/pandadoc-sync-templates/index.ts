/**
 * pandadoc-sync-templates — Supabase Edge Function
 * Phase 16: Sync PandaDoc templates into esign_templates table.
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
    const { orgId, userId } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: conn } = await admin.from('esign_connections')
      .select('access_token')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!conn) throw new Error('No PandaDoc connection found');

    const res = await fetch('https://api.pandadoc.com/public/v1/templates?count=100&deleted=false', {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });

    if (!res.ok) throw new Error(`PandaDoc templates error: ${await res.text()}`);
    const { results } = await res.json();

    const templates = (results ?? []).map((t: any) => ({
      organization_id: orgId,
      pandadoc_template_id: t.id,
      name: t.name,
      description: t.description ?? null,
      last_synced_at: new Date().toISOString(),
    }));

    if (templates.length > 0) {
      await admin.from('esign_templates').upsert(templates, {
        onConflict: 'organization_id,pandadoc_template_id',
      });
    }

    return new Response(JSON.stringify({ templates: templates.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
