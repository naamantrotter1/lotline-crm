/**
 * Org-scoped Supabase access for the Home Models catalog.
 * Replaces the per-browser localStorage keys `homeModels_data_v2` and
 * `hiddenOrderHomeIds` (see migration 123_home_models.sql).
 */
import { supabase } from './supabase';
import { HOME_MODELS } from '../data/homeModels';

function rowToModel(row) {
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    model: row.model,
    sections: row.sections,
    beds: row.beds,
    baths: Number(row.baths),
    sqft: row.sqft,
    price: Number(row.price),
    link: row.link || '',
  };
}

export async function fetchHomeModels(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from('home_models')
    .select('*')
    .eq('organization_id', orgId)
    .order('manufacturer', { ascending: true })
    .order('model', { ascending: true });
  if (error) {
    console.warn('[homeModelsData] fetch error:', error.message);
    return [];
  }
  return (data || []).map(rowToModel);
}

/** First-time seed: if the org has no home_models rows, copy the bundled
 *  HOME_MODELS catalog into Supabase so the page isn't blank for new orgs.
 *  Safe to call repeatedly — bails as soon as we see existing rows. */
export async function seedHomeModelsIfEmpty(orgId) {
  if (!supabase || !orgId) return [];
  const { count } = await supabase
    .from('home_models')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);
  if (count && count > 0) return [];
  const rows = HOME_MODELS.map(m => ({
    organization_id: orgId,
    manufacturer: m.manufacturer,
    model: m.model,
    sections: m.sections,
    beds: m.beds,
    baths: m.baths,
    sqft: m.sqft,
    price: m.price,
    link: m.link || null,
  }));
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from('home_models')
    .insert(rows)
    .select('*');
  if (error) {
    console.warn('[homeModelsData] seed error:', error.message);
    return [];
  }
  return (data || []).map(rowToModel);
}

export async function createHomeModel(orgId, model) {
  if (!supabase || !orgId) return { error: 'no supabase / orgId' };
  const { data, error } = await supabase
    .from('home_models')
    .insert({
      organization_id: orgId,
      manufacturer: model.manufacturer,
      model: model.model,
      sections: model.sections,
      beds: model.beds ?? 0,
      baths: model.baths ?? 0,
      sqft: model.sqft ?? 0,
      price: model.price ?? 0,
      link: model.link || null,
    })
    .select('*')
    .single();
  if (error) return { error };
  return { data: rowToModel(data) };
}

export async function updateHomeModel(id, model) {
  if (!supabase || !id) return { error: 'no supabase / id' };
  const { data, error } = await supabase
    .from('home_models')
    .update({
      manufacturer: model.manufacturer,
      model: model.model,
      sections: model.sections,
      beds: model.beds ?? 0,
      baths: model.baths ?? 0,
      sqft: model.sqft ?? 0,
      price: model.price ?? 0,
      link: model.link || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { error };
  return { data: rowToModel(data) };
}

export async function deleteHomeModel(id) {
  if (!supabase || !id) return { error: 'no supabase / id' };
  const { error } = await supabase.from('home_models').delete().eq('id', id);
  return { error };
}

// ── Hidden-from-Order-Home name set ─────────────────────────────────────────

export async function fetchHiddenOrderHomeNames(orgId) {
  if (!supabase || !orgId) return new Set();
  const { data, error } = await supabase
    .from('home_model_hidden_names')
    .select('name')
    .eq('organization_id', orgId);
  if (error) {
    console.warn('[homeModelsData] hidden names fetch error:', error.message);
    return new Set();
  }
  return new Set((data || []).map(r => r.name));
}

export async function setOrderHomeHidden(orgId, name, hidden) {
  if (!supabase || !orgId || !name) return;
  if (hidden) {
    await supabase
      .from('home_model_hidden_names')
      .upsert({ organization_id: orgId, name }, { onConflict: 'organization_id,name' });
  } else {
    await supabase
      .from('home_model_hidden_names')
      .delete()
      .eq('organization_id', orgId)
      .eq('name', name);
  }
}
