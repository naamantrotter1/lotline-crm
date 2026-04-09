/**
 * Metrics calculation engine.
 * Computes market statistics for every county × time-period × acreage bucket.
 */

// ─── Helper: median of sorted array ─────────────────────────────────────────
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ─── Acreage bucket classifier ────────────────────────────────────────────────
function acreageBucket(acres) {
  if (acres < 1)   return '0-1';
  if (acres < 2)   return '1-2';
  if (acres < 5)   return '2-5';
  if (acres < 10)  return '5-10';
  if (acres < 20)  return '10-20';
  return '20+';
}

// ─── Period: how many days back? ──────────────────────────────────────────────
const PERIOD_DAYS = {
  '7d':   7,
  '14d':  14,
  '30d':  30,
  '90d':  90,
  '6mo':  182,
  '1yr':  365,
  '2yr':  730,
  '3yr':  1095,
  '5yr':  1825,
};

// ─── Demand Score (0-100) ─────────────────────────────────────────────────────
function calcDemandScore({ absorptionRate, populationGrowth, unemploymentRate, monthsOfSupply, sellThroughRate }) {
  const absScore  = Math.min(absorptionRate / 30, 1) * 100;          // 30%
  const growScore = Math.min(Math.max((populationGrowth + 2) / 8, 0), 1) * 100; // 20%
  const unempScore= Math.min(Math.max((10 - unemploymentRate) / 8, 0), 1) * 100; // 15%
  const supplyScore = Math.min(Math.max((12 - monthsOfSupply) / 10, 0), 1) * 100; // 20%
  const sellScore = Math.min(sellThroughRate / 100, 1) * 100;        // 15%

  return +(
    absScore  * 0.30 +
    growScore * 0.20 +
    unempScore* 0.15 +
    supplyScore * 0.20 +
    sellScore * 0.15
  ).toFixed(1);
}

// ─── LotLine Opportunity Score (0-100) ────────────────────────────────────────
// Good exit (low months of supply for homes) + motivated sellers (high supply for land)
// + income supports $250k purchase + population growth
function calcOpportunityScore({ monthsOfSupplyHomes, populationGrowth, medianIncome,
  absorptionRate, mhFriendlyZoning }) {
  // Low months of supply for homes → good exit (weight: 30)
  const exitScore  = Math.min(Math.max((10 - monthsOfSupplyHomes) / 8, 0), 1) * 100;
  // Income must support $250k (rule of thumb: 4-5x income → ~$55k min)
  const incomeScore= Math.min(Math.max((medianIncome - 30000) / 40000, 0), 1) * 100;
  // Population growth → demand (weight: 20)
  const growScore  = Math.min(Math.max((populationGrowth + 1) / 7, 0), 1) * 100;
  // Absorption rate → velocity (weight: 20)
  const absScore   = Math.min(absorptionRate / 25, 1) * 100;
  // MH zoning bonus (weight: 10)
  const zoningScore= mhFriendlyZoning ? 100 : 20;

  return +(
    exitScore   * 0.30 +
    incomeScore * 0.20 +
    growScore   * 0.20 +
    absScore    * 0.20 +
    zoningScore * 0.10
  ).toFixed(1);
}

// ─── Acreage range parser ─────────────────────────────────────────────────────
function parseAcreageRange(range) {
  if (!range || range === 'All') return [0, Infinity];
  if (range.endsWith('+')) return [parseFloat(range), Infinity];
  const [min, max] = range.split('-').map(Number);
  return [min, max];
}

