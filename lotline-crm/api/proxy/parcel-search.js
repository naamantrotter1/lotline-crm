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

const NC_ATTR_FIELDS = 'parno,altparno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,szip,gisacres,landval,improvval,parval,parusedesc,saledate,saledatetx,cntyname,subdivisio';
const NC_MAPSERVER = 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query';
const NC_FEATSERVER1 = 'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { type, q, state = 'both', county = '' } = req.query;
  if (!type || !q || q.trim().length < 2) return res.status(400).json({ error: 'type and q required (min 2 chars)' });

  const safe = q.trim().replace(/'/g, "''");
  const safeUpper = safe.toUpperCase();
  // County for client-side comparison (uppercase) and SQL (title-case, matching NC OneMap storage)
  const safeCountyRaw = county.trim().replace(/'/g, "''");
  const safeCounty = safeCountyRaw.toUpperCase();
  const safeCountyTitle = safeCountyRaw.replace(/\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

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
  // MapServer/0 supports LIKE on parno and returns attributes in one request.
  // FeatureServer/1 returns geometry for the same prefix in one request.
  if (type === 'parno') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      // Fetch attrs and geometry in parallel — both use single LIKE queries
      const attrWhere = `parno LIKE '${safeUpper}%'`;
      const geoWhere  = `parno LIKE '${safeUpper}%'`;
      const [attrData, geoData] = await Promise.all([
        fetchJson(`${NC_MAPSERVER}?${new URLSearchParams({ where: attrWhere, outFields: NC_ATTR_FIELDS, returnGeometry: 'false', resultRecordCount: '10', f: 'json' })}`).catch(() => ({ features: [] })),
        fetchJson(`${NC_FEATSERVER1}?${new URLSearchParams({ where: geoWhere, outFields: 'parno', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' })}`).catch(() => ({ features: [] })),
      ]);
      const geoMap = {};
      for (const f of geoData.features || []) {
        const parno = f.attributes?.parno;
        if (parno) geoMap[parno] = centroid(f.geometry);
      }
      return (attrData.features || [])
        .filter(f => !safeCounty || (f.attributes?.cntyname || '').toUpperCase().includes(safeCounty))
        .map(f => {
          const a = f.attributes || {};
          const { lat, lng } = geoMap[a.parno] || {};
          const addr = [a.siteadd?.trim(), a.scity, a.szip ? `NC ${a.szip}` : 'NC'].filter(Boolean).join(', ');
          return { parno: a.parno || null, owner: a.ownname?.trim() || null, address: addr || null, city: a.scity || null, county: a.cntyname || null, state: 'NC', lat: lat ?? null, lng: lng ?? null };
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
  // MapServer/0 supports LIKE on ownname. County is required for NC to limit results.
  // County names in NC OneMap are title-cased (e.g. "Guilford"), so we use safeCountyTitle.
  if (type === 'owner') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      if (!safeCounty) return [{ _hint: 'Select a county to search by owner name' }];

      let where = `ownname LIKE '%${safeUpper}%'`;
      where += ` AND cntyname LIKE '%${safeCountyTitle}%'`;
      const [attrData] = await Promise.all([
        fetchJson(`${NC_MAPSERVER}?${new URLSearchParams({ where, outFields: NC_ATTR_FIELDS, returnGeometry: 'false', resultRecordCount: '20', f: 'json' })}`).catch(() => ({ features: [] })),
      ]);
      const matches = (attrData.features || []).slice(0, 10);
      if (!matches.length) return [];

      // Get geometry from FeatureServer/1 for each matched parno
      const parnos = matches.map(f => f.attributes?.parno).filter(Boolean);
      const geoResults = await Promise.all(parnos.map(async parno => {
        const gp = new URLSearchParams({ where: `parno='${parno.replace(/'/g,"''")}'`, outFields: 'parno', returnGeometry: 'true', outSR: '4326', f: 'json' });
        const d = await fetchJson(`${NC_FEATSERVER1}?${gp}`).catch(() => null);
        const f = d?.features?.[0];
        return f ? { parno, ...centroid(f.geometry) } : null;
      }));
      const geoMap = {};
      for (const g of geoResults) { if (g?.parno) geoMap[g.parno] = { lat: g.lat, lng: g.lng }; }

      return matches.map(f => {
        const a = f.attributes || {};
        const { lat, lng } = geoMap[a.parno] || {};
        const addr = [a.siteadd?.trim(), a.scity, a.szip ? `NC ${a.szip}` : 'NC'].filter(Boolean).join(', ');
        return { parno: a.parno || null, owner: a.ownname?.trim() || null, address: addr || null, city: a.scity || null, county: a.cntyname || null, state: 'NC', lat: lat ?? null, lng: lng ?? null };
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
