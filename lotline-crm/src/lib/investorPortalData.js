/**
 * investorPortalData.js
 * All data-access functions for the investor-facing portal.
 * Every function goes through the same Supabase client used by the operator side.
 * RLS policies enforce row-level scoping automatically based on auth.uid().
 */
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Investor identity
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the investor record linked to the current auth user.
 * Returns { investor, error }.
 */
export async function fetchMyInvestor() {
  const { data, error } = await supabase
    .from('investor_users')
    .select('investor_id, investors(*)')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .single();
  if (error) return { investor: null, error };
  return { investor: data?.investors ?? null, error: null };
}

// ─────────────────────────────────────────────────────────────
// Deals
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all deals belonging to my investor (matched by investor name field).
 * RLS + the investor name join keeps this scoped.
 */
export async function fetchMyDeals(investorName) {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('investor', investorName)
    .eq('is_archived', false)
    .order('close_date', { ascending: true, nullsFirst: false });
  return { deals: data ?? [], error };
}

export async function fetchMyDeal(dealId, investorName) {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .eq('investor', investorName)
    .single();
  return { deal: data ?? null, error };
}

/**
 * Fetch distinct investor names from the deals table.
 * Used as a fallback when the investors table doesn't exist yet.
 */
export async function fetchInvestorNamesFromDeals() {
  const { data, error } = await supabase
    .from('deals')
    .select('investor')
    .not('investor', 'is', null)
    .neq('investor', '')
    .eq('is_archived', false);
  if (error) return { investors: [], error };
  const names = [...new Set((data ?? []).map(d => d.investor).filter(Boolean))].sort();
  return { investors: names.map(name => ({ id: name, name })), error: null };
}

// ─────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────

/** Investor: fetch my visible documents. */
export async function fetchMyDocuments(investorId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, deals(address)')
    .eq('investor_id', investorId)
    .eq('visible_to_investor', true)
    .order('created_at', { ascending: false });
  return { documents: data ?? [], error };
}

/** Operator: fetch all documents for a deal. */
export async function fetchDealDocuments(dealId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  return { documents: data ?? [], error };
}

/** Operator: fetch all documents for an investor. */
export async function fetchInvestorDocuments(investorId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, deals(address)')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false });
  return { documents: data ?? [], error };
}

/** Operator: upload a document to Supabase Storage and insert a record. */
export async function uploadDocument({ file, title, docType, dealId, investorId, visibleToInvestor }) {
  const ext = file.name.split('.').pop();
  const path = `${investorId ?? 'general'}/${Date.now()}-${title.replace(/\s+/g, '_')}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('investor-documents')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadErr) return { error: uploadErr };

  const { data: { publicUrl } } = supabase.storage
    .from('investor-documents')
    .getPublicUrl(path);

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('documents')
    .insert({
      deal_id: dealId ?? null,
      investor_id: investorId ?? null,
      uploaded_by: user.id,
      title,
      file_url: publicUrl,
      file_size_bytes: file.size,
      mime_type: file.type,
      doc_type: docType,
      visible_to_investor: visibleToInvestor ?? false,
    })
    .select()
    .single();
  return { document: data, error };
}

/** Toggle visible_to_investor flag on a document. */
export async function toggleDocumentVisibility(docId, visible) {
  const { error } = await supabase
    .from('documents')
    .update({ visible_to_investor: visible })
    .eq('id', docId);
  return { error };
}

/** Delete a document record (operator only). */
export async function deleteDocument(docId) {
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  return { error };
}

// ─────────────────────────────────────────────────────────────
// Deal Updates (construction feed)
// ─────────────────────────────────────────────────────────────

/** Investor: fetch updates for deals I'm invested in. */
export async function fetchMyDealUpdates(investorName) {
  const { data, error } = await supabase
    .from('deal_updates')
    .select('*, deals!inner(address, investor)')
    .eq('deals.investor', investorName)
    .eq('visibility', 'investor')
    .order('posted_at', { ascending: false });
  return { updates: data ?? [], error };
}

/** Operator: fetch all updates for a specific deal. */
export async function fetchDealUpdates(dealId) {
  const { data, error } = await supabase
    .from('deal_updates')
    .select('*, profiles(name)')
    .eq('deal_id', dealId)
    .order('posted_at', { ascending: false });
  return { updates: data ?? [], error };
}

/** Operator: post a new deal update. Photos are uploaded separately and URLs passed in. */
export async function postDealUpdate({ dealId, title, bodyMd, photoUrls, visibility = 'investor' }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('deal_updates')
    .insert({
      deal_id: dealId,
      posted_by: user.id,
      title,
      body_md: bodyMd,
      photos: photoUrls ?? [],
      visibility,
    })
    .select()
    .single();
  return { update: data, error };
}

/** Upload a photo for a deal update to Supabase Storage. Returns the public URL. */
export async function uploadUpdatePhoto(dealId, file) {
  const path = `updates/${dealId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from('investor-documents')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) return { url: null, error };
  const { data: { publicUrl } } = supabase.storage
    .from('investor-documents')
    .getPublicUrl(path);
  return { url: publicUrl, error: null };
}

