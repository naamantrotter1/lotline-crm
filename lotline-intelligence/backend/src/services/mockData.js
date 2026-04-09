/**
 * Mock data generator for MLS listings, sold comps, pipeline deals.
 * Produces realistic NC/SC manufactured home market data until live MLS feed is purchased.
 */

const { ALL_COUNTIES } = require('../data/counties');
const LP_STATS = require('../data/lp_stats.json');
const LP_TYPE = { 'Manufactured Homes':'mfg', 'Single Family':'sf', 'Land':'land' };

// ─── Utilities ───────────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function formatDate(d) { return d.toISOString().split('T')[0]; }
function jitter(val, pct) { return val * (1 + rand(-pct, pct)); }

// County weights — priority markets get 4x more listings
function getCountyWeights() {
  return ALL_COUNTIES.map(c => c.priority ? 4.0 : 1.0);
}

// ─── ZIP code ranges per county (approximate) ────────────────────────────────
const NC_ZIPS = {
  '37061': ['28328','28333','28365','28393'], // Duplin
  '37163': ['28328','28344','28350','28391'], // Sampson
  '37191': ['27530','27534','27569','27577'], // Wayne
  '37155': ['28320','28337','28362','28375'], // Robeson
  '37047': ['28421','28432','28435','28433'], // Columbus
};
const SC_ZIPS = {
  '45051': ['29526','29527','29551','29566','29575','29579'], // Horry
  '45035': ['29420','29483','29485','29486'],                 // Dorchester
  '45057': ['29720','29724','29730'],                         // Lancaster
  '45021': ['29340','29372','29344'],                         // Cherokee
};
function getZip(county) {
  const map = { ...NC_ZIPS, ...SC_ZIPS };
  if (map[county.fips]) return pick(map[county.fips]);
  // Fallback: generate plausible zip from state
  if (county.state === 'NC') return String(randInt(27000, 28999));
  return String(randInt(29000, 29999));
}

// ─── Address generation ──────────────────────────────────────────────────────
const STREETS = ['Oak','Pine','Maple','Cedar','Hickory','Magnolia','Dogwood','Pecan','Elm','Willow',
  'Creek','Ridge','Hollow','Farm','Mill','Church','Old Mill','Sandy Run','River Bend','Longleaf'];
const SUFFIXES = ['Rd','Rd','Rd','Ln','Dr','Way','Ct','Hwy'];
function randomAddress() {
  return `${randInt(100, 9999)} ${pick(STREETS)} ${pick(SUFFIXES)}`;
}

// ─── Coordinate jitter around county centroid ────────────────────────────────
function randomCoords(county) {
  return {
    lat: county.lat + rand(-0.25, 0.25),
    lng: county.lng + rand(-0.25, 0.25),
  };
}

// ─── Property type distribution ──────────────────────────────────────────────
// Types match the Data filter: Manufactured Homes, Single Family, Land
const PROP_TYPES   = ['Manufactured Homes', 'Manufactured Homes', 'Single Family', 'Land'];
const PROP_WEIGHTS = [0.55, 0.20, 0.15, 0.10];

function randomPropertyType() {
  return weightedPick(PROP_TYPES, PROP_WEIGHTS);
}

// ─── Acreage by property type ────────────────────────────────────────────────
function randomAcreage(propType) {
  if (propType === 'Manufactured Homes') return +rand(0.75, 10).toFixed(2);
  if (propType === 'Single Family')      return +rand(0.25, 5).toFixed(2);
  if (propType === 'Land')               return +rand(2, 150).toFixed(2);
  return +rand(1, 15).toFixed(2);
}

// ─── Price calculation ────────────────────────────────────────────────────────
function randomListPrice(county, propType, acreage) {
  // Get per-type LP stats for this county
  const lpKey = LP_TYPE[propType] || 'all';
  const lp = (LP_STATS[lpKey] || {})[county.fips] || {};
  let base;
  if (propType === 'Land') {
    const ppaBase = lp.medianPpa || county.medianPpa || 8500;
    base = jitter(ppaBase * acreage, 0.35);
  } else {
    const defaults = { 'Single Family': 295000, 'Manufactured Homes': 235000 };
    const priceBase = lp.medianPrice || county.medianPrice || defaults[propType] || 235000;
    const jitterPct = propType === 'Single Family' ? 0.22 : 0.18;
    base = jitter(priceBase, jitterPct);
    base += (acreage - 2) * 3000;
  }
  return Math.round(Math.max(base, 25000));
}

