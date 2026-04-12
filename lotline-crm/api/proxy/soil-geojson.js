import https from 'https';

// ── WKT → GeoJSON geometry converter ──────────────────────────────────────────
function parseCoordPairs(str) {
  return str.trim().split(',').map(p => p.trim().split(/\s+/).map(Number));
}

function parseRings(s) {
  // s is like "((x y,...),(x y,...))" — returns array of coordinate arrays
  const rings = [];
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') { depth++; if (depth === 1) start = i + 1; }
    else if (s[i] === ')') { depth--; if (depth === 0) { rings.push(parseCoordPairs(s.slice(start, i))); } }
  }
  return rings;
}

function wktToGeoJSON(wkt) {
  if (!wkt) return null;
  wkt = wkt.trim();
  if (wkt.startsWith('MULTIPOLYGON')) {
    const inner = wkt.slice(wkt.indexOf('(') + 1, wkt.lastIndexOf(')'));
    const polys = [];
    let depth = 0, start = -1;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === '(') { depth++; if (depth === 1) start = i; }
      else if (inner[i] === ')') { depth--; if (depth === 0 && start !== -1) { polys.push(parseRings(inner.slice(start, i + 1))); start = -1; } }
    }
    return { type: 'MultiPolygon', coordinates: polys };
  }
  if (wkt.startsWith('POLYGON')) {
    return { type: 'Polygon', coordinates: parseRings(wkt.slice(wkt.indexOf('('))) };
  }
  return null;
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required: minLon,minLat,maxLon,maxLat' });

  const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
  if ([minLon, minLat, maxLon, maxLat].some(isNaN))
    return res.status(400).json({ error: 'invalid bbox' });

  const poly = `POLYGON((${minLon} ${minLat},${maxLon} ${minLat},${maxLon} ${maxLat},${minLon} ${maxLat},${minLon} ${minLat}))`;

  const query =
    `SELECT TOP 300 P.mupolygonkey, MU.mukey, MU.musym, MU.muname, ` +
    `CAST(P.SHAPE.STSimplify(0.00005).STAsText() AS nvarchar(max)) as wkt ` +
    `FROM mapunit MU INNER JOIN mupolygon P ON MU.mukey = P.mukey ` +
    `WHERE P.SHAPE.STIntersects(geometry::STPolyFromText('${poly}',4326)) = 1`;

  const body = JSON.stringify({ query, FORMAT: 'JSON+COLUMNNAME+METADATA' });

  const options = {
    hostname: 'sdmdataaccess.sc.egov.usda.gov',
    path: '/Tabular/SDMTabularService/post.rest',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'LotLine-CRM/1.0',
    },
    timeout: 20000,
  };

  const chunks = [];
  const request = https.request(options, (upstream) => {
    upstream.on('data', c => chunks.push(c));
    upstream.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        // If not JSON, return first 400 chars so we can diagnose
        if (raw.trimStart().startsWith('<') || raw.trimStart().startsWith('Error')) {
          return res.status(502).json({ error: 'SDA API returned non-JSON', detail: raw.substring(0, 400) });
        }
        const data = JSON.parse(raw);
        const rows = data.Table || [];
        if (!rows.length) return res.json({ type: 'FeatureCollection', features: [] });

        // First row is column names
        const cols = rows[0];
        const mupolygonkeyIdx = cols.indexOf('mupolygonkey');
        const mukeyIdx = cols.indexOf('mukey');
        const musymIdx = cols.indexOf('musym');
        const munameIdx = cols.indexOf('muname');
        const wktIdx = cols.indexOf('wkt');

        const features = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const geom = wktToGeoJSON(row[wktIdx]);
          if (!geom) continue;
          features.push({
            type: 'Feature',
            geometry: geom,
            properties: {
              mupolygonkey: row[mupolygonkeyIdx],
              mukey: row[mukeyIdx],
              musym: row[musymIdx],
              muname: row[munameIdx],
            },
          });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json({ type: 'FeatureCollection', features });
      } catch (e) {
        res.status(502).json({ error: 'parse error: ' + e.message });
      }
    });
  });

  request.on('error', err => res.status(502).json({ error: err.message }));
  request.on('timeout', () => { request.destroy(); res.status(504).json({ error: 'timeout' }); });
  request.write(body);
  request.end();
}
