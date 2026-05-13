/**
 * Read-side wrapper around the `states_config`, `counties`, and `county_zips`
 * tables introduced in migration 126. All data is small and rarely changes,
 * so we fetch once per session and cache in module-level memory + sessionStorage.
 *
 * The Deal Calculator imports these helpers; the County Database page can
 * reuse them too. Writes go through dedicated functions further down so the
 * cache can be invalidated.
 */
import { supabase } from './supabase';

const STATES_KEY   = 'lotline_states_config_v1';
const COUNTIES_KEY = 'lotline_counties_v1';

// ── Module cache ────────────────────────────────────────────────────────────
let _statesCache   = null;        // { NC: row, SC: row, FL: row }
let _countiesCache = null;        // array of county rows
let _statesPromise = null;
let _countiesPromise = null;

// ── States ──────────────────────────────────────────────────────────────────

/**
 * Fetch every supported state's config (NC, SC, FL). Returns a Promise that
 * resolves to an object keyed by state code. Result is cached for the page
 * lifetime AND in sessionStorage for fast first-render across reloads.
 */
export async function fetchStatesConfig() {
  if (_statesCache) return _statesCache;
  if (_statesPromise) return _statesPromise;

  // Try sessionStorage first for sub-millisecond first paint.
  try {
    const cached = sessionStorage.getItem(STATES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      _statesCache = parsed;
      // Re-fetch in the background to pick up admin edits, but return cache now.
      _statesPromise = doFetchStates().then(fresh => { _statesCache = fresh; return fresh; });
      return parsed;
    }
  } catch { /* ignore */ }

  _statesPromise = doFetchStates();
  _statesCache = await _statesPromise;
  return _statesCache;
}

async function doFetchStates() {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('states_config')
    .select('*');
  if (error) {
    console.warn('[statesConfig] fetch failed:', error.message);
    return {};
  }
  const byCode = {};
  for (const row of data || []) byCode[row.state] = row;
  try { sessionStorage.setItem(STATES_KEY, JSON.stringify(byCode)); } catch { /* ignore */ }
  return byCode;
}

/** Synchronous accessor — returns the cached state config or null. */
export function getCachedStateConfig(stateCode) {
  return _statesCache?.[stateCode] ?? null;
}

// ── Counties ────────────────────────────────────────────────────────────────

/** Fetch all 213 counties. Same cache pattern as states. */
export async function fetchCounties() {
  if (_countiesCache) return _countiesCache;
  if (_countiesPromise) return _countiesPromise;
  try {
    const cached = sessionStorage.getItem(COUNTIES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      _countiesCache = parsed;
      _countiesPromise = doFetchCounties().then(fresh => { _countiesCache = fresh; return fresh; });
      return parsed;
    }
  } catch { /* ignore */ }
  _countiesPromise = doFetchCounties();
  _countiesCache = await _countiesPromise;
  return _countiesCache;
}

async function doFetchCounties() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('counties')
    .select('*')
    .order('state', { ascending: true })
    .order('county_name', { ascending: true });
  if (error) {
    console.warn('[statesConfig] counties fetch failed:', error.message);
    return [];
  }
  try { sessionStorage.setItem(COUNTIES_KEY, JSON.stringify(data || [])); } catch { /* ignore */ }
  return data || [];
}

// ── ZIP lookup ──────────────────────────────────────────────────────────────

/**
 * Look up the county/state for a 5-digit US ZIP code.
 *
 * Returns `{ status, candidates }` where:
 *   status === 'unsupported' → ZIP exists but lies outside NC/SC/FL
 *                              (we don't actually know — caller treats this as the default)
 *   status === 'multi'       → ZIP maps to multiple counties (possibly different states);
 *                              caller should let the user pick
 *   status === 'ok'          → primary county resolved; result in candidates[0]
 *   status === 'missing'     → ZIP isn't in the crosswalk (uncommon for valid NC/SC/FL ZIPs)
 */
