/**
 * propertyData.js
 * Phase 20: Property data / ATTOM integration.
 *
 * Required env vars (edge function secrets):
 *   ATTOM_API_KEY   — ATTOM Data Solutions
 *   LOB_API_KEY     — Lob direct mail (optional)
 */
import { supabase } from './supabase';

// ── Property Lookups ───────────────────────────────────────────────────────

export async function lookupProperty(address, orgId, userId, dealId = null) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('property-lookup', {
    body: { address, orgId, userId, dealId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchPropertyLookups(orgId, { dealId, limit = 50 } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from('property_lookups')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (dealId) q = q.eq('deal_id', dealId);

  const { data } = await q;
  return data ?? [];
}

// ── Direct Mail ────────────────────────────────────────────────────────────

export async function sendDirectMail(orgId, userId, { name, contacts, templateId, returnAddress }) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('direct-mail-send', {
    body: { orgId, userId, name, contacts, templateId, returnAddress },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function fetchDirectMailJobs(orgId) {
  if (!supabase) return [];
  const { data } = await supabase
    .from('direct_mail_jobs')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatCurrency(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function formatSqft(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(value)) + ' sqft';
}
