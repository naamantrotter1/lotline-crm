/**
 * Tests for section layout merging logic in DealLeftColumn.
 * The merge must:
 *   1. Respect saved order + visibility
 *   2. Include any new DEFAULT_SECTIONS keys not yet in the saved data
 *   3. Not include keys that no longer exist in DEFAULT_SECTIONS
 */
import { describe, it, expect } from 'vitest';

// ── Extracted pure merge logic ─────────────────────────────────────────────────
const DEFAULT_SECTIONS = [
  { key: 'about',          label: 'About this deal', visible: true, order: 0 },
  { key: 'seller',         label: 'Seller / Owner',  visible: true, order: 1 },
  { key: 'financing',      label: 'Financing',       visible: true, order: 2 },
  { key: 'closing',        label: 'Closing',         visible: true, order: 3 },
  { key: 'cost_breakdown', label: 'Cost Breakdown',  visible: true, order: 4 },
];

function mergeSections(saved) {
  const savedMap = Object.fromEntries(saved.map(s => [s.key, s]));
  return DEFAULT_SECTIONS
    .map(def => savedMap[def.key]
      ? { ...def, visible: savedMap[def.key].visible, order: savedMap[def.key].order }
      : def
    )
    .sort((a, b) => a.order - b.order);
}

describe('mergeSections', () => {
  it('returns default order when saved is empty', () => {
    const result = mergeSections([]);
    expect(result.map(s => s.key)).toEqual(['about','seller','financing','closing','cost_breakdown']);
  });

  it('applies saved order', () => {
    const saved = [
      { key: 'about',          visible: true,  order: 4 },
      { key: 'seller',         visible: true,  order: 3 },
      { key: 'financing',      visible: true,  order: 2 },
      { key: 'closing',        visible: true,  order: 1 },
      { key: 'cost_breakdown', visible: true,  order: 0 },
    ];
    const result = mergeSections(saved);
    expect(result.map(s => s.key)).toEqual([
      'cost_breakdown','closing','financing','seller','about',
    ]);
  });

  it('applies saved visibility', () => {
    const saved = [
      { key: 'about',          visible: false, order: 0 },
      { key: 'seller',         visible: true,  order: 1 },
      { key: 'financing',      visible: false, order: 2 },
      { key: 'closing',        visible: true,  order: 3 },
      { key: 'cost_breakdown', visible: true,  order: 4 },
    ];
    const result = mergeSections(saved);
    const vis = Object.fromEntries(result.map(s => [s.key, s.visible]));
    expect(vis.about).toBe(false);
    expect(vis.financing).toBe(false);
    expect(vis.seller).toBe(true);
  });

  it('includes default sections missing from saved (new section added)', () => {
    // Simulate: saved only has 4 sections (closing was added later)
    const saved = [
      { key: 'about',          visible: true,  order: 0 },
      { key: 'seller',         visible: true,  order: 1 },
      { key: 'financing',      visible: true,  order: 2 },
      { key: 'cost_breakdown', visible: true,  order: 3 },
    ];
    const result = mergeSections(saved);
    const keys = result.map(s => s.key);
    expect(keys).toContain('closing');
  });

  it('preserves labels from DEFAULT_SECTIONS even when order is overridden', () => {
    const saved = [{ key: 'about', visible: true, order: 99 }];
    const result = mergeSections(saved);
    const about = result.find(s => s.key === 'about');
    expect(about.label).toBe('About this deal');
  });

  it('all 5 default sections are always present', () => {
    const result = mergeSections([]);
    expect(result).toHaveLength(5);
  });
});

describe('DEFAULT_SECTIONS', () => {
  it('all sections have required fields', () => {
    for (const s of DEFAULT_SECTIONS) {
      expect(s).toHaveProperty('key');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('visible');
      expect(s).toHaveProperty('order');
    }
  });

  it('order values are unique', () => {
    const orders = DEFAULT_SECTIONS.map(s => s.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('all sections are visible by default', () => {
    for (const s of DEFAULT_SECTIONS) {
      expect(s.visible).toBe(true);
    }
  });
});
