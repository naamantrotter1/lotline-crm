import { LAND_DEALS, DEAL_OVERVIEW_DEALS } from '../data/deals';

const LS_KEY = 'lotline_custom_deals';
const SEED_KEY = 'lotline_deals_seeded_v2';

export function seedDeals() {
  if (localStorage.getItem(SEED_KEY)) return;
  const existing = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } })();
  const existingIds = new Set(existing.map(d => String(d.id)));
  const toSeed = [...DEAL_OVERVIEW_DEALS, ...LAND_DEALS].filter(d => !existingIds.has(String(d.id)));
  localStorage.setItem(LS_KEY, JSON.stringify([...existing, ...toSeed]));
  localStorage.setItem(SEED_KEY, '1');
}
