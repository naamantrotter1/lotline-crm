import https from 'https';

function fetchJson(u) {
  return new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function buildNCWhere(filters = {}) {
  const clauses = ['1=1'];
  if (filters.acresMin) clauses.push(`gis_acres >= ${parseFloat(filters.acresMin)}`);
  if (filters.acresMax) clauses.push(`gis_acres <= ${parseFloat(filters.acresMax)}`);
  if (filters.county)   clauses.push(`UPPER(county_name) LIKE UPPER('%${filters.county.replace(/'/g, "''")}%')`);
  return clauses.join(' AND ');
}

function buildSCWhere(filters = {}) {
  const clauses = ['1=1'];
  if (filters.acresMin) clauses.push(`Acres >= ${parseFloat(filters.acresMin)}`);
  if (filters.acresMax) clauses.push(`Acres <= ${parseFloat(filters.acresMax)}`);
  if (filters.county)   clauses.push(`UPPER(County) LIKE UPPER('%${filters.county.replace(/'/g, "''")}%')`);
  return clauses.join(' AND ');
}

// Fetch one tile from NC OneMap (FeatureServer/1 = polygon layer)
function fetchNCTile(tileBbox, filters = {}) {
  const where = buildNCWhere(filters);
  const params = new URLSearchParams({
    geometry: tileBbox, geometryType: 'esriGeometryEnvelope', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'parno,gis_acres,owner,situsadd,city,zipcode,landval,improvval,totalval,landuse',
    where, returnGeometry: 'true', outSR: '4326', resultRecordCount: '1000', f: 'geojson',
  });
  return fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${params}`)
    .then(data => {
      if (data.error) { console.error('[NC parcels] API error:', data.error); return []; }
      if (!data.features) { console.warn('[NC parcels] No features in response'); return []; }
      data.features.forEach(f => {
        if (f.properties) {
          f.properties.state = 'NC';
          f.properties.acres = f.properties.gis_acres;
        }
      });
      return data.features;
    })
    .catch(err => { console.error('[NC parcels] fetch failed:', err.message); return []; });
}

// Fetch one tile from SC DOT
function fetchSCTile(tileBbox, filters = {}) {
  const where = buildSCWhere(filters);
  const params = new URLSearchParams({
    geometry: tileBbox, geometryType: 'esriGeometryEnvelope', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'T_Map_Number,County,Acres,Owner_Name,Situs_Address,Zip_Code,Land_Value,Total_Value',
    where, returnGeometry: 'true', outSR: '4326', resultRecordCount: '1000', f: 'geojson',
  });
  return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${params}`)
    .then(data => {
      if (data.error) { console.error('[SC parcels] API error:', data.error); return []; }
      if (!data.features) { console.warn('[SC parcels] No features in response'); return []; }
      data.features.forEach(f => {
        if (f.properties) {
          f.properties.parno = f.properties.T_Map_Number || '';
          f.properties.state = 'SC';
          f.properties.county = f.properties.County || '';
          f.properties.acres = f.properties.Acres || '';
          f.properties.owner = f.properties.Owner_Name || '';
          f.properties.situsadd = f.properties.Situs_Address || '';
          f.properties.landval = f.properties.Land_Value || '';
          f.properties.totalval = f.properties.Total_Value || '';
        }
      });
      return data.features;
    })
    .catch(err => { console.error('[SC parcels] fetch failed:', err.message); return []; });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox, acresMin, acresMax, county } = req.query;
  const filters = { acresMin, acresMax, county };
  if (!bbox) return res.status(400).json({ error: 'bbox required' });

  const [west, south, east, north] = bbox.split(',').map(Number);

  // Determine which states the bbox overlaps (not just the midpoint)
  const overlapsNC = north >= 33.84 && south <= 36.6 && east >= -84.4 && west <= -75.4;
  const overlapsSC = north >= 31.9  && south <= 35.3  && east >= -83.5 && west <= -78.4;

  // Split bbox into 2×2 grid to multiply effective feature cap (4 tiles × 1000 = 4000)
  const midLat = (south + north) / 2;
  const midLng = (west + east)   / 2;
  const tiles = [
    `${west},${south},${midLng},${midLat}`,    // SW
    `${midLng},${south},${east},${midLat}`,    // SE
    `${west},${midLat},${midLng},${north}`,    // NW
    `${midLng},${midLat},${east},${north}`,    // NE
  ];

  try {
    const fetches = [];
    if (overlapsNC || (!overlapsSC)) {
      // Default to NC if neither state matches (open-ocean / edge case)
      tiles.forEach(t => fetches.push(fetchNCTile(t, filters)));
    }
    if (overlapsSC) {
      tiles.forEach(t => fetches.push(fetchSCTile(t, filters)));
    }

    const results = await Promise.all(fetches);
    const allFeatures = results.flat();

    // Deduplicate by parno so tiled requests don't double-draw boundary polygons
    // Features without a parno are included but not deduplicated (use geometry hash as fallback)
    const seen = new Set();
    let fallbackIdx = 0;
    const unique = allFeatures.filter(f => {
      const id = f.properties?.parno || `__noid_${fallbackIdx++}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({ type: 'FeatureCollection', features: unique });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
