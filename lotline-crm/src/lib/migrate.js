/**
 * One-time migration: pushes all existing localStorage deals to Supabase.
 * Runs automatically on first load after Supabase is configured.
 */
import { supabase } from './supabase';
import { saveDeal } from './dealsSync';

const MIGRATED_KEY = 'lotline_migrated_v1';

export async function migrateToSupabase() {
  if (!supabase) return;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  try {
    // Gather all deals from localStorage
    const deals = JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]');
    if (deals.length === 0) { localStorage.setItem(MIGRATED_KEY, '1'); return; }

    // Apply any per-deal override keys that were saved separately
    const merged = deals.map(deal => {
      const id = deal.id;
      const stageOverride = localStorage.getItem(`lotline_deal_stage_${id}`);
      const subdivide     = localStorage.getItem(`lotline_subdivide_${id}`);
      const landClearing  = localStorage.getItem(`lotline_land_clearing_${id}`);
      return {
        ...deal,
        ...(stageOverride   ? { stage: stageOverride }         : {}),
        ...(subdivide        ? { subdividable: subdivide }      : {}),
        ...(landClearing     ? { landClearing: landClearing }   : {}),
      };
    });

    // Migrate county data
    try {
      const countyData = JSON.parse(localStorage.getItem('countyDatabase_data') || '{}');
      const countyRows = Object.entries(countyData).map(([countyName, data]) => ({
        county_name: countyName,
        state: data.state || '',
        data,
      }));
      if (countyRows.length > 0) {
        await supabase.from('county_data').upsert(countyRows, { onConflict: 'county_name,state' });
      }
    } catch {}

    // Push deals one by one (fire and collect errors)
    const errors = [];
    for (const deal of merged) {
      try { saveDeal(deal); } catch (e) { errors.push(e); }
    }

    if (errors.length === 0) {
      localStorage.setItem(MIGRATED_KEY, '1');
      console.log(`[migrate] Migrated ${merged.length} deals to Supabase.`);
    } else {
      console.warn('[migrate] Some deals failed to migrate:', errors);
    }
  } catch (e) {
    console.warn('[migrate] Migration failed:', e.message);
  }
}
