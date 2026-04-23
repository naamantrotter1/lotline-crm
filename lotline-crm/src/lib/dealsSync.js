import { supabase } from './supabase';

const LS_KEY = 'lotline_custom_deals';

// ── helpers ──────────────────────────────────────────────────────────────────

function lsGet() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function lsSet(deals) {
  localStorage.setItem(LS_KEY, JSON.stringify(deals));
}

// Map camelCase deal object → snake_case DB row
function dealToRow(deal) {
  return {
    id:                      String(deal.id),
    pipeline:                deal.pipeline || 'land-acquisition',
    stage:                   deal.stage || 'New Lead',
    address:                 deal.address || null,
    county:                  deal.county || null,
    state:                   deal.state || null,
    zip:                     deal.zip || null,
    acreage:                 deal.acreage ? parseFloat(deal.acreage) : null,
    parcel_id:               deal.parcelId || null,
    arv:                     deal.arv ? parseFloat(deal.arv) : null,
    grade:                   deal.grade || null,
    seller_name:             deal.sellerName || null,
    owner_name:              deal.ownerName || null,
    phone:                   deal.phone || null,
    email:                   deal.email || null,
    lead_source:             deal.leadSource || null,
    owner_type:              deal.ownerType || null,
    financing:               deal.financing || null,
    investor:                deal.investor || null,
    utility_scenario:        deal.utilityScenario || null,
    home_model:              deal.homeModel || null,
    water_company:           deal.waterCompany || null,
    sewer_company:           deal.sewerCompany || null,
    electric_company:        deal.electricCompany || null,
    subdividable:            deal.subdividable || null,
    land_clearing:           deal.landClearing || null,
    notes:                   deal.notes || null,
    general_notes:           deal.generalNotes || null,
    comps_notes:             deal.compsNotes || null,
    tags:                    deal.tags ? JSON.stringify(deal.tags) : null,
    land:                    deal.land ?? 0,
    mobile_home:             deal.mobileHome ?? 0,
    hud_engineer:            deal.hudEngineer ?? 0,
    perc_test:               deal.percTest ?? 0,
    survey:                  deal.survey ?? 0,
    footers:                 deal.footers ?? 0,
    setup:                   deal.setup ?? 0,
    clear_land:              deal.clearLand ?? 0,
    water_cost:              deal.water ?? 0,
    septic:                  deal.septic ?? 0,
    electric:                deal.electric ?? 0,
    hvac:                    deal.hvac ?? 0,
    underpinning:            deal.underpinning ?? 0,
    decks:                   deal.decks ?? 0,
    driveway:                deal.driveway ?? 0,
    landscaping:             deal.landscaping ?? 0,
    water_sewer:             deal.waterSewer ?? 0,
    mailbox:                 deal.mailbox ?? 0,
    gutters:                 deal.gutters ?? 0,
    photos:                  deal.photos ?? 0,
    mobile_tax:              deal.mobileTax ?? 0,
    staging:                 deal.staging ?? 0,
    contract_date:           deal.contractDate || null,
    close_date:              deal.closeDate || null,
    delivery_date:           deal.deliveryDate || null,
    dd_deadline:             deal.ddDeadline || null,
    appraisal_date:          deal.appraisalDate || null,
    fin_contingency:         deal.financingContingency || null,
    closing_date:            deal.closingDate || null,
    closing_attorney:        deal.closingAttorney || null,
    closing_attorney_phone:  deal.closingAttorneyPhone || null,
    closing_attorney_address: deal.closingAttorneyAddress || null,
    holding_months:          deal.holdingMonths ?? 4,
    holding_per_month:       deal.holdingPerMonth ?? 250,
    manufacturer:            deal.manufacturer || null,
    is_archived:             deal.isArchived || false,
    archived_at:             deal.archivedAt || null,
    lat:                     deal.lat ?? null,
    lng:                     deal.lng ?? null,
    capital_deployed_date:         deal.capitalDeployedDate || null,
    capital_returned_date:         deal.capitalReturnedDate || null,
    investor_paid_out:             deal.investorPaidOut || false,
    investor_capital_contributed:  deal.investorCapitalContributed ?? null,
    investor_equity_pct:           deal.investorEquityPct ?? null,
    projected_payout_date:         deal.projectedPayoutDate || null,
    dd_deadline2:            deal.ddDeadline || null,
    deal_owner:              deal.dealOwner || null,
    listing_url:             deal.listingUrl || null,
    contract_signed_at:      deal.contractSignedAt || null,
    scenario_data:           deal.scenarioData ? JSON.stringify(deal.scenarioData) : null,
    total_capital_required:  deal.totalCapitalRequired ?? null,
    capital_stack_status:    deal.capitalStackStatus || null,
  };
}

