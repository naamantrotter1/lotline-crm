import https from 'https';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required (minLon,minLat,maxLon,maxLat)' });

  // USDA NRCS Soil Data Mart WFS – returns GeoJSON natively
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'mapunitpoly',
    COUNT: '500',
    OUTPUTFORMAT: 'application/json',
    BBOX: `${bbox},urn:ogc:def:crs:EPSG::4326`,
  });

  const url = `https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDMWGS84Geographic.wfs?${params}`;

  const chunks = [];
  const request = https.get(url, {
    headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept': 'application/json' },
    timeout: 15000,
  }, (upstream) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    upstream.on('data', c => chunks.push(c));
    upstream.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      // If the WFS returned an error XML, wrap it so the client knows
      if (body.trimStart().startsWith('<')) {
        return res.status(502).json({ error: 'WFS returned XML (not GeoJSON)', detail: body.substring(0, 300) });
      }
      res.send(body);
    });
  });
  request.on('error', err => res.status(502).json({ error: err.message }));
  request.on('timeout', () => { request.destroy(); res.status(504).json({ error: 'WFS timeout' }); });
}
