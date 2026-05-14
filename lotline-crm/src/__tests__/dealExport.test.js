/**
 * Unit tests for src/lib/dealExport.js — buildExportData.
 *
 * Covers the 3 spec scenarios:
 *   1. Fully populated deal with 5 cost lines across 2 categories.
 *   2. Missing parcel_id + acreage render blank, not "undefined" / "null".
 *   3. Zero cost lines — Total row is $0 and rows is empty.
 *
 * Also covers HIDDEN_KEYS filtering (water_sewer must not appear in the
 * export so totals match the UI All-In Cost).
 */
import { describe, it, expect } from 'vitest';
import { buildExportData, formatCurrency, formatAcres, slugify } from '../lib/dealExport';

const DEAL_FULL = {
  address: '510 Walton Ln, Tyner, NC 27980',
  county: 'Chowan',
  state: 'NC',
  zip: '27980',
  parcelId: '130610 0363 23',
  acreage: 0.99,
  arv: 250000,
};

describe('buildExportData', () => {
  it('produces normalized output for a deal with all metadata + 5 cost lines across 2 categories', () => {
    const lines = [
      { category_key: 'mobile_home', group_name: 'Build',    label: 'Mobile Home',    estimated_amount: 80000, sort_order: 20 },
      { category_key: 'footers',     group_name: 'Build',    label: 'Footers',        estimated_amount: 6000,  sort_order: 22 },
      { category_key: 'land',        group_name: 'Land',     label: 'Land / Purchase Price', estimated_amount: 30000, sort_order: 10 },
      { category_key: 'survey',      group_name: 'Land',     label: 'Land Survey',    estimated_amount: 1500,  sort_order: 12 },
      { category_key: 'setup',       group_name: 'Build',    label: 'Setup',          estimated_amount: 9000,  sort_order: 21 },
    ];
    const out = buildExportData(DEAL_FULL, lines);

    expect(out.header).toEqual([
      { label: 'Address',     value: '510 Walton Ln, Tyner, NC 27980' },
      { label: 'County',      value: 'Chowan' },
      { label: 'State',       value: 'NC' },
      { label: 'Zip',         value: '27980' },
      { label: 'Parcel ID',   value: '130610 0363 23' },
      { label: 'Acreage',     value: '0.99' },
      { label: 'ARV',         value: 250000 },
      { label: 'All-In Cost', value: 126500 },
    ]);

    // Sorted: Land group first (sort_order 10, 12), then Build (20, 21, 22)
    expect(out.rows.map(r => r.label)).toEqual([
      'Land / Purchase Price',
      'Land Survey',
      'Mobile Home',
      'Setup',
      'Footers',
    ]);
    expect(out.rows.map(r => r.category)).toEqual(['Land','Land','Build','Build','Build']);
    expect(out.rows.map(r => r.amount)).toEqual([30000, 1500, 80000, 9000, 6000]);
    expect(out.totals.totalEstimated).toBe(126500);
    expect(out.totals.allIn).toBe(126500);
  });

  it('renders blank for missing parcel_id and acreage — not "undefined" or "null"', () => {
    const deal = { ...DEAL_FULL, parcelId: null, acreage: null };
    const out = buildExportData(deal, []);
    const findValue = (lbl) => out.header.find(h => h.label === lbl).value;

    expect(findValue('Parcel ID')).toBe('');
    expect(findValue('Acreage')).toBe('');
    // Non-null fields still render
    expect(findValue('Address')).toBe('510 Walton Ln, Tyner, NC 27980');
  });

  it('handles zero cost lines — empty rows, $0 totals', () => {
    const out = buildExportData(DEAL_FULL, []);
    expect(out.rows).toEqual([]);
    expect(out.totals.totalEstimated).toBe(0);
    expect(out.totals.allIn).toBe(0);
    expect(out.header.find(h => h.label === 'All-In Cost').value).toBe(0);
  });

  it('excludes HIDDEN_KEYS so totals match the UI All-In Cost', () => {
    const lines = [
      { category_key: 'land',        group_name: 'Land',  label: 'Land',         estimated_amount: 30000, sort_order: 10 },
      // The next 5 are hidden in the UI and must not appear or be summed.
      { category_key: 'water_sewer',          group_name: 'Sitework',  label: 'Water/Sewer',     estimated_amount: 1500, sort_order: 50 },
      { category_key: 'gutters',              group_name: 'Finishing', label: 'Gutters',         estimated_amount: 500,  sort_order: 60 },
      { category_key: 'professional_photos',  group_name: 'Finishing', label: 'Photos',          estimated_amount: 300,  sort_order: 61 },
      { category_key: 'staging',              group_name: 'Finishing', label: 'Staging',         estimated_amount: 200,  sort_order: 62 },
      { category_key: 'environmental_permits',group_name: 'Sitework',  label: 'Env Permits',     estimated_amount: 999,  sort_order: 49 },
    ];
    const out = buildExportData(DEAL_FULL, lines);
    expect(out.rows).toHaveLength(1);
    expect(out.totals.totalEstimated).toBe(30000);
  });

  it('handles empty-string and undefined deal fields without leaking "undefined"', () => {
    const out = buildExportData({}, []);
    const labels = out.header.map(h => h.value);
    expect(labels.every(v => v !== 'undefined' && v !== 'null')).toBe(true);
  });
});

describe('formatCurrency', () => {
  it('formats positive USD with 2 decimals + thousands separator', () => {
    expect(formatCurrency(126500)).toBe('$126,500.00');
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });
  it('returns empty string for null/undefined/empty', () => {
    expect(formatCurrency(null)).toBe('');
    expect(formatCurrency(undefined)).toBe('');
    expect(formatCurrency('')).toBe('');
  });
});

describe('formatAcres', () => {
  it('trims trailing zeros up to 4 decimals', () => {
    expect(formatAcres(0.99)).toBe('0.99');
    expect(formatAcres(1)).toBe('1');
    expect(formatAcres(1.5)).toBe('1.5');
    expect(formatAcres(3.1416)).toBe('3.1416');
    expect(formatAcres(3.14160)).toBe('3.1416');
  });
  it('returns empty for null/empty/NaN', () => {
    expect(formatAcres(null)).toBe('');
    expect(formatAcres('')).toBe('');
    expect(formatAcres('foo')).toBe('');
  });
});

describe('slugify', () => {
  it('lowercases, ASCII-only, hyphen-separated, ≤60 chars', () => {
    expect(slugify('510 Walton Ln, Tyner, NC 27980')).toBe('510-walton-ln-tyner-nc-27980');
    expect(slugify('  --foo bar--  ')).toBe('foo-bar');
    expect(slugify('Café résumé')).toBe('cafe-resume');
    expect(slugify('')).toBe('deal');
    expect(slugify(null)).toBe('deal');
    const long = slugify('a'.repeat(200));
    expect(long.length).toBeLessThanOrEqual(60);
  });
});
