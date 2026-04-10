import https from 'https';

function fetchJSON(url) {
  return new Promise((resolve) => {
    let body = '';
    https.get(url, { headers: { 'User-Agent': 'LotLine-CRM/1.0', 'Accept-Encoding': 'identity' } }, (r) => {
      r.on('data', c => body += c);
      r.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    }).on('error', () => resolve({}));
  });
}

function calcSlopeStats(samples, midLat) {
  if (!samples || samples.length < 9) return null;
  const valid = samples.filter(s => s.value != null && s.value !== 'NoData' && s.value !== -9999);
  if (valid.length < 9) return null;
  const sorted = [...valid].sort((a,b) => { const dy=b.location.y-a.location.y; if(Math.abs(dy)>1e-6)return dy; return a.location.x-b.location.x; });
  const gridN = Math.round(Math.sqrt(sorted.length));
  const mPerLat = 111320, mPerLng = 111320*Math.cos(midLat*Math.PI/180);
  const slopes = [];
  for (let r=0;r<gridN-1;r++) for (let c=0;c<gridN-1;c++) {
    const idx=r*gridN+c, tl=sorted[idx], tr=sorted[idx+1], bl=sorted[idx+gridN];
    if (!tl||!tr||!bl) continue;
    const dx=(tr.location.x-tl.location.x)*mPerLng, dy=(tl.location.y-bl.location.y)*mPerLat;
    if(dx<0.1||dy<0.1) continue;
    const slopePct=Math.sqrt(((parseFloat(tr.value)-parseFloat(tl.value))/dx)**2+((parseFloat(tl.value)-parseFloat(bl.value))/dy)**2)*100;
    if(isFinite(slopePct)) slopes.push(slopePct);
  }
  if (!slopes.length) return null;
  const n=slopes.length, count=(lo,hi)=>slopes.filter(s=>s>=lo&&(hi==null||s<hi)).length;
  return { avg:(slopes.reduce((a,v)=>a+v,0)/n).toFixed(2), flat:+((count(0,0.5)/n)*100).toFixed(1), minimal:+((count(0.5,5)/n)*100).toFixed(1), moderate:+((count(5,10)/n)*100).toFixed(1), heavy:+((count(10,15)/n)*100).toFixed(1), extreme:+((count(15)/n)*100).toFixed(1) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { bbox } = req.query;
  if (!bbox) return res.status(400).json({ error: 'bbox required' });
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  const geomEnv = JSON.stringify({ xmin: minLng, ymin: minLat, xmax: maxLng, ymax: maxLat, spatialReference: { wkid: 4326 } });

  const floodParams = new URLSearchParams({ where: "SFHA_TF = 'T'", geometryType: 'esriGeometryEnvelope', geometry: geomEnv, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'FLD_ZONE,ZONE_SUBTY', f: 'geojson', resultRecordCount: '500' });
  const wetlandParams = new URLSearchParams({ where: '1=1', geometryType: 'esriGeometryEnvelope', geometry: geomEnv, inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'WETLAND_TYPE,ATTRIBUTE', f: 'geojson', resultRecordCount: '500' });
  const elevParams = new URLSearchParams({ geometry: geomEnv, geometryType: 'esriGeometryEnvelope', sampleCount: '144', returnFirstValueOnly: 'false', f: 'json' });

  try {
    const [floodData, wetlandData, elevData] = await Promise.all([
      fetchJSON(`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set_gdb/FeatureServer/0/query?${floodParams}`),
      fetchJSON(`https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Wetlands/FeatureServer/0/query?${wetlandParams}`),
      fetchJSON(`https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples?${elevParams}`),
    ]);
    return res.json({ flood: { type: 'FeatureCollection', features: floodData.features||[] }, wetlands: { type: 'FeatureCollection', features: wetlandData.features||[] }, slope: calcSlopeStats(elevData.samples, (minLat+maxLat)/2) });
  } catch (err) { return res.status(502).json({ error: err.message }); }
}
