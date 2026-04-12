import https from 'https';

// ── GML2 → GeoJSON converter ──────────────────────────────────────────────────
function getTagValue(xml, tag) {
  const m = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([^<]+)<`));
  return m ? m[1].trim() : null;
}

function parseGMLCoords(str) {
  // GML2: "lon,lat lon,lat ..." (comma within pair, space between pairs)
  return str.trim().split(/\s+/).map(pair => pair.split(',').slice(0, 2).map(Number));
}

function parseGMLGeometry(featureXml) {
  const polygons = [];
  const polyRe = /<gml:Polygon[^>]*>([\s\S]*?)<\/gml:Polygon>/gi;
  let pm;
  while ((pm = polyRe.exec(featureXml)) !== null) {
    const rings = [];
    const ringRe = /<gml:(?:outer|inner)BoundaryIs>([\s\S]*?)<\/gml:(?:outer|inner)BoundaryIs>/gi;
    let rm;
    while ((rm = ringRe.exec(pm[1])) !== null) {
      const cm = rm[1].match(/<gml:coordinates[^>]*>([\s\S]*?)<\/gml:coordinates>/i);
      if (cm) rings.push(parseGMLCoords(cm[1]));
    }
    if (rings.length) polygons.push(rings);
  }
  if (!polygons.length) return null;
  if (polygons.length === 1) return { type: 'Polygon', coordinates: polygons[0] };
  return { type: 'MultiPolygon', coordinates: polygons };
}

function gmlToGeoJSON(xml) {
  const features = [];
  const memberRe = /<(?:gml:featureMember|gml:member)[^>]*>([\s\S]*?)<\/(?:gml:featureMember|gml:member)>/gi;
  let m;
  while ((m = memberRe.exec(xml)) !== null) {
    const fx = m[1];
    const geom = parseGMLGeometry(fx);
    if (!geom) continue;
    features.push({
      type: 'Feature',
      geometry: geom,
      properties: {
        mupolygonkey: getTagValue(fx, 'mupolygonkey'),
        mukey:        getTagValue(fx, 'mukey'),
        musym:        getTagValue(fx, 'musym'),
        muname:       getTagValue(fx, 'muname'),
        areasymbol:   getTagValue(fx, 'areasymbol'),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required: minLon,minLat,maxLon,maxLat' });

  // WFS 1.0.0 — default GML2 output (no OUTPUTFORMAT needed)
  const params = new URLSearchParams({
    SERVICE:     'WFS',
    VERSION:     '1.0.0',
    REQUEST:     'GetFeature',
    TYPENAME:    'mapunitpoly',
    MAXFEATURES: '400',
    BBOX:        bbox,
  });
  const url = `https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDMWGS84Geographic.wfs?${params}`;

  const chunks = [];
  const request = https.get(url, {
    headers: { 'User-Agent': 'LotLine-CRM/1.0' },
    timeout: 20000,
  }, (upstream) => {
    upstream.on('data', c => chunks.push(c));
    upstream.on('end', () => {
      const xml = Buffer.concat(chunks).toString();
      if (xml.includes('ServiceException') || xml.includes('ExceptionReport')) {
        return res.status(502).json({ error: 'WFS exception', detail: xml.substring(0, 400) });
      }
      try {
        const gj = gmlToGeoJSON(xml);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.json(gj);
      } catch (e) {
        res.status(502).json({ error: 'parse error: ' + e.message });
      }
    });
  });
  request.on('error', err => res.status(502).json({ error: err.message }));
  request.on('timeout', () => { request.destroy(); res.status(504).json({ error: 'timeout' }); });
}
