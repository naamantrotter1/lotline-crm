/**
 * Pooled Loan data layer — reads/writes via Supabase RLS.
 * A pooled loan is a single loan agreement linked to multiple deals.
 * Interest accrues on the full pool amount regardless of draws.
 */
import { supabase } from './supabase';

const LOAN_FIELDS = `
  id, organization_id, name, lender_name, lender_contact_name,
  lender_contact_email, lender_contact_phone,
  total_pool, interest_rate, term_months, start_date, maturity_date,
  profit_participation_pct, notes, created_at, updated_at
`.trim();

const ALLOC_FIELDS = `
  id, pooled_loan_id, deal_id, allocated_amount, draw_date, notes, created_at
`.trim();

/** Monthly interest on the full pool. */
export function monthlyInterest(loan) {
  return (loan.total_pool * loan.interest_rate) / 12;
}

/** Annual interest on the full pool. */
export function annualInterest(loan) {
  return loan.total_pool * loan.interest_rate;
}

/** Sum of all deal allocations for a loan. */
export function totalAllocated(allocations) {
  return allocations.reduce((s, a) => s + (parseFloat(a.allocated_amount) || 0), 0);
}

/**
 * Attributed monthly interest for one deal allocation.
 * Prorated by share of total allocated (not pool size).
 */
export function dealAttributedInterest(loan, allocations, dealId) {
  const total = totalAllocated(allocations);
  if (!total) return 0;
  const alloc = allocations.find(a => a.deal_id === dealId);
  if (!alloc) return 0;
  return (parseFloat(alloc.allocated_amount) / total) * monthlyInterest(loan);
}

/** List all pooled loans for an org. */
export async function fetchPooledLoans(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from('pooled_loans')
    .select(LOAN_FIELDS)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[pooledLoans] fetch error', error); return []; }
  return data || [];
}

/** Fetch one pooled loan with its deal allocations. */
export async function fetchPooledLoan(id) {
  if (!supabase || !id) return null;
  const [loanRes, allocRes] = await Promise.all([
    supabase.from('pooled_loans').select(LOAN_FIELDS).eq('id', id).single(),
    supabase.from('pooled_loan_deal_allocations').select(ALLOC_FIELDS).eq('pooled_loan_id', id).order('created_at'),
  ]);
  if (loanRes.error) return null;
  return { ...loanRes.data, allocations: allocRes.data || [] };
}

/** Create a new pooled loan. Returns { data, error }. */
export async function createPooledLoan(orgId, fields) {
  if (!supabase) return { error: 'No Supabase client' };
  const { data, error } = await supabase
    .from('pooled_loans')
    .insert({ organization_id: orgId, ...fields })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { data };
}

/** Update a pooled loan. Returns { error? }. */
export async function updatePooledLoan(id, fields) {
  if (!supabase) return { error: 'No Supabase client' };
  const { error } = await supabase
    .from('pooled_loans')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? { error: error.message } : {};
}

/** Delete a pooled loan (cascades to allocations). */
export async function deletePooledLoan(id) {
  if (!supabase) return { error: 'No Supabase client' };
  const { error } = await supabase.from('pooled_loans').delete().eq('id', id);
  return error ? { error: error.message } : { ok: true };
}

/** Upsert a deal allocation on a pooled loan. */
export async function upsertAllocation(pooledLoanId, dealId, allocatedAmount, opts = {}) {
  if (!supabase) return { error: 'No Supabase client' };
  const existing = await supabase
    .from('pooled_loan_deal_allocations')
    .select('id')
    .eq('pooled_loan_id', pooledLoanId)
    .eq('deal_id', dealId)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from('pooled_loan_deal_allocations')
      .update({ allocated_amount: allocatedAmount, ...opts })
      .eq('id', existing.data.id);
    return error ? { error: error.message } : { ok: true };
  }
  const { error } = await supabase
    .from('pooled_loan_deal_allocations')
    .insert({ pooled_loan_id: pooledLoanId, deal_id: dealId, allocated_amount: allocatedAmount, ...opts });
  return error ? { error: error.message } : { ok: true };
}

/** Remove a deal allocation. */
export async function removeAllocation(pooledLoanId, dealId) {
  if (!supabase) return { error: 'No Supabase client' };
  const { error } = await supabase
    .from('pooled_loan_deal_allocations')
    .delete()
    .eq('pooled_loan_id', pooledLoanId)
    .eq('deal_id', dealId);
  return error ? { error: error.message } : { ok: true };
}

/**
 * Fetch all pooled loans that have an allocation for a given deal_id.
 * Used by the deal financing tab.
 */
export async function fetchPooledLoansForDeal(dealId, orgId) {
  if (!supabase || !dealId) return [];
  let q = supabase
    .from('pooled_loan_deal_allocations')
    .select(`${ALLOC_FIELDS}, pooled_loans(${LOAN_FIELDS})`)
    .eq('deal_id', dealId);
  const { data, error } = await q;
  if (error) { console.error('[pooledLoans] deal fetch error', error); return []; }
  return (data || []).map(r => ({
    allocation: { id: r.id, allocated_amount: r.allocated_amount, draw_date: r.draw_date, notes: r.notes },
    loan: r.pooled_loans,
  }));
}

/** Build a payment schedule array for a loan (one entry per month). */
export function buildPaymentSchedule(loan) {
  if (!loan.start_date || !loan.term_months) return [];
  const monthly = monthlyInterest(loan);
  const start = new Date(loan.start_date);
  return Array.from({ length: loan.term_months }, (_, i) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    return {
      month: i + 1,
      date: d.toISOString().slice(0, 7), // YYYY-MM
      interest: monthly,
    };
  });
}