export async function resolveZipToCounty(zipCode) {
  if (!supabase || !zipCode) return { status: 'missing', candidates: [] };
  const zip = String(zipCode).trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return { status: 'missing', candidates: [] };

  const { data, error } = await supabase
    .from('county_zips')
    .select('zip_code, state, is_primary, county_id, counties(id, county_name, state, fips_code, default_costs, heat_map_metrics)')
    .eq('zip_code', zip);
  if (error) {
    console.warn('[statesConfig] zip lookup failed:', error.message);
    return { status: 'missing', candidates: [] };
  }
  if (!data || data.length === 0) {
    return { status: 'unsupported', candidates: [] };
  }
  if (data.length === 1) {
    return { status: 'ok', candidates: [normaliseCandidate(data[0])] };
  }
  // Multiple — sort with is_primary first, then alphabetical
  const sorted = [...data].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.counties?.county_name || '').localeCompare(b.counties?.county_name || '');
  });
  const sameState = sorted.every(r => r.state === sorted[0].state);
  return {
    status: sameState ? 'ok' : 'multi',
    candidates: sorted.map(normaliseCandidate),
  };
}

function normaliseCandidate(row) {
  return {
    zip: row.zip_code,
    state: row.state,
    isPrimary: !!row.is_primary,
    countyId: row.county_id,
    county: row.counties || null,
  };
}

// ── Writes (admin only via RLS) ─────────────────────────────────────────────

export function clearStatesConfigCache() {
  _statesCache = null;
  _statesPromise = null;
  try { sessionStorage.removeItem(STATES_KEY); } catch { /* ignore */ }
}

export function clearCountiesCache() {
  _countiesCache = null;
  _countiesPromise = null;
  try { sessionStorage.removeItem(COUNTIES_KEY); } catch { /* ignore */ }
}

/** Update a county's default_costs jsonb. Admin only (RLS enforced). */
export async function updateCountyDefaults(countyId, defaultCosts) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase
    .from('counties')
    .update({ default_costs: defaultCosts, updated_at: new Date().toISOString() })
    .eq('id', countyId);
  if (!error) clearCountiesCache();
  return { error };
}

/** Update a county's heat_map_metrics jsonb. Admin only. */
export async function updateCountyHeatMap(countyId, heatMapMetrics) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase
    .from('counties')
    .update({
      heat_map_metrics: { ...heatMapMetrics, lastRefreshedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq('id', countyId);
  if (!error) clearCountiesCache();
  return { error };
}

// ── ZIP CRUD for a county (admin / drawer) ──────────────────────────────────

/** Fetch every ZIP currently mapped to this county. */
export async function fetchZipsForCounty(countyId) {
  if (!supabase || !countyId) return [];
  const { data, error } = await supabase
    .from('county_zips')
    .select('zip_code, state, is_primary')
    .eq('county_id', countyId)
    .order('zip_code', { ascending: true });
  if (error) {
    console.warn('[statesConfig] fetchZipsForCounty error:', error.message);
    return [];
  }
  return data || [];
}

/** Add a ZIP row for this county. State is inherited from the county. */
export async function addZipToCounty(countyId, zipCode, state, { isPrimary = false } = {}) {
  if (!supabase) return { error: 'no supabase' };
  const clean = String(zipCode).trim().slice(0, 5);
  if (!/^\d{5}$/.test(clean)) return { error: 'invalid zip' };
  const { error } = await supabase
    .from('county_zips')
    .upsert(
      { zip_code: clean, county_id: countyId, state, is_primary: isPrimary },
      { onConflict: 'zip_code,county_id' }
    );
  return { error };
}

/** Remove a ZIP from this county (the zip row itself, not the county). */
export async function removeZipFromCounty(countyId, zipCode) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase
    .from('county_zips')
    .delete()
    .eq('county_id', countyId)
    .eq('zip_code', zipCode);
  return { error };
}

/** Toggle is_primary on a ZIP/county row. */
export async function setZipPrimary(countyId, zipCode, isPrimary) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase
    .from('county_zips')
    .update({ is_primary: !!isPrimary })
    .eq('county_id', countyId)
    .eq('zip_code', zipCode);
  return { error };
}
