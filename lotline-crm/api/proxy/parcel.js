import https from 'https';

function fetchJson(u) {
  return new Promise((resolve, reject) => {
    let body = '';
    https.get(u, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', chunk => body += chunk);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// Nominatim reverse geocoding — used as a fallback when the parcel database
// lacks a site address (common for NC OneMap and all SC DOT parcels).
async function reverseGeocode(lat, lng) {
  if (!lat || !lng || lat === 0 || lng === 0) return null;
  try {
    const p = new URLSearchParams({ lat, lon: lng, format: 'json', addressdetails: '1' });
    const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?${p}`);
    if (!data || data.error) return null;
    const a = data.address || {};
    const street = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(' ');
    // Only actual incorporated municipalities — suburb/neighbourhood/hamlet are community names
    // County is already shown separately in the parcel panel, so omit it here.
    const city   = a.city || a.town || a.municipality || '';
    // state_code may come back as "US-NC"; strip the "US-" prefix if present
    const rawState = a.state_code || '';
    const state  = rawState.replace(/^US-/i, '') ||
                   (a.state === 'North Carolina' ? 'NC' : a.state === 'South Carolina' ? 'SC' : '');
    const zip    = a.postcode || '';
    const parts  = [street, city, state, zip].filter(Boolean);
    return parts.length >= 2 ? parts.join(', ') : null;
  } catch {
    return null;
  }
}

// Extract a usable centroid [lat, lng] from a GeoJSON geometry
function centroidOf(geometry) {
  if (!geometry) return [0, 0];
  try {
    if (geometry.type === 'Point') return [geometry.coordinates[1], geometry.coordinates[0]];
    const rings = geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.coordinates[0][0]; // MultiPolygon
    const n = rings.length;
    const lat = rings.reduce((s, c) => s + c[1], 0) / n;
    const lng = rings.reduce((s, c) => s + c[0], 0) / n;
    return [lat, lng];
  } catch { return [0, 0]; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, parno: qParno, state: qState, county: qCounty } = req.query;
  if (!qParno && (!lat || !lng)) return res.status(400).json({ error: 'lat/lng or parno required' });

  const latN = parseFloat(lat) || 0;
  const lngN = parseFloat(lng) || 0;

  // If caller explicitly passes state (from boundary feature), trust it
  const forcedNC = qState === 'NC';
  const forcedSC = qState === 'SC';

  const parnoIsSC = forcedSC || (!forcedNC && qParno ? /\d{6}-\d{2}-\d{3}/.test(qParno) || (qParno.includes('-') && !/^[A-Z]/.test(qParno)) : false);
  const isNC = forcedNC || (!forcedSC && !parnoIsSC && latN >= 33.84 && latN <= 36.6 && lngN >= -84.4 && lngN <= -75.4);
  const isSC = forcedSC || parnoIsSC || (!isNC && latN >= 31.9 && latN <= 35.3 && lngN >= -83.5 && lngN <= -78.4);
  if (!qParno && !isNC && !isSC) return res.status(404).json({ error: 'Outside NC/SC coverage area' });

  // ── South Carolina ───────────────────────────────────────────────────────────
  if (isSC || (qParno && !isNC)) {
    const SC_FIELDS = 'T_Map_Number,County,L_Value,M_Value,Ownership,Mailing_Add,Mailing_City,Mailing_Zip,Zoning,Land_Use,Acreage,Shape_Area,Mailing_St';
    let scParams;
    if (qParno) {
      const scWhere = `T_Map_Number='${qParno.replace(/'/g, "''")}'`;
      scParams = new URLSearchParams({ where: scWhere, outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', f: 'geojson' });
    } else {
      // Use point query first (exact parcel containing the point), fall back to small bbox
      const ptGeom = JSON.stringify({ x: lngN, y: latN, spatialReference: { wkid: 4326 } });
      scParams = new URLSearchParams({ geometry: ptGeom, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', resultRecordCount: '3', f: 'geojson' });
    }
    try {
      let data = await fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${scParams}`);
      // If point query returned nothing (point on road/boundary), fall back to small bbox
      if (!qParno && (data.error || !data.features?.length)) {
        const d = 0.0002;
        const fbParams = new URLSearchParams({ geometry: `${lngN-d},${latN-d},${lngN+d},${latN+d}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', resultRecordCount: '3', f: 'geojson' });
        data = await fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${fbParams}`);
      }
      if (data.error || !data.features?.length) return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });
      const f = data.features[0]; const p = f.properties || {};

      // SC DOT has no site address — derive from geometry centroid via reverse geocode
      const [gLat, gLng] = centroidOf(f.geometry);
      const rgLat = latN || gLat;
      const rgLng = lngN || gLng;
      const siteAddr = await reverseGeocode(rgLat, rgLng);

      return res.json({
        parcelId: p.T_Map_Number||null,
        owner: p.Ownership?.trim()||null,
        mailAddr: [p.Mailing_Add, p.Mailing_City, p.Mailing_St, p.Mailing_Zip].filter(Boolean).join(', ')||null,
        siteAddr,
        acres: (p.Acreage>0 ? p.Acreage : null) ?? (p.Shape_Area>0 ? p.Shape_Area/43560 : null),
        landVal: p.L_Value??null,
        bldgVal: null,
        totVal: p.M_Value??null,
        landUse: p.Land_Use?.trim()||null,
        zoning: p.Zoning?.trim()||null,
        saleYear: null,
        county: p.County||null,
        subdivision: null,
        state: 'SC',
        geometry: f.geometry||null,
      });
    } catch (err) { return res.status(502).json({ error: err.message }); }
  }

  // ── North Carolina ───────────────────────────────────────────────────────────
  // szip added for complete site address; stnum not available in MapServer/0
  const ATTR_FIELDS = 'parno,altparno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,szip,gisacres,landval,improvval,parval,parusedesc,saledate,saledatetx,cntyname,subdivisio';

  const getAttrUrl = async () => {
    if (qParno) {
      const where = `parno='${qParno.replace(/'/g,"''")}'`;
      const p = new URLSearchParams({ where, outFields: ATTR_FIELDS, returnGeometry: 'false', f: 'json' });
      return `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`;
    }
    // Use point query — returns only the parcel that contains the exact click point.
    // Fall back to a tiny bbox if the point lands on a road/boundary with no parcel.
    const ptGeom = JSON.stringify({ x: lngN, y: latN, spatialReference: { wkid: 4326 } });
    let polyParams = new URLSearchParams({ geometry: ptGeom, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'parno,Shape__Area', returnGeometry: 'false', resultRecordCount: '3', f: 'json' });
    let polyData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${polyParams}`);
    if (!polyData.features?.length) {
      // fallback: tiny bbox (~11m box)
      const d = 0.0001;
      polyParams = new URLSearchParams({ geometry: `${lngN-d},${latN-d},${lngN+d},${latN+d}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'parno,Shape__Area', returnGeometry: 'false', resultRecordCount: '3', f: 'json' });
      polyData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${polyParams}`);
    }
    const features = polyData.features || [];
    if (!features.length) return null;
    const best = features.reduce((a,b) => (b.attributes?.Shape__Area??Infinity)<(a.attributes?.Shape__Area??Infinity)?b:a);
    const parno = best.attributes?.parno;
    if (!parno) return null;
    const p = new URLSearchParams({ where: `parno='${parno.replace(/'/g,"''")}'`, outFields: ATTR_FIELDS, returnGeometry: 'false', f: 'json' });
    return `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`;
  };

  try {
    const attrUrl = await getAttrUrl();
    if (!attrUrl) return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });
    const attrData = await fetchJson(attrUrl);
    if (attrData.error) return res.status(502).json({ error: `Parcel service error: ${attrData.error.message||attrData.error.code}` });
    const features = attrData.features || [];
    if (!features.length) return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });
    const best = features.reduce((a,b) => (b.attributes?.gisacres??Infinity)<(a.attributes?.gisacres??Infinity)?b:a);
    const a = best.attributes;

    let geometry = null;
    const lookupParno = qParno || a.parno;
    if (lookupParno) {
      try {
        const gp = new URLSearchParams({ where: `parno='${lookupParno.replace(/'/g,"''")}'`, outFields: 'parno', returnGeometry: 'true', f: 'geojson' });
        const polyData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${gp}`);
        geometry = polyData.features?.[0]?.geometry || null;
      } catch(e) {}
    }

    let saleYear = null;
    if (a.saledatetx) { const m = String(a.saledatetx).match(/(\d{4})/); if (m) saleYear = m[1]; }
    else if (a.saledate) { saleYear = new Date(a.saledate).getFullYear(); }

    // Build site address from NC OneMap fields; fall back to reverse geocoding
    // when county hasn't submitted a site address (common for many NC counties).
    //
    // siteadd sometimes lacks the house number; reverse geocoding will fill it in below.
    let street = a.siteadd?.trim() || '';
    let siteAddr = [street, a.scity, a.szip ? `NC ${a.szip}` : ''].filter(Boolean).join(', ') || null;
    if (!siteAddr || !/^\d/.test(siteAddr)) {
      // Use click/search coordinates, or centroid of fetched geometry, to get a
      // complete address including house number via reverse geocoding.
      const [gLat, gLng] = centroidOf(geometry);
      const rgLat = latN || gLat;
      const rgLng = lngN || gLng;
      const rgAddr = await reverseGeocode(rgLat, rgLng);
      if (rgAddr) {
        // If we already have a street name but just need the number, extract it
        const houseNum = rgAddr.match(/^(\d+[A-Za-z]?)\s/)?.[1];
        if (houseNum && street && !/^\d/.test(street)) {
          siteAddr = [`${houseNum} ${street}`, a.scity, a.szip ? `NC ${a.szip}` : ''].filter(Boolean).join(', ');
        } else {
          siteAddr = rgAddr;
        }
      }
    }

    return res.json({
      parcelId: a.parno||a.altparno||null,
      owner: a.ownname?.trim()||null,
      mailAddr: [a.mailadd, a.mcity, a.mstate, a.mzip].filter(Boolean).join(', ')||null,
      siteAddr,
      acres: a.gisacres??null,
      landVal: a.landval??null,
      bldgVal: a.improvval??null,
      totVal: a.parval??null,
      landUse: a.parusedesc?.trim()||null,
      saleYear,
      county: a.cntyname||null,
      subdivision: a.subdivisio?.trim()||null,
      state: 'NC',
      geometry,
    });
  } catch (err) { return res.status(502).json({ error: err.message }); }
}
