/**
 * customFieldsData.js
 * Phase 7: Custom field definitions — CRUD via Supabase.
 */
import { supabase } from './supabase';

/** Slugify a human name → a safe JSONB key */
export function toFieldKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

/** Fetch all field definitions for an org + entity type, ordered by sort_order. */
export async function fetchFieldDefs(orgId, entityType) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .select('*')
    .eq('organization_id', orgId)
    .eq('entity_type', entityType)
    .order('sort_order')
    .order('created_at');
  if (error) { console.error('fetchFieldDefs', error); return []; }
  return data || [];
}

/** Create a new field definition. Returns { data, error }. */
export async function createFieldDef(orgId, { name, entityType, fieldType, options, required = false }) {
  if (!supabase) return { error: 'no supabase' };
  const field_key = toFieldKey(name);
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .insert({
      organization_id: orgId,
      entity_type:     entityType,
      name,
      field_key,
      field_type:      fieldType,
      options:         options || null,
      required,
      sort_order:      Date.now(), // use timestamp as initial sort to preserve insertion order
    })
    .select()
    .single();
  return { data, error };
}

/** Update a field definition's name, options, or required flag. */
export async function updateFieldDef(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const allowed = ['name', 'options', 'required', 'sort_order'];
  const safe = {};
  for (const k of allowed) if (k in patch) safe[k] = patch[k];
  const { data, error } = await supabase
    .from('custom_field_definitions')
    .update(safe)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/** Delete a field definition. */
export async function deleteFieldDef(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('custom_field_definitions').delete().eq('id', id);
  return { error };
}
