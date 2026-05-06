/**
 * One-time migration: moves stale localStorage data into Supabase
 * then purges the obsolete keys.
 *
 * Runs once per user after login (guarded by MIGRATION_KEY in localStorage).
 * Safe to call multiple times — no-ops after first successful run.
 */
import { supabase } from './supabase';

const MIGRATION_KEY = 'supabase_migration_v4_complete';

// Keys / patterns that are safe to delete after migration
const STALE_PATTERNS = [
  /^dd_deal-/, /^dd_land-/, /^dd_custom-/,
  /^lotline_deal_stage_/,
  /^lotline_deals_[a-f0-9-]{36}$/,   // uuid-scoped deal cache
  /^lotline_investors/,
  /^nf_assignments/,
  /^nf_extra_investors/,
  /^lotline_notes_/,
  /^lotline_subdivide_/,
  /^lotline_deleted_deal_ids_/,
  /^lotline_migrated/,
  /^lotline_migration_/,
  /^lotline_deals_seeded_v2$/,
];

export async function runLocalStorageMigration(orgId) {
  if (localStorage.getItem(MIGRATION_KEY)) return;
  if (!supabase || !orgId) return;

  console.log('[migration] Running localStorage → Supabase migration v4...');
  const migrations = [];

  // ── Migrate deal stages ──────────────────────────────────────────────────
  Object.keys(localStorage)
    .filter(k => k.startsWith('lotline_deal_stage_'))
    .forEach(k => {
      const dealId = k.replace('lotline_deal_stage_', '');
      const stage  = localStorage.getItem(k);
      if (dealId && stage) {
        migrations.push(
          supabase.from('deals').update({ stage }).eq('id', dealId)
        );
      }
    });

  // ── Migrate subdivide toggles ────────────────────────────────────────────
  Object.keys(localStorage)
    .filter(k => k.startsWith('lotline_subdivide_'))
    .forEach(k => {
      const dealId = k.replace('lotline_subdivide_', '');
      const val    = localStorage.getItem(k);
      if (dealId && val !== null) {
        const subdivide = val === 'true' || val === 'Yes';
        migrations.push(
          supabase.from('deals').update({ subdivide }).eq('id', dealId)
        );
      }
    });

  // ── Migrate DD milestone checkboxes ─────────────────────────────────────
  const milestoneMap = {};
  Object.keys(localStorage)
    .filter(k => /^dd_(deal|land|custom)-/.test(k))
    .forEach(k => {
      const withoutPrefix = k.replace(/^dd_/, '');
      const isDate  = withoutPrefix.endsWith('_date');
      const isCont  = withoutPrefix.endsWith('_cont');
      const trimmed = (isDate || isCont) ? withoutPrefix.slice(0, -5) : withoutPrefix;
      const match   = trimmed.match(/^((deal|land|custom)-[\w-]+?)_(.+)$/);
      if (!match) return;
      const [, dealId,, milestoneKey] = match;
      const key = `${dealId}::${milestoneKey}`;
      if (!milestoneMap[key]) milestoneMap[key] = { dealId, milestoneKey, orgId };
      const val = localStorage.getItem(k);
      if (isDate) milestoneMap[key].completed_date = val || null;
      else if (isCont) milestoneMap[key].notes = val || null;
      else milestoneMap[key].status = val || 'not_started';
    });

  const rows = Object.values(milestoneMap).map(m => ({
    organization_id: m.orgId,
    deal_id:         m.dealId,
    milestone_key:   m.milestoneKey,
    status:          m.status       || 'not_started',
    completed_date:  m.completed_date || null,
    notes:           m.notes        || null,
  }));

  if (rows.length > 0) {
    migrations.push(
      supabase.from('deal_milestones')
        .upsert(rows, { onConflict: 'deal_id,milestone_key' })
    );
  }

  await Promise.allSettled(migrations);

  // ── Purge stale keys ─────────────────────────────────────────────────────
  let purged = 0;
  Object.keys(localStorage).forEach(key => {
    if (STALE_PATTERNS.some(p => p.test(key))) {
      localStorage.removeItem(key);
      purged++;
    }
  });

  localStorage.setItem(MIGRATION_KEY, 'true');
  console.log(`[migration] v4 complete. Purged ${purged} stale keys.`);
}
