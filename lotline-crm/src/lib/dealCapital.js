// Compute the investor's capital amount for a single deal from the SAME
// inputs the operator sees on the deal's Financing tab — the deal row's
// cost columns + scenarioData. This is the source of truth for the
// "Capital Invested" displayed in the operator's Investor Portal and the
// drawer's Position Breakdown.
//
// Why we can't just read deal_allocations.amount: that field is written
// only at investor-assignment time and goes stale the instant any cost
// (land, mobile home, etc.) or loanBasisFlag changes on the deal.

const HMCB_TYPES = new Set(['hmcb', 'hard-money-construction-holdback', 'hard_money_construction_holdback']);
const HM_TYPES   = new Set(['hard-money-loan', 'hard_money_loan']);
const HM_LH_TYPES = new Set(['hard-money-land-home', 'hard_money_land_home']);
const LOC_TYPES  = new Set(['loc', 'line-of-credit', 'line_of_credit']);
const CASH_TYPES = new Set(['cash']);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildCost(deal) {
  // Build cost excludes land. Matches the DealCalculator/DealDetail definition
  // (mobileHome + permits + sitework + utilities + other) — but a deal row may
  // not have those broken-out fields. Fall back to totalActual − land.
  if (deal.totalActual != null) {
    return Math.max(0, num(deal.totalActual) - num(deal.land));
  }
  return num(deal.mobileHome) + num(deal.permits) + num(deal.sitework)
       + num(deal.utilities)  + num(deal.other);
}

function totalAllIn(deal) {
  if (deal.totalActual != null) return num(deal.totalActual);
  return num(deal.land) + buildCost(deal);
}

/**
 * Compute the loan amount (and therefore investor's capital exposure) for
 * a deal based on its financing scenario + scenarioData.
 *
 * Returns the dollar amount the primary investor has lent on this deal.
 * Falls back through the cleanest available signal:
 *   1. scenarioData.loanAmountOverride (operator typed a number)
 *   2. scenario-aware computation from loanBasisFlags + cost fields
 *   3. deal.investorCapitalContributed (legacy column)
 *   4. 0
 */
export function computeDealInvestorCapital(deal) {
  if (!deal) return 0;
  const sd = deal.scenarioData || {};
  const scenarioType = String(deal.financingScenarioType ?? deal.financing ?? '').toLowerCase();

  // Explicit override always wins.
  if (sd.loanAmountOverride != null) return num(sd.loanAmountOverride);

  // ── Cash: investor isn't a lender. Capital = build cost (operator's own).
  if (CASH_TYPES.has(scenarioType)) return buildCost(deal);

  // ── Line of credit: the investor's exposure tracks the current draw.
  if (LOC_TYPES.has(scenarioType)) {
    if (sd.drawAmount != null) return num(sd.drawAmount);
    if (sd.creditLimit != null) return num(sd.creditLimit);
  }

  // ── Hard money / HMCB / land+home: derive from loanBasisFlags + costs.
  if (HM_TYPES.has(scenarioType) || HM_LH_TYPES.has(scenarioType) || HMCB_TYPES.has(scenarioType)) {
    const flags = sd.loanBasisFlags;
    if (flags) {
      return (flags.land  ? num(deal.land)       : 0)
           + (flags.home  ? num(deal.mobileHome) : 0)
           + (flags.allIn ? totalAllIn(deal)     : 0);
    }
    // Sensible default by scenario family.
    if (HM_LH_TYPES.has(scenarioType)) return num(deal.land) + num(deal.mobileHome);
    if (HM_TYPES.has(scenarioType))    return totalAllIn(deal);
    if (HMCB_TYPES.has(scenarioType))  return totalAllIn(deal);
  }

  // ── Fallback: whatever the legacy column says, then zero.
  if (deal.investorCapitalContributed != null) return num(deal.investorCapitalContributed);
  return 0;
}
