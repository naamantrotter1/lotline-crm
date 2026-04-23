import { INVESTORS } from '../data/investors';

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
  return updated;
}