function randomBeds(propType) {
  if (propType === 'Land') return 0;
  if (propType === 'Single Family') return pick([3, 3, 4, 4, 5]);
  return pick([3, 3, 4, 4, 3]);
}

function randomBaths(propType) {
  if (propType === 'Land') return 0;
  if (propType === 'Single Family') return pick([2, 2.5, 3, 3, 2]);
  return pick([2, 2, 2.5, 3, 2]);
}

function randomSqft(propType, beds) {
  if (propType === 'Land') return 0;
  if (propType === 'Single Family') return randInt(1200, 3200);
  if (beds === 4) return randInt(1600, 2400);
  return randInt(1100, 2000);
}

// ─── Generate 500 active listings ────────────────────────────────────────────
function generateListings(count = 500) {
  const weights = getCountyWeights();
  const listings = [];

  for (let i = 0; i < count; i++) {
    const county = weightedPick(ALL_COUNTIES, weights);
    const propType = randomPropertyType();
    const acreage = randomAcreage(propType);
    const listPrice = randomListPrice(county, propType, acreage);
    const beds = randomBeds(propType);
    const baths = randomBaths(propType);
    const sqft = randomSqft(propType, beds);
    const domBase = county.dom || 90;
    const dom = Math.max(5, Math.round(jitter(domBase, 0.4)));
    const listDate = formatDate(daysAgo(dom));
    const coords = randomCoords(county);
    const zip = getZip(county);
    const floodZones = ['X', 'X', 'X', 'X', 'AE', 'AE', 'A', 'VE'];
    const floodZoneWeights = [0.55, 0.1, 0.1, 0.05, 0.1, 0.05, 0.04, 0.01];

    listings.push({
      mls_id: `MOCK-L-${String(i + 1).padStart(5, '0')}`,
      county_fips: county.fips,
      zip_code: zip,
      lat: +coords.lat.toFixed(6),
      lng: +coords.lng.toFixed(6),
      address: `${randomAddress()}, ${county.name}, ${county.state} ${zip}`,
      list_price: listPrice,
      price_per_acre: +(listPrice / acreage).toFixed(0),
      acreage,
      bedrooms: beds,
      bathrooms: baths,
      sqft,
      days_on_market: dom,
      list_date: listDate,
      status: 'Active',
      property_type: propType,
      year_built: randInt(2005, 2024),
      well_septic: Math.random() > 0.35,
      public_utilities: Math.random() > 0.65,
      flood_zone: weightedPick(floodZones, floodZoneWeights),
      source: 'mock',
    });
  }
  return listings;
}

// ─── Generate 1500 sold comps (24 months) ────────────────────────────────────
function generateSoldComps(count = 1500) {
  const weights = getCountyWeights();
  const comps = [];

  for (let i = 0; i < count; i++) {
    const county = weightedPick(ALL_COUNTIES, weights);
    const propType = randomPropertyType();
    const acreage = randomAcreage(propType);
    const listPrice = randomListPrice(county, propType, acreage);
    const beds = randomBeds(propType);
    const baths = randomBaths(propType);
    const sqft = randomSqft(propType, beds);
    const domBase = county.dom || 90;
    const dom = Math.max(5, Math.round(jitter(domBase, 0.4)));

    // Close date: random within last 24 months
    const closeDaysAgo = randInt(1, 730);
    const closeDate = formatDate(daysAgo(closeDaysAgo));
    const listDate = formatDate(daysAgo(closeDaysAgo + dom));

    // Sale price: typically 94-105% of list (strong market near 100%)
    const ltsRatio = rand(0.93, 1.04);
    const salePrice = Math.round(listPrice * ltsRatio);
    const coords = randomCoords(county);
    const zip = getZip(county);

    comps.push({
      mls_id: `MOCK-C-${String(i + 1).padStart(5, '0')}`,
      county_fips: county.fips,
      zip_code: zip,
      lat: +coords.lat.toFixed(6),
      lng: +coords.lng.toFixed(6),
      address: `${randomAddress()}, ${county.name}, ${county.state} ${zip}`,
      list_price: listPrice,
      sale_price: salePrice,
      price_per_acre: +(salePrice / acreage).toFixed(0),
      acreage,
      bedrooms: beds,
      bathrooms: baths,
      sqft,
      days_on_market: dom,
      list_date: listDate,
      close_date: closeDate,
      list_to_sale_ratio: +(ltsRatio * 100).toFixed(2),
      property_type: propType,
      year_built: randInt(2002, 2024),
      source: 'mock',
    });
  }
  return comps;
}

