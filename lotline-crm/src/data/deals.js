/**
 * Compute the Total Cost of Capital for a deal when a Hard Money financing
 * scenario is active. Returns 0 for Cash / no scenario / missing data.
 * Reads from deal.scenarioData (populated by the Financing tab).
 */
export function computeCostOfCapital(deal) {
  const sd = deal?.scenarioData;
  if (!sd) return 0;
  const financing = (deal?.financing || '').toLowerCase();
  if (!financing.includes('hard money')) return 0;
  const loanFallback = deal.totalActual || (deal.land || 0) + (deal.mobileHome || 0);
  const loan = sd.loanAmountOverride || loanFallback;
  if (!loan) return 0;
  const monthlyInterest = loan * ((sd.interestRate || 0) / 100) / 12;
  const holdMonths = sd.holdPeriod || 0;
  const origFee = (sd.originationFeeType === 'percentage' || !sd.originationFeeType)
    ? loan * ((sd.originationFeePct || 0) / 100)
    : (sd.originationFeeFlat || 0);
  const servicingFee = sd.servicingFeeType === 'percentage'
    ? loan * ((sd.servicingFeePct || 0) / 100)
    : (sd.servicingFeeFlat || 0);
  const otherFees = (sd.drawFeeHm || 0) + (sd.underwritingFee || 0) + (sd.attorneyDocFee || 0);
  return (monthlyInterest * holdMonths) + origFee + servicingFee + otherFees;
}

/**
 * Calculate net profit for a deal.
 *
 * When costBreakdownV2 is enabled and actual cost data is available,
 * pass totalActualOverride (= deal_cost_summary_view.total_actual).
 * When not provided, falls back to legacy column sum (pre-migration behavior,
 * or when the feature flag is off — guaranteed identical math).
 *
 * When a Hard Money financing scenario is active, Total Cost of Capital
 * (interest + origination + closing fees) is deducted from net profit.
 */
export function calcNetProfit(deal, totalActualOverride) {
  const totalCosts = totalActualOverride != null
    ? totalActualOverride
    // Use cost-lines total when DealsContext has enriched the deal object.
    // Falls back to legacy flat columns only for seeded/unsynced deals that
    // have not yet been enriched (e.g. localStorage-only deals).
    : deal.totalActual != null
    ? Number(deal.totalActual)
    : (deal.land || 0) +
      (deal.mobileHome || 0) +
      (deal.hudEngineer || 0) +
      (deal.percTest || 0) +
      (deal.survey || 0) +
      (deal.footers || 0) +
      (deal.setup || 0) +
      (deal.clearLand || 0) +
      (deal.water || 0) +
      (deal.septic || 0) +
      (deal.electric || 0) +
      (deal.hvac || 0) +
      (deal.underpinning || 0) +
      (deal.decks || 0) +
      (deal.driveway || 0) +
      (deal.landscaping || 0) +
      (deal.waterSewer || 0) +
      (deal.mailbox || 0) +
      (deal.gutters || 0) +
      (deal.photos || 0) +
      (deal.mobileTax || 0) +
      (deal.staging || 0);

  const arv = deal.arv || 0;
  const coc = computeCostOfCapital(deal);

  return arv - totalCosts - arv * ((deal.sellingCostPct || 4.5) / 100) - (deal.holdingMonths || 4) * (deal.holdingPerMonth || 250) - coc;
}

