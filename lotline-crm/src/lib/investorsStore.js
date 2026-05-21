import { INVESTORS } from '../data/investors';
import { supabase } from './supabase';

function lsKey(orgId) {
  return orgId ? `lotline_investors_${orgId}` : 'lotline_investors';
}

/**
 * Load investors from org-scoped localStorage.
 * Only seeds from static INVESTORS data for the LotLine Homes org (orgSlug === 'lotline-homes').
 * New tenants get an empty list.
 */
export function loadInvestors(orgId, orgSlug) {
  try {
    const saved = JSON.parse(localStorage.getItem(lsKey(orgId)));
    if (saved && saved.length) return saved;
  } catch {}
  // Only seed static LotLine investor data for the LotLine org
  if (orgSlug === 'lotline-homes') {
    const seeded = INVESTORS.map(inv => ({ ...inv }));
    localStorage.setItem(lsKey(orgId), JSON.stringify(seeded));
    return seeded;
  }
  return [];
}

export function saveInvestors(investors, orgId) {
  localStorage.setItem(lsKey(orgId), JSON.stringify(investors));
}

export function addInvestor(newInv, orgId, orgSlug) {
  const all = loadInvestors(orgId, orgSlug);
  const investor = {
    id: `inv-${Date.now()}`,
    name: newInv.name || '',
    contact: newInv.contact || '',
    email: newInv.email || '',
    phone: newInv.phone || '',
    type: newInv.type || 'Private Lender',
    activeDeals: 0,
    capitalInvested: 0,
    totalReturns: 0,
    roiPct: 0,
    roiDollars: 0,
    avgAnnualizedRoi: 0,
    preferredFinancing: newInv.preferredFinancing || '',
    standardTerms: newInv.standardTerms || '',
    notes: newInv.notes || '',
    deals: [],
  };
  const updated = [...all, investor];
  saveInvestors(updated, orgId);

  // Also persist to Supabase so new investors are visible to all org members
  if (supabase && orgId) {
    supabase.from('investors').insert({
      organization_id:    orgId,
      name:               investor.name,
      contact:            investor.contact,
      email:              investor.email,
      phone:              investor.phone,
      type:               investor.type,
      preferred_financing: investor.preferredFinancing,
      standard_terms:     investor.standardTerms,
      notes:              investor.notes,
    }).then(() => {});
  }

  return updated;
}

/**
 * Update an investor by id. Patches localStorage cache + Supabase row.
 * Returns the new array of investors.
 */
