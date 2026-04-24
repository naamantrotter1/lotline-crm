/**
 * pandadoc-send — Supabase Edge Function
 * Phase 16: Create and send a document from a PandaDoc template.
 *
 * Required env vars:
 *   PANDADOC_CLIENT_ID, PANDADOC_CLIENT_SECRET (for token refresh)
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(admin: any, orgId: string, userId: string): Promise<string> {
  const { data: conn } = await admin.from('esign_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!conn) throw new Error('No PandaDoc connection found');

  // Refresh if expired
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    const tokenRes = await fetch('https://api.pandadoc.com/oauth2/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: Deno.env.get('PANDADOC_CLIENT_ID') ?? '',
        client_secret: Deno.env.get('PANDADOC_CLIENT_SECRET') ?? '',
        refresh_token: conn.refresh_token,
      }),
    });
    if (tokenRes.ok) {
      const tokens = await tokenRes.json();
      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
      await admin.from('esign_connections').update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? conn.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }).eq('id', conn.id);
      return tokens.access_token;
    }
  }
  return conn.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { envelopeId, orgId, userId, pandadocTemplateId, recipients, fieldsData } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const accessToken = await getAccessToken(admin, orgId, userId);

    // Fetch envelope name
    const { data: envelope } = await admin.from('esign_envelopes').select('name').eq('id', envelopeId).maybeSingle();
    const docName = envelope?.name ?? 'Document';

    // Build PandaDoc API payload
    const recipientsPayload = (recipients ?? []).map((r: any, i: number) => ({
      email: r.email,
      first_name: r.name.split(' ')[0] ?? r.name,
      last_name:  r.name.split(' ').slice(1).join(' ') || '',
      role:       r.role ?? 'signer',
      signing_order: i + 1,
    }));

    const tokensPayload = Object.entries(fieldsData ?? {}).map(([k, v]) => ({
      name: k, value: String(v),
    }));

    const createRes = await fetch('https://api.pandadoc.com/public/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: docName,
        template_uuid: pandadocTemplateId,
        recipients: recipientsPayload,
        tokens: tokensPayload,
        fields: {},
        tags: ['lotline-crm'],
        metadata: { envelope_id: envelopeId, org_id: orgId },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`PandaDoc create error: ${err}`);
    }

    const doc = await createRes.json();

    // Send the document
    const sendRes = await fetch(`https://api.pandadoc.com/public/v1/documents/${doc.id}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Please sign this document at your earliest convenience.', silent: false }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`PandaDoc send error: ${err}`);
    }

    // Update envelope record
    await admin.from('esign_envelopes').update({
      pandadoc_doc_id: doc.id,
      status: 'sent',
      sent_at: new Date().toISOString(),
      pandadoc_view_url: doc.links?.[0]?.href ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', envelopeId);

    return new Response(JSON.stringify({ ok: true, pandadocDocId: doc.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
