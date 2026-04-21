import { INVESTORS } from '../data/investors';

const LS_KEY = 'lotline_investors';

export function loadInvestors() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    if (saved && saved.length) return saved;
  } catch {}
  // Seed from static data on first load
  const seeded = INVESTORS.map(inv => ({ ...inv }));
  localStorage.setItem(LS_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveInvestors(investors) {
  localStorage.setItem(LS_KEY, JSON.stringify(investors));
}

export function addInvestor(newInv) {
  const all = loadInvestors();
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
  saveInvestors(updated);
  return updated;
}
