const https = require('https');

function fetchJson(u) {
  return new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });

  const [west, south, east, north] = bbox.split(',').map(Number);
  const midLat = (south + north) / 2;
  const midLng = (west + east) / 2;

  const midInNC = midLat >= 33.84 && midLat <= 36.6 && midLng >= -84.4 && midLng <= -75.4;
  const midInSC = !midInNC && midLat >= 31.9 && midLat <= 35.3 && midLng >= -83.5 && midLng <= -78.4;

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

  const querySC = () => {
    const params = new URLSearchParams({
      geometry: bbox, geometryType: 'esriGeometryEnvelope', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: 'T_Map_Number,County',
      returnGeometry: 'true', outSR: '4326', resultRecordCount: '500', f: 'geojson',
    });
    return fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${params}`)
      .then(data => {
        if (data.error || !data.features) return { type: 'FeatureCollection', features: [] };
        data.features.forEach(f => { if (f.properties) f.properties.parno = f.properties.T_Map_Number || ''; });
        return data;
      })
      .catch(() => ({ type: 'FeatureCollection', features: [] }));
  };

  try {
    const queries = [];
    if (midInNC) queries.push(queryNC());
    if (midInSC) queries.push(querySC());
    if (queries.length === 0) queries.push(queryNC());

    const results = await Promise.all(queries);
    const allFeatures = results.flatMap(r => r.features || []);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({ type: 'FeatureCollection', features: allFeatures });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