/** Operator: delete a deal update. */
export async function deleteDealUpdate(updateId) {
  const { error } = await supabase.from('deal_updates').delete().eq('id', updateId);
  return { error };
}

// ─────────────────────────────────────────────────────────────
// Distributions
// ─────────────────────────────────────────────────────────────

/** Investor: fetch my distribution ledger. */
export async function fetchMyDistributions(investorId) {
  const { data, error } = await supabase
    .from('distributions')
    .select('*, deals(address)')
    .eq('investor_id', investorId)
    .order('date', { ascending: false });
  return { distributions: data ?? [], error };
}

/** Operator: fetch all distributions for a deal. */
export async function fetchDealDistributions(dealId) {
  const { data, error } = await supabase
    .from('distributions')
    .select('*, investors(name)')
    .eq('deal_id', dealId)
    .order('date', { ascending: false });
  return { distributions: data ?? [], error };
}

/** Operator: fetch all distributions for an investor. */
export async function fetchInvestorDistributions(investorId) {
  const { data, error } = await supabase
    .from('distributions')
    .select('*, deals(address)')
    .eq('investor_id', investorId)
    .order('date', { ascending: false });
  return { distributions: data ?? [], error };
}

/** Operator: add a distribution record. */
export async function addDistribution({ dealId, investorId, date, amount, type, wireReference, notes }) {
  const { data, error } = await supabase
    .from('distributions')
    .insert({ deal_id: dealId, investor_id: investorId, date, amount, type, wire_reference: wireReference, notes })
    .select()
    .single();
  return { distribution: data, error };
}

/** Operator: delete a distribution record. */
export async function deleteDistribution(id) {
  const { error } = await supabase.from('distributions').delete().eq('id', id);
  return { error };
}

// ─────────────────────────────────────────────────────────────
// Investment Interest (Available Investments)
// ─────────────────────────────────────────────────────────────

/** Investor: submit a "Reserve Interest" for a deal. */
export async function submitInvestmentInterest({ investorId, dealId, amount, notes }) {
  const { data, error } = await supabase
    .from('investment_interest')
    .insert({ investor_id: investorId, deal_id: dealId ?? null, amount, notes })
    .select()
    .single();
  return { interest: data, error };
}

/** Operator: fetch all investment interest submissions. */
export async function fetchAllInvestmentInterest() {
  const { data, error } = await supabase
    .from('investment_interest')
    .select('*, investors(name), deals(address)')
    .order('created_at', { ascending: false });
  return { interest: data ?? [], error };
}

/** Operator: update status of an interest submission. */
export async function updateInterestStatus(id, status) {
  const { error } = await supabase
    .from('investment_interest')
    .update({ status })
    .eq('id', id);
  return { error };
}

// ─────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────

/** Investor: fetch my inbox. */
export async function fetchMyMessages(investorId) {
  const { data, error } = await supabase
    .from('investor_messages')
    .select('*, profiles(name)')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false });
  return { messages: data ?? [], error };
}

/** Investor: mark a message as read. */
export async function markMessageRead(messageId) {
  const { error } = await supabase
    .from('investor_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
  return { error };
}

/** Operator: send a message to an investor. */
export async function sendInvestorMessage({ investorId, subject, body }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('investor_messages')
    .insert({ investor_id: investorId, sent_by: user.id, subject, body })
    .select()
    .single();
  return { message: data, error };
}

/** Operator: fetch all messages for a given investor. */
export async function fetchInvestorMessages(investorId) {
  const { data, error } = await supabase
    .from('investor_messages')
    .select('*, profiles(name)')
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false });
  return { messages: data ?? [], error };
}