// Map snake_case DB row → camelCase deal object
function rowToDeal(row) {
  return {
    id:                    row.id,
    pipeline:              row.pipeline,
    stage:                 row.stage,
    address:               row.address,
    county:                row.county,
    state:                 row.state,
    zip:                   row.zip,
    acreage:               row.acreage,
    parcelId:              row.parcel_id,
    arv:                   row.arv,
    grade:                 row.grade,
    sellerName:            row.seller_name,
    ownerName:             row.owner_name,
    phone:                 row.phone,
    email:                 row.email,
    leadSource:            row.lead_source,
    ownerType:             row.owner_type,
    financing:             row.financing,
    investor:              row.investor,
    utilityScenario:       row.utility_scenario,
    homeModel:             row.home_model,
    waterCompany:          row.water_company,
    sewerCompany:          row.sewer_company,
    electricCompany:       row.electric_company,
    subdividable:          row.subdividable,
    landClearing:          row.land_clearing,
    notes:                 row.notes,
    generalNotes:          row.general_notes,
    compsNotes:            row.comps_notes,
    tags:                  row.tags ? JSON.parse(row.tags) : [],
    land:                  row.land,
    mobileHome:            row.mobile_home,
    hudEngineer:           row.hud_engineer,
    percTest:              row.perc_test,
    survey:                row.survey,
    footers:               row.footers,
    setup:                 row.setup,
    clearLand:             row.clear_land,
    water:                 row.water_cost,
    septic:                row.septic,
    electric:              row.electric,
    hvac:                  row.hvac,
    underpinning:          row.underpinning,
    decks:                 row.decks,
    driveway:              row.driveway,
    landscaping:           row.landscaping,
    waterSewer:            row.water_sewer,
    mailbox:               row.mailbox,
    gutters:               row.gutters,
    photos:                row.photos,
    mobileTax:             row.mobile_tax,
    staging:               row.staging,
    contractDate:          row.contract_date,
    closeDate:             row.close_date,
    deliveryDate:          row.delivery_date,
    ddDeadline:            row.dd_deadline,
    appraisalDate:         row.appraisal_date,
    financingContingency:  row.fin_contingency,
    closingDate:           row.closing_date,
    closingAttorney:       row.closing_attorney,
    closingAttorneyPhone:  row.closing_attorney_phone,
    closingAttorneyAddress: row.closing_attorney_address,
    holdingMonths:         row.holding_months,
    holdingPerMonth:       row.holding_per_month,
    manufacturer:          row.manufacturer,
    isArchived:            row.is_archived,
    archivedAt:            row.archived_at,
    lat:                   row.lat,
    lng:                   row.lng,
    capitalDeployedDate:          row.capital_deployed_date,
    capitalReturnedDate:          row.capital_returned_date,
    investorPaidOut:              row.investor_paid_out,
    investorCapitalContributed:   row.investor_capital_contributed,
    investorEquityPct:            row.investor_equity_pct,
    projectedPayoutDate:          row.projected_payout_date,
    listingUrl:            row.listing_url,
    contractSignedAt:      row.contract_signed_at,
    dealOwner:             row.deal_owner,
    scenarioData:          row.scenario_data ? (typeof row.scenario_data === 'string' ? JSON.parse(row.scenario_data) : row.scenario_data) : null,
    totalCapitalRequired:  row.total_capital_required ?? null,
    capitalStackStatus:    row.capital_stack_status ?? 'draft',
  };
}

// ── Deals ─────────────────────────────────────────────────────────────────────

// Hardcoded contractSignedAt dates for seeded deals (until Supabase column exists)
// April 2026 = moved to Deal Overview this month; March 2026 = moved prior month
const APR = '2026-04-01T12:00:00.000Z';
const MAR = '2026-03-15T12:00:00.000Z';
// Explicit mapping for all seeded Deal Overview deals — overrides any stale localStorage values
const SEEDED_CONTRACT_SIGNED_DATES = {
  'deal-001': MAR, 'deal-002': MAR, 'deal-003': MAR,
  'deal-004': MAR, // Blue Newkirk Rd
  'deal-005': APR, 'deal-006': APR, 'deal-007': APR, 'deal-008': APR,
  'deal-009': APR, 'deal-010': APR, 'deal-011': APR,
  'deal-012': MAR, // Henry Jenkins Rd
  'deal-013': APR, 'deal-014': APR, 'deal-015': APR, 'deal-016': APR,
  'deal-017': MAR, 'deal-018': MAR, 'deal-019': MAR,
  'deal-020': MAR, 'deal-021': MAR,
};

/** Load all deals: Supabase first, localStorage fallback */
export async function loadAllDeals() {
  if (!supabase) return lsGet();
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('is_archived', false);
    if (error) throw error;
    // Merge Supabase rows with any locally-stored fields not yet synced to DB
    // (e.g. contractSignedAt, listingUrl before those columns exist in Supabase)
    const lsDeals = lsGet();
    const lsById = Object.fromEntries(lsDeals.map(d => [String(d.id), d]));
    const deals = data.map(row => {
      const fromSupabase = rowToDeal(row);
      const fromLS = lsById[String(fromSupabase.id)] || {};
      const id = String(fromSupabase.id);
      const seededDate = SEEDED_CONTRACT_SIGNED_DATES[id] || null;
      return {
        ...fromSupabase,
        // Seeded deals use the hardcoded date (overrides stale LS migration values)
        // User-created deals fall back to LS then null
        contractSignedAt: fromSupabase.contractSignedAt
          || seededDate
          || fromLS.contractSignedAt
          || null,
        listingUrl: fromSupabase.listingUrl || fromLS.listingUrl || null,
        // Trust Supabase first, fall back to localStorage, then seeded date
        contractDate: fromSupabase.contractDate || fromLS.contractDate || (seededDate ? seededDate.slice(0, 10) : null),
      };
    });
    lsSet(deals);
    return deals;
  } catch (e) {
    console.warn('[dealsSync] Supabase unavailable, using localStorage:', e.message);
    return lsGet();
  }
}

