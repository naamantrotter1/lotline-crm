/**
 * dedupeData.js
 * Phase 18: Contact deduplication data layer.
 */
import { supabase } from './supabase';

// ── Candidates ─────────────────────────────────────────────────────────────

export async function fetchDedupeCandidates(orgId, { status = 'pending' } = {}) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('dedupe_candidates')
    .select(`
      *,
      contact_a:contacts!contact_a_id(id, first_name, last_name, email, phone, address, created_at, lead_source, status),
      contact_b:contacts!contact_b_id(id, first_name, last_name, email, phone, address, created_at, lead_source, status)
    `)
    .eq('organization_id', orgId)
    .eq('status', status)
    .order('score', { ascending: false })
    .limit(200);
  return data ?? [];
}

/**
 * Scan the org's contacts for duplicates and insert/update dedupe_candidates.
 * Uses edge function to avoid scanning thousands of contacts client-side.
 */
export async function runDedupesScan(orgId) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('dedupe-scan', {
    body: { orgId },
  });
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Merge contact B into contact A. Keeps contact A, deletes contact B.
 * Uses edge function which moves all related records.
 */
export async function mergeContacts(candidateId, keepId, mergeId, orgId, userId) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('dedupe-merge', {
    body: { candidateId, keepId, mergeId, orgId, userId },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function dismissCandidate(id, userId) {
  if (!supabase) return;
  await supabase.from('dedupe_candidates').update({
    status: 'dismissed',
    resolved_by: userId,
    resolved_at: new Date().toISOString(),
  }).eq('id', id);
}