// ─── LotLine Pipeline Deals — sourced from LotLine DealFlow Pro CRM ─────────
const PIPELINE_DEALS = [
  // ── Land Acquisition pipeline ─────────────────────────────────────────────
  {
    pipeline: 'development',
    address: '577 Colonial Landing Rd SE, Bolivia, NC 28422', county_fips: '37019', zip_code: '28422',
    lat: 34.0612, lng: -78.2381, acreage: 2.1,
    acquisition_price: 28000, home_cost: 107000, closing_costs: 5000, carrying_costs: 38795, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Clayton Majestic 28x60', sqft: 1680, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-08',
    notes: 'Grade A. Contract Signed. Land Clearing stage. Hard Money (Land + Home). Funder: TBD.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: '569 Colonial Landing, Bolivia, NC 28422', county_fips: '37019', zip_code: '28422',
    lat: 34.0598, lng: -78.2415, acreage: 1.9,
    acquisition_price: 28000, home_cost: 107000, closing_costs: 5000, carrying_costs: 39295, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Clayton Majestic 28x60', sqft: 1680, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-08',
    notes: 'Grade A. Contract Signed. Land Clearing stage. Hard Money (Land + Home).', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: '236 Woods Ct, Bolivia, NC 28422', county_fips: '37019', zip_code: '28422',
    lat: 34.0579, lng: -78.2440, acreage: 1.7,
    acquisition_price: 26000, home_cost: 104000, closing_costs: 4800, carrying_costs: 40845, install_costs: 9200,
    target_sale_price: 245000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-08',
    notes: 'Grade B. Contract Signed. Land Clearing stage. Hard Money (Land + Home).', assigned_to: 'James P.',
  },
  {
    pipeline: 'land',
    address: '130 Speaks Rd, Olin, NC 28660', county_fips: '37097', zip_code: '28660',
    lat: 35.9931, lng: -80.8768, acreage: 3.5,
    acquisition_price: 32000, home_cost: 0, closing_costs: 3200, carrying_costs: 0, install_costs: 0,
    target_sale_price: 250000,
    status: 'due_diligence', contract_date: '2026-03-28',
    notes: 'Iredell County. Underwriting.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'land',
    address: '124 Speaks Rd, Olin, NC 28660', county_fips: '37097', zip_code: '28660',
    lat: 35.9918, lng: -80.8755, acreage: 2.8,
    acquisition_price: 25544, home_cost: 0, closing_costs: 3000, carrying_costs: 0, install_costs: 0,
    target_sale_price: 250000,
    status: 'due_diligence', contract_date: '2026-03-28',
    notes: 'Iredell County. Low Margin 14%. Hard Money Loan.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'land',
    address: 'Frank Bullock Rd, Manson, NC 27553', county_fips: '37181', zip_code: '27553',
    lat: 36.5082, lng: -78.4021, acreage: 8.2,
    acquisition_price: 48000, home_cost: 0, closing_costs: 4000, carrying_costs: 0, install_costs: 0,
    target_sale_price: 200000,
    status: 'due_diligence', contract_date: '2026-04-01',
    notes: 'Vance County. Subdivide potential.', assigned_to: 'James P.',
  },
  {
    pipeline: 'land',
    address: 'Lot 3 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2201, lng: -79.4871, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'James P.',
  },
  {
    pipeline: 'land',
    address: 'Lot 4 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2215, lng: -79.4855, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'land',
    address: 'Lot 5 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2229, lng: -79.4838, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'land',
    address: 'Lot 6 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2242, lng: -79.4821, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'James P.',
  },
  {
    pipeline: 'land',
    address: 'Lot 7 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2255, lng: -79.4804, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'land',
    address: 'Lot 8 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2268, lng: -79.4787, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'land',
    address: 'Lot 9 Creek Landing Rd, Nichols, SC 29581', county_fips: '45067', zip_code: '29581',
    lat: 34.2281, lng: -79.4770, acreage: 1.5,
    acquisition_price: 30000, home_cost: 112000, closing_costs: 5500, carrying_costs: 40295, install_costs: 10500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'under_contract', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Land Clearing. Closing 05/12/2026.', assigned_to: 'James P.',
  },
  // ── Development pipeline (Deal Overview) ──────────────────────────────────
  {
    pipeline: 'development',
    address: 'Blue Newkirk Rd, Magnolia, NC 28453', county_fips: '37061', zip_code: '28453',
    lat: 34.9221, lng: -77.9518, acreage: 2.8,
    acquisition_price: 30000, home_cost: 108000, closing_costs: 5000, carrying_costs: 36620, install_costs: 9500,
    target_sale_price: 260000, home_model: 'Clayton Everton 28x60', sqft: 1680, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-31',
    notes: 'Grade A. Funder: Atium Build Group LLC. Subdivide. Hard Money (Land + Home). Day 8.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: '10-6 Marion Rd, Dorchester, SC 29437', county_fips: '45035', zip_code: '29437',
    lat: 33.1014, lng: -80.4381, acreage: 2.0,
    acquisition_price: 38000, home_cost: 128000, closing_costs: 6000, carrying_costs: 40820, install_costs: 10000,
    target_sale_price: 300000, home_model: 'Clayton Big House 32x60', sqft: 1920, bedrooms: 4, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-07',
    notes: 'Grade A. Funder: Atium Build Group LLC. Hard Money (Land + Home). Day 1.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: '10-5 Marion Rd, Dorchester, SC 29437', county_fips: '45035', zip_code: '29437',
    lat: 33.1028, lng: -80.4362, acreage: 2.0,
    acquisition_price: 38000, home_cost: 128000, closing_costs: 6000, carrying_costs: 40820, install_costs: 10000,
    target_sale_price: 300000, home_model: 'Clayton Big House 32x60', sqft: 1920, bedrooms: 4, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-07',
    notes: 'Grade A. Funder: Louis Isom. Hard Money (Land + Home). Day 1.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: '10-2 Marion Rd, Dorchester, SC 29437', county_fips: '45035', zip_code: '29437',
    lat: 33.1043, lng: -80.4398, acreage: 2.0,
    acquisition_price: 38000, home_cost: 128000, closing_costs: 6000, carrying_costs: 40820, install_costs: 10000,
    target_sale_price: 300000, home_model: 'Clayton Big House 32x60', sqft: 1920, bedrooms: 4, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-07',
    notes: 'Grade A. Funder: Blue Bay Capital. Hard Money (Land + Home). Day 1.', assigned_to: 'James P.',
  },
  {
    pipeline: 'development',
    address: '10-3 Marion Rd, Dorchester, SC 29437', county_fips: '45035', zip_code: '29437',
    lat: 33.1057, lng: -80.4377, acreage: 2.0,
    acquisition_price: 38000, home_cost: 128000, closing_costs: 6000, carrying_costs: 40820, install_costs: 10000,
    target_sale_price: 300000, home_model: 'Clayton Big House 32x60', sqft: 1920, bedrooms: 4, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-07',
    notes: 'Grade A. Funder: Atium Build Group LLC. Hard Money (Land + Home). Day 1.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: '10-4 Marion Rd, Dorchester, SC 29437', county_fips: '45035', zip_code: '29437',
    lat: 33.1069, lng: -80.4355, acreage: 2.0,
    acquisition_price: 38000, home_cost: 128000, closing_costs: 6000, carrying_costs: 40820, install_costs: 10000,
    target_sale_price: 300000, home_model: 'Clayton Big House 32x60', sqft: 1920, bedrooms: 4, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-07',
    notes: 'Grade A. Funder: Windstone. Hard Money (Land + Home). Day 1.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: '510 Walton Ln, Tyner, NC 27980', county_fips: '37091', zip_code: '27980',
    lat: 36.2891, lng: -76.9415, acreage: 3.2,
    acquisition_price: 25000, home_cost: 96000, closing_costs: 4500, carrying_costs: 35920, install_costs: 9000,
    target_sale_price: 230000, home_model: 'Fleetwood Southwick 28x52', sqft: 1456, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-07',
    notes: 'Grade A. Funder: Atium Build Group LLC. Land Clearing. Hard Money (Land + Home). Day 1.', assigned_to: 'James P.',
  },
  {
    pipeline: 'development',
    address: '10-1 Marion Rd, Dorchester, SC 29437', county_fips: '45035', zip_code: '29437',
    lat: 33.0998, lng: -80.4410, acreage: 1.8,
    acquisition_price: 36000, home_cost: 122000, closing_costs: 5800, carrying_costs: 40373, install_costs: 10500,
    target_sale_price: 265000, home_model: 'Clayton Majestic 28x60', sqft: 1680, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-04-08',
    notes: 'Grade C. Funder: Windstone. Hard Money Loan. Day 0.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: 'Swanson Rd, Crouse, NC 28033', county_fips: '37109', zip_code: '28033',
    lat: 35.4712, lng: -81.2398, acreage: 2.6,
    acquisition_price: 28000, home_cost: 101000, closing_costs: 4800, carrying_costs: 36292, install_costs: 9500,
    target_sale_price: 235000, home_model: 'Clayton Majestic 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'permit_pending', contract_date: '2026-02-13',
    notes: 'Grade B. Cash deal. Land Clearing. Day 54. Active development.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: 'Erwin Temple Church Rd, Woodleaf, NC 27054', county_fips: '37159', zip_code: '27054',
    lat: 35.6318, lng: -80.5241, acreage: 3.1,
    acquisition_price: 27000, home_cost: 100000, closing_costs: 4800, carrying_costs: 35895, install_costs: 9500,
    target_sale_price: 235000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'permit_pending', contract_date: '2026-03-27',
    notes: 'Grade A. Funder: Louis Isom. Hard Money (Land + Home). Day 12. Active development.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: '0 Henry Jenkins Rd, Mooresboro, NC 28114', county_fips: '37161', zip_code: '28114',
    lat: 35.3921, lng: -81.9618, acreage: 1.16,
    acquisition_price: 27000, home_cost: 77000, closing_costs: 5000, carrying_costs: 36313, install_costs: 9000,
    target_sale_price: 245000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-15', close_date: '2026-04-29',
    notes: 'Grade A. Funder: Louis Isom. Hard Money (Land + Home). Rutherford County.', assigned_to: 'James P.',
  },
  {
    pipeline: 'development',
    address: 'Lot 3 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2201, lng: -79.4871, acreage: 4.18,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'James P.',
  },
  {
    pipeline: 'development',
    address: 'Lot 4 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2215, lng: -79.4888, acreage: 4.2,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: 'Lot 5 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2229, lng: -79.4905, acreage: 3.76,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: 'Lot 6 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2243, lng: -79.4922, acreage: 3.78,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'James P.',
  },
  {
    pipeline: 'development',
    address: 'Lot 7 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2257, lng: -79.4939, acreage: 3.5,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'Sarah K.',
  },
  {
    pipeline: 'development',
    address: 'Lot 8 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2271, lng: -79.4956, acreage: 3.03,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'Marcus T.',
  },
  {
    pipeline: 'development',
    address: 'Lot 9 Creek Landing Rd, Nichols, SC 29581', county_fips: '45051', zip_code: '29581',
    lat: 34.2285, lng: -79.4973, acreage: 3.5,
    acquisition_price: 34000, home_cost: 84000, closing_costs: 5500, carrying_costs: 17170, install_costs: 9500,
    target_sale_price: 255000, home_model: 'Fleetwood Weston 28x56', sqft: 1568, bedrooms: 3, bathrooms: 2,
    status: 'due_diligence', contract_date: '2026-03-20', close_date: '2026-05-12',
    notes: 'Grade B. Cash deal. Horry County. Closing 05/12/2026.', assigned_to: 'James P.',
  },
];

