/**
 * lead-form-submit — Supabase Edge Function
 * Phase 17: Handle public lead form submission.
 * - Inserts submission record
 * - Auto-creates or links a Contact based on field mappings
 * - Sends push notification to org members (if enabled)
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
    const { formId, orgId, data: formData } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch form + fields
    const { data: form } = await admin
      .from('lead_forms')
      .select('*, lead_form_fields(*)')
      .eq('id', formId)
      .eq('active', true)
      .maybeSingle();

    if (!form) {
      return new Response(JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build contact fields from mappings
    const contactFields: Record<string, string> = {};
    for (const field of (form.lead_form_fields ?? [])) {
      if (field.maps_to && formData[field.label] !== undefined) {
        contactFields[field.maps_to] = String(formData[field.label]);
      }
    }

    // Auto-create or link contact
    let contactId: string | null = null;
    if (contactFields.email || contactFields.first_name) {
      // Check for existing contact by email
      if (contactFields.email) {
        const { data: existing } = await admin
          .from('contacts')
          .select('id')
          .eq('organization_id', form.organization_id)
          .eq('email', contactFields.email)
          .maybeSingle();
        if (existing) {
          contactId = existing.id;
        }
      }

      if (!contactId) {
        const { data: newContact } = await admin
          .from('contacts')
          .insert({
            organization_id: form.organization_id,
            first_name: contactFields.first_name ?? 'Unknown',
            last_name:  contactFields.last_name ?? null,
            email:      contactFields.email ?? null,
            phone:      contactFields.phone ?? null,
            address:    contactFields.address ?? null,
            notes:      contactFields.notes ?? null,
            lead_source: 'lead_form',
            status: 'new_lead',
          })
          .select('id')
          .single();
        contactId = newContact?.id ?? null;
      }
    }

    // Insert submission
    const { data: submission } = await admin.from('lead_submissions').insert({
      form_id: formId,
      organization_id: form.organization_id,
      contact_id: contactId,
      deal_id: form.deal_id ?? null,
      data: formData,
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
    }).select().single();

    // Send push notifications to org members who have subscriptions
    if (form.notify_push) {
      const contactName = `${contactFields.first_name ?? ''} ${contactFields.last_name ?? ''}`.trim() || 'Someone';
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('user_id')
        .eq('organization_id', form.organization_id);

      const uniqueUserIds = [...new Set((subs ?? []).map((s: any) => s.user_id))];
      for (const uid of uniqueUserIds) {
        await admin.functions.invoke('push-send', {
          body: {
            userId: uid,
            notification: {
              title: 'New Lead',
              body: `${contactName} just submitted "${form.name}"`,
              url: contactId ? `/contacts/${contactId}` : '/lead-forms',
            },
          },
        }).catch(() => {/* ignore push errors */});
      }
    }

    return new Response(JSON.stringify({ ok: true, submissionId: submission?.id, contactId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
