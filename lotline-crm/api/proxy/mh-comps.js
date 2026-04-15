// Manufactured Home Comps proxy
// Requires: RAPIDAPI_KEY env var (Zillow Real Estate API by Data Forge on RapidAPI)
// Host: zillow-real-estate-api.p.rapidapi.com
import https from 'https';

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    let body = '';
    https.get(url, { headers }, (r) => {
      r.on('data', chunk => (body += chunk));
      r.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON: ' + body.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lng, status = 'for_sale' } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });

  // Zillow Real Estate API by Data Forge — search by coordinates
  const apiStatus = status === 'sold' ? 'recently_sold' : 'for_sale';

  const params = new URLSearchParams({
    lat:       parseFloat(lat).toFixed(6),
    lng:       parseFloat(lng).toFixed(6),
    status:    apiStatus,
    home_type: 'manufactured',
    zoom:      '11',
    page_size: '40',
  });

  const url = `https://zillow-real-estate-api.p.rapidapi.com/v1/search/coordinates?${params}`;

  try {
    const data = await fetchJson(url, {
      'X-RapidAPI-Key':  apiKey,
      'X-RapidAPI-Host': 'zillow-real-estate-api.p.rapidapi.com',
      'User-Agent':      'LotLine-CRM/1.0',
    });

    // API returns { results: [...] } or { properties: [...] } — handle both shapes
    const props = data?.results || data?.properties || data?.props || [];

    const results = props.map(p => ({
      zpid:     p.zpid,
      address:  p.address || [p.streetAddress, p.city, p.state].filter(Boolean).join(', '),
      price:    p.price ?? p.listPrice ?? p.soldPrice,
      beds:     p.bedrooms ?? p.beds,
      baths:    p.bathrooms ?? p.baths,
      sqft:     p.livingArea ?? p.sqft,
      lat:      p.latitude ?? p.lat,
      lng:      p.longitude ?? p.lng,
      imgSrc:   p.imgSrc ?? p.image,
      url:      p.detailUrl
                  ? (p.detailUrl.startsWith('http') ? p.detailUrl : `https://www.zillow.com${p.detailUrl}`)
                  : (p.url ?? null),
      daysOn:   p.daysOnZillow ?? p.daysOnMarket,
      soldDate: p.soldDate ?? null,
      status:   status === 'sold' ? 'sold' : 'for_sale',
    })).filter(p => p.lat && p.lng);

    res.status(200).json({ results, raw_count: props.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
