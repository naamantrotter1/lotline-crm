import https from 'https';

function fetchJson(u) {
  return new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('JSON parse error')); } });
    }).on('error', reject);
  });
}

// Fetch attributes (owner, address, county) from MapServer/0 for a list of NC parno values.
// MapServer/0 supports exact match and IN clauses but NOT LIKE.
async function ncAttrs(parnos) {
  if (!parnos.length) return {};
  const orClause = parnos.map(p => `parno = '${p.replace(/'/g, "''")}'`).join(' OR ');
  const p = new URLSearchParams({ where: orClause, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'false', resultRecordCount: '50', f: 'json' });
  const data = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`).catch(() => ({ features: [] }));
  const map = {};
  for (const f of data.features || []) {
    if (f.attributes?.parno) map[f.attributes.parno] = f.attributes;
  }
  return map;
}

// Compute centroid from an ArcGIS JSON geometry (rings array)
function centroid(g) {
  if (!g) return { lat: null, lng: null };
  const rings = g.rings?.[0];
  if (rings?.length) {
    return {
      lat: rings.reduce((s, c) => s + c[1], 0) / rings.length,
      lng: rings.reduce((s, c) => s + c[0], 0) / rings.length,
    };
  }
  return { lat: g.y ?? null, lng: g.x ?? null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, q, state = 'both', county = '' } = req.query;
  if (!type || !q || q.trim().length < 2) return res.status(400).json({ error: 'type and q required (min 2 chars)' });

  const safe = q.trim().replace(/'/g, "''");
  const safeUpper = safe.toUpperCase();
  const safeCounty = county.trim().replace(/'/g, "''").toUpperCase();

  // ── Address search: Nominatim geocoding for fuzzy address suggestions ───
  if (type === 'address') {
    const searches = [];

    if (state !== 'SC') {
      const p = new URLSearchParams({ q: `${q.trim()}, North Carolina, USA`, format: 'json', addressdetails: '1', limit: '6', countrycodes: 'us' });
      searches.push(fetchJson(`https://nominatim.openstreetmap.org/search?${p}`).catch(() => []));
    }
    if (state !== 'NC') {
      const p = new URLSearchParams({ q: `${q.trim()}, South Carolina, USA`, format: 'json', addressdetails: '1', limit: '6', countrycodes: 'us' });
      searches.push(fetchJson(`https://nominatim.openstreetmap.org/search?${p}`).catch(() => []));
    }

    try {
      const allResults = (await Promise.all(searches)).flat();

      // Filter to NC/SC only and deduplicate by lat/lng
      const seen = new Set();
      const mapped = allResults
        .filter(r => {
          const s = r.address?.state || '';
          return s === 'North Carolina' || s === 'South Carolina';
        })
        .filter(r => {
          const key = `${parseFloat(r.lat).toFixed(4)},${parseFloat(r.lon).toFixed(4)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(r => {
          const a = r.address || {};
          const street = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(' ');
          const city   = a.city || a.town || a.municipality || '';
          const state  = a.state === 'North Carolina' ? 'NC' : 'SC';
          const address = [street, city, state].filter(Boolean).join(', ') || r.display_name?.split(',').slice(0,2).join(' ').trim() || q;
          return {
            parno: null,
            owner: null,
            address,
            city,
            county: (a.county || '').replace(' County', ''),
            state,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
          };
        });

      return res.json(mapped.slice(0, 8));
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // ── Parcel ID (parno) search ──────────────────────────────────────────────
  // FeatureServer/1 supports LIKE on parno + returns geometry.
  // MapServer/0 only supports exact match — we use it for attributes after.
  if (type === 'parno') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      // Step 1: LIKE search on FeatureServer/1 (polygon layer — supports LIKE)
      let where = `parno LIKE '${safeUpper}%'`;
      const p = new URLSearchParams({ where, outFields: 'parno', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      const geoData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${p}`).catch(() => ({ features: [] }));
      const geoFeatures = geoData.features || [];
      if (!geoFeatures.length) return [];

      const parnos = geoFeatures.map(f => f.attributes?.parno).filter(Boolean);
      const geoMap = {};
      for (const f of geoFeatures) {
        if (f.attributes?.parno) geoMap[f.attributes.parno] = centroid(f.geometry);
      }

      // Step 2: Fetch attributes via exact IN query on MapServer/0
      let attrs = await ncAttrs(parnos);
      // Apply county filter client-side if specified
      if (safeCounty) {
        attrs = Object.fromEntries(Object.entries(attrs).filter(([, a]) => (a.cntyname || '').toUpperCase().includes(safeCounty)));
      }

      return parnos
        .filter(parno => attrs[parno] || !safeCounty)
        .map(parno => {
          const a = attrs[parno] || {};
          const { lat, lng } = geoMap[parno] || {};
          const addr = [a.siteadd, a.stpostal, 'NC'].filter(Boolean).join(', ');
          return { parno, owner: a.ownname || null, address: addr || null, city: a.stpostal || null, county: a.cntyname || null, state: 'NC', lat: lat ?? null, lng: lng ?? null };
        });
    };

    const searchSC = () => {
      if (state === 'NC') return Promise.resolve([]);
      let where = `T_Map_Number LIKE '${safeUpper}%'`;
      if (safeCounty) where += ` AND County LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'T_Map_Number,County', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${p}`)
        .then(data => (data.features || []).map(f => {
          const a = f.attributes || {}; const { lat, lng } = centroid(f.geometry);
          return { parno: a.T_Map_Number, owner: null, address: null, city: null, county: a.County, state: 'SC', lat, lng };
        })).catch(() => []);
    };

    try {
      const queries = [];
      if (state !== 'SC') queries.push(searchNC());
      if (state !== 'NC') queries.push(searchSC());
      const results = (await Promise.all(queries)).flat();
      return res.json(results.slice(0, 10));
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // ── Owner search ──────────────────────────────────────────────────────────
  // NC: MapServer/0 does not support LIKE. We query FeatureServer/1 for a
  // county bbox, then filter attributes client-side by owner name.
  if (type === 'owner') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      // Without county we can't scope the search — too broad
      if (!safeCounty) return [{ _hint: 'Select a county to search by owner name' }];

      // Get parcels in this county from FeatureServer/1 via attribute filter
      // FeatureServer/1 does NOT have cntyname; use MapServer/0 to find parno list
      // for this county, then fetch owner attrs. MapServer/0 supports cntyname = '...'
      // cntyname stored as title-case e.g. "Guilford" — convert safeCounty to title-case
      const titleCounty = safeCounty.charAt(0) + safeCounty.slice(1).toLowerCase();
      const countyWhere = `cntyname = '${titleCounty.replace(/'/g,"''")}'`;
      const cp = new URLSearchParams({ where: countyWhere, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'false', resultRecordCount: '1000', f: 'json' });
      const countyData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${cp}`).catch(() => ({ features: [] }));
      const all = (countyData.features || []).filter(f => (f.attributes?.ownname || '').toUpperCase().includes(safeUpper));
      if (!all.length) return [];

      // Fetch centroids for matched parcels from FeatureServer/1
      const parnos = all.map(f => f.attributes.parno).filter(Boolean).slice(0, 10);
      const list = parnos.map(p => `'${p.replace(/'/g,"''")}'`).join(',');
      const gp = new URLSearchParams({ where: `parno IN (${list})`, outFields: 'parno', returnGeometry: 'true', outSR: '4326', f: 'json' });
      const geoData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${gp}`).catch(() => ({ features: [] }));
      const geoMap = {};
      for (const f of geoData.features || []) {
        if (f.attributes?.parno) geoMap[f.attributes.parno] = centroid(f.geometry);
      }

      return parnos.map(parno => {
        const a = all.find(f => f.attributes.parno === parno)?.attributes || {};
        const { lat, lng } = geoMap[parno] || {};
        const addr = [a.siteadd, a.stpostal, 'NC'].filter(Boolean).join(', ');
        return { parno, owner: a.ownname || null, address: addr || null, city: a.stpostal || null, county: a.cntyname || null, state: 'NC', lat: lat ?? null, lng: lng ?? null };
      });
    };

    const searchSC = () => {
      if (state === 'NC') return Promise.resolve([]);
      let where = `Ownership LIKE '%${safeUpper}%'`;
      if (safeCounty) where += ` AND County LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'T_Map_Number,Ownership,County', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${p}`)
        .then(data => (data.features || []).map(f => {
          const a = f.attributes || {}; const { lat, lng } = centroid(f.geometry);
          return { parno: a.T_Map_Number, owner: a.Ownership?.trim() || null, address: null, city: null, county: a.County, state: 'SC', lat, lng };
        })).catch(() => []);
    };

    try {
      const queries = [];
      if (state !== 'SC') queries.push(searchNC());
      if (state !== 'NC') queries.push(searchSC());
      const results = (await Promise.all(queries)).flat();
      const hints = results.filter(r => r._hint);
      const real = results.filter(r => !r._hint);
      if (hints.length && !real.length) return res.json(hints);
      return res.json(real.slice(0, 10));
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Invalid type' });
}
