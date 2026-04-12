import https from 'https';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Forward all query params to USDA NRCS SDM WMS
  const params = new URLSearchParams(req.query);
  const url = `https://SDMDataAccess.sc.egov.usda.gov/Spatial/SDM.wms?${params.toString()}`;

  const chunks = [];
  https.get(url, {
    headers: {
      'User-Agent': 'LotLine-CRM/1.0',
      'Accept': 'image/png,image/*,*/*',
    },
  }, (upstream) => {
    const contentType = upstream.headers['content-type'] || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.on('data', chunk => chunks.push(chunk));
    upstream.on('end', () => res.end(Buffer.concat(chunks)));
  }).on('error', err => res.status(502).json({ error: err.message }));
}
