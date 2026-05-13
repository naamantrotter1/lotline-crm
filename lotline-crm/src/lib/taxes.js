/**
 * State-aware tax computations for the Deal Calculator.
 *
 * Each function takes (amount, rates) where `rates` is the merged
 * tax_formulas object for the state (with any county overrides already
 * applied — see useLocationResolver / mergedDefaults).
 *
 * All amounts are USD numbers. Returned values are rounded to whole dollars
 * for display; callers can use raw multiplication if cent-precision is
 * needed.
 *
 * Sources:
 *   NC excise           — NCGS 105-228.30 — $1 per $500 of consideration → 0.2%
 *   SC deed stamps      — SC Code §12-24-10 — $3.70 per $1000 → 0.370%
 *   FL doc stamps (deed)— FS 201.02         — $0.70 per $100 statewide; $0.60
 *                         per $100 in Miami-Dade (single-family residence)
 *   FL intangible tax   — FS 199            — $2 per $1000 of new debt → 0.2%
 *                         (applies to mortgages financing real property)
 */

const round = (n) => Math.round(Number(n) || 0);

/** NC excise tax (deed transfer). Applies to purchasePrice. */
export function ncExcise(purchasePrice, rates) {
  const rate = Number(rates?.ncExciseRate ?? 0.002);
  return round((Number(purchasePrice) || 0) * rate);
}

/** SC deed stamps. Applies to purchasePrice. */
export function scDeedStamps(purchasePrice, rates) {
  const rate = Number(rates?.scDeedStampRate ?? 0.00370);
  return round((Number(purchasePrice) || 0) * rate);
}

/** FL doc stamps on deed. Rate may be overridden per-county (Miami-Dade = 0.006). */
export function flDocStampsDeed(purchasePrice, rates) {
  const rate = Number(rates?.docStampsDeedRate ?? 0.007);
  return round((Number(purchasePrice) || 0) * rate);
}

/**
 * FL intangible tax on financing. Applies to the LOAN amount, not the
 * purchase price. Returns 0 if there's no loan.
 */
export function flIntangibleTax(loanAmount, rates) {
  if (!loanAmount || Number(loanAmount) <= 0) return 0;
  const rate = Number(rates?.intangibleTaxRate ?? 0.002);
  return round(Number(loanAmount) * rate);
}

/**
 * Compute the value for any field whose default_costs entry is the literal
 * string 'auto'. Returns null when there isn't a matching computer (caller
 * should leave the user-entered value untouched in that case).
 */
export function computeAutoField(fieldKey, { purchasePrice, loanAmount, rates }) {
  switch (fieldKey) {
    case 'ncExciseTax':   return ncExcise(purchasePrice, rates);
    case 'scDeedStamps':  return scDeedStamps(purchasePrice, rates);
    case 'docStampsDeed': return flDocStampsDeed(purchasePrice, rates);
    case 'intangibleTax': return flIntangibleTax(loanAmount, rates);
    default:              return null;
  }
}

/**
 * Walk a state's default_costs and resolve every 'auto' marker to its
 * computed value, leaving non-auto entries untouched. The output is suitable
 * for seeding the calculator's input state.
 */
export function resolveAutoDefaults(defaults, ctx) {
  const out = {};
  for (const [key, val] of Object.entries(defaults || {})) {
    if (val === 'auto') {
      const computed = computeAutoField(key, ctx);
      out[key] = computed ?? 0;
    } else {
      out[key] = val;
    }
  }
  return out;
}
