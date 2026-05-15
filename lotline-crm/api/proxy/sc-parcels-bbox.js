// api/proxy/sc-parcels-bbox.js
// ═════════════════════════════════════════════════════════════════════════════
// Returns SC parcels intersecting a bounding box, sourced from the Supabase
// sc_parcels table (RPC: sc_parcels_in_bbox).
//
// Use case: when a quick-filter chip is active in FloodMap.jsx (absentee /
// corporate / tax-delinquent / mobile-home), the map switches from SCDOT
// polygon-fetch to this endpoint and renders matching parcels as centroid
// points enriched with full attribute data (owner, value, beds/baths, etc.).
//
// Query params:
//   bbox=west,south,east,north         required
//   acresMin, acresMax                  optional
//   assessedMin, assessedMax            optional
//   county                              optional substring match
//   absenteeOnly=1                      optional flag
//   corporateOnly=1                     optional flag
//   taxDelinquentOnly=1                 optional flag
//   mobileHomeOnly=1                    optional flag
//   vacantOnly=1                        optional flag
//   limit                               optional, max 4000 (default 4000)
//
// Response:
//   GeoJSON FeatureCollection of Point features. Each feature.properties
//   contains every column from the sc_parcels_in_bbox RPC.

const PROJECT_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function flag(v) {
  if (v === undefined || v === null || v === '') return false;
  return v === '1' || v === 'true' || v === true;
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!PROJECT_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials' });
  }

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required (west,south,east,north)' });
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) {
    return res.status(400).json({ error: 'bbox must be west,south,east,north' });
  }
  const [west, south, east, north] = parts;

  const filters = {
    acresMin:          numOrNull(req.query.acresMin),
    acresMax:          numOrNull(req.query.acresMax),
    assessedMin:       numOrNull(req.query.assessedMin),
    assessedMax:       numOrNull(req.query.assessedMax),
    county:            req.query.county || null,
    absenteeOnly:      flag(req.query.absenteeOnly),
    corporateOnly:     flag(req.query.corporateOnly),
    taxDelinquentOnly: flag(req.query.taxDelinquentOnly),
    mobileHomeOnly:    flag(req.query.mobileHomeOnly),
    vacantOnly:        flag(req.query.vacantOnly),
  };
  // Strip null/false values so the RPC's IS NULL guards short-circuit
  Object.keys(filters).forEach(k => {
    if (filters[k] === null || filters[k] === false) delete filters[k];
  });

  const limit = Math.min(parseInt(req.query.limit || '4000', 10) || 4000, 4000);

  const body = {
    west, south, east, north,
    filters,
    max_rows: limit,
  };

  try {
    const r = await fetch(`${PROJECT_URL}/rest/v1/rpc/sc_parcels_in_bbox`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(502).json({ error: `Supabase RPC failed: ${r.status} ${text.slice(0, 300)}` });
    }
    const rows = await r.json();

    const features = rows
      .filter(p => Number.isFinite(p.centroid_lat) && Number.isFinite(p.centroid_lon))
      .map(p => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.centroid_lon, p.centroid_lat],
        },
        properties: {
          // Compat fields for existing map click handlers
          parno:     p.parcel_id,
          cntyname:  p.county,
          state:     'SC',
          // Full attribute payload
          ...p,
        },
      }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.json({
      type: 'FeatureCollection',
      features,
      meta: { count: features.length, source: 'supabase.sc_parcels', filters, limit },
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
