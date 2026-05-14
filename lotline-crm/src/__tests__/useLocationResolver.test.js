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
  // 30303 (Atlanta GA) and any other ZIP not in this map — the resolver
  // reports 'missing' because it can't tell from a ZIP alone whether the
  // ZIP is out of state or just not yet in our NC/SC/FL crosswalk.
};

// Mirrors the post-131 states_config schema: NC/SC share the construction-
// cost legacy field set; FL adds wetlandSurvey + impactFee. Auto-tax fields
// no longer appear in visible_fields (the tax rates still live in
// tax_formulas for any callers that need them).
const NC_SC_DEFAULTS = {
  land: 0, percTest: 2000, survey: 1500, mobileHome: 78000,
  septic: 7500, water: 10000,
};
const NC_SC_FIELDS = [
  'land','percTest','survey','constructionAuth','improvementPermit',
  'wellPermit','mobileHome','landClearing','roughGrade','septic','water',
  'waterSewer','publicSewer','electric','footers','setup','trimOut','hvac',
  'electrical','plumbingConnection','septicConnection','underpinning',
  'driveway','landscaping','decks','hudEngineer','mailbox','mobileTax',
];

const FAKE_STATES = {
  NC: {
    state: 'NC',
    display_name: 'North Carolina',
    default_costs: { ...NC_SC_DEFAULTS },
    visible_fields: NC_SC_FIELDS,
    tax_formulas: { ncExciseRate: 0.002 },
  },
  SC: {
    state: 'SC',
    display_name: 'South Carolina',
    default_costs: { ...NC_SC_DEFAULTS },
    visible_fields: NC_SC_FIELDS,
    tax_formulas: { scDeedStampRate: 0.00370 },
  },
  FL: {
    state: 'FL',
    display_name: 'Florida',
    default_costs: { ...NC_SC_DEFAULTS, wetlandSurvey: 0, impactFee: 0 },
    visible_fields: [...NC_SC_FIELDS, 'wetlandSurvey', 'impactFee'],
    tax_formulas: { docStampsDeedRate: 0.007, intangibleTaxRate: 0.002 },
  },
};

vi.mock('../lib/statesConfig', () => ({
  fetchStatesConfig: vi.fn(async () => FAKE_STATES),
  fetchCounties: vi.fn(async () => [ORANGE_NC, CHARLESTON_SC, MIAMI_DADE_FL]),
  resolveZipToCounty: vi.fn(async (zip) =>
    FAKE_ZIP_MAP[zip] || { status: 'missing', candidates: [] }
  ),
}));

// Import AFTER the mock so the hook picks up the mocked module
const { useLocationResolver } = await import('../hooks/useLocationResolver');

beforeEach(() => { vi.clearAllMocks(); });

describe('useLocationResolver — zip → state, mergedDefaults, mergedRates', () => {
  it('zip 27514 resolves to Orange County NC with the legacy field list', async () => {
    const { result } = renderHook(() => useLocationResolver('27514', null));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('NC');
    expect(result.current.county.county_name).toBe('Orange');
    // Legacy keys are present, FL-only extras are not.
    expect(result.current.stateConfig.visible_fields).toContain('percTest');
    expect(result.current.stateConfig.visible_fields).toContain('mobileHome');
    expect(result.current.stateConfig.visible_fields).not.toContain('wetlandSurvey');
    expect(result.current.stateConfig.visible_fields).not.toContain('impactFee');
    expect(result.current.mergedRates.ncExciseRate).toBe(0.002);
  });

  it('zip 29412 resolves to Charleston SC with the same field list as NC and no FL extras', async () => {
    const { result } = renderHook(() => useLocationResolver('29412', null));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('SC');
    expect(result.current.county.county_name).toBe('Charleston');
    expect(result.current.stateConfig.visible_fields).toContain('percTest');
    expect(result.current.stateConfig.visible_fields).not.toContain('wetlandSurvey');
    expect(result.current.stateConfig.visible_fields).not.toContain('impactFee');
  });

  it('zip 33101 (Miami-Dade FL) includes wetlandSurvey + impactFee and applies county rate override', async () => {
    const { result } = renderHook(() => useLocationResolver('33101', null));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('FL');
    expect(result.current.county.county_name).toBe('Miami-Dade');
    // FL-only extras are present in the field list.
    expect(result.current.stateConfig.visible_fields).toContain('wetlandSurvey');
    expect(result.current.stateConfig.visible_fields).toContain('impactFee');
    // County override on the rate still beats the state default 0.007.
    expect(result.current.mergedRates.docStampsDeedRate).toBe(0.006);
    // Non-rate county defaults (impactFee) land in mergedDefaults, not rates.
    expect(result.current.mergedDefaults.impactFee).toBe(4200);
    expect(result.current.mergedDefaults.docStampsDeedRate).toBeUndefined();
  });

  it('zip not in the crosswalk reports missing (so caller can prompt for manual county pick)', async () => {
    const { result } = renderHook(() => useLocationResolver('30303', null));
    await waitFor(() => expect(result.current.status).toBe('missing'));
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

  it('manualState quick-pick (no zip / no county) resolves to that state directly', async () => {
    const { result } = renderHook(() => useLocationResolver('', null, 'SC'));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('SC');
    expect(result.current.county).toBeNull();
    expect(result.current.stateConfig.visible_fields).toContain('percTest');
    // mergedDefaults comes from stateConfig only — no county overrides applied.
    expect(result.current.mergedDefaults.mobileHome).toBe(78000);
    expect(result.current.mergedRates.scDeedStampRate).toBe(0.00370);
    expect(result.current.heatMap).toBeNull();
  });

  it('explicit ZIP/county selection wins over manualState', async () => {
    // User clicks NC quick-pick AND types an FL ZIP — the FL ZIP wins.
    const { result } = renderHook(() => useLocationResolver('33101', null, 'NC'));
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.state).toBe('FL');
    expect(result.current.county.county_name).toBe('Miami-Dade');
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
