/**
 * Cost Breakdown Parity Tests
 *
 * Verifies that:
 * 1. calcNetProfit prefers deal.totalActual over legacy flat columns when set.
 * 2. calcNetProfit falls back to the legacy column sum when totalActual is null.
 * 3. resolveActual mirrors the DB view logic exactly.
 * 4. computeTotalActual sums leaf lines correctly (matching the DB view).
 *
 * These are pure-function unit tests — no Supabase calls.
 * They guard against regressions in the cost propagation fix (PR 2).
 */

import { describe, it, expect } from 'vitest';
import { calcNetProfit } from '../data/deals';
import { resolveActual, resolveDifference, computeTotalActual, computeTotalEstimated } from '../lib/costBreakdownData';

// ── Shared fixtures ────────────────────────────────────────────────────────────

const DEAL_BASE = {
  arv: 250000,
  sellingCostPct: 4.5,
  holdingMonths: 4,
  holdingPerMonth: 250,
};

const LEGACY_COSTS = {
  land: 30000,
  mobileHome: 80000,
  hudEngineer: 600,
  percTest: 2500,
  survey: 1500,
  footers: 2000,
  setup: 10000,
  clearLand: 4000,
  water: 10000,
  septic: 7500,
  electric: 2000,
  hvac: 4500,
  underpinning: 0,
  decks: 3500,
  driveway: 1500,
  landscaping: 1500,
  waterSewer: 0,
  mailbox: 300,
  gutters: 0,
  photos: 0,
  mobileTax: 0,
  staging: 0,
};

// Sum of all legacy cost fields (manual reference value)
const LEGACY_SUM = Object.values(LEGACY_COSTS).reduce((s, v) => s + v, 0);
// 30000+80000+600+2500+1500+2000+10000+4000+10000+7500+2000+4500+0+3500+1500+1500+0+300+0+0+0+0 = 161900

// ── calcNetProfit ──────────────────────────────────────────────────────────────

describe('calcNetProfit', () => {
  const arv      = DEAL_BASE.arv;
  const sellCost = arv * (DEAL_BASE.sellingCostPct / 100);
  const holdCost = DEAL_BASE.holdingMonths * DEAL_BASE.holdingPerMonth;

  it('uses deal.totalActual when set, ignores legacy flat columns', () => {
    const totalActual = 99999; // arbitrary canonical value different from LEGACY_SUM
    const deal = { ...DEAL_BASE, ...LEGACY_COSTS, totalActual };
    const profit = calcNetProfit(deal);
    const expected = arv - totalActual - sellCost - holdCost;
    expect(profit).toBeCloseTo(expected, 2);
  });

  it('uses totalActualOverride argument over everything else when provided', () => {
    const override = 55555;
    const deal = { ...DEAL_BASE, ...LEGACY_COSTS, totalActual: 99999 };
    const profit = calcNetProfit(deal, override);
    const expected = arv - override - sellCost - holdCost;
    expect(profit).toBeCloseTo(expected, 2);
  });

  it('falls back to legacy column sum when totalActual is null', () => {
    const deal = { ...DEAL_BASE, ...LEGACY_COSTS, totalActual: null };
    const profit = calcNetProfit(deal);
    const expected = arv - LEGACY_SUM - sellCost - holdCost;
    expect(profit).toBeCloseTo(expected, 2);
  });

  it('falls back to legacy column sum when totalActual is undefined (unenriched deal)', () => {
    const deal = { ...DEAL_BASE, ...LEGACY_COSTS }; // no totalActual key
    const profit = calcNetProfit(deal);
    const expected = arv - LEGACY_SUM - sellCost - holdCost;
    expect(profit).toBeCloseTo(expected, 2);
  });

  it('treats totalActual=0 as valid canonical value (not legacy fallback)', () => {
    const deal = { ...DEAL_BASE, ...LEGACY_COSTS, totalActual: 0 };
    const profit = calcNetProfit(deal);
    const expected = arv - 0 - sellCost - holdCost;
    expect(profit).toBeCloseTo(expected, 2);
  });

  it('does not double-count when totalActual equals legacy sum (parity case)', () => {
    const deal = { ...DEAL_BASE, ...LEGACY_COSTS, totalActual: LEGACY_SUM };
    const profit = calcNetProfit(deal);
    const expected = arv - LEGACY_SUM - sellCost - holdCost;
    expect(profit).toBeCloseTo(expected, 2);
  });
});

