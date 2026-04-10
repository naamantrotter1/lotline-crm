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

// Compute centroid from an ArcGIS JSON geometry (rings or point)
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

// Fetch full attributes for NC parnos — MapServer/0 only supports single exact match.
// Use exact same field list and WHERE format as parcel.js which is known to work.
const NC_ATTR_FIELDS = 'parno,altparno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,szip,gisacres,landval,improvval,parval,parusedesc,saledate,saledatetx,cntyname,subdivisio';
async function ncAttrsBatch(parnos) {
  const entries = await Promise.all(parnos.slice(0, 10).map(async parno => {
    const p = new URLSearchParams({ where: `parno='${parno.replace(/'/g,"''")}'`, outFields: NC_ATTR_FIELDS, returnGeometry: 'false', f: 'json' });
    const data = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`).catch(e => ({ _err: e.message }));
    const attrs = data?._err ? null : (data?.features?.[0]?.attributes || { _noFeatures: JSON.stringify(data).substring(0, 200) });
    return [parno, attrs];
  }));
  const map = {};
  for (const [inputParno, attrs] of entries) { if (attrs && !attrs._noFeatures && !attrs._err) map[inputParno] = attrs; }
  // Surface first error/empty for debug
  const firstBad = entries.find(([, a]) => a?._noFeatures || a?._err);
  if (firstBad && Object.keys(map).length === 0) map._debug = { parno: firstBad[0], info: firstBad[1] };
  return map;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, q, state = 'both', county = '' } = req.query;
  if (!type || !q || q.trim().length < 2) return res.status(400).json({ error: 'type and q required (min 2 chars)' });

  const safe = q.trim().replace(/'/g, "''");
  const safeUpper = safe.toUpperCase();
  const safeCounty = county.trim().replace(/'/g, "''").toUpperCase();

  // ── Address search ────────────────────────────────────────────────────────
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
      const seen = new Set();
      const mapped = allResults
        .filter(r => { const s = r.address?.state || ''; return s === 'North Carolina' || s === 'South Carolina'; })
        .filter(r => { const key = `${parseFloat(r.lat).toFixed(4)},${parseFloat(r.lon).toFixed(4)}`; if (seen.has(key)) return false; seen.add(key); return true; })
        .map(r => {
          const a = r.address || {};
          const street = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(' ');
          const city   = a.city || a.town || a.municipality || '';
          const st     = a.state === 'North Carolina' ? 'NC' : 'SC';
          const address = [street, city, st].filter(Boolean).join(', ') || r.display_name?.split(',').slice(0,2).join(' ').trim() || q;
          return { parno: null, owner: null, address, city, county: (a.county || '').replace(' County', ''), state: st, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
        });
      return res.json(mapped.slice(0, 8));
    } catch (err) { return res.status(502).json({ error: err.message }); }
  }

  // ── Parcel ID search ──────────────────────────────────────────────────────
  // FeatureServer/1 (polygon layer) supports LIKE on parno + returns geometry.
  // Then fetch attributes individually from MapServer/0 (only supports = per parno).
  if (type === 'parno') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      const where = `parno LIKE '${safeUpper}%'`;
      const p = new URLSearchParams({ where, outFields: 'parno', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      const geoData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${p}`).catch(() => ({ features: [] }));
      const geoFeatures = geoData.features || [];
      if (!geoFeatures.length) return [];

      const geoMap = {};
      const parnos = [];
      for (const f of geoFeatures) {
        const parno = f.attributes?.parno;
        if (parno) { parnos.push(parno); geoMap[parno] = centroid(f.geometry); }
      }

      // Filter by county client-side after fetching attrs
      const attrs = await ncAttrsBatch(parnos);

      return parnos
        .filter(parno => !safeCounty || (attrs[parno]?.cntyname || '').toUpperCase().includes(safeCounty))
        .map(parno => {
          const a = attrs[parno] || {};
          const { lat, lng } = geoMap[parno] || {};
          const addr = [a.siteadd, a.scity, a.szip ? `NC ${a.szip}` : 'NC'].filter(Boolean).join(', ');
          return { parno, owner: a.ownname || null, address: addr || null, city: a.scity || null, county: a.cntyname || null, state: 'NC', lat: lat ?? null, lng: lng ?? null };
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
      return res.json((await Promise.all(queries)).flat().slice(0, 10));
    } catch (err) { return res.status(502).json({ error: err.message }); }
  }

  // ── Owner search ──────────────────────────────────────────────────────────
  // Try FeatureServer/0 (attribute FeatureServer layer) which supports LIKE on ownname.
  // Falls back to county-required hint if no county is selected.
  if (type === 'owner') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      if (!safeCounty) return [{ _hint: 'Select a county to search by owner name' }];

      // FeatureServer/0 is the attribute layer via FeatureServer protocol — supports LIKE
      let where = `ownname LIKE '%${safeUpper}%'`;
      if (safeCounty) where += ` AND cntyname LIKE '%${safeCounty}%'`;
      const fp = new URLSearchParams({ where, outFields: NC_ATTR_FIELDS, returnGeometry: 'false', resultRecordCount: '20', f: 'json' });
      const fsData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0/query?${fp}`).catch(() => ({ features: [] }));
      const matches = (fsData.features || []).slice(0, 10);
      if (!matches.length) return [];

      // Get geometry from FeatureServer/1 using individual exact match requests
      const parnos = matches.map(f => f.attributes?.parno).filter(Boolean);
      const geoResults = await Promise.all(parnos.map(async parno => {
        const gp = new URLSearchParams({ where: `parno='${parno.replace(/'/g,"''")}'`, outFields: 'parno', returnGeometry: 'true', outSR: '4326', f: 'json' });
        const d = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${gp}`).catch(() => null);
        const f = d?.features?.[0];
        return f ? { parno, ...centroid(f.geometry) } : null;
      }));
      const geoMap = {};
      for (const g of geoResults) { if (g?.parno) geoMap[g.parno] = { lat: g.lat, lng: g.lng }; }

      return matches.map(f => {
        const a = f.attributes || {};
        const { lat, lng } = geoMap[a.parno] || {};
        const addr = [a.siteadd, a.scity, a.szip ? `NC ${a.szip}` : 'NC'].filter(Boolean).join(', ');
        return { parno: a.parno || null, owner: a.ownname || null, address: addr || null, city: a.scity || null, county: a.cntyname || null, state: 'NC', lat: lat ?? null, lng: lng ?? null };
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
      const real  = results.filter(r => !r._hint);
      if (hints.length && !real.length) return res.json(hints);
      return res.json(real.slice(0, 10));
    } catch (err) { return res.status(502).json({ error: err.message }); }
  }

  return res.status(400).json({ error: 'Invalid type' });
}