// Compute derived financials for each deal
function enrichDeals() {
  return PIPELINE_DEALS.map((d, i) => {
    const allIn = d.acquisition_price + d.home_cost +
      (d.closing_costs || 0) + (d.carrying_costs || 0) + (d.install_costs || 0);
    const projProfit = d.target_sale_price - allIn;
    const projROI = (projProfit / allIn) * 100;

    const actualProfit = d.actual_sale_price
      ? d.actual_sale_price - allIn
      : null;
    const actualROI = d.actual_sale_price
      ? (actualProfit / allIn) * 100
      : null;

    let daysToClose = null;
    if (d.contract_date && d.close_date) {
      daysToClose = Math.round(
        (new Date(d.close_date) - new Date(d.contract_date)) / 86400000
      );
    }

    return {
      ...d,
      id: `DEAL-${String(i + 1).padStart(3, '0')}`,
      all_in_cost: allIn,
      projected_profit: Math.round(projProfit),
      projected_roi_pct: +projROI.toFixed(1),
      actual_profit: actualProfit !== null ? Math.round(actualProfit) : null,
      actual_roi_pct: actualROI !== null ? +actualROI.toFixed(1) : null,
      days_to_close: daysToClose,
      created_at: daysAgo(randInt(30, 200)).toISOString(),
    };
  });
}

module.exports = { generateListings, generateSoldComps, enrichDeals };
