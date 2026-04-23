import { LAND_DEALS, DEAL_OVERVIEW_DEALS } from '../data/deals';
import { lsKey } from '../lib/dealsSync';

// ── These functions are called from DealsContext, NOT at module level.
// ── They only run when orgSlug === 'lotline-homes', so new tenants never see
// ── LotLine's static seed data.

export function seedDeals(orgId) {
  const seedKey = `lotline_deals_seeded_v2_${orgId}`;
  if (localStorage.getItem(seedKey)) return;
  const key = lsKey(orgId);
  const existing = (() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } })();
  const existingIds = new Set(existing.map(d => String(d.id)));
  const toSeed = [...DEAL_OVERVIEW_DEALS, ...LAND_DEALS].filter(d => !existingIds.has(String(d.id)));
  localStorage.setItem(key, JSON.stringify([...existing, ...toSeed]));
  localStorage.setItem(seedKey, '1');
}

// One-time migration: backfill contractSignedAt for existing deals in this org's LS cache
export function migrateContractSignedAt(orgId) {
  const migrationKey = `lotline_migration_contract_signed_at_v2_${orgId}`;
  if (localStorage.getItem(migrationKey)) return;

  const APRIL = '2026-04-01T12:00:00.000Z';
  const MARCH = '2026-03-15T12:00:00.000Z';

  const aprilIds = new Set([
    'deal-005', 'deal-006', 'deal-007', 'deal-008', 'deal-009',
    'deal-010', 'deal-011', 'deal-013', 'deal-014', 'deal-015',
    'deal-016', 'deal-017', 'deal-018', 'deal-019',
  ]);

  const key = lsKey(orgId);
  const deals = (() => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } })();
  const updated = deals.map(d => {
    if (d.pipeline === 'land-acquisition') return d;
    return { ...d, contractSignedAt: aprilIds.has(String(d.id)) ? APRIL : MARCH };
  });

  localStorage.setItem(key, JSON.stringify(updated));
  localStorage.setItem(migrationKey, '1');
}
