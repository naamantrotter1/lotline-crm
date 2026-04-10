/**
 * LotLine Intelligence — Mock Server (no database required)
 * Serves all API endpoints from in-memory generated data.
 * Run with: node src/mock-server.js
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const { ALL_COUNTIES } = require('./data/counties');
const { generateListings, generateSoldComps, enrichDeals } = require('./services/mockData');
const { calcAllStats, calcCountyStats } = require('./services/metrics');
const LP_STATS = require('./data/lp_stats.json'); // Land Portal per-type stats

// Map LotLine propertyType filter values -> LP stats type keys
const PROP_TYPE_MAP = {
  'All':               'all',
  'Manufactured Homes':'mfg',
  'Single Family':     'sf',
  'Land':              'land',
};

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
// Allow Private Network Access requests (e.g. from https pages to localhost)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network');
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json({ limit: '10mb' }));

// ── Pre-generate all data on startup ────────────────────────────────────────
console.log('🌱 Generating mock data...');
const LISTINGS  = generateListings(800);
const COMPS     = generateSoldComps(5000);
const DEALS     = enrichDeals();
const ALL_STATS = calcAllStats(ALL_COUNTIES, LISTINGS, COMPS);

// Build county lookup maps
const countyByFips = {};
ALL_COUNTIES.forEach(c => { countyByFips[c.fips] = c; });

const statsByFipsPeriod = {};
ALL_STATS.forEach(s => {
  const key = `${s.county_fips}|${s.period}`;
  statsByFipsPeriod[key] = s;
});

console.log(`✅ Ready: ${ALL_COUNTIES.length} counties, ${LISTINGS.length} listings, ${COMPS.length} comps, ${DEALS.length} deals\n`);

// Dynamic stats cache (computed on demand for non-default filter combos)
const dynamicStatsCache = {};
function getDynamicStats(county, period, acreageRange, listingStatus, propertyType) {
  const key = `${county.fips}|${period}|${acreageRange}|${listingStatus}|${propertyType}`;
  if (!dynamicStatsCache[key]) {
    dynamicStatsCache[key] = calcCountyStats(county, LISTINGS, COMPS, period, acreageRange, listingStatus, propertyType);
  }
  return dynamicStatsCache[key];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
};

function countyToRow(c, period='90d', propertyType='All', acreageRange='All', listingStatus='sold') {
  // Use dynamic stats whenever any filter deviates from the pre-computed default
  const isDefault = acreageRange === 'All' && listingStatus === 'sold' && propertyType === 'All';
  const stats = isDefault
    ? (statsByFipsPeriod[`${c.fips}|${period}`] || {})
    : getDynamicStats(c, period, acreageRange, listingStatus, propertyType);

  // LP stats as fallback — use type-specific LP data, but only when no specific acreage filter
  const lpKey = PROP_TYPE_MAP[propertyType] || 'all';
  const lp = acreageRange === 'All' && listingStatus !== 'for_sale'
    ? ((LP_STATS[lpKey] || {})[c.fips] || {})
    : {};

  return {
    id: c.fips, fips_code: c.fips, name: c.name, state: c.state,
    lat: c.lat, lng: c.lng,
    population: c.pop, growth_pct: c.growth,
    median_income: c.income, median_home_value: c.homeValue,
    unemployment_rate: c.unemployment, flood_risk_pct: c.floodRisk,
    mh_friendly_zoning: c.mhFriendly, priority_market: c.priority,
    // stats — comp/listing stats are primary (period/filter-sensitive); LP data is fallback for counties with no comps
    active_listings:       stats.active_listings,
    sold_count:            stats.sold_count,
    median_list_price:     stats.median_list_price     ?? lp.medianPrice ?? null,
    median_sale_price:     stats.median_sale_price     ?? lp.medianPrice ?? null,
    median_price_per_acre: stats.median_price_per_acre ?? lp.medianPpa   ?? null,
    median_days_on_market: stats.median_days_on_market ?? lp.dom         ?? null,
    absorption_rate_pct:   stats.absorption_rate_pct   ?? lp.absorption  ?? null,
    months_of_supply:      stats.months_of_supply      ?? lp.mos         ?? null,
    sell_through_rate_pct: stats.sell_through_rate_pct ?? lp.str         ?? null,
    list_to_sale_ratio_pct:stats.list_to_sale_ratio_pct,
    demand_score:          stats.demand_score,
    opportunity_score:     stats.opportunity_score,
  };
}

// ── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status:'ok', mode:'mock', version:'1.0.0' }));

// ── GET /api/counties ────────────────────────────────────────────────────────
app.get('/api/counties', (req, res) => {
  const { state, period='90d', propertyType='All', acreageRange='All', listingStatus='sold' } = req.query;
  let counties = ALL_COUNTIES;
  if (state && state !== 'Both') counties = counties.filter(c => c.state === state);
  res.json({ data: counties.map(c => countyToRow(c, period, propertyType, acreageRange, listingStatus)), count: counties.length });
});

// ── GET /api/counties/:fips ──────────────────────────────────────────────────
app.get('/api/counties/:fips', (req, res) => {
  const county = countyByFips[req.params.fips];
  if (!county) return res.status(404).json({ error: 'County not found' });

  const stats = ['7d','14d','30d','90d','6mo','1yr','2yr','3yr','5yr'].map(p => ({
    period: p, acreage_bucket: 'all',
    ...(statsByFipsPeriod[`${county.fips}|${p}`] || {}),
  }));

  const listings = LISTINGS.filter(l => l.county_fips === county.fips).slice(0, 20);
  const comps    = COMPS.filter(c => c.county_fips === county.fips)
    .sort((a,b) => b.close_date.localeCompare(a.close_date)).slice(0, 20);
  const deals    = DEALS.filter(d => d.county_fips === county.fips);

  res.json({
    county: {
      fips_code: county.fips, name: county.name, state: county.state,
      centroid_lat: county.lat, centroid_lng: county.lng,
      population: county.pop, population_growth_pct: county.growth,
      median_household_income: county.income, median_home_value: county.homeValue,
      unemployment_rate: county.unemployment, flood_risk_pct: county.floodRisk,
      mh_friendly_zoning: county.mhFriendly, priority_market: county.priority,
    },
    stats, listings, comps, deals,
  });
});

// ── GET /api/counties/:fips/trend ────────────────────────────────────────────
app.get('/api/counties/:fips/trend', (req, res) => {
  const countyComps = COMPS.filter(c => c.county_fips === req.params.fips);

  // Group by month
  const byMonth = {};
  countyComps.forEach(c => {
    const month = c.close_date.slice(0,7) + '-01';
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(c);
  });

  const data = Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).map(([month, cs]) => ({
    month,
    sales:        cs.length,
    median_price: median(cs.map(c => c.sale_price)),
    median_dom:   median(cs.map(c => c.days_on_market)),
    avg_lts:      cs.reduce((s,c) => s + (c.list_to_sale_ratio||0),0) / cs.length,
  }));

  res.json({ data });
});

// ── GET /api/listings ────────────────────────────────────────────────────────
app.get('/api/listings', (req, res) => {
  const { state, county_fips, min_price, max_price, min_acres, max_acres,
          property_type, limit=100, offset=0 } = req.query;
  let data = LISTINGS;
  if (state && state !== 'Both') {
    const fips = ALL_COUNTIES.filter(c=>c.state===state).map(c=>c.fips);
    data = data.filter(l => fips.includes(l.county_fips));
  }
  if (county_fips) data = data.filter(l => l.county_fips === county_fips);
  if (min_price)   data = data.filter(l => l.list_price >= Number(min_price));
  if (max_price)   data = data.filter(l => l.list_price <= Number(max_price));
  if (min_acres)   data = data.filter(l => l.acreage >= Number(min_acres));
  if (max_acres)   data = data.filter(l => l.acreage <= Number(max_acres));
  if (property_type && property_type !== 'All') data = data.filter(l => l.property_type === property_type);

  const enriched = data.map(l => ({
    ...l,
    county_fips: l.county_fips,
    county_name: countyByFips[l.county_fips]?.name,
    state:       countyByFips[l.county_fips]?.state,
  }));

  const total = enriched.length;
  res.json({ data: enriched.slice(Number(offset), Number(offset)+Number(limit)), total });
});

// ── GET /api/comps ───────────────────────────────────────────────────────────
app.get('/api/comps', (req, res) => {
  const { state, county_fips, min_price, max_price, min_acres, max_acres,
          property_type, date_from, date_to, max_dom, limit=200, offset=0, sort='close_date' } = req.query;
  let data = COMPS;

  if (state && state !== 'Both') {
    const fips = ALL_COUNTIES.filter(c=>c.state===state).map(c=>c.fips);
    data = data.filter(c => fips.includes(c.county_fips));
  }
  if (county_fips)  data = data.filter(c => c.county_fips === county_fips);
  if (min_price)    data = data.filter(c => c.sale_price >= Number(min_price));
  if (max_price)    data = data.filter(c => c.sale_price <= Number(max_price));
  if (min_acres)    data = data.filter(c => c.acreage >= Number(min_acres));
  if (max_acres)    data = data.filter(c => c.acreage <= Number(max_acres));
  if (property_type && property_type !== 'All') data = data.filter(c => c.property_type === property_type);
  if (date_from)    data = data.filter(c => c.close_date >= date_from);
  if (date_to)      data = data.filter(c => c.close_date <= date_to);
  if (max_dom)      data = data.filter(c => c.days_on_market <= Number(max_dom));

  data.sort((a,b) => (b[sort]||'').toString().localeCompare((a[sort]||'').toString()));

  const enriched = data.map(c => ({
    ...c,
    county_name: countyByFips[c.county_fips]?.name,
    state:       countyByFips[c.county_fips]?.state,
  }));

  res.json({ data: enriched.slice(Number(offset), Number(offset)+Number(limit)), total: enriched.length });
});

// ── GET /api/comps/summary ───────────────────────────────────────────────────
app.get('/api/comps/summary', (req, res) => {
  const { county_fips, state } = req.query;
  let data = COMPS;
  if (county_fips) data = data.filter(c => c.county_fips === county_fips);
  if (state && state !== 'Both') {
    const fips = ALL_COUNTIES.filter(c=>c.state===state).map(c=>c.fips);
    data = data.filter(c => fips.includes(c.county_fips));
  }
  const prices = data.map(c=>c.sale_price).filter(Boolean);
  res.json({
    total_sales:       data.length,
    median_sale_price: median(prices),
    median_list_price: median(data.map(c=>c.list_price).filter(Boolean)),
    median_dom:        median(data.map(c=>c.days_on_market).filter(Boolean)),
    median_ppa:        median(data.map(c=>c.price_per_acre).filter(Boolean)),
    median_lts:        median(data.map(c=>c.list_to_sale_ratio).filter(Boolean)),
    median_acreage:    median(data.map(c=>c.acreage).filter(Boolean)),
    avg_sale_price:    prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : null,
    min_sale_price:    prices.length ? Math.min(...prices) : null,
    max_sale_price:    prices.length ? Math.max(...prices) : null,
  });
});

// ── GET /api/deals ───────────────────────────────────────────────────────────
app.get('/api/deals', (req, res) => {
  const { status, state } = req.query;
  let data = DEALS.map(d => ({
    ...d,
    id: d.id,
    county_name: countyByFips[d.county_fips]?.name,
    state:       countyByFips[d.county_fips]?.state,
  }));
  if (status) data = data.filter(d => d.status === status);
  if (state && state !== 'Both') data = data.filter(d => d.state === state);

  const active = data.filter(d => !['closed','dead'].includes(d.status));
  const closed = data.filter(d => d.status === 'closed');
  const summary = {
    total_active:      active.length,
    total_invested:    active.reduce((s,d) => s + (d.all_in_cost||0), 0),
    projected_profit:  active.reduce((s,d) => s + (d.projected_profit||0), 0),
    avg_projected_roi: active.length ? active.reduce((s,d)=>s+(d.projected_roi_pct||0),0)/active.length : 0,
    closed_deals:      closed.length,
    total_actual_profit: closed.reduce((s,d) => s + (d.actual_profit||0), 0),
  };
  res.json({ data, summary });
});

// ── GET /api/deals/:id ───────────────────────────────────────────────────────
app.get('/api/deals/:id', (req, res) => {
  const deal = DEALS.find(d => d.id === req.params.id);
  if (!deal) return res.status(404).json({ error: 'Not found' });
  const stats = statsByFipsPeriod[`${deal.county_fips}|90d`];
  res.json({ deal: { ...deal, county_name: countyByFips[deal.county_fips]?.name }, market_context: stats });
});

// ── GET /api/stats/counties ───────────────────────────────────────────────────
app.get('/api/stats/counties', (req, res) => {
  const { period='90d', state, sort='opportunity_score' } = req.query;
  let counties = ALL_COUNTIES;
  if (state && state !== 'Both') counties = counties.filter(c => c.state === state);

  let data = counties.map(c => countyToRow(c, period));
  data.sort((a,b) => (b[sort]||0) - (a[sort]||0));
  res.json({ data, count: data.length, period });
});

// ── GET /api/stats/top-markets ────────────────────────────────────────────────
app.get('/api/stats/top-markets', (req, res) => {
  const { limit=10, period='90d', state } = req.query;
  let data = ALL_COUNTIES.map(c => countyToRow(c, period));
  if (state && state !== 'Both') data = data.filter(r => r.state === state);
  data.sort((a,b) => (b.opportunity_score||0) - (a.opportunity_score||0));
  res.json({ data: data.slice(0, Number(limit)), period });
});

// ── GET /api/stats/overview ───────────────────────────────────────────────────
app.get('/api/stats/overview', (req, res) => {
  const { state } = req.query;
  let listings = LISTINGS;
  let comps90  = COMPS.filter(c => {
    const d = new Date(c.close_date);
    return d >= new Date(Date.now() - 90*24*3600*1000);
  });
  if (state && state !== 'Both') {
    const fips = ALL_COUNTIES.filter(c=>c.state===state).map(c=>c.fips);
    listings = listings.filter(l => fips.includes(l.county_fips));
    comps90  = comps90.filter(c => fips.includes(c.county_fips));
  }
  const prices = comps90.map(c=>c.sale_price).filter(Boolean).sort((a,b)=>a-b);
  const mid = Math.floor(prices.length/2);
  res.json({
    active_listings:  listings.length,
    sales_90d:        comps90.length,
    median_price_90d: prices.length ? (prices.length%2?prices[mid]:(prices[mid-1]+prices[mid])/2) : null,
    active_deals:     DEALS.filter(d=>!['closed','dead'].includes(d.status)).length,
  });
});

// ── GET /api/reports/county/:fips ─────────────────────────────────────────────
app.get('/api/reports/county/:fips', (req, res) => {
  const { fips } = req.params;
  const { period='90d' } = req.query;
  const county = countyByFips[fips];
  if (!county) return res.status(404).json({ error: 'Not found' });

  const stats = ['30d','90d','6mo','1yr','2yr'].map(p => ({
    period: p, ...(statsByFipsPeriod[`${fips}|${p}`] || {}),
  }));

  const countyComps = COMPS.filter(c => c.county_fips === fips);
  const byMonth = {};
  countyComps.forEach(c => {
    const m = c.close_date.slice(0,7)+'-01';
    if (!byMonth[m]) byMonth[m]=[];
    byMonth[m].push(c);
  });
  const trend = Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([month,cs])=>({
    month, sales: cs.length,
    median_price: median(cs.map(c=>c.sale_price)),
    median_dom:   median(cs.map(c=>c.days_on_market)),
    avg_lts:      cs.reduce((s,c)=>s+(c.list_to_sale_ratio||0),0)/cs.length,
  }));

  const comparable = ALL_COUNTIES
    .filter(c => c.state===county.state && c.fips!==fips)
    .map(c => ({ ...countyToRow(c, period), name: c.name, fips_code: c.fips }))
    .sort((a,b)=>(b.opportunity_score||0)-(a.opportunity_score||0))
    .slice(0, 5);

  res.json({
    county: {
      fips_code: county.fips, name: county.name, state: county.state,
      population: county.pop, population_growth_pct: county.growth,
      median_household_income: county.income, median_home_value: county.homeValue,
      unemployment_rate: county.unemployment, flood_risk_pct: county.floodRisk,
      mh_friendly_zoning: county.mhFriendly, priority_market: county.priority,
    },
    stats, current_stats: stats.find(s=>s.period===period),
    trend, comparable_markets: comparable,
    generated_at: new Date().toISOString(),
  });
});

// ── GET /api/reports/best-markets ────────────────────────────────────────────
app.get('/api/reports/best-markets', (req, res) => {
  const { period='90d', state } = req.query;
  let data = ALL_COUNTIES.map((c,i) => ({ ...countyToRow(c,period), rank: i+1 }));
  if (state && state !== 'Both') data = data.filter(r => r.state===state);
  data.sort((a,b)=>(b.opportunity_score||0)-(a.opportunity_score||0));
  data = data.map((r,i)=>({...r, rank:i+1}));
  res.json({ data, count: data.length, period });
});

// ── GET /api/zip-stats ────────────────────────────────────────────────────────
app.get('/api/zip-stats', (req, res) => {
  const { state, period = '90d' } = req.query;

  const stateFips = state && state !== 'Both'
    ? ALL_COUNTIES.filter(c => c.state === state).map(c => c.fips)
    : null;

  const filteredListings = stateFips
    ? LISTINGS.filter(l => stateFips.includes(l.county_fips))
    : LISTINGS;
  const filteredComps = stateFips
    ? COMPS.filter(c => stateFips.includes(c.county_fips))
    : COMPS;

  // Aggregate by zip code
  const zipMap = {};
  filteredListings.forEach(l => {
    if (!l.zip_code) return;
    if (!zipMap[l.zip_code]) zipMap[l.zip_code] = { zip_code: l.zip_code, county_fips: l.county_fips, listings: [], comps: [] };
    zipMap[l.zip_code].listings.push(l);
  });
  filteredComps.forEach(c => {
    if (!c.zip_code) return;
    if (!zipMap[c.zip_code]) zipMap[c.zip_code] = { zip_code: c.zip_code, county_fips: c.county_fips, listings: [], comps: [] };
    zipMap[c.zip_code].comps.push(c);
  });

  const data = Object.values(zipMap).map(z => {
    const salePrices = z.comps.map(c => c.sale_price).filter(Boolean).sort((a, b) => a - b);
    const listPrices = z.listings.map(l => l.list_price).filter(Boolean).sort((a, b) => a - b);
    const doms = z.listings.map(l => l.days_on_market).filter(Boolean).sort((a, b) => a - b);
    const mid = (arr) => arr.length ? (arr.length % 2 ? arr[Math.floor(arr.length / 2)] : (arr[Math.floor(arr.length / 2) - 1] + arr[Math.floor(arr.length / 2)]) / 2) : null;

    const countyStats = statsByFipsPeriod[`${z.county_fips}|${period}`] || {};
    const baseScore = countyStats.opportunity_score || 50;
    // Vary the score slightly by zip absorption ratio
    const totalTx = z.comps.length + z.listings.length;
    const absorption = totalTx > 0 ? z.comps.length / totalTx : 0.5;
    const zipScore = Math.min(99, Math.max(1, baseScore + (absorption - 0.5) * 30));

    return {
      zip_code: z.zip_code,
      county_fips: z.county_fips,
      active_listings: z.listings.length,
      sold_count: z.comps.length,
      median_list_price: mid(listPrices),
      median_sale_price: mid(salePrices),
      median_days_on_market: mid(doms),
      opportunity_score: +zipScore.toFixed(1),
      demand_score: countyStats.demand_score || null,
      absorption_rate_pct: countyStats.absorption_rate_pct || null,
      months_of_supply: countyStats.months_of_supply || null,
    };
  });

  res.json({ data, count: data.length });
});

// ── POST /api/import-lp-stats (one-shot: saves Land Portal per-type stats to disk) ──
const fs = require('fs');
const LP_STATS_PATH = require('path').join(__dirname, 'data/lp_stats.json');
app.post('/api/import-lp-stats', (req, res) => {
  try {
    fs.writeFileSync(LP_STATS_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true, types: Object.keys(req.body), sample: Object.keys(req.body.all || {}).slice(0,3) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── WMS Proxy (bypasses browser ORB/CORS blocking for federal WMS services) ──
const https = require('https');
const http  = require('http');

const WMS_UPSTREAM = {
  water: 'https://hydro.nationalmap.gov/arcgis/services/NHDPlus_HR/MapServer/WMSServer',
};

app.get('/proxy/wms/:service', (req, res) => {
  const upstream = WMS_UPSTREAM[req.params.service];
  if (!upstream) return res.status(404).json({ error: 'Unknown service' });

  const qs = new URLSearchParams(req.query).toString();
  const url = `${upstream}?${qs}`;

  const lib = url.startsWith('https') ? https : http;
  lib.get(url, {
    headers: { 'User-Agent': 'LotLine-CRM/1.0' },
  }, (upstream_res) => {
    res.set('Content-Type', upstream_res.headers['content-type'] || 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    upstream_res.pipe(res);
  }).on('error', (err) => {
    res.status(502).json({ error: err.message });
  });
});

// ── GeoJSON Proxies (Esri ArcGIS REST feature services for FEMA + Wetlands) ──

// In-memory cache: key → { data, expires }
const geoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Round bbox coords to ~0.1° (~10km) grid to maximise cache hits while panning
function bboxCacheKey(prefix, bbox) {
  const parts = bbox.split(',').map(n => (Math.round(Number(n) * 10) / 10).toFixed(1));
  return `${prefix}:${parts.join(',')}`;
}

function getCached(key) {
  const entry = geoCache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  geoCache.delete(key);
  return null;
}

function proxyGeoJSON(url, res, cacheKey) {
  if (cacheKey) {
    const hit = getCached(cacheKey);
    if (hit) {
      res.set('Content-Type', 'application/json');
      res.set('Cache-Control', 'public, max-age=600');
      return res.send(hit);
    }
  }
  let body = '';
  https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (upstream_res) => {
    upstream_res.on('data', chunk => body += chunk);
    upstream_res.on('end', () => {
      if (cacheKey) geoCache.set(cacheKey, { data: body, expires: Date.now() + CACHE_TTL });
      res.set('Content-Type', 'application/json');
      res.set('Cache-Control', 'public, max-age=600');
      res.send(body);
    });
  }).on('error', err => res.status(502).json({ error: err.message }));
}

app.get('/api/proxy/flood-zones', (req, res) => {
  const { bbox } = req.query; // "minLng,minLat,maxLng,maxLat"
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geometry = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    where: "SFHA_TF = 'T'",
    geometryType: 'esriGeometryEnvelope',
    geometry,
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY',
    maxAllowableOffset: '0',
    f: 'geojson',
    resultRecordCount: '1000',
  });
  proxyGeoJSON(`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query?${params}`, res, bboxCacheKey('flood', bbox));
});

app.get('/api/proxy/wetlands', (req, res) => {
  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geometry = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    where: '1=1',
    geometryType: 'esriGeometryEnvelope',
    geometry,
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'WETLAND_TYPE,ATTRIBUTE',
    maxAllowableOffset: '0',
    f: 'geojson',
    resultRecordCount: '1000',
  });
  proxyGeoJSON(`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Wetlands/FeatureServer/0/query?${params}`, res, bboxCacheKey('wetlands', bbox));
});

// ── Buildability: flood zones + wetlands within a parcel bbox ─────────────────
// Calculate slope stats from USGS 3DEP elevation samples arranged in a grid
function calcSlopeStats(samples, midLat) {
  if (!samples || samples.length < 9) return null;
  const valid = samples.filter(s => s.value != null && s.value !== 'NoData' && s.value !== -9999);
  if (valid.length < 9) return null;

  // Sort into row-major grid (top→bottom, left→right)
  const sorted = [...valid].sort((a, b) => {
    const dy = b.location.y - a.location.y;
    if (Math.abs(dy) > 1e-6) return dy;
    return a.location.x - b.location.x;
  });

  const gridN = Math.round(Math.sqrt(sorted.length));
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(midLat * Math.PI / 180);

  const slopes = [];
  for (let r = 0; r < gridN - 1; r++) {
    for (let c = 0; c < gridN - 1; c++) {
      const idx = r * gridN + c;
      const tl = sorted[idx], tr = sorted[idx + 1], bl = sorted[idx + gridN];
      if (!tl || !tr || !bl) continue;
      const dx = (tr.location.x - tl.location.x) * mPerLng;
      const dy = (tl.location.y - bl.location.y) * mPerLat;
      if (dx < 0.1 || dy < 0.1) continue;
      const dzx = parseFloat(tr.value) - parseFloat(tl.value);
      const dzy = parseFloat(tl.value) - parseFloat(bl.value);
      const slopePct = Math.sqrt((dzx / dx) ** 2 + (dzy / dy) ** 2) * 100;
      if (isFinite(slopePct)) slopes.push(slopePct);
    }
  }

  if (!slopes.length) return null;
  const n = slopes.length;
  const count = (lo, hi) => slopes.filter(s => s >= lo && (hi == null || s < hi)).length;
  return {
    avg: (slopes.reduce((a, v) => a + v, 0) / n).toFixed(2),
    flat:     +((count(0, 0.5) / n) * 100).toFixed(1),
    minimal:  +((count(0.5, 5) / n) * 100).toFixed(1),
    moderate: +((count(5, 10) / n) * 100).toFixed(1),
    heavy:    +((count(10, 15) / n) * 100).toFixed(1),
    extreme:  +((count(15) / n) * 100).toFixed(1),
  };
}

app.get('/api/proxy/buildability', (req, res) => {
  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geomEnv = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });

  const fetchJSON = (url) => new Promise((resolve) => {
    let body = '';
    https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', c => body += c);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    }).on('error', () => resolve({}));
  });

  const floodParams = new URLSearchParams({ where: "SFHA_TF = 'T'", geometryType: 'esriGeometryEnvelope', geometry: geomEnv, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE,ZONE_SUBTY', f: 'geojson', resultRecordCount: '500' });
  const wetlandParams = new URLSearchParams({ where: '1=1', geometryType: 'esriGeometryEnvelope', geometry: geomEnv, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'WETLAND_TYPE,ATTRIBUTE', f: 'geojson', resultRecordCount: '500' });
  const elevParams = new URLSearchParams({ geometry: geomEnv, geometryType: 'esriGeometryEnvelope', sampleCount: '144', returnFirstValueOnly: 'false', f: 'json' });

  Promise.all([
    fetchJSON(`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query?${floodParams}`),
    fetchJSON(`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Wetlands/FeatureServer/0/query?${wetlandParams}`),
    fetchJSON(`https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples?${elevParams}`),
  ]).then(([floodData, wetlandData, elevData]) => {
    const midLat = (minLat + maxLat) / 2;
    const slope = calcSlopeStats(elevData.samples, midLat);
    res.json({
      flood: { type: 'FeatureCollection', features: floodData.features || [] },
      wetlands: { type: 'FeatureCollection', features: wetlandData.features || [] },
      slope,
    });
  }).catch(err => res.status(502).json({ error: err.message }));
});

app.get('/api/proxy/contours', (req, res) => {
  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geomEnv = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });

  // Query both index contours (layer 0) and intermediate contours (layer 1) from USGS National Map
  // Layer 25 = Normal Index Contours, 26 = Normal Intermediate Contours (USGS National Map)
  const makeParams = (isIndex) => new URLSearchParams({
    geometry: geomEnv, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'contourelevation,contourunits,contourinterval',
    returnGeometry: 'true', f: 'geojson', resultRecordCount: '500',
  });

  const fetchLayer = (layer, isIndex) => new Promise((resolve) => {
    const url = `https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/${layer}/query?${makeParams(isIndex)}`;
    let body = '';
    https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', c => body += c);
      r.on('end', () => {
        try {
          const features = JSON.parse(body).features || [];
          // Tag each feature with its type for frontend styling
          features.forEach(f => { f.properties._isIndex = isIndex; });
          resolve(features);
        } catch { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });

  Promise.all([fetchLayer(25, true), fetchLayer(26, false)])
    .then(([indexFeatures, intermediateFeatures]) => {
      res.json({
        type: 'FeatureCollection',
        features: [...indexFeatures, ...intermediateFeatures],
      });
    })
    .catch(err => res.status(502).json({ error: err.message }));
});

app.get('/api/proxy/water', (req, res) => {
  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geometry = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });
  const baseParams = {
    where: '1=1',
    geometryType: 'esriGeometryEnvelope',
    geometry,
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'GNIS_NAME,FType',
    maxAllowableOffset: '0',
    f: 'geojson',
    resultRecordCount: '500',
  };

  // Fetch flowlines (layer 3) + waterbodies (layer 9) in parallel and merge
  const fetchLayer = (layer) => new Promise((resolve) => {
    const url = `https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer/${layer}/query?${new URLSearchParams(baseParams)}`;
    https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => {
        try { resolve(JSON.parse(body).features || []); } catch { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });

  const cacheKey = bboxCacheKey('water', bbox);
  const hit = getCached(cacheKey);
  if (hit) {
    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=600');
    return res.send(hit);
  }

  Promise.all([fetchLayer(3), fetchLayer(9)]).then(([flowlines, waterbodies]) => {
    const body = JSON.stringify({ type: 'FeatureCollection', features: [...flowlines, ...waterbodies] });
    geoCache.set(cacheKey, { data: body, expires: Date.now() + CACHE_TTL });
    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(body);
  });
});

// ── Parcel Proxy (NC OneMap statewide parcel layer) ──────────────────────────
app.get('/api/proxy/parcel', (req, res) => {
  const { lat, lng, parno: qParno } = req.query;
  if (!qParno && (!lat || !lng)) return res.status(400).json({ error: 'lat/lng or parno required' });
  const latN = parseFloat(lat) || 0;
  const lngN = parseFloat(lng) || 0;

  // SC T_Map_Number has dashes (e.g. 003717-07-012); NC parno is typically digits only
  const parnoIsSC = qParno ? /\d{6}-\d{2}-\d{3}/.test(qParno) || (qParno.includes('-') && !/^[A-Z]/.test(qParno)) : false;
  // Geographic bounds (used for coordinate-only lookups)
  const isNC = !parnoIsSC && latN >= 33.84 && latN <= 36.6 && lngN >= -84.4 && lngN <= -75.4;
  const isSC = parnoIsSC || (!isNC && latN >= 31.9 && latN <= 35.3 && lngN >= -83.5 && lngN <= -78.4);
  if (!qParno && !isNC && !isSC) return res.status(404).json({ error: 'Outside NC/SC coverage area' });

  const fetchJson = (u) => new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });

  // ── SC DOT lookup ──────────────────────────────────────────────────────────
  if (isSC || (qParno && !isNC)) {
    const SC_FIELDS = 'T_Map_Number,County,L_Value,M_Value,Ownership,Mailing_Add,Mailing_City,Mailing_Zip,Zoning,Land_Use,Acreage,Shape_Area,Mailing_St';
    let scParams;
    if (qParno) {
      scParams = new URLSearchParams({ where: `T_Map_Number='${qParno.replace(/'/g, "''")}'`, outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', f: 'geojson' });
    } else {
      const d = 0.002;
      scParams = new URLSearchParams({
        geometry: `${lngN-d},${latN-d},${lngN+d},${latN+d}`,
        geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
        outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', resultRecordCount: '5', f: 'geojson',
      });
    }
    return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${scParams}`)
      .then(data => {
        if (data.error || !data.features?.length) {
          return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });
        }
        const f = data.features[0];
        const p = f.properties || {};
        const normalized = {
          parcelId: p.T_Map_Number || null,
          owner:    p.Ownership?.trim() || null,
          mailAddr: [p.Mailing_Add, p.Mailing_City, p.Mailing_St, p.Mailing_Zip].filter(Boolean).join(', ') || null,
          siteAddr: null,
          acres:    (p.Acreage > 0 ? p.Acreage : null) ?? (p.Shape_Area > 0 ? p.Shape_Area / 43560 : null),
          landVal:  p.L_Value ?? null,
          bldgVal:  null,
          totVal:   p.M_Value ?? null,
          landUse:  p.Land_Use?.trim() || null,
          zoning:   p.Zoning?.trim() || null,
          saleYear: null,
          county:   p.County || null,
          subdivision: null,
          state:    'SC',
          geometry: f.geometry || null,
        };
        res.set('Content-Type', 'application/json');
        res.json(normalized);
      })
      .catch(err => {
        console.error('[parcel SC] fetch error:', err.message);
        res.status(502).json({ error: err.message });
      });
  }

  // ── NC OneMap lookup ────────────────────────────────────────────────────────
  const ATTR_FIELDS = 'parno,altparno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,gisacres,landval,improvval,parval,parusedesc,saledate,saledatetx,cntyname,subdivisio';

  // Build attribute query: by parno (exact) or by point-in-polygon on the polygon layer
  const getAttrUrl = async () => {
    if (qParno) {
      // User clicked a boundary polygon — look up by parno directly
      const p = new URLSearchParams({ where: `parno='${qParno.replace(/'/g, "''")}'`, outFields: ATTR_FIELDS, returnGeometry: 'false', f: 'json' });
      return `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`;
    }
    // Coordinate lookup: use small bbox on FeatureServer/1 (polygon layer) to get parno candidates,
    // pick the smallest parcel (most specific match), then look up attributes in MapServer/0.
    const d = 0.001; // ~110m radius
    const polyParams = new URLSearchParams({
      geometry: `${lngN - d},${latN - d},${lngN + d},${latN + d}`,
      geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'parno,Shape__Area', returnGeometry: 'false', resultRecordCount: '5', f: 'json',
    });
    const polyData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${polyParams}`);
    const features = polyData.features || [];
    if (!features.length) return null;
    // Pick smallest Shape__Area (most specific parcel for the click point)
    const best = features.reduce((a, b) => {
      const aa = a.attributes?.Shape__Area ?? Infinity;
      const ba = b.attributes?.Shape__Area ?? Infinity;
      return ba < aa ? b : a;
    });
    const parno = best.attributes?.parno;
    if (!parno) return null;
    const p = new URLSearchParams({ where: `parno='${parno.replace(/'/g, "''")}'`, outFields: ATTR_FIELDS, returnGeometry: 'false', f: 'json' });
    return `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`;
  };

  getAttrUrl().then(attrUrl => {
    if (!attrUrl) return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });
    return fetchJson(attrUrl);
  }).then(async (attrData) => {
    if (!attrData) return; // already responded
    if (attrData.error) {
      console.error('[parcel] attr error:', attrData.error);
      return res.status(502).json({ error: `Parcel service error: ${attrData.error.message || attrData.error.code}` });
    }
    const features = attrData.features || [];
    if (!features.length) return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });

    // Pick best match: smallest acreage (handles condos / stacked parcels)
    const best = features.reduce((a, b) => {
      const aa = a.attributes?.gisacres ?? Infinity;
      const ba = b.attributes?.gisacres ?? Infinity;
      return ba < aa ? b : a;
    });
    const a = best.attributes;

    // Get polygon geometry from FeatureServer/1
    let geometry = null;
    const lookupParno = qParno || a.parno;
    if (lookupParno) {
      try {
        const gp = new URLSearchParams({ where: `parno='${lookupParno.replace(/'/g, "''")}'`, outFields: 'parno', returnGeometry: 'true', f: 'geojson' });
        const polyUrl = `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${gp}`;
        const polyData = await fetchJson(polyUrl);
        geometry = polyData.features?.[0]?.geometry || null;
      } catch (e) {
        console.warn('[parcel] geometry fetch failed:', e.message);
      }
    }

    // Format sale date
    let saleYear = null;
    if (a.saledatetx) {
      const m = String(a.saledatetx).match(/(\d{4})/);
      if (m) saleYear = m[1];
    } else if (a.saledate) {
      saleYear = new Date(a.saledate).getFullYear();
    }

    const normalized = {
      parcelId: a.parno || a.altparno || null,
      owner:    a.ownname?.trim() || null,
      mailAddr: [a.mailadd, a.mcity, a.mstate, a.mzip].filter(Boolean).join(', ') || null,
      siteAddr: [a.siteadd, a.scity].filter(Boolean).join(', ') || null,
      acres:    a.gisacres ?? null,
      landVal:  a.landval ?? null,
      bldgVal:  a.improvval ?? null,
      totVal:   a.parval ?? null,
      landUse:  a.parusedesc?.trim() || null,
      saleYear,
      county:   a.cntyname || null,
      subdivision: a.subdivisio?.trim() || null,
      state:    isNC ? 'NC' : 'SC',
      geometry,
    };

    res.set('Content-Type', 'application/json');
    res.json(normalized);
  }).catch(err => {
    console.error('[parcel] fetch error:', err.message);
    res.status(502).json({ error: err.message });
  });
});

// ── NC OneMap Parcel Boundary Tile Proxy ──────────────────────────────────────
// Proxies NC OneMap MapServer export images so parcel boundaries display on satellite
// Called by frontend custom GridLayer: /api/proxy/parcel-img?bbox=lng1,lat1,lng2,lat2&w=256&h=256
app.get('/api/proxy/parcel-img', (req, res) => {
  const { bbox, w = '256', h = '256' } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });

  const url = `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/export?bbox=${encodeURIComponent(bbox)}&bboxSR=4326&layers=show%3A1&size=${w}%2C${h}&format=png32&transparent=true&f=image`;

  https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0' } }, (upstream) => {
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-port img loading
    upstream.pipe(res);
  }).on('error', err => res.status(502).send(err.message));
});

// ── Parcel Boundaries GeoJSON (NC + SC) ────────────────────────────────────────
// ── Parcel Search (by APN, owner name, or site address) ──────────────────────
app.get('/api/proxy/parcel-search', (req, res) => {
  const { type, q, state = 'both' } = req.query;
  if (!type || !q || q.trim().length < 2) return res.status(400).json({ error: 'type and q required (min 2 chars)' });

  const fetchJson = (u) => new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('JSON parse error')); } });
    }).on('error', reject);
  });

  const safe = q.trim().replace(/'/g, "''").toUpperCase();

  // NC OneMap search — returns up to 10 results with centroid geometry
  const searchNC = () => {
    let where;
    if (type === 'parno')   where = `UPPER(parno) LIKE '${safe}%'`;
    else if (type === 'owner')   where = `UPPER(ownname) LIKE '%${safe}%'`;
    else                         where = `UPPER(siteadd) LIKE '%${safe}%'`;
    const p = new URLSearchParams({
      where, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'true',
      outSR: '4326', resultRecordCount: '10', f: 'json',
    });
    return fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`)
      .then(data => (data.features || []).map(f => {
        const a = f.attributes || {};
        const g = f.geometry;
        const lat = g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1));
        const lng = g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1));
        return { parno: a.parno, owner: a.ownname, address: a.siteadd, city: a.stpostal, county: a.cntyname, state: 'NC', lat, lng };
      }))
      .catch(() => []);
  };

  // SC DOT search — parno only (SC attribute search is limited)
  const searchSC = () => {
    if (type !== 'parno') return Promise.resolve([]);
    const where = `UPPER(T_Map_Number) LIKE '${safe}%'`;
    const p = new URLSearchParams({
      where, outFields: 'T_Map_Number,County', returnGeometry: 'true',
      outSR: '4326', resultRecordCount: '10', f: 'json',
    });
    return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${p}`)
      .then(data => (data.features || []).map(f => {
        const a = f.attributes || {};
        const g = f.geometry;
        const lat = g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1));
        const lng = g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1));
        return { parno: a.T_Map_Number, owner: null, address: null, city: null, county: a.County, state: 'SC', lat, lng };
      }))
      .catch(() => []);
  };

  const queries = [];
  if (state !== 'SC') queries.push(searchNC());
  if (state !== 'NC') queries.push(searchSC());

  Promise.all(queries)
    .then(results => res.json(results.flat().slice(0, 10)))
    .catch(err => res.status(502).json({ error: err.message }));
});

// Queries NC OneMap and/or SC DOT statewide parcel service based on bbox location.
app.get('/api/proxy/parcel-boundaries', (req, res) => {
  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });

  const [west, south, east, north] = bbox.split(',').map(Number);
  const midLat = (south + north) / 2;
  const midLng = (west + east) / 2;

  // Check each state independently — query both in overlap zones and merge results.
  const midInNC = midLat >= 33.84 && midLat <= 36.6 && midLng >= -84.4 && midLng <= -75.4;
  const midInSC = midLat >= 31.9 && midLat <= 35.3 && midLng >= -83.5 && midLng <= -78.4;

  const fetchJson = (u) => new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });

  // Query SC DOT statewide parcel service (covers all SC counties)
  const querySC = () => {
    const params = new URLSearchParams({
      geometry: bbox, geometryType: 'esriGeometryEnvelope', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: 'T_Map_Number,County',
      returnGeometry: 'true', outSR: '4326', resultRecordCount: '500', f: 'geojson',
    });
    return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${params}`)
      .then(data => {
        if (data.error || !data.features) return { type: 'FeatureCollection', features: [] };
        // Normalize T_Map_Number → parno
        data.features.forEach(f => {
          if (f.properties) {
            f.properties.parno = f.properties.T_Map_Number || '';
          }
        });
        return data;
      })
      .catch(() => ({ type: 'FeatureCollection', features: [] }));
  };

  // Query NC OneMap
  const queryNC = () => {
    const params = new URLSearchParams({
      geometry: bbox, geometryType: 'esriGeometryEnvelope', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: 'parno',
      returnGeometry: 'true', outSR: '4326', resultRecordCount: '500', f: 'geojson',
    });
    return fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${params}`)
      .then(data => (data.error || !data.features) ? { type: 'FeatureCollection', features: [] } : data)
      .catch(() => ({ type: 'FeatureCollection', features: [] }));
  };

  // Query both states independently and merge — each service returns empty for tiles outside its coverage
  const queries = [];
  if (midInNC) queries.push(queryNC());
  if (midInSC) queries.push(querySC());
  if (queries.length === 0) queries.push(queryNC()); // fallback

  Promise.all(queries)
    .then(results => {
      const allFeatures = results.flatMap(r => r.features || []);
      res.json({ type: 'FeatureCollection', features: allFeatures });
    })
    .catch(err => res.status(502).json({ error: err.message }));
});

// ── MapTiler Vector Tile Proxy ────────────────────────────────────────────────
// Proxies MapTiler PBF tiles server-side so the API key stays out of the client.
// Set MAPTILER_KEY in your .env file — free account at maptiler.com
const MAPTILER_KEY = process.env.MAPTILER_KEY || '';
const MAPTILER_TILESETS = {
  flood:       'd155b9c1-7373-4e36-8b76-0ee3a9943e79', // FEMA NFHL
  wetlands:    'f3127837-ba5e-4b6b-a2ea-36af6aa2cabe', // USFWS NWI
  water_lines: '019cf85a-a0ce-7343-accf-9aa64578c573', // NHD water lines
  water_areas: '019cfa69-0d5a-799d-bd1e-964eecbfd02e', // NHD water areas
};

app.get('/proxy/tiles/:layer/:z/:x/:y.pbf', (req, res) => {
  const { layer, z, x, y } = req.params;
  const tileset = MAPTILER_TILESETS[layer];
  if (!tileset) return res.status(404).json({ error: 'Unknown layer' });
  if (!MAPTILER_KEY) return res.status(503).json({ error: 'Set MAPTILER_KEY in backend .env' });

  const url = `https://api.maptiler.com/tiles/${tileset}/${z}/${x}/${y}.pbf?key=${MAPTILER_KEY}`;
  https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0' } }, (upstream_res) => {
    const ct = upstream_res.headers['content-type'] || 'application/x-protobuf';
    const ce = upstream_res.headers['content-encoding'];
    res.set('Content-Type', ct);
    if (ce) res.set('Content-Encoding', ce);
    res.set('Cache-Control', 'public, max-age=86400');
    upstream_res.pipe(res);
  }).on('error', err => res.status(502).json({ error: err.message }));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🏠 LotLine Intelligence API (mock mode)`);
  console.log(`   http://localhost:${PORT}`);
});
