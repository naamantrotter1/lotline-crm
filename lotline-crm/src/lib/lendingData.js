/**
 * Org-scoped Supabase access for the Lending page and the Investor Portal's
 * "Available Investments" tab. Replaces the localStorage-only storage of
 * loan requests and partnership submissions so teammates and connected
 * investors all see the same data.
 *
 * Tables live in migration 122_lending_and_partnerships.sql.
 */
import { supabase } from './supabase';

// ── Loan requests ───────────────────────────────────────────────────────────

export async function fetchLendingRequests(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from('lending_requests')
    .select('*')
    .eq('organization_id', orgId)
    .order('date_submitted', { ascending: false });
  if (error) {
    console.warn('[lendingData] fetchLendingRequests error:', error.message);
    return [];
  }
  return (data || []).map(rowToLoan);
}

export async function createLendingRequest(orgId, loan) {
  if (!supabase || !orgId) return { error: 'no supabase / orgId' };
  const ref = loan.ref || ('LND-' + Math.floor(1000 + Math.random() * 9000));
  const row = {
    organization_id: orgId,
    ref,
    address: loan.address || '',
    loan_amount: loan.loanAmount ? Number(loan.loanAmount) : null,
    loan_type: loan.loanType || null,
    property_type: loan.propertyType || null,
    purchase_price: loan.purchasePrice ? Number(loan.purchasePrice) : null,
    arv: loan.arv ? Number(loan.arv) : null,
    credit_score: loan.creditScore || null,
    exit_strategy: loan.exitStrategy || null,
    notes: loan.notes || null,
    costs: loan.costs || {},
    date_submitted: new Date().toISOString().slice(0, 10),
    status: loan.status || 'Pending Review',
  };
  const { data, error } = await supabase
    .from('lending_requests')
    .insert(row)
    .select('*')
    .single();
  if (error) return { error };
  return { data: rowToLoan(data) };
}

function rowToLoan(row) {
  return {
    id: row.id,
    ref: row.ref,
    address: row.address,
    loanAmount: row.loan_amount,
    loanType: row.loan_type,
    propertyType: row.property_type,
    purchasePrice: row.purchase_price,
    arv: row.arv,
    creditScore: row.credit_score,
    exitStrategy: row.exit_strategy,
    notes: row.notes,
    costs: row.costs || {},
    dateSubmitted: row.date_submitted,
    status: row.status,
  };
}

// ── Partnerships ───────────────────────────────────────────────────────────

export async function fetchLendingPartnerships(orgId) {
  if (!supabase || !orgId) return [];
  const { data, error } = await supabase
    .from('lending_partnerships')
    .select('*')
    .eq('organization_id', orgId)
    .order('date_submitted', { ascending: false });
  if (error) {
    console.warn('[lendingData] fetchLendingPartnerships error:', error.message);
    return [];
  }
  return (data || []).map(rowToPartnership);
}

export async function createLendingPartnership(orgId, partner) {
  if (!supabase || !orgId) return { error: 'no supabase / orgId' };
  const ref = partner.ref || ('PRT-' + Math.floor(1000 + Math.random() * 9000));
  const row = {
    organization_id: orgId,
    ref,
    address: partner.address || '',
    property_type: partner.propertyType || null,
    deal_type: partner.dealType || null,
    purchase_price: partner.purchasePrice ? Number(partner.purchasePrice) : null,
    repair_costs: partner.repairCosts ? Number(partner.repairCosts) : null,
    arv: partner.arv ? Number(partner.arv) : null,
    projected_profit: partner.projectedProfit ? Number(partner.projectedProfit) : null,
    needs: partner.needs || [],
    split: partner.split || null,
    your_role: partner.yourRole || null,
    summary: partner.summary || null,
    deal_flyer_name: partner.dealFlyerName || null,
    supporting_docs_name: partner.supportingDocsName || null,
    costs: partner.costs || {},
    date_submitted: new Date().toISOString().slice(0, 10),
    status: partner.status || 'Under Review',
  };
  const { data, error } = await supabase
    .from('lending_partnerships')
    .insert(row)
    .select('*')
    .single();
  if (error) return { error };
  return { data: rowToPartnership(data) };
}

function rowToPartnership(row) {
  return {
    id: row.id,
    ref: row.ref,
    address: row.address,
    propertyType: row.property_type,
    dealType: row.deal_type,
    purchasePrice: row.purchase_price,
    repairCosts: row.repair_costs,
    arv: row.arv,
    projectedProfit: row.projected_profit,
    needs: row.needs || [],
    split: row.split,
    yourRole: row.your_role,
    summary: row.summary,
    dealFlyerName: row.deal_flyer_name,
    supportingDocsName: row.supporting_docs_name,
    costs: row.costs || {},
    dateSubmitted: row.date_submitted,
    status: row.status,
  };
}
