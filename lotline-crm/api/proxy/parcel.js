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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, parno: qParno } = req.query;
  if (!qParno && (!lat || !lng)) return res.status(400).json({ error: 'lat/lng or parno required' });

  const latN = parseFloat(lat) || 0;
  const lngN = parseFloat(lng) || 0;

  const parnoIsSC = qParno ? /\d{6}-\d{2}-\d{3}/.test(qParno) || (qParno.includes('-') && !/^[A-Z]/.test(qParno)) : false;
  const isNC = !parnoIsSC && latN >= 33.84 && latN <= 36.6 && lngN >= -84.4 && lngN <= -75.4;
  const isSC = parnoIsSC || (!isNC && latN >= 31.9 && latN <= 35.3 && lngN >= -83.5 && lngN <= -78.4);
  if (!qParno && !isNC && !isSC) return res.status(404).json({ error: 'Outside NC/SC coverage area' });

  if (isSC || (qParno && !isNC)) {
    const SC_FIELDS = 'T_Map_Number,County,L_Value,M_Value,Ownership,Mailing_Add,Mailing_City,Mailing_Zip,Zoning,Land_Use,Acreage,Shape_Area,Mailing_St';
    let scParams;
    if (qParno) {
      scParams = new URLSearchParams({ where: `T_Map_Number='${qParno.replace(/'/g, "''")}'`, outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', f: 'geojson' });
    } else {
      const d = 0.002;
      scParams = new URLSearchParams({ geometry: `${lngN-d},${latN-d},${lngN+d},${latN+d}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: SC_FIELDS, returnGeometry: 'true', outSR: '4326', resultRecordCount: '5', f: 'geojson' });
    }
    try {
      const data = await fetchJson(`https://smpesri.scdot.org/arcgis/rest/services/GISMapping/SC_Parcels/MapServer/0/query?${scParams}`);
      if (data.error || !data.features?.length) return res.status(404).json({ error: 'No parcel found. Try clicking inside a property boundary.' });
      const f = data.features[0]; const p = f.properties || {};
      return res.json({ parcelId: p.T_Map_Number||null, owner: p.Ownership?.trim()||null, mailAddr: [p.Mailing_Add,p.Mailing_City,p.Mailing_St,p.Mailing_Zip].filter(Boolean).join(', ')||null, siteAddr: null, acres: (p.Acreage>0?p.Acreage:null)??(p.Shape_Area>0?p.Shape_Area/43560:null), landVal: p.L_Value??null, bldgVal: null, totVal: p.M_Value??null, landUse: p.Land_Use?.trim()||null, zoning: p.Zoning?.trim()||null, saleYear: null, county: p.County||null, subdivision: null, state: 'SC', geometry: f.geometry||null });
    } catch (err) { return res.status(502).json({ error: err.message }); }
  }

  const ATTR_FIELDS = 'parno,altparno,ownname,mailadd,mcity,mstate,mzip,siteadd,scity,gisacres,landval,improvval,parval,parusedesc,saledate,saledatetx,cntyname,subdivisio';

  const getAttrUrl = async () => {
    if (qParno) {
      const p = new URLSearchParams({ where: `parno='${qParno.replace(/'/g,"''")}'`, outFields: ATTR_FIELDS, returnGeometry: 'false', f: 'json' });
      return `https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/0/query?${p}`;
    }
    const d = 0.001;
    const polyParams = new URLSearchParams({ geometry: `${lngN-d},${latN-d},${lngN+d},${latN+d}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'parno,Shape__Area', returnGeometry: 'false', resultRecordCount: '5', f: 'json' });
    const polyData = await fetchJson(`https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1/query?${polyParams}`);
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
    return res.json({ parcelId: a.parno||a.altparno||null, owner: a.ownname?.trim()||null, mailAddr: [a.mailadd,a.mcity,a.mstate,a.mzip].filter(Boolean).join(', ')||null, siteAddr: [a.siteadd,a.scity].filter(Boolean).join(', ')||null, acres: a.gisacres??null, landVal: a.landval??null, bldgVal: a.improvval??null, totVal: a.parval??null, landUse: a.parusedesc?.trim()||null, saleYear, county: a.cntyname||null, subdivision: a.subdivisio?.trim()||null, state: 'NC', geometry });
  } catch (err) { return res.status(502).json({ error: err.message }); }
}