// ─────────────────────────────────────────────────────────────
// Impersonation (operator "view as investor")
// ─────────────────────────────────────────────────────────────

export async function logImpersonationStart(investorId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('operator_impersonation_log')
    .insert({ operator_id: user.id, investor_id: investorId })
    .select()
    .single();
  return { logId: data?.id, error };
}

export async function logImpersonationEnd(logId) {
  const { error } = await supabase
    .from('operator_impersonation_log')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', logId);
  return { error };
}

// ─────────────────────────────────────────────────────────────
// Operators: manage investors table
// ─────────────────────────────────────────────────────────────

export async function fetchAllInvestors() {
  const { data, error } = await supabase
    .from('investors')
    .select('*')
    .order('name');
  return { investors: data ?? [], error };
}

export async function upsertInvestor(investor) {
  const { data, error } = await supabase
    .from('investors')
    .upsert(investor, { onConflict: 'id' })
    .select()
    .single();
  return { investor: data, error };
}

export async function linkInvestorUser(userId, investorId) {
  const { error } = await supabase
    .from('investor_users')
    .upsert({ user_id: userId, investor_id: investorId }, { onConflict: 'user_id' });
  return { error };
}

// ─────────────────────────────────────────────────────────────
// Math helpers (shared by both operator + investor views)
// ─────────────────────────────────────────────────────────────

/**
 * Compute headline portfolio numbers from a list of deals + distributions.
 * Returns { committed, deployed, returned, unrealizedGain, weightedIrr, nextDistribution }.
 */
export function computePortfolioMetrics(deals, distributions) {
  const committed   = deals.reduce((s, d) => s + (d.projected_irr ? (d.min_check_size ?? 0) : 0), 0);
  const deployed    = deals.reduce((s, d) => {
    const land  = d.land  ?? 0;
    const build = (d.mobile_home ?? 0) + (d.permits ?? 0) + (d.setup ?? 0) + (d.septic ?? 0) +
                  (d.well ?? 0) + (d.electric ?? 0) + (d.hvac ?? 0) + (d.clear_land ?? 0) +
                  (d.water_cost ?? 0) + (d.footers ?? 0) + (d.underpinning ?? 0) + (d.decks ?? 0) +
                  (d.driveway ?? 0) + (d.landscaping ?? 0) + (d.water_sewer ?? 0);
    return s + land + build;
  }, 0);
  const returned    = distributions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const unrealizedGain = deals.reduce((s, d) => {
    const arv = d.arv ?? 0;
    const costs = (d.land ?? 0) + (d.mobile_home ?? 0) + (d.permits ?? 0);
    const sellCost = arv * 0.045;
    return s + Math.max(0, arv - costs - sellCost);
  }, 0);

  // Simple weighted IRR: average of projected_irr weighted by ARV
  const totalArv = deals.reduce((s, d) => s + (d.arv ?? 0), 0);
  const weightedIrr = totalArv > 0
    ? deals.reduce((s, d) => s + (d.projected_irr ?? 0) * ((d.arv ?? 0) / totalArv), 0)
    : 0;

  // Next distribution: nearest projected_payout_date in the future
  const future = deals
    .filter(d => d.projected_payout_date && new Date(d.projected_payout_date) > new Date())
    .sort((a, b) => new Date(a.projected_payout_date) - new Date(b.projected_payout_date));
  const nextDistribution = future[0]?.projected_payout_date ?? null;

  return { committed, deployed, returned, unrealizedGain, weightedIrr, nextDistribution };
}

/**
 * Build CSV string from distributions array.
 */
export function distributionsToCsv(distributions) {
  const header = ['Date', 'Deal', 'Amount', 'Type', 'Wire Reference', 'Notes'];
  const rows = distributions.map(d => [
    d.date,
    d.deals?.address ?? '',
    d.amount,
    d.type,
    d.wire_reference ?? '',
    d.notes ?? '',
  ]);
  return [header, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
