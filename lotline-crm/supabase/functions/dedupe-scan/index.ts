/**
 * dedupe-scan — Supabase Edge Function
 * Phase 18: Scan org contacts for duplicates and populate dedupe_candidates.
 *
 * Matching rules (any match → candidate):
 *   - Exact email match        → score 95
 *   - Exact phone match        → score 85
 *   - Same first+last name     → score 75
 *   - Similar name (one token) → score 50
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function phoneDigits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { orgId } = await req.json();

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch all contacts for the org
    const { data: contacts } = await admin
      .from('contacts')
      .select('id, first_name, last_name, email, phone')
      .eq('organization_id', orgId)
      .limit(5000);

    if (!contacts || contacts.length < 2) {
      return new Response(JSON.stringify({ found: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const candidates: any[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        const a = contacts[i];
        const b = contacts[j];
        const pairKey = [a.id, b.id].sort().join(':');
        if (seen.has(pairKey)) continue;

        const reasons: string[] = [];
        let score = 0;

        // Email match
        const emailA = normalize(a.email);
        const emailB = normalize(b.email);
        if (emailA && emailB && emailA === emailB) {
          reasons.push('same_email');
          score = Math.max(score, 95);
        }

        // Phone match
        const phoneA = phoneDigits(a.phone);
        const phoneB = phoneDigits(b.phone);
        if (phoneA.length >= 10 && phoneA === phoneB) {
          reasons.push('same_phone');
          score = Math.max(score, 85);
        }

        // Full name match
        const nameA = normalize(`${a.first_name} ${a.last_name}`);
        const nameB = normalize(`${b.first_name} ${b.last_name}`);
        if (nameA && nameB && nameA === nameB) {
          reasons.push('same_name');
          score = Math.max(score, 75);
        }

        if (score >= 50) {
          seen.add(pairKey);
          const [cA, cB] = a.id < b.id ? [a, b] : [b, a];
          candidates.push({
            organization_id: orgId,
            contact_a_id: cA.id,
            contact_b_id: cB.id,
            score,
            match_reasons: reasons,
            status: 'pending',
          });
        }
      }
    }

    if (candidates.length > 0) {
      await admin.from('dedupe_candidates').upsert(candidates, {
        onConflict: 'organization_id,contact_a_id,contact_b_id',
        ignoreDuplicates: false,
      });
    }

    return new Response(JSON.stringify({ found: candidates.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
