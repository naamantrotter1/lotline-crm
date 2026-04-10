import https from 'https';

function fetchLayer(layer, params) {
  return new Promise((resolve) => {
    const url = `https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/${layer}/query?${params}`;
    let body = '';
    https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', c => body += c);
      r.on('end', () => {
        try { const features = JSON.parse(body).features || []; features.forEach(f => { f.properties._isIndex = layer === 25; }); resolve(features); }
        catch { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geomEnv = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({ geometry: geomEnv, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'contourelevation,contourunits,contourinterval', returnGeometry: 'true', f: 'geojson', resultRecordCount: '500' });

  try {
    const [index, intermediate] = await Promise.all([fetchLayer(25, params), fetchLayer(26, params)]);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json({ type: 'FeatureCollection', features: [...index, ...intermediate] });
  } catch (err) { return res.status(502).json({ error: err.message }); }
}