// ─── Main: calculate stats for one county over one period ────────────────────
function calcCountyStats(county, listings, comps, periodKey, acreageRange='All', listingStatus='sold', propertyType='All') {
  const days = PERIOD_DAYS[periodKey];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Filter comps to period and county
  let periodComps = comps.filter(c =>
    c.county_fips === county.fips && new Date(c.close_date) >= cutoff
  );

  // Active listings for this county
  let activeListings = listings.filter(l =>
    l.county_fips === county.fips && l.status === 'Active'
  );

  // Apply property type filter
  if (propertyType && propertyType !== 'All') {
    periodComps    = periodComps.filter(c => c.property_type === propertyType);
    activeListings = activeListings.filter(l => l.property_type === propertyType);
  }

  // Apply acreage filter
  const [minA, maxA] = parseAcreageRange(acreageRange);
  const filteredComps    = acreageRange === 'All' ? periodComps    : periodComps.filter(c => c.acreage >= minA && c.acreage < maxA);
  const filteredListings = acreageRange === 'All' ? activeListings : activeListings.filter(l => l.acreage >= minA && l.acreage < maxA);

  const activeCount = filteredListings.length;
  const soldCount = filteredComps.length;

  // Monthly sold rate
  const monthsInPeriod = days / 30;
  const soldPerMonth = soldCount / monthsInPeriod;

  const monthsOfSupply = soldPerMonth > 0 ? +(activeCount / soldPerMonth).toFixed(2) : 99;

  const totalAvailable = soldCount + activeCount;
  const absorptionRate = totalAvailable > 0
    ? +((soldCount / totalAvailable) * 100).toFixed(2)
    : 0;

  // Sell through rate (sold / sold + expired) — approximate with DOM > 180 as "expired"
  const expired = filteredListings.filter(l => l.days_on_market > 180).length;
  const sellThroughRate = (soldCount + expired) > 0
    ? +((soldCount / (soldCount + expired)) * 100).toFixed(2)
    : 0;

  // For "for_sale" status: use active listing prices/DOM; for "sold": use comp prices
  const isForSale = listingStatus === 'for_sale';
  const priceItems  = isForSale ? filteredListings : filteredComps;
  const salePrices  = isForSale ? priceItems.map(l => l.list_price)  : priceItems.map(c => c.sale_price);
  const listPrices  = filteredComps.map(c => c.list_price);
  const doms        = isForSale ? priceItems.map(l => l.days_on_market) : filteredComps.map(c => c.days_on_market);
  const ppa         = isForSale
    ? priceItems.map(l => l.price_per_acre ?? (l.acreage > 0 ? l.list_price / l.acreage : 0))
    : filteredComps.map(c => c.price_per_acre);
  const acreages    = priceItems.map(x => x.acreage);
  const ltsRatios   = filteredComps.map(c => c.list_to_sale_ratio);

  const demandScore = calcDemandScore({
    absorptionRate,
    populationGrowth: county.growth,
    unemploymentRate: county.unemployment,
    monthsOfSupply,
    sellThroughRate,
  });

  const opportunityScore = calcOpportunityScore({
    monthsOfSupplyHomes: monthsOfSupply,
    populationGrowth: county.growth,
    medianIncome: county.income,
    absorptionRate,
    mhFriendlyZoning: county.mhFriendly,
  });

  // Fall back to Land Portal anchor values when no comps exist for this period
  const medianSalePrice    = median(salePrices)  ?? county.medianPrice ?? null;
  const medianPricePerAcre = median(ppa)         ?? county.medianPpa   ?? null;
  const medianListPrice    = median(listPrices)  ?? county.medianPrice ?? null;

  return {
    period: periodKey,
    acreage_bucket: 'all',
    active_listings: activeCount,
    sold_count: soldCount,
    median_list_price:      medianListPrice,
    median_sale_price:      medianSalePrice,
    median_price_per_acre:  medianPricePerAcre,
    avg_list_price:         avg(listPrices) ? +avg(listPrices).toFixed(0) : null,
    avg_sale_price:         avg(salePrices) ? +avg(salePrices).toFixed(0) : null,
    median_days_on_market:  median(doms) ?? county.dom ?? null,
    avg_days_on_market:     avg(doms) ? +avg(doms).toFixed(1) : null,
    absorption_rate_pct:    soldCount > 0 ? absorptionRate : (county.absorption ?? null),
    months_of_supply:       soldCount > 0 ? monthsOfSupply : (county.mos ?? null),
    sell_through_rate_pct:  soldCount > 0 ? sellThroughRate : (county.str ?? null),
    list_to_sale_ratio_pct: median(ltsRatios),
    avg_acreage:            avg(acreages) ? +avg(acreages).toFixed(2) : null,
    demand_score:           demandScore,
    opportunity_score:      opportunityScore,
  };
}

// ─── Calculate all stats for all counties × all periods ──────────────────────
function calcAllStats(counties, listings, comps) {
  const results = [];
  const periods = Object.keys(PERIOD_DAYS);

  for (const county of counties) {
    for (const period of periods) {
      const stats = calcCountyStats(county, listings, comps, period);
      results.push({ county_fips: county.fips, ...stats });
    }
  }
  return results;
}

module.exports = { calcAllStats, calcCountyStats, calcDemandScore, calcOpportunityScore, acreageBucket, parseAcreageRange, PERIOD_DAYS };
