import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ── Mock statesConfig BEFORE the hook is imported ──────────────────────────
const ORANGE_NC = {
  id: 'county-nc-orange',
  state: 'NC',
  county_name: 'Orange',
  fips_code: '37135',
  default_costs: {},
  heat_map_metrics: {},
};
const CHARLESTON_SC = {
  id: 'county-sc-charleston',
  state: 'SC',
  county_name: 'Charleston',
  fips_code: '45019',
  default_costs: {},
  heat_map_metrics: {},
};
const MIAMI_DADE_FL = {
  id: 'county-fl-miamidade',
  state: 'FL',
  county_name: 'Miami-Dade',
  fips_code: '12086',
  default_costs: { docStampsDeedRate: 0.006, impactFee: 4200 },
  heat_map_metrics: {},
};
const FAKE_ZIP_MAP = {
  '27514': { status: 'ok', candidates: [{ zip:'27514', state:'NC', isPrimary:true, countyId: ORANGE_NC.id, county: ORANGE_NC }] },
  '29412': { status: 'ok', candidates: [{ zip:'29412', state:'SC', isPrimary:true, countyId: CHARLESTON_SC.id, county: CHARLESTON_SC }] },
  '33101': { status: 'ok', candidates: [{ zip:'33101', state:'FL', isPrimary:true, countyId: MIAMI_DADE_FL.id, county: MIAMI_DADE_FL }] },
  // 30303 (Atlanta GA) — we don't store it in the crosswalk for NC/SC/FL only,
  // so the resolver should report 'unsupported'.
};

const FAKE_STATES = {
  NC: {
    state: 'NC',
    display_name: 'North Carolina',
    default_costs: { percTest: 800, ncExciseTax: 'auto', recordingFees: 64 },
    visible_fields: ['purchasePrice','closingCosts','percTest','ncExciseTax','recordingFees'],
    tax_formulas: { ncExciseRate: 0.002 },
  },
  SC: {
    state: 'SC',
    display_name: 'South Carolina',
    default_costs: { percTest: 750, scDeedStamps: 'auto', platRecording: 25 },
    visible_fields: ['purchasePrice','closingCosts','percTest','scDeedStamps','platRecording'],
    tax_formulas: { scDeedStampRate: 0.00370 },
  },
  FL: {
    state: 'FL',
    display_name: 'Florida',
    default_costs: { docStampsDeed: 'auto', intangibleTax: 'auto', surveying: 1300 },
    visible_fields: ['purchasePrice','closingCosts','surveying','docStampsDeed','intangibleTax'],
    tax_formulas: { docStampsDeedRate: 0.007, intangibleTaxRate: 0.002 },
  },
};

vi.mock('../lib/statesConfig', () => ({
  fetchStatesConfig: vi.fn(async () => FAKE_STATES),
  fetchCounties: vi.fn(async () => [ORANGE_NC, CHARLESTON_SC, MIAMI_DADE_FL]),
  resolveZipToCounty: vi.fn(async (zip) =>
    FAKE_ZIP_MAP[zip] || { status: 'unsupported', candidates: [] }
  ),
}));

// Import AFTER the mock so the hook picks up the mocked module
const { useLocationResolver } = await import('../hooks/useLocationResolver');

beforeEach(() => { vi.clearAllMocks(); });

describe('useLocationResolver — zip → state, mergedDefaults, mergedRates', () => {
  it('zip 27514 resolves to Orange County NC with NC visible_fields', async () => {
    const { result } = renderHook(() => useLocationResolver('27514', null));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('NC');
    expect(result.current.county.county_name).toBe('Orange');
    expect(result.current.stateConfig.visible_fields).toContain('percTest');
    expect(result.current.stateConfig.visible_fields).not.toContain('docStampsDeed');
    expect(result.current.mergedRates.ncExciseRate).toBe(0.002);
  });

  it('zip 29412 resolves to Charleston SC with scDeedStamps in visible_fields, no ncExciseTax', async () => {
    const { result } = renderHook(() => useLocationResolver('29412', null));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('SC');
    expect(result.current.county.county_name).toBe('Charleston');
    expect(result.current.stateConfig.visible_fields).toContain('scDeedStamps');
    expect(result.current.stateConfig.visible_fields).not.toContain('ncExciseTax');
  });

  it('zip 33101 (Miami-Dade FL) overrides docStampsDeedRate to 0.006', async () => {
    const { result } = renderHook(() => useLocationResolver('33101', null));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('FL');
    expect(result.current.county.county_name).toBe('Miami-Dade');
    // County override should beat the state 0.007
    expect(result.current.mergedRates.docStampsDeedRate).toBe(0.006);
    // Non-rate county defaults (impactFee) land in mergedDefaults, not rates
    expect(result.current.mergedDefaults.impactFee).toBe(4200);
    expect(result.current.mergedDefaults.docStampsDeedRate).toBeUndefined();
  });

  it('zip 30303 (Atlanta GA) reports unsupported and supplies no state config', async () => {
    const { result } = renderHook(() => useLocationResolver('30303', null));
    await waitFor(() => expect(result.current.status).toBe('unsupported'));
    expect(result.current.state).toBeNull();
    expect(result.current.stateConfig).toBeNull();
    expect(result.current.mergedDefaults).toBeNull();
  });

  it('countySelection (no zip) resolves directly to the picked county', async () => {
    const { result } = renderHook(() => useLocationResolver('', { countyId: MIAMI_DADE_FL.id }));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('FL');
    expect(result.current.county.county_name).toBe('Miami-Dade');
    expect(result.current.mergedRates.docStampsDeedRate).toBe(0.006);
  });

  it('empty inputs produce idle status', async () => {
    const { result } = renderHook(() => useLocationResolver('', null));
    // Hook may briefly resolve to load states before settling idle
    await waitFor(() => {
      expect(['idle']).toContain(result.current.status);
    });
    expect(result.current.state).toBeNull();
  });
});
