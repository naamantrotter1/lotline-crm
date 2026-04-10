import https from 'https';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox, w = '256', h = '256' } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });

  const url = `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/export?bbox=${encodeURIComponent(bbox)}&bboxSR=4326&layers=show%3A1&size=${w}%2C${h}&format=png32&transparent=true&f=image`;
  https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0' } }, (upstream) => {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    upstream.pipe(res);
  }).on('error', err => res.status(502).send(err.message));
}
