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

  const safe = q.trim().replace(/'/g, "''").toUpperCase();
  const safeCounty = county.trim().replace(/'/g, "''").toUpperCase();

  const searchNC = () => {
    let where;
    if (type === 'parno') where = `UPPER(parno) LIKE '${safe}%'`;
    else if (type === 'owner') where = `UPPER(ownname) LIKE '%${safe}%'`;
    else where = `UPPER(siteadd) LIKE '%${safe}%'`;
    if (safeCounty) where += ` AND UPPER(cntyname) LIKE '%${safeCounty}%'`;
    const p = new URLSearchParams({ where, outFields: 'parno,ownname,siteadd,cntyname,stpostal', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
    return fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`)
      .then(data => (data.features || []).map(f => {
        const a = f.attributes || {}; const g = f.geometry;
        const lat = g?.y ?? (g?.rings?.[0]?.reduce((s,c)=>s+c[1],0)/(g?.rings?.[0]?.length||1));
        const lng = g?.x ?? (g?.rings?.[0]?.reduce((s,c)=>s+c[0],0)/(g?.rings?.[0]?.length||1));
        return { parno: a.parno, owner: a.ownname, address: a.siteadd, city: a.stpostal, county: a.cntyname, state: 'NC', lat, lng };
      })).catch(() => []);
  };

  const searchSC = () => {
    if (type !== 'parno') return Promise.resolve([]);
    let where = `UPPER(T_Map_Number) LIKE '${safe}%'`;
    if (safeCounty) where += ` AND UPPER(County) LIKE '%${safeCounty}%'`;
    const p = new URLSearchParams({ where, outFields: 'T_Map_Number,County', returnGeometry: 'true', outSR: '4326', resultRecordCount: '10', f: 'json' });
    return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${p}`)
      .then(data => (data.features || []).map(f => {
        const a = f.attributes || {}; const g = f.geometry;
        const lat = g?.y ?? (g?.rings?.[0]?.reduce((s,c)=>s+c[1],0)/(g?.rings?.[0]?.length||1));
        const lng = g?.x ?? (g?.rings?.[0]?.reduce((s,c)=>s+c[0],0)/(g?.rings?.[0]?.length||1));
        return { parno: a.T_Map_Number, owner: null, address: null, city: null, county: a.County, state: 'SC', lat, lng };
      })).catch(() => []);
  };

  try {
    const queries = [];
    if (state !== 'SC') queries.push(searchNC());
    if (state !== 'NC') queries.push(searchSC());
    const results = await Promise.all(queries);
    return res.json(results.flat().slice(0, 10));
  } catch (err) { return res.status(502).json({ error: err.message }); }
}