export const DEAL_OVERVIEW_DEALS = [
  // Contract Signed (3)
  {
    id: 'deal-001', pipeline: 'deal-overview', stage: 'Contract Signed',
    address: '577 Colonial Landing Rd SE, Bolivia, NC 28422', county: 'Brunswick', state: 'NC', zip: '28422', acreage: 0.6,
    grade: 'A', tags: ['Land Clearing'], investor: null, financing: 'Hard Money (Land + Home)',
    arv: 255000,
    land: 30000, mobileHome: 80000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 4000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '168DB040', sellerName: 'Kevin Lulendo', ownerName: 'NEWTON PAUL HENRY',
    leadSource: 'Wholesaler', ownerType: 'Wholesaler',
    contractDate: '2026-03-08',
    notes: 'Grade A. Contract Signed. Land Clearing stage. Hard Money (Land + Home). Funder: TBD.',
    lat: 34.0612, lng: -78.2381,
  },
  {
    id: 'deal-002', pipeline: 'deal-overview', stage: 'Contract Signed',
    address: '569 Colonial Landing, Bolivia, NC 28422', county: 'Brunswick', state: 'NC', zip: '28422', acreage: 0.68,
    grade: 'A', tags: ['Land Clearing'], investor: null, financing: 'Hard Money (Land + Home)',
    arv: 255000,
    land: 30000, mobileHome: 80000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 4500, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '168DB041', sellerName: 'Kevin Lulendo', ownerName: 'NEWTON PAUL HENRY',
    leadSource: 'Wholesaler', ownerType: 'Owner',
    contractDate: '2026-03-08',
    notes: 'May already have perc test done',
    lat: 34.0598, lng: -78.2415,
  },
  {
    id: 'deal-003', pipeline: 'deal-overview', stage: 'Contract Signed',
    address: '236 Woods Ct, Bolivia, NC 28422', county: 'Brunswick', state: 'NC', zip: '28422', acreage: 56,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Hard Money (Land + Home)',
    arv: 245000,
    land: 30000, mobileHome: 76000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 5000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.13, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '152MA006', sellerName: 'Kevin Lulendo', ownerName: 'NEWTON PAUL HENRY',
    leadSource: 'Wholesaler', ownerType: 'Owner',
    contractDate: '2026-03-08',
    notes: '',
    lat: 34.0579, lng: -78.2440,
  },

  // Due Diligence (16)
  {
    id: 'deal-004', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Blue Newkirk Rd, Magnolia, NC 28453', county: 'Duplin', state: 'NC', zip: '28453', acreage: 4,
    grade: 'A', tags: ['Subdivide'], investor: 'Atium Build Group LLC', financing: 'Hard Money (Land + Home)',
    arv: 260000,
    land: 48000, mobileHome: 75000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 0, water: 1600, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.04, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '12-418--', ownerName: 'WHELCHEL, JOHN E JR & WIFE WHELCHEL, MARY',
    leadSource: 'FB Market Place', ownerType: 'Wholesaler', utilityScenario: 'Septic Needed', subdividable: true,
    closingAttorney: 'Gold Law, PA', closingAttorneyPhone: '919-654-6224',
    closingAttorneyAddress: '309 W Millbrook Rd Suite 171, Raleigh, NC 27609',
    contractDate: '2026-03-31', closeDate: '2026-03-31', daysInPipeline: 8,
    ddTasksCompleted: ['Perk Test'],
    notes: 'Subdivide. County guarantees 1000 ft water tap for pressure, may have to pay for more. Fee $1600 per tap. Sub divided into two 2 acre lots. Called Johnny J Williams land surveying, left vm. Will call back 3/20. Johnny J Williams is going to be doing the surveying on this property. Follow up 4/2',
    lat: 34.8966, lng: -78.0542,
  },
  {
    id: 'deal-005', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '10-6 Marion Rd, Dorchester, SC 29437', county: 'Dorchester', state: 'SC', zip: '29437', acreage: 1.01,
    grade: 'A', tags: [], investor: 'Atium Build Group LLC', financing: 'Hard Money (Land + Home)',
    arv: 300000,
    land: 57500, mobileHome: 95000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 5.83, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '094-00-00-052.000', sellerName: 'Landco Developers LLC',
    leadSource: 'FB Market Place', ownerType: 'Realtor', utilityScenario: 'Well and Septic',
    closingAttorney: 'The Quattlebaum Law Firm, LLC', closingAttorneyPhone: '843-563-2112',
    closingAttorneyAddress: '222 N Parler Ave, St. George, SC 29477',
    contractDate: '2026-04-07', closeDate: '2026-04-07', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 33.0912, lng: -80.4659,
  },
  {
    id: 'deal-006', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '10-5 Marion Rd, Dorchester, SC 29437', county: 'Dorchester', state: 'SC', zip: '29437', acreage: 1.01,
    grade: 'A', tags: [], investor: 'Louis Isom', financing: 'Hard Money (Land + Home)',
    arv: 300000,
    land: 57500, mobileHome: 95000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 5.83, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '094-00-00-051.000', sellerName: 'Landco Developers LLC',
    leadSource: 'FB Market Place', ownerType: 'Realtor', utilityScenario: 'Well and Septic',
    closingAttorney: 'The Quattlebaum Law Firm, LLC', closingAttorneyPhone: '843-563-2112',
    closingAttorneyAddress: '222 N Parler Ave, St. George, SC 29477',
    contractDate: '2026-04-07', closeDate: '2026-04-07', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 33.0918, lng: -80.4652,
  },
  {
    id: 'deal-007', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '10-2 Marion Rd, Dorchester, SC 29437', county: 'Dorchester', state: 'SC', zip: '29437', acreage: 1.04,
    grade: 'A', tags: [], investor: 'Blue Bay Capital', financing: 'Hard Money (Land + Home)',
    arv: 300000,
    land: 57500, mobileHome: 95000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 5.83, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '105-00-00-114.000', sellerName: 'Landco Developers LLC',
    leadSource: 'FB Market Place', ownerType: 'Realtor', utilityScenario: 'Well and Septic',
    closingAttorney: 'The Quattlebaum Law Firm, LLC', closingAttorneyPhone: '843-563-2112',
    closingAttorneyAddress: '222 N Parler Ave, St. George, SC 29477',
    contractDate: '2026-04-07', closeDate: '2026-04-07', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 33.0924, lng: -80.4645,
  },
  {
    id: 'deal-008', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '10-3 Marion Rd, Dorchester, SC 29437', county: 'Dorchester', state: 'SC', zip: '29437', acreage: 1.04,
    grade: 'A', tags: [], investor: 'Atium Build Group LLC', financing: 'Hard Money (Land + Home)',
    arv: 300000,
    land: 57500, mobileHome: 95000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 5.83, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '105-00-00-115.000', sellerName: 'Landco Developers LLC',
    leadSource: 'FB Market Place', ownerType: 'Realtor', utilityScenario: 'Well and Septic',
    closingAttorney: 'The Quattlebaum Law Firm, LLC', closingAttorneyPhone: '843-563-2112',
    closingAttorneyAddress: '222 N Parler Ave, St. George, SC 29477',
    contractDate: '2026-04-07', closeDate: '2026-04-07', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 33.0930, lng: -80.4638,
  },
  {
    id: 'deal-009', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '10-4 Marion Rd, Dorchester, SC 29437', county: 'Dorchester', state: 'SC', zip: '29437', acreage: 1.04,
    grade: 'A', tags: [], investor: 'Windstone', financing: 'Hard Money (Land + Home)',
    arv: 300000,
    land: 57500, mobileHome: 95000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 5.83, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '105-00-00-116.000', sellerName: 'Landco Developers LLC',
    leadSource: 'FB Market Place', ownerType: 'Realtor', utilityScenario: 'Well and Septic',
    closingAttorney: 'The Quattlebaum Law Firm, LLC', closingAttorneyPhone: '843-563-2112',
    closingAttorneyAddress: '222 N Parler Ave, St. George, SC 29477',
    contractDate: '2026-04-07', closeDate: '2026-04-07', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 33.0936, lng: -80.4631,
  },
  {
    id: 'deal-010', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '510 Walton Ln, Tyner, NC 27980', county: 'Chowan', state: 'NC', zip: '27980', acreage: 0.99,
    grade: 'A', tags: ['Land Clearing'], investor: 'Atium Build Group LLC', financing: 'Hard Money (Land + Home)',
    arv: 230000,
    land: 24900, mobileHome: 72000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 4000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 6000, decks: 3500, driveway: 1200, landscaping: 1500, waterSewer: 2000, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.24, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '130610 0363 23', sellerName: 'DANIELS MARK MORRIS',
    leadSource: 'FB Market Place', ownerType: 'Wholesaler', utilityScenario: 'Existing Well and Septic',
    closingAttorney: 'McCollum Law P.C.', closingAttorneyPhone: '9198614120',
    closingAttorneyAddress: '1135 Kildaire Farm Rd. Ste. 321, Cary, NC 27511',
    contractDate: '2026-04-07', closeDate: '2026-04-07', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: 'Called county to see if they have any records on a septic system on file. Will hear back on 3/25. Inspector could not find septic system due to over grown brush. Once we close 3/31, schedule land clearing company to go out and clear the brush and overgrowth.',
    lat: 36.2152, lng: -76.6113,
  },
  {
    id: 'deal-011', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '10-1 Marion Rd, Dorchester, SC 29437', county: 'Dorchester', state: 'SC', zip: '29437', acreage: 1.04,
    grade: 'C', tags: [], investor: 'Windstone', financing: 'Hard Money (Land + Home)',
    arv: 265000,
    land: 57500, mobileHome: 77000, hudEngineer: 500, percTest: 0, survey: 0, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 5.83, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '105-00-00-113.000', sellerName: 'Landco Developers LLC',
    leadSource: 'FB Market Place', ownerType: 'Realtor', utilityScenario: 'Well and Septic',
    closingAttorney: 'The Quattlebaum Law Firm, LLC', closingAttorneyPhone: '843-563-2112',
    closingAttorneyAddress: '222 N Parler Ave, St. George, SC 29477',
    contractDate: '2026-04-08', closeDate: '2026-04-08', daysInPipeline: 0,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 33.0906, lng: -80.4666,
  },
  {
    id: 'deal-012', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: '0 Henry Jenkins Rd, Mooresboro, NC 28114', county: 'Rutherford', state: 'NC', zip: '28114', acreage: 1.16,
    grade: 'A', tags: [], investor: 'Louis Isom', financing: 'Hard Money (Land + Home)',
    arv: 245000,
    land: 27000, mobileHome: 77000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4493, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.13, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '1636458', sellerName: 'JOHNSON MICHAEL W',
    leadSource: 'FB Market Place', utilityScenario: 'Well and Septic',
    sewerCompany: 'Septic', electricCompany: 'Duke Energy (NC)', waterCompany: 'Well',
    closingAttorney: 'Peter E. Lane', closingAttorneyPhone: '828-287-5225',
    closingAttorneyAddress: '131 East Court Street, Rutherfordton, NC 28139 PO Box 1519',
    contractDate: '2026-03-15', closeDate: '2026-04-29', daysInPipeline: 1,
    ddTasksCompleted: ['Perk Test'],
    notes: '',
    lat: 35.2985, lng: -81.6991,
  },

  // Creek Landing Lots 3-9 (Horry County SC)
  {
    id: 'deal-013', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 3 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 4.18,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    parcelId: '12109010003', leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2338, lng: -79.1487,
  },
  {
    id: 'deal-014', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 4 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 4.2,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    parcelId: '12108040008', leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2344, lng: -79.1481,
  },
  {
    id: 'deal-015', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 5 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 3.76,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    parcelId: '12108040009', leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2350, lng: -79.1474,
  },
  {
    id: 'deal-016', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 6 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 3.78,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    parcelId: '12108040010', leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2356, lng: -79.1468,
  },
  {
    id: 'deal-017', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 7 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 3.5,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2362, lng: -79.1461,
  },
  {
    id: 'deal-018', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 8 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 3.03,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    parcelId: '12108040011', leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2368, lng: -79.1455,
  },
  {
    id: 'deal-019', pipeline: 'deal-overview', stage: 'Due Diligence',
    address: 'Lot 9 Creek Landing Rd, Nichols, SC 29581', county: 'Horry', state: 'SC', zip: '29581', acreage: 3.5,
    grade: 'B', tags: ['Land Clearing'], investor: null, financing: 'Cash',
    arv: 255000,
    land: 34000, mobileHome: 84000, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 6000, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 2500, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.07, holdingMonths: 4, holdingPerMonth: 250,
    leadSource: 'Realtor', ownerType: 'Owner',
    closingAttorney: 'Murray Law Group - Carolina Forest', closingAttorneyPhone: '(843) 236-2400',
    closingAttorneyAddress: '3876 Renee Drive Myrtle Beach, SC 29579',
    contractDate: '2026-03-20', closeDate: '2026-05-12',
    ddTasksCompleted: [],
    notes: '',
    lat: 34.2374, lng: -79.1448,
  },

  // Development (2)
  {
    id: 'deal-020', pipeline: 'deal-overview', stage: 'Development',
    address: 'Swanson Rd, Crouse, NC 28033', county: 'Lincoln', state: 'NC', zip: '28033', acreage: 2.6,
    grade: 'B', tags: ['Land Clearing'], investor: 'Cash', financing: 'Cash',
    arv: 235000,
    land: 22940, mobileHome: 77000, hudEngineer: 500, percTest: 1957, survey: 1500, footers: 6000, setup: 9000, clearLand: 8800, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.20, holdingMonths: 4, holdingPerMonth: 250,
    parcelId: '15301', sellerName: null, ownerName: null,
    leadSource: 'FB Market Place', ownerType: 'Realtor',
    contractDate: '2026-02-13', closeDate: '2026-02-12', daysInPipeline: 54,
    utilityScenario: 'Well and Septic',
    closingAttorney: null, closingAttorneyPhone: null, closingAttorneyAddress: null,
    ddTasksCompleted: ['Perk Test'],
    notes: 'Called to get an update on permits and the county said it is going to take another 4-6 weeks, E911 address gets assigned once building permit is approved',
    lat: 35.4222, lng: -81.3139,
  },
  {
    id: 'deal-021', pipeline: 'deal-overview', stage: 'Development',
    address: 'Erwin Temple Church Rd, Woodleaf, NC 27054', county: 'Rowan', state: 'NC', zip: '27054', acreage: 3.1,
    grade: 'A', tags: [], investor: 'Louis Isom', financing: 'Hard Money (Land + Home)',
    arv: 235000,
    land: 30000, mobileHome: 77000, hudEngineer: 500, percTest: 1300, survey: 1500, footers: 6000, setup: 9000, clearLand: 0, water: 10000, septic: 7500, electric: 2000, hvac: 4500, underpinning: 5650, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 1500, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    sellingCostPct: 6.20, holdingMonths: 6, holdingPerMonth: 250,
    parcelId: '802-082', sellerName: null, ownerName: null,
    leadSource: null, ownerType: null,
    contractDate: '2026-03-27', closeDate: '2026-03-27', daysInPipeline: 12,
    utilityScenario: 'Septic Needed',
    waterCompany: 'Well', sewerCompany: 'Septic', electricCompany: 'Duke Energy Progress',
    closingAttorney: '24 Hour Closing', closingAttorneyPhone: '704-800-4131', closingAttorneyAddress: '803 N Main St Salisbury NC 28144',
    ddTasksCompleted: ['Perk Test'],
    notes: 'Grade A. Funder: Louis Isom. Hard Money (Land + Home). Day 12. Active development.',
    lat: 35.7690, lng: -80.5909,
  },
];