/** Load archived deals */
export async function loadArchivedDeals() {
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem('lotline_archived_deals') || '[]'); } catch { return []; }
  }
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('is_archived', true);
    if (error) throw error;
    return data.map(rowToDeal);
  } catch {
    try { return JSON.parse(localStorage.getItem('lotline_archived_deals') || '[]'); } catch { return []; }
  }
}

/** Write a single deal to localStorage only (synchronous, no network). */
export function saveToLS(deal) {
  const all = lsGet();
  const idx = all.findIndex(d => String(d.id) === String(deal.id));
  if (idx >= 0) all[idx] = deal; else all.push(deal);
  lsSet(all);
}

/** Flush a single deal to Supabase only (async, no localStorage touch).
 *  Tries UPDATE first; falls back to INSERT for new deals. */
export function flushToSupabase(deal) {
  if (!supabase) return;
  const row = dealToRow(deal);
  supabase.from('deals').update(row).eq('id', row.id).select()
    .then(({ error, data }) => {
      if (error) {
        console.error('[dealsSync] flushToSupabase update error:', error.code, error.message, error.hint);
        return;
      }
      if (!data || data.length === 0) {
        console.warn('[dealsSync] flushToSupabase: 0 rows updated, attempting insert for id:', row.id);
        supabase.from('deals').insert(row)
          .then(({ error: insertError }) => {
            if (insertError) console.error('[dealsSync] flushToSupabase insert error:', insertError.message);
            else console.log('[dealsSync] flushToSupabase: inserted new deal', row.id);
          });
      } else {
        console.log('[dealsSync] flushToSupabase: updated deal', row.id);
      }
    });
}

/** Save a single deal — updates localStorage immediately, Supabase async.
 *  Tries UPDATE first (works for all roles incl. agent); falls back to
 *  INSERT for brand-new deals that don't yet exist in the DB. */
export function saveDeal(deal) {
  saveToLS(deal);
  flushToSupabase(deal);
}

/** Delete a deal from both localStorage and Supabase */
export function deleteDeal(dealId) {
  const all = lsGet().filter(d => String(d.id) !== String(dealId));
  lsSet(all);
  if (supabase) {
    supabase.from('deals').delete().eq('id', String(dealId))
      .then(({ error }) => { if (error) console.warn('[dealsSync] deleteDeal error:', error.message); });
  }
}

/** Archive a deal */
export function archiveDeal(deal) {
  const archived = { ...deal, isArchived: true, archivedAt: new Date().toISOString() };
  saveDeal(archived);
  // Remove from active localStorage list
  const all = lsGet().filter(d => String(d.id) !== String(deal.id));
  lsSet(all);
}

// ── County Data ───────────────────────────────────────────────────────────────

export async function loadCountyData() {
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem('countyDatabase_data') || '{}'); } catch { return {}; }
  }
  try {
    const { data, error } = await supabase.from('county_data').select('*');
    if (error) throw error;
    const result = {};
    data.forEach(row => { result[row.county_name] = row.data; });
    localStorage.setItem('countyDatabase_data', JSON.stringify(result));
    return result;
  } catch {
    try { return JSON.parse(localStorage.getItem('countyDatabase_data') || '{}'); } catch { return {}; }
  }
}

export function saveCountyData(countyName, state, data) {
  // Update localStorage
  try {
    const all = JSON.parse(localStorage.getItem('countyDatabase_data') || '{}');
    all[countyName] = data;
    localStorage.setItem('countyDatabase_data', JSON.stringify(all));
  } catch {}

  // Async Supabase upsert
  if (supabase) {
    supabase.from('county_data')
      .upsert({ county_name: countyName, state, data }, { onConflict: 'county_name,state' })
      .then(({ error }) => { if (error) console.warn('[dealsSync] saveCountyData error:', error.message); });
  }
}

// ── Real-time subscription ────────────────────────────────────────────────────

/**
 * Subscribe to live deal changes from Supabase.
 * @param {function} onUpdate - called with the updated deal object on INSERT/UPDATE
 * @param {function} onDelete - called with the deleted deal id on DELETE
 * @returns {function} unsubscribe - call to stop listening
 */
export function subscribeToDeals(onUpdate, onDelete) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel('deals-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deals' }, payload => {
      onUpdate(rowToDeal(payload.new));
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals' }, payload => {
      onUpdate(rowToDeal(payload.new));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'deals' }, payload => {
      onDelete(String(payload.old.id));
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
