/**
 * dealsSync unit tests
 *
 * Covers:
 *  - deleteDeal throws when orgId is missing
 *  - deleteDeal removes the deal from localStorage
 *  - deleteDeal writes a tombstone entry
 *  - loadAllDeals does not re-flush a tombstoned deal (resurrection prevention)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteDeal, getTombstones, loadAllDeals } from '../lib/dealsSync';

// ── localStorage stub ──────────────────────────────────────────────────────────
const store = {};
const localStorageMock = {
  getItem:  (k) => store[k] ?? null,
  setItem:  (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
  clear:    () => { Object.keys(store).forEach(k => delete store[k]); },
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: false });

// ── Supabase mock ──────────────────────────────────────────────────────────────
// The setup.js in this directory already mocks '../lib/supabase' globally.
// Here we need a version that returns data for loadAllDeals so we can assert
// that tombstoned deals are not re-flushed.
// Chainable select stub that supports .eq().eq(), .eq().maybeSingle(), .in().eq()
const selectStub = () => {
  const chain = {
    eq: () => ({ ...chain, maybeSingle: async () => ({ data: null }), data: [], error: null }),
    in: () => ({ ...chain }),
    maybeSingle: async () => ({ data: null }),
    data: [],
    error: null,
  };
  return chain;
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
    from: (table) => {
      if (table === 'deals') {
        return {
          select: selectStub,
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }),
          insert: async () => ({ error: null }),
        };
      }
      return { select: selectStub };
    },
    channel: () => ({ on: function() { return this; }, subscribe: () => {} }),
    removeChannel: () => {},
  },
}));

// costBreakdownData is imported by dealsSync — stub it out
vi.mock('../lib/costBreakdownData', () => ({
  fetchCostSummariesForOrg: async () => [],
}));

const ORG = 'org-test-123';
const LS_KEY = `lotline_deals_${ORG}`;

function seedDeals(deals) {
  localStorage.setItem(LS_KEY, JSON.stringify(deals));
}

beforeEach(() => {
  localStorage.clear();
});

// ──────────────────────────────────────────────────────────────────────────────

describe('deleteDeal', () => {
  it('throws synchronously when orgId is omitted', async () => {
    await expect(deleteDeal('deal-001')).rejects.toThrow('deleteDeal: orgId is required');
  });

  it('removes the deal from localStorage', async () => {
    seedDeals([{ id: 'deal-001' }, { id: 'deal-002' }]);
    await deleteDeal('deal-001', ORG);
    const remaining = JSON.parse(localStorage.getItem(LS_KEY));
    expect(remaining.map(d => d.id)).not.toContain('deal-001');
    expect(remaining.map(d => d.id)).toContain('deal-002');
  });

  it('writes a tombstone entry for the deleted deal', async () => {
    seedDeals([{ id: 'deal-001' }]);
    await deleteDeal('deal-001', ORG);
    const tombstones = getTombstones(ORG);
    expect(tombstones.has('deal-001')).toBe(true);
  });

  it('does not include other deal IDs in the tombstone', async () => {
    seedDeals([{ id: 'deal-001' }, { id: 'deal-002' }]);
    await deleteDeal('deal-001', ORG);
    const tombstones = getTombstones(ORG);
    expect(tombstones.has('deal-002')).toBe(false);
  });
});

describe('loadAllDeals resurrection prevention', () => {
  it('does not return a tombstoned deal in the merged result', async () => {
    // Simulate: deal exists in LS (stale cache from another tab) but has been tombstoned
    seedDeals([{ id: 'deal-zombie', pipeline: 'land-acquisition', stage: 'New Lead' }]);
    // Write tombstone (as if deleteDeal ran on this device)
    await deleteDeal('deal-zombie', ORG);
    // Re-seed LS to simulate another tab restoring the stale entry
    seedDeals([{ id: 'deal-zombie', pipeline: 'land-acquisition', stage: 'New Lead' }]);

    const result = await loadAllDeals(ORG);
    const ids = result.map(d => String(d.id));
    expect(ids).not.toContain('deal-zombie');
  });

  it('includes a genuinely new (non-tombstoned) LS deal in the returned list', async () => {
    // Non-tombstoned deal in LS but absent from Supabase → should appear in merged results
    seedDeals([{ id: 'deal-new', pipeline: 'land-acquisition', stage: 'New Lead' }]);
    // No tombstone written for deal-new
    const result = await loadAllDeals(ORG);
    const ids = result.map(d => String(d.id));
    expect(ids).toContain('deal-new');
  });
});
