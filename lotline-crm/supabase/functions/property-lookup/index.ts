/**
 * property-lookup — Supabase Edge Function
 * Phase 20: Look up property data from ATTOM API.
 *
 * Required env vars:
 *   ATTOM_API_KEY
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeAttomData(data: any) {
  const prop = data?.property?.[0];
  if (!prop) return {};
  const lot = prop.lot ?? {};
  const building = prop.building ?? {};
  const assessment = prop.assessment ?? {};
  const sale = prop.sale ?? {};
  const owner = prop.owner ?? {};
  const loc = prop.location ?? {};

  return {
    owner_name:      [owner.owner1?.fullName, owner.owner2?.fullName].filter(Boolean).join(' & ') || null,
    owner_mailing:   owner.mailAddress?.oneLine ?? null,
    assessed_value:  assessment.assessed?.totalValue ?? null,
    market_value:    assessment.market?.totalValue ?? null,
    lot_size_sqft:   lot.lotSize2 ?? null,
    year_built:      building.construction?.yearBuilt ?? null,
    zoning:          prop.area?.zoningTypeCode ?? null,
    land_use:        prop.summary?.propClass ?? null,
    last_sale_date:  sale.saleTransDate ? sale.saleTransDate.substring(0, 10) : null,
    last_sale_price: sale.saleDollarAmt ?? null,
    tax_amount:      assessment.tax?.taxAmt ?? null,
    latitude:        loc.latitude ?? null,
    longitude:       loc.longitude ?? null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { address, orgId, userId, dealId } = await req.json();

    const attomKey = Deno.env.get('ATTOM_API_KEY');
    if (!attomKey) {
      return new Response(JSON.stringify({ error: 'ATTOM_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ATTOM property detail endpoint
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address=${encodeURIComponent(address)}`;
    const attomRes = await fetch(url, {
      headers: { apikey: attomKey, Accept: 'application/json' },
    });

    if (!attomRes.ok) {
      const err = await attomRes.text();
      throw new Error(`ATTOM API error (${attomRes.status}): ${err}`);
    }

    const raw = await attomRes.json();
    const normalized = normalizeAttomData(raw);
    const parcelId = raw?.property?.[0]?.identifier?.apn ?? null;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: saved } = await admin.from('property_lookups').insert({
      organization_id: orgId,
      created_by: userId,
      deal_id: dealId ?? null,
      address,
      parcel_id: parcelId,
      provider: 'attom',
      raw_data: raw,
      ...normalized,
    }).select().single();

    return new Response(JSON.stringify({ ...normalized, parcelId, id: saved?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
