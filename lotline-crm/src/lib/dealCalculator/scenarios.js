// src/lib/dealCalculator/scenarios.js
// Pure helpers for the Financing Scenario Comparison table.
// All monetary inputs/outputs are plain numbers (dollars). No React.

const HM_ANNUAL_RATE = 0.12;
const HM_POINTS_PCT  = 0.03;

// Round to dollars so the table never shows cents.
function hmInterest(loanAmount, holdingMonths) {
  return loanAmount * HM_ANNUAL_RATE * (holdingMonths / 12);
}

function hmPoints(loanAmount) {
  return loanAmount * HM_POINTS_PCT;
}

// Operator's cash out-of-pocket: uncovered all-in cost + upfront points.
function hmCapitalIn(totalAllIn, loanAmount) {
  return Math.max(0, totalAllIn - loanAmount) + hmPoints(loanAmount);
}

// Profit after both interest and points.
function hmNetProfit(baseProfit, loanAmount, holdingMonths) {
  return baseProfit - hmInterest(loanAmount, holdingMonths) - hmPoints(loanAmount);
}

function fmtRoi(profit, capital) {
  if (capital === 0) return '—';
  return (profit / capital * 100).toFixed(1);
}

/**
 * buildScenarios — returns the four financing scenario rows.
 *
 * @param {object} params
 * @param {number} params.buildCost      Z — sum of all cost-input fields
 * @param {number} params.totalAllIn     Q — buildCost + sellingCosts + holdingCosts
 * @param {number} params.baseProfit     U — arv - totalAllIn (before financing costs)
 * @param {number} params.holdingMonths  number of hold months
 * @param {number} params.landCost       activeCostBag.land
 * @param {number} params.mobileHomeCost activeCostBag.mobile_home
 *
 * Each row: { label, capital, profit, roi, tooltip }
 *   roi is a string: "123.4" or "—"
 *   tooltip is a string or null
 */
export function buildScenarios({
  buildCost,
  totalAllIn,
  baseProfit,
  holdingMonths,
  landCost,
  mobileHomeCost,
}) {
  const Z = buildCost   || 0;
  const Q = totalAllIn  || 0;
  const U = baseProfit  || 0;
  const M = holdingMonths || 0;

  // ── Cash ─────────────────────────────────────────────────────────────────
  const cashCapital = Z;
  const cashProfit  = U;
  const cashRoi     = cashCapital > 0 ? (cashProfit / cashCapital * 100).toFixed(1) : '—';

  // ── Hard Money: loan = total all-in cost ─────────────────────────────────
  const hmLoan     = Q;
  const hmCapital  = hmCapitalIn(Q, hmLoan);   // = 0 + Q*0.03 = Q*0.03
  const hmProfit   = hmNetProfit(U, hmLoan, M);
  const hmRoi      = fmtRoi(hmProfit, hmCapital);

  // ── HM (Land + Home): loan = land + manufactured home cost only ──────────
  const landAndHome  = (Number(landCost) || 0) + (Number(mobileHomeCost) || 0);
  const hmLhCapital  = hmCapitalIn(Q, landAndHome);   // = (Q - landAndHome) + landAndHome*0.03
  const hmLhProfit   = hmNetProfit(U, landAndHome, M);
  const hmLhRoi      = fmtRoi(hmLhProfit, hmLhCapital);

  // ── Line of Credit ────────────────────────────────────────────────────────
  // TODO(LOC): confirm interest rate + points then plug into the same helpers
  const locCapital = 0;   // no equity down required (full LOC coverage assumed)
  const locProfit  = U;   // interest not yet modeled

  return [
    {
      label:   'Cash',
      capital: cashCapital,
      profit:  cashProfit,
      roi:     cashRoi,
      tooltip: null,
    },
    {
      label:   'Hard Money',
      capital: hmCapital,
      profit:  hmProfit,
      roi:     hmRoi,
      tooltip: '12% annual interest + 3 points on a total all-in cost loan.',
    },
    {
      label:   'HM (Land + Home)',
      capital: hmLhCapital,
      profit:  hmLhProfit,
      roi:     hmLhRoi,
      tooltip: '12% annual interest + 3 points on a land + home cost loan.',
    },
    {
      label:   'Line of Credit',
      capital: locCapital,
      profit:  locProfit,
      roi:     '—',
      tooltip: 'Interest and points not yet modeled — confirm with your lender.',
    },
  ];
}
