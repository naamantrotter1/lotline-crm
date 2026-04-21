import { LAND_DEALS, DEAL_OVERVIEW_DEALS } from '../data/deals';

const LS_KEY = 'lotline_custom_deals';
const SEED_KEY = 'lotline_deals_seeded_v2';
const MIGRATION_KEY = 'lotline_migration_contract_signed_at_v2';

export function seedDeals() {
  if (localStorage.getItem(SEED_KEY)) return;
  const existing = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } })();
  const existingIds = new Set(existing.map(d => String(d.id)));
  const toSeed = [...DEAL_OVERVIEW_DEALS, ...LAND_DEALS].filter(d => !existingIds.has(String(d.id)));
  localStorage.setItem(LS_KEY, JSON.stringify([...existing, ...toSeed]));
  localStorage.setItem(SEED_KEY, '1');
}

// One-time migration: backfill contractSignedAt for existing deals
export function migrateContractSignedAt() {
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const APRIL = '2026-04-01T12:00:00.000Z';
  const MARCH = '2026-03-15T12:00:00.000Z';

  // Due Diligence deals added in April (all except Blue Newkirk and Henry Jenkins)
  const aprilIds = new Set([
    'deal-005', 'deal-006', 'deal-007', 'deal-008', 'deal-009',
    'deal-010', 'deal-011', 'deal-013', 'deal-014', 'deal-015',
    'deal-016', 'deal-017', 'deal-018', 'deal-019',
  ]);

  const deals = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } })();
  const updated = deals.map(d => {
    // Only stamp Deal Overview deals (not land-acquisition pipeline)
    if (d.pipeline === 'land-acquisition') return d;
    return { ...d, contractSignedAt: aprilIds.has(String(d.id)) ? APRIL : MARCH };
  });

  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  localStorage.setItem(MIGRATION_KEY, '1');
}
