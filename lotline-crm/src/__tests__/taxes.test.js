import { describe, it, expect } from 'vitest';
import {
  ncExcise,
  scDeedStamps,
  flDocStampsDeed,
  flIntangibleTax,
  computeAutoField,
  resolveAutoDefaults,
} from '../lib/taxes';

describe('NC excise tax (NCGS 105-228.30, $1 per $500 = 0.2%)', () => {
  it('returns $500 on a $250k purchase', () => {
    expect(ncExcise(250_000, { ncExciseRate: 0.002 })).toBe(500);
  });
  it('handles 0 and missing inputs', () => {
    expect(ncExcise(0, { ncExciseRate: 0.002 })).toBe(0);
    expect(ncExcise(null, { ncExciseRate: 0.002 })).toBe(0);
    expect(ncExcise(undefined, {})).toBe(0);
  });
  it('falls back to default rate when rates missing', () => {
    expect(ncExcise(100_000, {})).toBe(200);
  });
});

describe('SC deed stamps ($3.70 per $1000 = 0.370%)', () => {
  it('returns $925 on a $250k purchase', () => {
    expect(scDeedStamps(250_000, { scDeedStampRate: 0.00370 })).toBe(925);
  });
});

describe('FL doc stamps on deed', () => {
  it('returns $1,750 statewide on a $250k purchase (0.7%)', () => {
    expect(flDocStampsDeed(250_000, { docStampsDeedRate: 0.007 })).toBe(1_750);
  });
  it('returns $1,500 in Miami-Dade on a $250k purchase (county override 0.6%)', () => {
    expect(flDocStampsDeed(250_000, { docStampsDeedRate: 0.006 })).toBe(1_500);
  });
});

describe('FL intangible tax', () => {
  it('is zero when no loan', () => {
    expect(flIntangibleTax(0, { intangibleTaxRate: 0.002 })).toBe(0);
    expect(flIntangibleTax(null, {})).toBe(0);
  });
  it('returns $400 on a $200k loan', () => {
    expect(flIntangibleTax(200_000, { intangibleTaxRate: 0.002 })).toBe(400);
  });
});

describe('computeAutoField', () => {
  it('routes ncExciseTax to ncExcise', () => {
    expect(computeAutoField('ncExciseTax', { purchasePrice: 250_000, rates: { ncExciseRate: 0.002 } }))
      .toBe(500);
  });
  it('routes scDeedStamps to scDeedStamps', () => {
    expect(computeAutoField('scDeedStamps', { purchasePrice: 250_000, rates: { scDeedStampRate: 0.00370 } }))
      .toBe(925);
  });
  it('routes docStampsDeed to flDocStampsDeed and honours county override', () => {
    expect(computeAutoField('docStampsDeed', { purchasePrice: 250_000, rates: { docStampsDeedRate: 0.006 } }))
      .toBe(1_500);
  });
  it('returns null for non-auto field keys', () => {
    expect(computeAutoField('percTest', { purchasePrice: 250_000, rates: {} })).toBeNull();
    expect(computeAutoField('unknown', {})).toBeNull();
  });
});

describe('resolveAutoDefaults', () => {
  it('replaces only the "auto" markers', () => {
    const defaults = {
      surveying: 1300,
      docStampsDeed: 'auto',
      intangibleTax: 'auto',
      impactFee: 0,
    };
    const out = resolveAutoDefaults(defaults, {
      purchasePrice: 250_000,
      loanAmount: 200_000,
      rates: { docStampsDeedRate: 0.007, intangibleTaxRate: 0.002 },
    });
    expect(out.surveying).toBe(1300);
    expect(out.impactFee).toBe(0);
    expect(out.docStampsDeed).toBe(1_750);
    expect(out.intangibleTax).toBe(400);
  });
  it('replaces "auto" with 0 when no computer matches', () => {
    const out = resolveAutoDefaults({ mystery: 'auto' }, { rates: {} });
    expect(out.mystery).toBe(0);
  });
});