export async function updateInvestor(id, patch, orgId) {
  const all = loadInvestors(orgId);
  const updated = all.map(inv => String(inv.id) === String(id) ? { ...inv, ...patch } : inv);
  saveInvestors(updated, orgId);
  if (supabase && orgId) {
    const dbPatch = {};
    if (patch.name !== undefined)               dbPatch.name = patch.name;
    if (patch.contact !== undefined)            dbPatch.contact = patch.contact;
    if (patch.email !== undefined)              dbPatch.email = patch.email;
    if (patch.phone !== undefined)              dbPatch.phone = patch.phone;
    if (patch.type !== undefined)               dbPatch.type = patch.type;
    if (patch.preferredFinancing !== undefined) dbPatch.preferred_financing = patch.preferredFinancing;
    if (patch.standardTerms !== undefined)      dbPatch.standard_terms = patch.standardTerms;
    if (patch.notes !== undefined)              dbPatch.notes = patch.notes;
    // Structured standard terms — auto-populate fields in deal Financing tab
    if (patch.defaultScenarioType !== undefined)       dbPatch.default_scenario_type        = patch.defaultScenarioType || null;
    if (patch.defaultInterestRate !== undefined)       dbPatch.default_interest_rate        = patch.defaultInterestRate;
    if (patch.defaultHoldPeriodMonths !== undefined)   dbPatch.default_hold_period_months   = patch.defaultHoldPeriodMonths;
    if (patch.defaultTermMonths !== undefined)         dbPatch.default_term_months          = patch.defaultTermMonths;
    if (patch.defaultOriginationFeePct !== undefined)  dbPatch.default_origination_fee_pct  = patch.defaultOriginationFeePct;
    if (patch.defaultOriginationFeeType !== undefined) dbPatch.default_origination_fee_type = patch.defaultOriginationFeeType;
    if (patch.defaultOriginationFeeFlat !== undefined) dbPatch.default_origination_fee_flat = patch.defaultOriginationFeeFlat;
    if (patch.defaultPosition !== undefined)           dbPatch.default_position             = patch.defaultPosition;
    if (patch.defaultPreferredReturnPct !== undefined) dbPatch.default_preferred_return_pct = patch.defaultPreferredReturnPct;
    if (patch.defaultProfitSharePct !== undefined)     dbPatch.default_profit_share_pct     = patch.defaultProfitSharePct;
    if (patch.defaultPaymentTiming !== undefined)      dbPatch.default_payment_timing       = patch.defaultPaymentTiming;
    if (patch.defaultPaymentDueDay !== undefined)      dbPatch.default_payment_due_day      = patch.defaultPaymentDueDay;
    if (patch.defaultDrawFee !== undefined)            dbPatch.default_draw_fee             = patch.defaultDrawFee;
    if (patch.defaultServicingFee !== undefined)       dbPatch.default_servicing_fee        = patch.defaultServicingFee;
    if (patch.defaultLtcPct !== undefined)             dbPatch.default_ltc_pct              = patch.defaultLtcPct;
    if (patch.defaultMaxLoanAmount !== undefined)      dbPatch.default_max_loan_amount      = patch.defaultMaxLoanAmount;
    if (patch.defaultExtensionAvailable !== undefined) dbPatch.default_extension_available  = patch.defaultExtensionAvailable;
    if (patch.defaultExtensionMonths !== undefined)    dbPatch.default_extension_months     = patch.defaultExtensionMonths;
    if (patch.defaultExtensionFeePoints !== undefined) dbPatch.default_extension_fee_points = patch.defaultExtensionFeePoints;
    if (patch.termsNotes !== undefined)                dbPatch.terms_notes                  = patch.termsNotes;
    if (patch.defaultReturnType !== undefined)         dbPatch.default_return_type          = patch.defaultReturnType || null;
    if (patch.defaultUnderwritingFee !== undefined)    dbPatch.default_underwriting_fee     = patch.defaultUnderwritingFee;
    if (patch.defaultAttorneyDocFee !== undefined)     dbPatch.default_attorney_doc_fee     = patch.defaultAttorneyDocFee;
    if (patch.defaultAppraisalFee !== undefined)       dbPatch.default_appraisal_fee        = patch.defaultAppraisalFee;
    if (patch.defaultLegalFee !== undefined)           dbPatch.default_legal_fee            = patch.defaultLegalFee;
    if (Object.keys(dbPatch).length > 0) {
      const { error } = await supabase
        .from('investors')
        .update(dbPatch)
        .eq('id', id)
        .eq('organization_id', orgId);
      if (error) console.error('[investorsStore] updateInvestor failed:', error.message);
    }
  }
  return updated;
}

/**
 * Delete an investor entirely. Removes from localStorage cache and Supabase
 * Returns any active allocations the investor holds before deleting, because
 * deal_allocations.investor_id is ON DELETE RESTRICT and the delete would
 * otherwise fail.
 */
export async function deleteInvestor(investor, orgId) {
  const id = investor?.id;
  const all = loadInvestors(orgId);
  const next = all.filter(i => String(i.id) !== String(id));
  saveInvestors(next, orgId);

  if (supabase && orgId && id) {
    // Return any active allocations so the FK ON DELETE RESTRICT doesn't block.
    await supabase
      .from('deal_allocations')
      .update({
        status:     'returned',
        notes:      'Auto-returned: investor deleted from directory',
        updated_at: new Date().toISOString(),
      })
      .eq('investor_id', id)
      .neq('status', 'returned');

    const { error } = await supabase
      .from('investors')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId);
    if (error) console.error('[investorsStore] deleteInvestor failed:', error.message);
  }
  return next;
}
