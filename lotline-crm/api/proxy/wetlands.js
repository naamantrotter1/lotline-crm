const https = require('https');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geometry = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });
  const params = new URLSearchParams({
    where: '1=1', geometryType: 'esriGeometryEnvelope', geometry,
    inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'WETLAND_TYPE,ATTRIBUTE', maxAllowableOffset: '0',
    f: 'geojson', resultRecordCount: '1000',
  });
  const url = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Wetlands/FeatureServer/0/query?${params}`;

  let body = '';
  https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (upstream) => {
    upstream.on('data', c => body += c);
    upstream.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.send(body);
    });
  }).on('error', err => res.status(502).json({ error: err.message }));
};
