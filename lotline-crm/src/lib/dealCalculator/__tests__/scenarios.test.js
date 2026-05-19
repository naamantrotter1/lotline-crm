import { describe, it, expect } from 'vitest';
import { buildScenarios } from '../scenarios';

// ── Fixture A ─────────────────────────────────────────────────────────────────
// arv=300000, Z=180000, X=15000 (5%), ae=6000 (6mo * 1000),
// holdingMonths=6, land=40000, mobile_home=70000
// Q = 180000 + 15000 + 6000 = 201000
// U = 300000 - 201000 = 99000

const FIXTURE_A = {
  buildCost:     180_000,
  totalAllIn:    201_000,
  baseProfit:     99_000,
  holdingMonths:       6,
  landCost:       40_000,
  mobileHomeCost: 70_000,
};

describe('Fixture A — standard deal', () => {
  const rows = buildScenarios(FIXTURE_A);
  const byLabel = (l) => rows.find(r => r.label === l);

  it('returns exactly 4 rows', () => {
    expect(rows).toHaveLength(4);
  });

  describe('Cash', () => {
    const s = byLabel('Cash');
    it('capital = buildCost', () => expect(s.capital).toBe(180_000));
    it('profit  = baseProfit', () => expect(s.profit).toBe(99_000));
    it('roi is a numeric string', () => expect(parseFloat(s.roi)).toBeCloseTo(55.0, 0));
  });

  describe('Hard Money', () => {
    const s = byLabel('Hard Money');
    // interest = 201000 * 0.12 * 0.5 = 12060
    // points   = 201000 * 0.03       = 6030
    // capital  = 0 + 6030            = 6030
    // profit   = 99000 - 12060 - 6030 = 80910
    // roi      = 80910 / 6030        ≈ 1342.0%
    it('capital = Q * 0.03 = 6030', () => expect(s.capital).toBe(6_030));
    it('profit  = 80910',           () => expect(s.profit).toBe(80_910));
    it('roi     ≈ 1341.8%',         () => expect(parseFloat(s.roi)).toBeCloseTo(1341.8, 1));
    it('has a tooltip',             () => expect(s.tooltip).toMatch(/12%/));
  });

  describe('HM (Land + Home)', () => {
    const s = byLabel('HM (Land + Home)');
    // landAndHome = 110000
    // interest    = 110000 * 0.12 * 0.5 = 6600
    // points      = 110000 * 0.03       = 3300
    // capital     = (201000 - 110000) + 3300 = 94300
    // profit      = 99000 - 6600 - 3300 = 89100
    // roi         = 89100 / 94300       ≈ 94.5%
    it('capital = 94300',  () => expect(s.capital).toBe(94_300));
    it('profit  = 89100',  () => expect(s.profit).toBe(89_100));
    it('roi     ≈ 94.5%',  () => expect(parseFloat(s.roi)).toBeCloseTo(94.5, 0));
    it('has a tooltip',    () => expect(s.tooltip).toMatch(/land \+ home/i));
  });

  describe('Line of Credit', () => {
    const s = byLabel('Line of Credit');
    it('capital = 0',           () => expect(s.capital).toBe(0));
    it('profit  = baseProfit',  () => expect(s.profit).toBe(99_000));
    it('roi     = "—"',         () => expect(s.roi).toBe('—'));
    it('tooltip mentions lender', () => expect(s.tooltip).toMatch(/lender/i));
  });
});

// ── Fixture B — zero inputs ────────────────────────────────────────────────────
describe('Fixture B — arv=0, Z=0 (no data entered)', () => {
  const rows = buildScenarios({
    buildCost: 0, totalAllIn: 0, baseProfit: 0,
    holdingMonths: 6, landCost: 0, mobileHomeCost: 0,
  });
  const byLabel = (l) => rows.find(r => r.label === l);

  it('does not throw', () => expect(rows).toHaveLength(4));

  it('Cash capital = 0', () => expect(byLabel('Cash').capital).toBe(0));
  it('Cash profit = 0',  () => expect(byLabel('Cash').profit).toBe(0));
  it('Cash roi = "—"',   () => expect(byLabel('Cash').roi).toBe('—'));

  it('Hard Money capital = 0', () => expect(byLabel('Hard Money').capital).toBe(0));
  it('Hard Money roi = "—"',   () => expect(byLabel('Hard Money').roi).toBe('—'));

  it('HM (Land + Home) capital = 0', () => expect(byLabel('HM (Land + Home)').capital).toBe(0));
  it('HM (Land + Home) roi = "—"',   () => expect(byLabel('HM (Land + Home)').roi).toBe('—'));

  it('LOC roi = "—"', () => expect(byLabel('Line of Credit').roi).toBe('—'));
});

// ── Fixture C — holdingMonths=0 ────────────────────────────────────────────────
describe('Fixture C — holdingMonths=0, Q=100000, U=50000', () => {
  const rows = buildScenarios({
    buildCost: 80_000, totalAllIn: 100_000, baseProfit: 50_000,
    holdingMonths: 0, landCost: 30_000, mobileHomeCost: 40_000,
  });
  const hm = rows.find(r => r.label === 'Hard Money');

  // interest = 0 (no hold time), points = 100000 * 0.03 = 3000
  // capital  = 0 + 3000 = 3000
  // profit   = 50000 - 0 - 3000 = 47000
  it('Hard Money interest = 0, so capital = points only = 3000', () => {
    expect(hm.capital).toBeCloseTo(3_000, 2);
  });
  it('Hard Money profit = U - points = 47000', () => {
    expect(hm.profit).toBeCloseTo(47_000, 2);
  });
});
