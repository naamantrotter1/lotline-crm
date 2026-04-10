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
        .map(r => ({
          parno: null,
          owner: null,
          address: r.display_name?.split(',').slice(0, 3).join(',').trim() || q,
          city: r.address?.city || r.address?.town || r.address?.village || r.address?.suburb || '',
          county: (r.address?.county || '').replace(' County', ''),
          state: r.address?.state === 'North Carolina' ? 'NC' : 'SC',
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
        }));

      return res.json(mapped.slice(0, 8));
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // ── Parcel ID (parno) search: NC OneMap + SC DOT ─────────────────────────
  if (type === 'parno') {
    const searchNC = () => {
      let where = `UPPER(parno) LIKE '${safeUpper}%'`;
      if (safeCounty) where += ` AND UPPER(cntyname) LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      return fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`)
        .then(data => (data.features || []).map(f => {
          const a = f.attributes || {}; const g = f.geometry;
          const lat = g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1));
          const lng = g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1));
          return { parno: a.parno, owner: a.ownname, address: a.siteadd, city: a.stpostal, county: a.cntyname, state: 'NC', lat, lng };
        })).catch(() => []);
    };

    const searchSC = () => {
      let where = `UPPER(T_Map_Number) LIKE '${safeUpper}%'`;
      if (safeCounty) where += ` AND UPPER(County) LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'T_Map_Number,County', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${p}`)
        .then(data => (data.features || []).map(f => {
          const a = f.attributes || {}; const g = f.geometry;
          const lat = g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1));
          const lng = g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1));
          return { parno: a.T_Map_Number, owner: null, address: null, city: null, county: a.County, state: 'SC', lat, lng };
        })).catch(() => []);
    };

    try {
      const queries = [];
      if (state !== 'SC') queries.push(searchNC());
      if (state !== 'NC') queries.push(searchSC());
      const results = await Promise.all(queries);
      return res.json(results.flat().slice(0, 10));
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  // ── Owner search: NC OneMap + SC DOT (requires county for performance) ───
  if (type === 'owner') {
    const searchNC = () => {
      if (!safeCounty) return Promise.resolve([]);
      const where = `UPPER(ownname) LIKE '%${safeUpper}%' AND UPPER(cntyname) LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      return fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`)
        .then(data => (data.features || []).map(f => {
          const a = f.attributes || {}; const g = f.geometry;
          const lat = g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1));
          const lng = g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1));
          return { parno: a.parno, owner: a.ownname, address: a.siteadd, city: a.stpostal, county: a.cntyname, state: 'NC', lat, lng };
        })).catch(() => []);
    };

    try {
      const results = await searchNC();
      if (!safeCounty) return res.json([{ _hint: 'Select a county to search by owner name' }]);
      return res.json(results.slice(0, 10));
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Invalid type' });
}
