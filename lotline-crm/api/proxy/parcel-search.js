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

  // ── Parcel ID (parno) search: NC OneMap + SC DOT ─────────────────────────
  if (type === 'parno') {
    const searchNC = async () => {
      let where = `parno LIKE '${safeUpper}%'`;
      if (safeCounty) where += ` AND cntyname LIKE '%${safeCounty}%'`;
      // MapServer/0 is attribute-only — must use returnGeometry:false
      const p = new URLSearchParams({ where, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'false', resultRecordCount: '10', f: 'json' });
      const data = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`).catch(e => ({ _fetchError: e.message, features: [] }));
      if (data.error || data._fetchError) return [{ _debug: { error: data.error, fetchError: data._fetchError, where } }];
      const features = data.features || [];
      if (!features.length) return [];
      // Fetch centroids from FeatureServer/1 which supports geometry
      const ids = features.map(f => `'${(f.attributes.parno||'').replace(/'/g,"''")}'`).filter(Boolean).join(',');
      const gp = new URLSearchParams({ where: `parno IN (${ids})`, outFields: 'parno', returnGeometry: 'true', outSR: '4326', f: 'json' });
      const geoData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${gp}`).catch(() => ({ features: [] }));
      const centroids = {};
      for (const f of geoData.features || []) {
        const g = f.geometry;
        centroids[f.attributes?.parno] = {
          lat: g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1)),
          lng: g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1)),
        };
      }
      return features.map(f => {
        const a = f.attributes || {};
        const { lat = null, lng = null } = centroids[a.parno] || {};
        const addr = [a.siteadd, a.stpostal, 'NC'].filter(Boolean).join(', ');
        return { parno: a.parno, owner: a.ownname, address: addr, city: a.stpostal, county: a.cntyname, state: 'NC', lat, lng };
      });
    };

    const searchSC = () => {
      let where = `T_Map_Number LIKE '${safeUpper}%'`;
      if (safeCounty) where += ` AND County LIKE '%${safeCounty}%'`;
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

  // ── Owner search: NC OneMap + SC DOT ────────────────────────────────────
  if (type === 'owner') {
    const searchNC = async () => {
      if (state === 'SC') return [];
      let where = `ownname LIKE '%${safeUpper}%'`;
      if (safeCounty) where += ` AND cntyname LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'false', resultRecordCount: '10', f: 'json' });
      const data = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`).catch(() => ({ features: [] }));
      const features = data.features || [];
      if (!features.length) return [];
      const ids = features.map(f => `'${(f.attributes.parno||'').replace(/'/g,"''")}'`).filter(Boolean).join(',');
      const gp = new URLSearchParams({ where: `parno IN (${ids})`, outFields: 'parno', returnGeometry: 'true', outSR: '4326', f: 'json' });
      const geoData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${gp}`).catch(() => ({ features: [] }));
      const centroids = {};
      for (const f of geoData.features || []) {
        const g = f.geometry;
        centroids[f.attributes?.parno] = {
          lat: g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1)),
          lng: g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1)),
        };
      }
      return features.map(f => {
        const a = f.attributes || {};
        const { lat = null, lng = null } = centroids[a.parno] || {};
        const addr = [a.siteadd, a.stpostal, 'NC'].filter(Boolean).join(', ');
        return { parno: a.parno, owner: a.ownname, address: addr, city: a.stpostal, county: a.cntyname, state: 'NC', lat, lng };
      });
    };

    const searchSC = () => {
      if (state === 'NC') return Promise.resolve([]);
      let where = `Ownership LIKE '%${safeUpper}%'`;
      if (safeCounty) where += ` AND County LIKE '%${safeCounty}%'`;
      const p = new URLSearchParams({ where, outFields: 'T_Map_Number,Ownership,County', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
      return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${p}`)
        .then(data => (data.features || []).map(f => {
          const a = f.attributes || {}; const g = f.geometry;
          const lat = g?.y ?? (g?.rings?.[0]?.reduce((s, c) => s + c[1], 0) / (g?.rings?.[0]?.length || 1));
          const lng = g?.x ?? (g?.rings?.[0]?.reduce((s, c) => s + c[0], 0) / (g?.rings?.[0]?.length || 1));
          return { parno: a.T_Map_Number, owner: a.Ownership?.trim() || null, address: null, city: null, county: a.County, state: 'SC', lat, lng };
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

  return res.status(400).json({ error: 'Invalid type' });
}
