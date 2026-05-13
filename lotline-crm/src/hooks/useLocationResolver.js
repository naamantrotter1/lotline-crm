/**
 * useLocationResolver — given a ZIP code and/or a county selection, resolve
 * the active state and the merged cost defaults for the calculator.
 *
 * Inputs:
 *   zip:    string|null      — 5-digit US ZIP
 *   countySelection: { countyId } | null
 *
 * Returns:
 *   {
 *     status:        'idle' | 'resolving' | 'ok' | 'multi' | 'unsupported',
 *     state:         'NC' | 'SC' | 'FL' | null,
 *     county:        county row | null,
 *     candidates:    array of {zip,state,isPrimary,county} when status==='multi',
 *     stateConfig:   states_config row | null,
 *     mergedDefaults:{ ...stateConfig.default_costs, ...county.default_costs }
 *                     | null,
 *     mergedRates:   { ...stateConfig.tax_formulas, ...county.default_costs<rate keys> }
 *                     | null,
 *     heatMap:       county.heat_map_metrics | null,
 *     error:         string | null,
 *   }
 *
 * Calculator usage:
 *   const loc = useLocationResolver(zip, picked);
 *   if (loc.status === 'unsupported') show "supports NC/SC/FL only" banner;
 *   if (loc.status === 'multi') prompt user to pick from loc.candidates;
 *   if (loc.status === 'ok') render loc.stateConfig.visible_fields,
 *     seed from resolveAutoDefaults(loc.mergedDefaults, { purchasePrice, loanAmount, rates: loc.mergedRates }).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchStatesConfig, fetchCounties, resolveZipToCounty } from '../lib/statesConfig';

// Rate keys that appear in tax_formulas and may be overridden in county.default_costs
const RATE_KEYS = new Set([
  'ncExciseRate',
  'scDeedStampRate',
  'docStampsDeedRate',
  'intangibleTaxRate',
]);

function splitOverrides(countyDefaults) {
  const costs = {};
  const rates = {};
  for (const [k, v] of Object.entries(countyDefaults || {})) {
    if (RATE_KEYS.has(k)) rates[k] = v; else costs[k] = v;
  }
  return { costs, rates };
}

export function useLocationResolver(zip, countySelection) {
  const [statesCfg, setStatesCfg] = useState(null);
  const [countiesAll, setCountiesAll] = useState(null);
  const [zipResult, setZipResult] = useState({ status: 'idle', candidates: [] });
  const [error, setError] = useState(null);
  const lastZipRef = useRef(null);

  // ── Load states + counties once ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, c] = await Promise.all([fetchStatesConfig(), fetchCounties()]);
        if (cancelled) return;
        setStatesCfg(s);
        setCountiesAll(c);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Resolve ZIP whenever it changes ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const cleanZip = (zip || '').trim().slice(0, 5);
    if (!cleanZip || !/^\d{5}$/.test(cleanZip)) {
      setZipResult({ status: 'idle', candidates: [] });
      lastZipRef.current = null;
      return;
    }
    if (lastZipRef.current === cleanZip) return;
    lastZipRef.current = cleanZip;
    setZipResult({ status: 'resolving', candidates: [] });
    (async () => {
      const result = await resolveZipToCounty(cleanZip);
      if (cancelled || lastZipRef.current !== cleanZip) return;
      setZipResult(result);
    })();
    return () => { cancelled = true; };
  }, [zip]);

  // ── Compose the answer ───────────────────────────────────────────────────
  return useMemo(() => {
    if (error) {
      return { status: 'ok', state: null, county: null, stateConfig: null,
               mergedDefaults: null, mergedRates: null, heatMap: null,
               candidates: [], error };
    }
    if (!statesCfg) {
      return { status: 'resolving', state: null, county: null, stateConfig: null,
               mergedDefaults: null, mergedRates: null, heatMap: null,
               candidates: [], error: null };
    }

    // 1) If the user picked a specific county, it wins.
    let countyRow = null;
    if (countySelection?.countyId && countiesAll) {
      countyRow = countiesAll.find(c => c.id === countySelection.countyId) || null;
    }

    // 2) Otherwise use the ZIP resolution.
    if (!countyRow) {
      if (zipResult.status === 'idle' || zipResult.status === 'resolving') {
        return { status: zipResult.status, state: null, county: null,
                 stateConfig: null, mergedDefaults: null, mergedRates: null,
                 heatMap: null, candidates: [], error: null };
      }
      if (zipResult.status === 'unsupported') {
        return { status: 'unsupported', state: null, county: null,
                 stateConfig: null, mergedDefaults: null, mergedRates: null,
                 heatMap: null, candidates: [], error: null };
      }
      if (zipResult.status === 'multi') {
        return { status: 'multi', state: null, county: null,
                 stateConfig: null, mergedDefaults: null, mergedRates: null,
                 heatMap: null, candidates: zipResult.candidates, error: null };
      }
      // ok — single candidate (or sorted with is_primary first)
      countyRow = zipResult.candidates[0]?.county || null;
    }

    if (!countyRow) {
      return { status: 'idle', state: null, county: null, stateConfig: null,
               mergedDefaults: null, mergedRates: null, heatMap: null,
               candidates: [], error: null };
    }

    const stateCode = countyRow.state;
    const stateConfig = statesCfg[stateCode] || null;
    if (!stateConfig) {
      return { status: 'unsupported', state: stateCode, county: countyRow,
               stateConfig: null, mergedDefaults: null, mergedRates: null,
               heatMap: null, candidates: [], error: null };
    }

    const { costs: countyCostOverrides, rates: countyRateOverrides } =
      splitOverrides(countyRow.default_costs);

    const mergedDefaults = { ...stateConfig.default_costs, ...countyCostOverrides };
    const mergedRates    = { ...stateConfig.tax_formulas,  ...countyRateOverrides };
    const heatMap        = countyRow.heat_map_metrics || {};

    return {
      status: 'ok',
      state: stateCode,
      county: countyRow,
      stateConfig,
      mergedDefaults,
      mergedRates,
      heatMap,
      candidates: [],
      error: null,
    };
  }, [statesCfg, countiesAll, countySelection, zipResult, error]);
}