// ── resolveActual (mirrors deal_cost_resolved_view logic) ─────────────────────

describe('resolveActual', () => {
  it('returns actual_amount when actual_overridden is true', () => {
    const line = { estimated_amount: 1000, actual_amount: 2500, actual_overridden: true };
    expect(resolveActual(line)).toBe(2500);
  });

  it('returns estimated_amount when actual_overridden is false', () => {
    const line = { estimated_amount: 1000, actual_amount: 2500, actual_overridden: false };
    expect(resolveActual(line)).toBe(1000);
  });

  it('returns 0 for null estimated when not overridden', () => {
    const line = { estimated_amount: null, actual_amount: null, actual_overridden: false };
    expect(resolveActual(line)).toBe(0);
  });

  it('returns actual_amount even when estimated is null', () => {
    const line = { estimated_amount: null, actual_amount: 800, actual_overridden: true };
    expect(resolveActual(line)).toBe(800);
  });

  it('returns 0 for null line', () => {
    expect(resolveActual(null)).toBe(0);
  });
});

// ── resolveDifference ──────────────────────────────────────────────────────────

describe('resolveDifference', () => {
  it('returns 0 when actual mirrors estimated', () => {
    const line = { estimated_amount: 5000, actual_amount: null, actual_overridden: false };
    expect(resolveDifference(line)).toBe(0);
  });

  it('returns positive when actual overrides above estimated', () => {
    const line = { estimated_amount: 5000, actual_amount: 7000, actual_overridden: true };
    expect(resolveDifference(line)).toBe(2000);
  });

  it('returns negative when actual overrides below estimated', () => {
    const line = { estimated_amount: 5000, actual_amount: 3000, actual_overridden: true };
    expect(resolveDifference(line)).toBe(-2000);
  });
});

// ── computeTotalActual ─────────────────────────────────────────────────────────

describe('computeTotalActual', () => {
  const lines = [
    { estimated_amount: 1000, actual_amount: 1200, actual_overridden: true  }, // uses actual
    { estimated_amount: 2000, actual_amount: null,  actual_overridden: false }, // uses estimated
    { estimated_amount: null,  actual_amount: null,  actual_overridden: false }, // blank → 0
    { estimated_amount: 500,  actual_amount: 800,   actual_overridden: false }, // override false → uses estimated
  ];

  it('sums resolved actuals correctly', () => {
    // 1200 + 2000 + 0 + 500 = 3700
    expect(computeTotalActual(lines)).toBe(3700);
  });

  it('returns 0 for empty array', () => {
    expect(computeTotalActual([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(computeTotalActual(null)).toBe(0);
    expect(computeTotalActual(undefined)).toBe(0);
  });
});

// ── computeTotalEstimated ──────────────────────────────────────────────────────

describe('computeTotalEstimated', () => {
  it('sums estimated_amount fields regardless of override flag', () => {
    const lines = [
      { estimated_amount: 1000, actual_amount: 9999, actual_overridden: true  },
      { estimated_amount: 2000, actual_amount: null,  actual_overridden: false },
      { estimated_amount: null,  actual_amount: null,  actual_overridden: false },
    ];
    expect(computeTotalEstimated(lines)).toBe(3000);
  });
});

// ── Parity: totalActual must equal computeTotalActual(lines) ──────────────────

describe('parity: deal.totalActual should match computeTotalActual(lines)', () => {
  it('calcNetProfit using totalActual matches calcNetProfit using computeTotalActual', () => {
    const lines = [
      { estimated_amount: 30000, actual_amount: 31000, actual_overridden: true  },
      { estimated_amount: 80000, actual_amount: null,  actual_overridden: false },
      { estimated_amount: 10000, actual_amount: null,  actual_overridden: false },
      { estimated_amount: 7500,  actual_amount: 8200,  actual_overridden: true  },
    ];
    const totalActualFromLines = computeTotalActual(lines);
    // 31000 + 80000 + 10000 + 8200 = 129200

    const dealWithTotalActual = { ...DEAL_BASE, totalActual: totalActualFromLines };
    const dealWithLegacy      = { ...DEAL_BASE, totalActual: null, land: 31000, mobileHome: 80000, water: 10000, septic: 8200 };

    // Both should yield the same net profit (parity)
    const profitFromCanonical = calcNetProfit(dealWithTotalActual);
    const profitFromLegacy    = calcNetProfit(dealWithLegacy);

    expect(profitFromCanonical).toBeCloseTo(profitFromLegacy, 2);
  });
});
