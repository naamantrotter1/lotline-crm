const https = require('https');

function fetchLayer(layer, baseParams) {
  return new Promise((resolve) => {
    const url = `https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer/${layer}/query?${new URLSearchParams(baseParams)}`;
    let body = '';
    https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', d => body += d);
      r.on('end', () => { try { resolve(JSON.parse(body).features || []); } catch { resolve([]); } });
    }).on('error', () => resolve([]));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geometry = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });
  const baseParams = {
    where: '1=1', geometryType: 'esriGeometryEnvelope', geometry,
    inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'GNIS_NAME,FType', maxAllowableOffset: '0', f: 'geojson', resultRecordCount: '500',
  };

  try {
    const [flowlines, waterbodies] = await Promise.all([fetchLayer(3, baseParams), fetchLayer(9, baseParams)]);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json({ type: 'FeatureCollection', features: [...flowlines, ...waterbodies] });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