export const LAND_DEALS = [
  { id: 'land-001', pipeline: 'land-acquisition', stage: 'New Lead', address: 'TBD Heritage Rd', county: 'Horry', state: 'SC', grade: 'B', arv: 250000, netProfit: 50080, financing: 'Cash' },
  { id: 'land-002', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Lot 1 Highway 430', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 131080, financing: 'Cash' },
  { id: 'land-003', pipeline: 'land-acquisition', stage: 'New Lead', address: '0 Highway 19 LOT 5', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 144080, financing: 'Cash' },
  { id: 'land-004', pipeline: 'land-acquisition', stage: 'New Lead', address: '0 Highway 57', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 150080, financing: 'Cash' },
  { id: 'land-005', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Lot B3 Black Creek Road', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 142815, financing: 'Cash' },
  { id: 'land-006', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Untitled', county: '', state: '', grade: null, arv: null, netProfit: -39670, financing: 'Cash' },
  { id: 'land-007', pipeline: 'land-acquisition', stage: 'New Lead', address: 'TBD Harvey Road', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 124080, financing: 'Cash' },
  { id: 'land-008', pipeline: 'land-acquisition', stage: 'New Lead', address: 'TBD Highway 545 Hannahrae Court', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 144080, financing: 'Cash' },
  { id: 'land-009', pipeline: 'land-acquisition', stage: 'New Lead', address: '0 Highway 19 LOT 2', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 149080, financing: 'Cash' },
  { id: 'land-010', pipeline: 'land-acquisition', stage: 'New Lead', address: 'TBD Mosdell Drive', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 134080, financing: 'Cash' },
  { id: 'land-011', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Lot 2 Allentown Road', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 113080, financing: 'Cash' },
  { id: 'land-012', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Loris SC (no street address)', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 149334, financing: 'Cash' },
  { id: 'land-013', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Nichols SC (no street address)', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 165080, financing: 'Cash' },
  { id: 'land-014', pipeline: 'land-acquisition', stage: 'New Lead', address: 'TBD Lot B5 Mount Olive Church Rd', county: 'Horry', state: 'SC', grade: 'A', arv: 250000, netProfit: 126580, financing: 'Cash' },
  { id: 'land-015', pipeline: 'land-acquisition', stage: 'New Lead', address: '130 Speaks Rd, Olin, NC 28660', county: 'Iredell', state: 'NC', grade: null, arv: null, netProfit: -98670, financing: 'Cash' },
  { id: 'land-016', pipeline: 'land-acquisition', stage: 'New Lead', address: '124 Speaks Rd, Olin, NC 28660', county: 'Iredell', state: 'NC', grade: 'D', arv: 250000, netProfit: 25544, financing: 'Hard Money Loan', tags: ['Low Margin 14%'] },
  { id: 'land-017', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Frank Bullock Rd, Manson, NC 27553', county: 'Vance', state: 'NC', grade: null, arv: null, netProfit: -96670, financing: 'Cash', tags: ['Subdivide'] },
  { id: 'land-018', pipeline: 'land-acquisition', stage: 'New Lead', address: 'Clover, SC (exact address TBD)', county: 'York', state: 'SC', grade: 'A', arv: 300000, netProfit: 151830, financing: 'Cash' },
  { id: 'land-019', pipeline: 'land-acquisition', stage: 'Underwriting', address: '4.27 Acres Horry County SC', county: 'Horry', state: 'SC', zip: '29581', acreage: 4.27, grade: 'A', arv: 250000, netProfit: 132080, financing: 'Cash', land: 67000, mobileHome: 0, hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000, clearLand: 0, water: 0, septic: 0, electric: 0, hvac: 4500, underpinning: 6000, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 0, mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0, holdingMonths: 4, holdingPerMonth: 250, generalNotes: 'https://www.landwatch.com/horry-county-south-carolina-undeveloped-land-for-sale/pid/422771262', ownerType: 'Owner', utilityScenario: 'All Utilities Available' },
];

export const ARCHIVED_DEALS = [
  { id: 'arch-001', pipeline: 'Land Acquisition', lastStage: 'New Lead', archivedDate: '2026-04-06', address: '0 Highway 19 LOT 7', arv: 250000, netProfit: 149080 },
  { id: 'arch-002', pipeline: 'Land Acquisition', lastStage: 'New Lead', archivedDate: '2026-04-06', address: 'Lot 3 Highway 430', arv: 250000, netProfit: 174080 },
  { id: 'arch-003', pipeline: 'Land Acquisition', lastStage: 'Negotiating', archivedDate: '2026-04-02', address: '1513 Oak Dale Rd, Loris, SC 29568', arv: 255000, netProfit: 58705 },
  { id: 'arch-004', pipeline: 'Land Acquisition', lastStage: 'Negotiating', archivedDate: '2026-04-02', address: 'Deep Woods Rd, Saint George, SC 29477', arv: 270000, netProfit: 61680 },
  { id: 'arch-005', pipeline: 'Land Acquisition', lastStage: 'New Lead', archivedDate: '2026-03-31', address: 'Untitled', arv: null, netProfit: -39670 },
];

export const ALL_DEALS = [...DEAL_OVERVIEW_DEALS, ...LAND_DEALS];
