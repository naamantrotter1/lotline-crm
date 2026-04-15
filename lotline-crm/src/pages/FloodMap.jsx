import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { Layers, Droplets, Waves, AlertTriangle, ZoomIn, MapPin, X, TreePine, Mountain, SlidersHorizontal, Search, ChevronDown, PlusCircle, ExternalLink } from 'lucide-react';
import { saveDeal } from '../lib/dealsSync';

function AddToPipelineModal({ parcelData, onClose }) {
  const [address,    setAddress]    = useState(parcelData.siteAddr || '');
  const [county,     setCounty]     = useState(parcelData.county || '');
  const [dealState,  setDealState]  = useState(parcelData.state || 'NC');
  const [acreage,    setAcreage]    = useState(parcelData.acres != null ? String(Number(parcelData.acres).toFixed(2)) : '');
  const [ownerName,  setOwnerName]  = useState(parcelData.owner || '');
  const [parcelId,   setParcelId]   = useState(parcelData.parcelId || '');
  const [notes,      setNotes]      = useState('');
  const [saved,      setSaved]      = useState(false);

  const handleSave = () => {
    if (!address.trim()) return;
    const deal = {
      id: 'map-' + Date.now(),
      pipeline: 'land-acquisition',
      stage: 'New Lead',
      address: address.trim(),
      parcelId: parcelId.trim(),
      county: county.trim(),
      state: dealState,
      acreage: parseFloat(acreage) || undefined,
      ownerName: ownerName.trim(),
      arv: 0,
      financing: 'Cash',
      netProfit: 0,
      land: parcelData.landVal || 0,
      generalNotes: notes.trim(),
      holdingMonths: 4,
      holdingPerMonth: 250,
      hudEngineer: 500, percTest: 2000, survey: 1500, footers: 6000, setup: 9000,
      mobileHome: 0, clearLand: 0, water: 0, septic: 0, electric: 0, hvac: 4500,
      underpinning: 6000, decks: 3500, driveway: 1200, landscaping: 0, waterSewer: 0,
      mailbox: 170, gutters: 0, photos: 0, mobileTax: 300, staging: 0,
    };
    saveDeal(deal);
    setSaved(true);
    setTimeout(onClose, 1100);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PlusCircle size={16} className="text-accent" />
            <h2 className="text-sm font-bold text-sidebar">Add to Land Acquisition</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Address */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Address *</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Property address"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>

          {/* County / State / Acreage */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">County</label>
              <input value={county} onChange={e => setCounty(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">State</label>
              <select value={dealState} onChange={e => setDealState(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="NC">NC</option>
                <option value="SC">SC</option>
              </select>
            </div>
            <div className="col-span-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Acres</label>
              <input type="number" value={acreage} onChange={e => setAcreage(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>

          {/* Owner / Parcel ID */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Owner</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Parcel ID</label>
              <input value={parcelId} onChange={e => setParcelId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!address.trim() || saved}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              saved ? 'bg-green-500 text-white' : !address.trim() ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-accent text-white hover:bg-accent/90'
            }`}
          >
            {saved ? '✓ Added to Pipeline!' : 'Add as New Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Config ──────────────────────────────────────────────────────────────────
const PROXY = import.meta.env.VITE_API_URL || '';
const MIN_GEOJSON_ZOOM = 8; // Below this the polygons are too small to be useful

const LAYER_CONFIGS = {
  floodplain: {
    label: 'FEMA Floodplain',
    description: '100-yr Special Flood Hazard Areas',
    icon: AlertTriangle,
    color: '#2563eb',    // blue-600 — bright enough to show on satellite
    type: 'geojson',
    apiPath: '/api/proxy/flood-zones',
  },
  wetlands: {
    label: 'Wetlands',
    description: 'National Wetlands Inventory (USFWS)',
    icon: Droplets,
    color: '#06b6d4',    // cyan-500 — distinct from flood blue
    type: 'geojson',
    apiPath: '/api/proxy/wetlands',
  },
  water: {
    label: 'Water Features',
    description: 'Rivers, Streams & Water Bodies (USGS)',
    icon: Waves,
    color: '#38bdf8',    // sky-400
    type: 'geojson',
    apiPath: '/api/proxy/water',
  },
};

const TILE_LAYERS = {
  light: [
    { url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', opts: { maxZoom: 19 } },
    { url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', opts: { maxZoom: 19, pane: 'shadowPane' } },
  ],
  satellite: [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom: 19 } },
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', opts: { maxZoom: 19, pane: 'shadowPane' } },
  ],
};

const STATE_BOUNDS = {
  Both: { center: [34.8, -79.5], zoom: 7 },
  NC:   { center: [35.5, -79.4], zoom: 7 },
  SC:   { center: [33.9, -78.65], zoom: 12 }, // center on Myrtle Beach parcel coverage area
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function FloodMap({ initialParcelId, initialState, initialCounty, initialAddress, onClose } = {}) {
  const mapRef       = useRef(null);
  const leafletMap   = useRef(null);
  const baseTiles    = useRef([]);
  const wmsRefs      = useRef({});
  const geojsonRefs  = useRef({});
  const countyLayer  = useRef(null);
  const fetchTimer   = useRef(null);
  const fetchSeq     = useRef({ floodplain: 0, wetlands: 0, water: 0 });
  const layersRef    = useRef({ floodplain: true, wetlands: false, water: false });
  const parcelModeRef = useRef(false);
  const parcelBoundaryLayerRef = useRef(null);
  const parcelBoundariesRef = useRef(false);
  const clickedParnoRef = useRef(null);  // set by boundary polygon click before map click fires
  const clickedStateRef = useRef(null);  // 'NC' | 'SC' — from boundary feature property
  const selectedParnoRef = useRef(null); // currently highlighted parcel parno
  const parcelFetchAbortRef = useRef(null); // AbortController for in-flight boundary fetch
  const parcelInfoAbortRef = useRef(null);  // AbortController for in-flight parcel info fetch
  const selectedHighlightRef = useRef(null); // separate top-layer for the selected parcel highlight
  const fromSearchRef = useRef(false);       // true when click was triggered by search result (use data.geometry directly)

  const [state,    setState]    = useState('Both');
  const [searchParams] = useSearchParams();
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [layers,   setLayers]   = useState({ floodplain: false, wetlands: false, water: false });
  const [counties, setCounties] = useState(false);
  const [zoom,     setZoom]     = useState(7);
  const [loading,  setLoading]  = useState({});
  const [parcelMode, setParcelMode]             = useState(true);
  const [parcelData, setParcelData]             = useState(null);
  const [parcelLoading, setParcelLoading]       = useState(false);
  const [parcelBoundaries, setParcelBoundaries] = useState(true);
  const [buildability, setBuildability]         = useState(null); // { pct, flood, wetlands }
  const [buildabilityLoading, setBuildabilityLoading] = useState(false);
  const [showBuildability, setShowBuildability] = useState(false);
  const [showAddToPipeline, setShowAddToPipeline] = useState(false);
  const [parcelLatLng, setParcelLatLng] = useState(null);
  const parcelLayerRef = useRef(null);
  const buildabilityLayerRef = useRef(null);
  const contoursLayerRef = useRef(null);      // vector GeoJSON contour layer
  const contoursFetchAbortRef = useRef(null); // abort controller for in-flight contour fetch
  const contoursEnabledRef = useRef(false);   // mirrors contours state for use in callbacks

  const [contours, setContours] = useState(false);
  const [soil,     setSoil]     = useState(false);
  const soilGeoJSONRef      = useRef(null);
  const soilFetchAbortRef   = useRef(null);
  const soilEnabledRef      = useRef(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // ── Parcel search bar ──────────────────────────────────────────────────────
  const [searchType, setSearchType]       = useState('address');
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const [showTypeMenu, setShowTypeMenu]   = useState(false);
  const [searchState, setSearchState]     = useState('');   // 'NC' | 'SC' | ''
  const [searchCounty, setSearchCounty]   = useState('');
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [showCountyMenu, setShowCountyMenu] = useState(false);
  const searchDebounce = useRef(null);

  const NC_COUNTIES = ['Alamance','Alexander','Alleghany','Anson','Ashe','Avery','Beaufort','Bertie','Bladen','Brunswick','Buncombe','Burke','Cabarrus','Caldwell','Camden','Carteret','Caswell','Catawba','Chatham','Cherokee','Chowan','Clay','Cleveland','Columbus','Craven','Cumberland','Currituck','Dare','Davidson','Davie','Duplin','Durham','Edgecombe','Forsyth','Franklin','Gaston','Gates','Graham','Granville','Greene','Guilford','Halifax','Harnett','Haywood','Henderson','Hertford','Hoke','Hyde','Iredell','Jackson','Johnston','Jones','Lee','Lenoir','Lincoln','Macon','Madison','Martin','McDowell','Mecklenburg','Mitchell','Montgomery','Moore','Nash','New Hanover','Northampton','Onslow','Orange','Pamlico','Pasquotank','Pender','Perquimans','Person','Pitt','Polk','Randolph','Richmond','Robeson','Rockingham','Rowan','Rutherford','Sampson','Scotland','Stanly','Stokes','Surry','Swain','Transylvania','Tyrrell','Union','Vance','Wake','Warren','Washington','Watauga','Wayne','Wilkes','Wilson','Yadkin','Yancey'];
  const SC_COUNTIES = ['Abbeville','Aiken','Allendale','Anderson','Bamberg','Barnwell','Beaufort','Berkeley','Calhoun','Charleston','Cherokee','Chester','Chesterfield','Clarendon','Colleton','Darlington','Dillon','Dorchester','Edgefield','Fairfield','Florence','Georgetown','Greenville','Greenwood','Hampton','Horry','Jasper','Kershaw','Lancaster','Laurens','Lee','Lexington','Marion','Marlboro','McCormick','Newberry','Oconee','Orangeburg','Pickens','Richland','Saluda','Spartanburg','Sumter','Union','Williamsburg','York'];
  const countyList = searchState === 'NC' ? NC_COUNTIES : searchState === 'SC' ? SC_COUNTIES : [];

  soilEnabledRef.current = soil;
  layersRef.current = layers;
  parcelModeRef.current = parcelMode;
  parcelBoundariesRef.current = parcelBoundaries;
  contoursEnabledRef.current = contours;
  sessionStorage.setItem('parcelBoundaries', parcelBoundaries);
  sessionStorage.setItem('parcelMode', parcelMode);
  sessionStorage.setItem('contours', contours);

  // ── Fetch + render a GeoJSON layer ────────────────────────────────────────
  const fetchGeoJSONLayer = (key, map) => {
    const cfg = LAYER_CONFIGS[key];
    const seq = ++fetchSeq.current[key];
    const b = map.getBounds();
    const bbox = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;

    setLoading(p => ({ ...p, [key]: true }));

    fetch(`${PROXY}${cfg.apiPath}?bbox=${bbox}`)
      .then(r => r.json())
      .then(data => {
        if (fetchSeq.current[key] !== seq) return;
        const m = leafletMap.current;
        if (!m || !m._panes?.overlayPane || !layersRef.current[key]) return;
        const newLayer = data.features?.length
          ? L.geoJSON(data, {
              style: { color: cfg.color, weight: 1.2, fillColor: cfg.color, fillOpacity: 0.55, opacity: 0.9 },
            }).addTo(m)
          : null;
        if (geojsonRefs.current[key]) geojsonRefs.current[key].remove();
        geojsonRefs.current[key] = newLayer;
        if (parcelBoundaryLayerRef.current) parcelBoundaryLayerRef.current.bringToFront();
      })
      .catch(() => {})
      .finally(() => {
        if (fetchSeq.current[key] === seq) setLoading(p => ({ ...p, [key]: false }));
      });
  };

  // ── Refresh active GeoJSON layers on pan/zoom ─────────────────────────────
  const fetchParcelBoundaries = (map) => {
    // Don't fetch when zoomed out — bbox would be too large and the API would time out
    if (map.getZoom() < 12) {
      if (parcelFetchAbortRef.current) parcelFetchAbortRef.current.abort();
      if (parcelBoundaryLayerRef.current) { parcelBoundaryLayerRef.current.remove(); parcelBoundaryLayerRef.current = null; }
      return;
    }
    // Abort any in-flight request
    if (parcelFetchAbortRef.current) parcelFetchAbortRef.current.abort();
    const ctrl = new AbortController();
    parcelFetchAbortRef.current = ctrl;

    const b = map.getBounds();
    const bbox = `${b.getWest().toFixed(5)},${b.getSouth().toFixed(5)},${b.getEast().toFixed(5)},${b.getNorth().toFixed(5)}`;
    fetch(`${PROXY}/api/proxy/parcel-boundaries?bbox=${bbox}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        const m = leafletMap.current;
        if (!m || !parcelBoundariesRef.current) return;
        // Replace old layer only after new data is ready (avoids blank flash)
        const oldLayer = parcelBoundaryLayerRef.current;
        const sel = selectedParnoRef.current;
        const newLayer = data.features?.length
          ? L.geoJSON(data, {
              style: { color: '#DA7756', weight: 2.5, fillOpacity: 0.001, opacity: 1 },
              onEachFeature: (feature, layer) => {
                layer.on('click', () => {
                  if (feature.properties?.parno) clickedParnoRef.current = feature.properties.parno;
                  if (feature.properties?.state) clickedStateRef.current = feature.properties.state;
                });
              },
            })
          : null;
        const liveMap = leafletMap.current;
        if (!liveMap || !liveMap._mapPane) return;
        try {
          if (newLayer) newLayer.addTo(liveMap);
          parcelBoundaryLayerRef.current = newLayer;
          if (oldLayer) oldLayer.remove();
          if (parcelBoundaryLayerRef.current) parcelBoundaryLayerRef.current.bringToFront();
          // Re-raise highlight above freshly added boundary layer
          if (selectedHighlightRef.current) selectedHighlightRef.current.bringToFront?.();
        } catch (_e) { /* map invalidated mid-render, retry on next pan */ }
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[parcels] fetch error:', err); });
  };

  // ── Fetch + render contour lines as GeoJSON vectors ──────────────────────
  const fetchContours = (map) => {
    if (contoursFetchAbortRef.current) contoursFetchAbortRef.current.abort();
    const ctrl = new AbortController();
    contoursFetchAbortRef.current = ctrl;
    const b = map.getBounds();
    const bbox = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;
    fetch(`${PROXY}/api/proxy/contours?bbox=${bbox}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (!leafletMap.current || !leafletMap.current._panes?.overlayPane || !contoursEnabledRef.current) return;
        const oldLayer = contoursLayerRef.current;
        contoursLayerRef.current = data.features?.length
          ? L.geoJSON(data, {
              style: (f) => {
                const isIndex = f.properties?._isIndex;
                return { color: '#e879f9', weight: isIndex ? 2 : 1, fillOpacity: 0, opacity: isIndex ? 0.9 : 0.55 };
              },
              onEachFeature: (f, layer) => {
                const elev = f.properties?.contourelevation;
                const unit = f.properties?.contourunits === 2 ? 'm' : 'ft';
                const isIndex = f.properties?._isIndex;
                if (elev != null && isIndex) {
                  layer.bindTooltip(`${Math.round(elev)}${unit}`, {
                    permanent: true, direction: 'center', className: 'contour-label',
                    opacity: 0.9,
                  });
                }
              },
            }).addTo(leafletMap.current)
          : null;
        if (oldLayer) oldLayer.remove();
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[contours] fetch error:', err); });
  };

  // ── Soil polygon color lookup ─────────────────────────────────────────────
  const SOIL_PALETTE = [
    '#e8d5b7','#c9ad7e','#d4b896','#b89a6e','#e8c880',
    '#b8d4a0','#98c078','#c8e098','#90b878','#a8cc88',
    '#b0cce0','#88b0d4','#d0b8d8','#c0a8d0','#e8b8d0',
    '#f0c8a0','#e0a870','#f0d8b0','#d8c880','#c0d8a8',
  ];
  const soilColor = (musym) => {
    if (!musym) return '#d4c5a9';
    let h = 0;
    for (let i = 0; i < musym.length; i++) { h = ((h << 5) - h) + musym.charCodeAt(i); h |= 0; }
    return SOIL_PALETTE[Math.abs(h) % SOIL_PALETTE.length];
  };

  // ── Fetch + render colored soil polygons ──────────────────────────────────
  const fetchSoil = (map) => {
    if (soilFetchAbortRef.current) soilFetchAbortRef.current.abort();
    if (map.getZoom() < 12) {
      if (soilGeoJSONRef.current) { soilGeoJSONRef.current.remove(); soilGeoJSONRef.current = null; }
      return;
    }
    const ctrl = new AbortController();
    soilFetchAbortRef.current = ctrl;
    const b = map.getBounds();
    const bbox = `${b.getWest().toFixed(4)},${b.getSouth().toFixed(4)},${b.getEast().toFixed(4)},${b.getNorth().toFixed(4)}`;
    fetch(`${PROXY}/api/proxy/soil-geojson?bbox=${bbox}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (!leafletMap.current || !soilEnabledRef.current) return;
        const old = soilGeoJSONRef.current;
        soilGeoJSONRef.current = data.features?.length
          ? L.geoJSON(data, {
              style: f => ({
                fillColor: soilColor(f.properties?.musym),
                fillOpacity: 0.55,
                color: '#666',
                weight: 0.5,
                opacity: 0.8,
              }),
              onEachFeature: (f, layer) => {
                const { musym, muname } = f.properties || {};
                layer.bindTooltip(
                  `<b>${musym || ''}</b>${muname ? '<br><span style="font-size:11px">' + muname + '</span>' : ''}`,
                  { sticky: true, opacity: 0.9 }
                );
              },
            }).addTo(leafletMap.current)
          : null;
        if (old) old.remove();
      })
      .catch(err => { if (err.name !== 'AbortError') console.error('[soil] fetch error:', err); });
  };

  // ── Fetch + render buildability overlay for a parcel ──────────────────────
  const showBuildabilityOverlay = (parcelGeometry) => {
    if (!parcelGeometry || !leafletMap.current) return;
    setBuildabilityLoading(true);
    setBuildability(null);

    // Clear previous overlay
    if (buildabilityLayerRef.current) { buildabilityLayerRef.current.remove(); buildabilityLayerRef.current = null; }

    const parcelFeature = { type: 'Feature', geometry: parcelGeometry, properties: {} };
    const b = turf.bbox(parcelFeature);
    const bboxStr = `${b[0].toFixed(5)},${b[1].toFixed(5)},${b[2].toFixed(5)},${b[3].toFixed(5)}`;

    fetch(`${PROXY}/api/proxy/buildability?bbox=${bboxStr}`)
      .then(r => r.json())
      .then(({ flood, wetlands, slope }) => {
        const map = leafletMap.current;
        if (!map) return;

        const clipToParcel = (fc) => {
          const clipped = [];
          (fc.features || []).forEach(f => {
            try {
              const inter = turf.intersect(turf.featureCollection([parcelFeature, f]));
              if (inter) clipped.push(inter);
            } catch {}
          });
          return clipped;
        };

        const floodClipped   = clipToParcel(flood);
        const wetlandClipped = clipToParcel(wetlands);

        const parcelArea = turf.area(parcelFeature);
        const parcelAcres = parcelArea * 0.000247105;

        // Calculate area constrained by flood + wetlands
        let envConstrainedArea = 0;
        const allConstraints = [...floodClipped, ...wetlandClipped];
        if (allConstraints.length) {
          try {
            const union = allConstraints.reduce((acc, f) => acc ? turf.union(turf.featureCollection([acc, f])) : f, null);
            if (union) envConstrainedArea = turf.area(union);
          } catch { envConstrainedArea = allConstraints.reduce((s, f) => s + turf.area(f), 0); }
        }
        const floodPct    = Math.min(100, Math.round((envConstrainedArea / parcelArea) * 100));
        const wetlandPct  = Math.min(100, Math.round((wetlandClipped.reduce((s, f) => s + turf.area(f), 0) / parcelArea) * 100));

        // Slope constraints: moderate (5-10%) + heavy (10-15%) + extreme (15%+) are non-buildable
        const slopePctNonBuildable = slope
          ? Math.round((slope.moderate || 0) + (slope.heavy || 0) + (slope.extreme || 0))
          : 0;

        // Combined buildability: subtract environmental constraints AND steep slope
        // These can overlap so take max(env, slope) approach, capped at 100
        const totalConstrainedPct = Math.min(100, floodPct + slopePctNonBuildable);
        const buildablePct = Math.max(0, 100 - totalConstrainedPct);
        const buildableAcres = (parcelAcres * buildablePct / 100).toFixed(2);

        // Render overlay
        const group = L.layerGroup().addTo(map);
        L.geoJSON(parcelFeature, {
          style: { color: '#22c55e', weight: 2, fillColor: '#22c55e', fillOpacity: 0.25, opacity: 0.9 },
        }).addTo(group);
        if (floodClipped.length) {
          L.geoJSON({ type: 'FeatureCollection', features: floodClipped }, {
            style: { color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.55, opacity: 0.9 },
          }).addTo(group);
        }
        if (wetlandClipped.length) {
          L.geoJSON({ type: 'FeatureCollection', features: wetlandClipped }, {
            style: { color: '#06b6d4', weight: 1, fillColor: '#06b6d4', fillOpacity: 0.55, opacity: 0.9 },
          }).addTo(group);
        }

        buildabilityLayerRef.current = group;
        setBuildability({
          pct: buildablePct,
          buildableAcres,
          floodPct,
          wetlandPct,
          slopePctNonBuildable,
          hasFlood: floodClipped.length > 0,
          hasWetlands: wetlandClipped.length > 0,
          slope,
        });
      })
      .catch(() => setBuildability({ error: 'Could not load buildability data.' }))
      .finally(() => setBuildabilityLoading(false));
  };

  const refreshGeoJSONRef = useRef(null);
  refreshGeoJSONRef.current = (map) => {
    const active = layersRef.current;
    const z = map.getZoom();
    ['floodplain', 'wetlands', 'water'].forEach(key => {
      if (!active[key] || z < MIN_GEOJSON_ZOOM) {
        if (geojsonRefs.current[key]) { geojsonRefs.current[key].remove(); geojsonRefs.current[key] = null; }
        return;
      }
      fetchGeoJSONLayer(key, map);
    });
    if (!parcelBoundariesRef.current) {
      if (parcelBoundaryLayerRef.current) { parcelBoundaryLayerRef.current.remove(); parcelBoundaryLayerRef.current = null; }
    } else {
      fetchParcelBoundaries(map);
    }
    if (!contoursEnabledRef.current) {
      if (contoursLayerRef.current) { contoursLayerRef.current.remove(); contoursLayerRef.current = null; }
    } else {
      fetchContours(map);
    }
    if (!soilEnabledRef.current) {
      if (soilGeoJSONRef.current) { soilGeoJSONRef.current.remove(); soilGeoJSONRef.current = null; }
    } else {
      fetchSoil(map);
    }
  };

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const savedView = (() => {
      try { return JSON.parse(sessionStorage.getItem('mapView')); } catch { return null; }
    })();

    const map = L.map(mapRef.current, {
      center: savedView ? [savedView.lat, savedView.lng] : [34.8, -79.5],
      zoom: savedView ? savedView.zoom : 7,
      zoomControl: true,
      attributionControl: true,
    });

    // Custom pane for the selected-parcel highlight — sits above all GeoJSON overlay layers
    map.createPane('highlightPane');
    map.getPane('highlightPane').style.zIndex = 450;
    map.getPane('highlightPane').style.pointerEvents = 'none';

    baseTiles.current = TILE_LAYERS.satellite.map(t => L.tileLayer(t.url, t.opts).addTo(map));
    leafletMap.current = map;
    setMapReady(true);

    map.on('zoomend moveend', () => {
      const c = map.getCenter();
      sessionStorage.setItem('mapView', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
      setZoom(map.getZoom());
      clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(() => refreshGeoJSONRef.current?.(map), 300);
    });

    return () => {
      clearTimeout(fetchTimer.current);
      leafletMap.current = null;
      map.remove();
    };
  }, []);

  // ── Auto-load parcel from prop or URL params ────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const parno       = initialParcelId || searchParams.get('parcelId');
    const stateParam  = initialState    || searchParams.get('state')    || '';
    const countyParam = initialCounty   || searchParams.get('county')   || '';
    const address     = initialAddress  || searchParams.get('address')  || '';

    if (!address && !parno) return;

    if (address) {
      // Pass the address to the backend, which geocodes server-side and returns the parcel.
      // More reliable than client-side geocoding for rural addresses without house numbers.
      setSearchType('address');
      setSearchQuery(address);
      if (stateParam) setSearchState(stateParam);
      if (countyParam) setSearchCounty(countyParam);
      handleSearchSelect({ dealAddress: address, lat: 0, lng: 0, state: stateParam, county: countyParam });
    } else if (parno) {
      setSearchType('parno');
      if (stateParam) setSearchState(stateParam);
      if (countyParam) setSearchCounty(countyParam);
      setSearchQuery(parno);
      handleSearchSelect({ parno, lat: 0, lng: 0, state: stateParam, county: countyParam });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  // ── Swap base tiles ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    baseTiles.current.forEach(t => t.remove());
    baseTiles.current = TILE_LAYERS[mapStyle].map(t => L.tileLayer(t.url, t.opts).addTo(map));
  }, [mapStyle]);

  // ── County outlines ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (countyLayer.current) { countyLayer.current.remove(); countyLayer.current = null; }
    if (!counties) return;

    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
      .then(r => r.json())
      .then(us => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';
        script.onload = () => {
          const gj = window.topojson.feature(us, us.objects.counties);
          const filtered = {
            ...gj,
            features: gj.features.filter(f => {
              const fips = String(f.id).padStart(5, '0');
              return fips.startsWith('37') || fips.startsWith('45');
            }),
          };
          countyLayer.current = L.geoJSON(filtered, {
            style: { color: '#ffffff', weight: 0.8, fillOpacity: 0, opacity: 0.35 },
          }).addTo(map);
        };
        if (!window.topojson) document.head.appendChild(script);
        else script.onload();
      })
      .catch(() => {});
  }, [counties]);

  // ── Layer toggles ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    ['floodplain', 'wetlands', 'water'].forEach(key => {
      if (!layers[key]) {
        if (geojsonRefs.current[key]) { geojsonRefs.current[key].remove(); geojsonRefs.current[key] = null; }
      } else if (map.getZoom() >= MIN_GEOJSON_ZOOM) {
        fetchGeoJSONLayer(key, map);
      }
    });
  }, [layers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Contour lines vector GeoJSON layer ───────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (!contours) {
      if (contoursFetchAbortRef.current) contoursFetchAbortRef.current.abort();
      if (contoursLayerRef.current) { contoursLayerRef.current.remove(); contoursLayerRef.current = null; }
    } else {
      fetchContours(map);
    }
  }, [contours]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Soil map units — colored GeoJSON polygons ─────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (!soil) {
      if (soilFetchAbortRef.current) soilFetchAbortRef.current.abort();
      if (soilGeoJSONRef.current) { soilGeoJSONRef.current.remove(); soilGeoJSONRef.current = null; }
      return;
    }
    fetchSoil(map);
  }, [soil]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan to state — skip first mount so saved map view is preserved ─────────
  const statePanInitialized = useRef(false);
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (!statePanInitialized.current) { statePanInitialized.current = true; return; }
    const { center, zoom: z } = STATE_BOUNDS[state];
    map.setView(center, z, { animate: true });
  }, [state]);

  // ── Parcel click handler ───────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    const onClick = (e) => {
      if (!parcelModeRef.current) return;
      const { lat, lng } = e.latlng;
      setParcelLoading(true);
      setParcelData(null);

      // Cancel any in-flight parcel info request and clear previous highlight
      if (parcelInfoAbortRef.current) parcelInfoAbortRef.current.abort();
      if (selectedHighlightRef.current) { selectedHighlightRef.current.remove(); selectedHighlightRef.current = null; }
      const parcelInfoCtrl = new AbortController();
      parcelInfoAbortRef.current = parcelInfoCtrl;

      const parno = clickedParnoRef.current;
      const clickedState = clickedStateRef.current;
      clickedParnoRef.current = null;
      clickedStateRef.current = null;
      let parcelUrl = parno
        ? `${PROXY}/api/proxy/parcel?parno=${encodeURIComponent(parno)}&lat=${lat}&lng=${lng}`
        : `${PROXY}/api/proxy/parcel?lat=${lat}&lng=${lng}`;
      if (clickedState) parcelUrl += `&state=${clickedState}`;
      fetch(parcelUrl, { signal: parcelInfoCtrl.signal })
        .then(r => r.json())
        .then(data => {
          if (data.error) { setParcelData({ error: data.error }); return; }
          setParcelData(data);
          setParcelLatLng({ lat, lng });
          setShowBuildability(false);
          setBuildability(null);
          if (buildabilityLayerRef.current) { buildabilityLayerRef.current.remove(); buildabilityLayerRef.current = null; }

          const newParno = data.parcelId;
          selectedParnoRef.current = newParno;
          const isFromSearch = fromSearchRef.current;
          fromSearchRef.current = false;

          // Draw highlight as a separate top layer with a thick green border.
          let foundBounds = null;

          // For search results: always use the geometry returned by the API — it is
          // guaranteed to match the resolved parcel. The boundary layer may still
          // contain old-viewport data and could pick a neighbour.
          if (isFromSearch && data.geometry && leafletMap.current?._mapPane) {
            const hl = L.geoJSON({ type: 'Feature', geometry: data.geometry }, {
              style: { color: '#00ff00', weight: 5, fillOpacity: 0.08, opacity: 1 },
              pane: 'highlightPane',
            });
            hl.addTo(leafletMap.current);
            selectedHighlightRef.current = hl;
            foundBounds = hl.getBounds();
          }

          // For direct map clicks: try the boundary layer first (already loaded for viewport)
          if (!isFromSearch && parcelBoundaryLayerRef.current && newParno && leafletMap.current?._mapPane) {
            parcelBoundaryLayerRef.current.eachLayer(l => {
              if (l.feature?.properties?.parno === newParno) {
                foundBounds = l.getBounds();
                const hl = L.geoJSON(l.toGeoJSON(), {
                  style: { color: '#00ff00', weight: 6, fillOpacity: 0.08, opacity: 1 },
                  renderer: L.canvas(),
                });
                hl.addTo(leafletMap.current);
                selectedHighlightRef.current = hl;
              }
            });
          }

          // Fallback: draw green highlight from API geometry when boundary layer doesn't have it
          if (!selectedHighlightRef.current && data.geometry && leafletMap.current?._mapPane) {
            const hl = L.geoJSON({ type: 'Feature', geometry: data.geometry }, {
              style: { color: '#00ff00', weight: 5, fillOpacity: 0.08, opacity: 1 },
              pane: 'highlightPane',
            });
            hl.addTo(leafletMap.current);
            selectedHighlightRef.current = hl;
            foundBounds = hl.getBounds();
          }

          // Fit map to highlighted parcel bounds
          const bounds = foundBounds || (data.geometry
            ? L.geoJSON({ type: 'Feature', geometry: data.geometry }).getBounds()
            : null);
          if (bounds?.isValid()) {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 19, animate: true });
            // After fitBounds animation settles, force a boundary refresh so neighbouring
            // parcels around the searched property are visible.
            if (isFromSearch) {
              setTimeout(() => {
                const m = leafletMap.current;
                if (m && parcelBoundariesRef.current) fetchParcelBoundaries(m);
              }, 900);
            }
          }
        })
        .catch(err => { if (err.name !== 'AbortError') setParcelData({ error: 'Lookup failed. Try again.' }); })
        .finally(() => { if (!parcelInfoCtrl.signal.aborted) setParcelLoading(false); });
    };

    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    map.getContainer().style.cursor = parcelMode ? 'crosshair' : '';
    if (!parcelMode) {
      setParcelData(null);
      selectedParnoRef.current = null;
      if (parcelLayerRef.current) { parcelLayerRef.current.remove(); parcelLayerRef.current = null; }
      if (selectedHighlightRef.current) { selectedHighlightRef.current.remove(); selectedHighlightRef.current = null; }
    }
  }, [parcelMode]);

  // ── Parcel boundary GeoJSON layer ─────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    if (parcelBoundaries) {
      fetchParcelBoundaries(map);
    } else {
      if (parcelBoundaryLayerRef.current) { parcelBoundaryLayerRef.current.remove(); parcelBoundaryLayerRef.current = null; }
    }
  }, [parcelBoundaries]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLayer = key => setLayers(p => ({ ...p, [key]: !p[key] }));

  const SEARCH_TYPES = [
    { id: 'address', label: 'Address' },
    { id: 'parno',   label: 'APN / Parcel ID' },
    { id: 'owner',   label: 'Owner' },
  ];

  const handleSearchInput = (val) => {
    setSearchQuery(val);
    clearTimeout(searchDebounce.current);
    if (val.trim().length < 2) { setSearchResults([]); setShowSearchDrop(false); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ type: searchType, q: val });
        if ((searchType === 'parno' || searchType === 'owner') && searchState) params.set('state', searchState);
        if ((searchType === 'parno' || searchType === 'owner') && searchCounty) params.set('county', searchCounty);
        const r = await fetch(`${PROXY}/api/proxy/parcel-search?${params}`);
        const data = await r.json();
        setSearchResults(Array.isArray(data) ? data : []);
        setShowSearchDrop(true);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  };

  const handleSearchSelect = async (result) => {
    const map = leafletMap.current;
    if (!map) return;
    setShowSearchDrop(false);
    setSearchQuery(result.address || result.parno || result.dealAddress || '');

    let lat = result.lat;
    let lng = result.lng;

    // Cancel any in-flight requests and clear previous highlight
    if (parcelInfoAbortRef.current) parcelInfoAbortRef.current.abort();
    if (selectedHighlightRef.current) { selectedHighlightRef.current.remove(); selectedHighlightRef.current = null; }

    setParcelLoading(true);
    setParcelData(null);
    const parcelInfoCtrl = new AbortController();
    parcelInfoAbortRef.current = parcelInfoCtrl;

    // Build parcel API URL
    let parcelUrl = result.parno
      ? `${PROXY}/api/proxy/parcel?parno=${encodeURIComponent(result.parno)}&lat=${lat ?? 0}&lng=${lng ?? 0}`
      : result.dealAddress
        ? `${PROXY}/api/proxy/parcel?address=${encodeURIComponent(result.dealAddress)}`
        : `${PROXY}/api/proxy/parcel?lat=${lat}&lng=${lng}`;
    if (result.state) parcelUrl += `&state=${encodeURIComponent(result.state)}`;
    if (result.county) parcelUrl += `&county=${encodeURIComponent(result.county)}`;

    try {
      const r = await fetch(parcelUrl, { signal: parcelInfoCtrl.signal });
      const data = await r.json();
      if (data.error) { setParcelData({ error: data.error }); return; }
      setParcelData(data);
      // Compute centroid from geometry for Street View; fall back to search result coords
      try {
        if (data.geometry) {
          const c = turf.centroid({ type: 'Feature', geometry: data.geometry });
          setParcelLatLng({ lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] });
        } else if (lat != null && lng != null) {
          setParcelLatLng({ lat, lng });
        }
      } catch { if (lat != null && lng != null) setParcelLatLng({ lat, lng }); }
      setShowBuildability(false);
      setBuildability(null);
      if (buildabilityLayerRef.current) { buildabilityLayerRef.current.remove(); buildabilityLayerRef.current = null; }
      selectedParnoRef.current = data.parcelId;

      // Draw highlight from API geometry
      if (data.geometry && leafletMap.current?._mapPane) {
        const hl = L.geoJSON({ type: 'Feature', geometry: data.geometry }, {
          style: { color: '#00ff00', weight: 6, fillOpacity: 0.08, opacity: 1 },
          renderer: L.canvas(),
        });
        hl.addTo(leafletMap.current);
        selectedHighlightRef.current = hl;

        const bounds = hl.getBounds();
        if (bounds?.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 19, animate: true });
          // After zoom settles, refresh boundaries so nearby parcels are visible
          setTimeout(() => {
            const m = leafletMap.current;
            if (m && parcelBoundariesRef.current) fetchParcelBoundaries(m);
          }, 900);
        } else if (lat != null && lng != null) {
          map.flyTo([lat, lng], 18, { animate: true, duration: 1.2 });
        }
      } else if (lat != null && lng != null) {
        // No geometry — just fly to the search coords
        map.flyTo([lat, lng], 18, { animate: true, duration: 1.2 });
      }
    } catch (err) {
      if (err.name !== 'AbortError') setParcelData({ error: 'Lookup failed. Try again.' });
    } finally {
      if (!parcelInfoCtrl.signal.aborted) setParcelLoading(false);
    }
  };

  const geojsonLayersActive = ['floodplain', 'wetlands', 'water'].some(k => layers[k]);
  const showZoomHint = geojsonLayersActive && zoom < MIN_GEOJSON_ZOOM;
  const showParcelZoomHint = false;
  const showContourZoomHint = false;

  // Toggle switch component
  const Toggle = ({ active, onChange }) => (
    <button
      onClick={onChange}
      className="relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none"
      style={{ backgroundColor: active ? '#f97316' : '#374151' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: active ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );

  return (
    <div className={onClose ? 'flex flex-col w-full h-full' : '-m-6 flex flex-col'} style={onClose ? {} : { height: 'calc(100vh - 56px)' }}>

      {/* ── Map ── */}
      <div className="relative flex-1 min-h-0">
        <div ref={mapRef} className="w-full h-full" />
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-[2000] bg-gray-900/80 hover:bg-gray-900 text-white rounded-full p-2 shadow-lg transition-colors"
          >
            <X size={18} />
          </button>
        )}

        {/* ── Parcel Search Bar ── */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-0 shadow-2xl rounded-xl overflow-visible" style={{ minWidth: 420 }}>
          {/* Type selector */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowTypeMenu(p => !p)}
              className="flex items-center gap-1.5 px-3 h-10 rounded-l-xl text-sm font-semibold text-white border border-r-0 border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors whitespace-nowrap"
            >
              {SEARCH_TYPES.find(t => t.id === searchType)?.label}
              <ChevronDown size={13} className="text-gray-400" />
            </button>
            {showTypeMenu && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-[1200] min-w-[160px]">
                {SEARCH_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSearchType(t.id); setShowTypeMenu(false); setSearchQuery(''); setSearchResults([]); setShowSearchDrop(false); if (t.id === 'address') { setSearchState(''); setSearchCounty(''); setShowStateMenu(false); setShowCountyMenu(false); } }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${searchType === t.id ? 'bg-orange-500 text-white' : 'text-gray-200 hover:bg-gray-700'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* State selector — for APN and Owner search */}
          {(searchType === 'parno' || searchType === 'owner') && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowStateMenu(p => !p); setShowCountyMenu(false); setShowTypeMenu(false); }}
                className="flex items-center gap-1 px-3 h-10 text-sm font-medium text-white border border-l-0 border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors whitespace-nowrap"
                style={{ minWidth: 80 }}
              >
                {searchState || 'State'}
                <ChevronDown size={12} className="text-gray-400" />
              </button>
              {showStateMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-[1200]" style={{ minWidth: 100 }}>
                  {['NC', 'SC'].map(s => (
                    <button key={s} onClick={() => { setSearchState(s); setSearchCounty(''); setShowStateMenu(false); setShowCountyMenu(true); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${searchState === s ? 'bg-orange-500 text-white' : 'text-gray-200 hover:bg-gray-700'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* County selector — for APN and Owner search */}
          {(searchType === 'parno' || searchType === 'owner') && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowCountyMenu(p => !p); setShowStateMenu(false); setShowTypeMenu(false); }}
                className="flex items-center gap-1 px-3 h-10 text-sm font-medium text-white border border-l-0 border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors whitespace-nowrap"
                style={{ minWidth: 110 }}
              >
                <span className="truncate" style={{ maxWidth: 90 }}>{searchCounty || 'County'}</span>
                <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
              </button>
              {showCountyMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-[1200]" style={{ minWidth: 160, maxHeight: 260, overflowY: 'auto' }}>
                  {!searchState ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Select a state first</p>
                  ) : (
                    <>
                      {countyList.map(c => (
                        <button key={c} onClick={() => { setSearchCounty(c); setShowCountyMenu(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${searchCounty === c ? 'bg-orange-500 text-white' : 'text-gray-200 hover:bg-gray-700'}`}>
                          {c}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Text input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchDrop(true)}
              placeholder={searchType === 'parno' ? 'Enter parcel ID…' : searchType === 'owner' ? 'Enter owner name…' : 'Enter address…'}
              className="w-full h-10 pl-3 pr-8 text-sm text-white bg-gray-900 border border-gray-600 focus:outline-none focus:border-orange-500 placeholder-gray-500"
              style={{ minWidth: 160 }}
            />
            {searchLoading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Search button */}
          <button
            onClick={() => handleSearchInput(searchQuery)}
            className="flex items-center justify-center w-10 h-10 bg-orange-500 hover:bg-orange-400 rounded-r-xl border border-orange-500 transition-colors flex-shrink-0"
          >
            <Search size={15} className="text-white" />
          </button>

          {/* Results dropdown */}
          {showSearchDrop && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-[1200]">
              {searchResults.map((r, i) => r._hint ? (
                <p key={i} className="px-4 py-3 text-sm text-gray-400">{r._hint}</p>
              ) : (
                <button
                  key={i}
                  onClick={() => handleSearchSelect(r)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800 border-b border-gray-700/50 last:border-0 transition-colors"
                >
                  <p className="text-sm text-white font-medium truncate">{r.address || r.parno}</p>
                  <p className="text-xs text-gray-400 truncate">{[r.owner, r.county, r.state].filter(Boolean).join(' · ')}</p>
                </button>
              ))}
            </div>
          )}
          {showSearchDrop && searchResults.length === 0 && !searchLoading && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-600 rounded-xl shadow-2xl z-[1200]">
              <p className="px-4 py-3 text-sm text-gray-400">No results found</p>
            </div>
          )}
        </div>

        {/* Zoom hint */}
        {(showZoomHint || showParcelZoomHint || showContourZoomHint) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-gray-900/95 shadow-md border border-blue-500/40 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-blue-300">
            <ZoomIn size={13} />
            {showParcelZoomHint && !showZoomHint && !showContourZoomHint
              ? 'Zoom in to see parcel boundaries'
              : showContourZoomHint && !showZoomHint && !showParcelZoomHint
              ? 'Zoom in to see contour lines'
              : 'Zoom in to a specific area to see flood zone / wetland polygons'}
          </div>
        )}

        {/* ── Map Filters panel ── */}
        {showFiltersPanel && (
          <div className="absolute bottom-16 right-3 z-[1100] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-72 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers size={14} className="text-orange-400" />
                Map Filters &amp; Basemaps
              </p>
              <button onClick={() => setShowFiltersPanel(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Basemaps */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Basemaps</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'light', label: 'Map' },
                    { id: 'satellite', label: 'Satellite' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setMapStyle(id)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors border ${
                        mapStyle === id
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layers */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Layers</p>
                <div className="space-y-3">
                  {/* Parcel Boundaries */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">Parcel Boundaries</span>
                    <Toggle active={parcelBoundaries} onChange={() => { setParcelBoundaries(p => !p); setParcelMode(p => !p); }} />
                  </div>
                  {/* County Boundaries */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">County Boundaries</span>
                    <Toggle active={counties} onChange={() => setCounties(p => !p)} />
                  </div>
                  {/* Contour Lines */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">Contour Lines</span>
                    <Toggle active={contours} onChange={() => setContours(p => !p)} />
                  </div>
                  {/* FEMA Floodplain */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">FEMA Floodplain</span>
                    <Toggle active={layers.floodplain} onChange={() => toggleLayer('floodplain')} />
                  </div>
                  {/* Wetlands */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">Wetlands</span>
                    <Toggle active={layers.wetlands} onChange={() => toggleLayer('wetlands')} />
                  </div>
                  {/* Water Features */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">Water Features</span>
                    <Toggle active={layers.water} onChange={() => toggleLayer('water')} />
                  </div>
                  {/* Soil Report */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-200">Soil Report</span>
                    <Toggle active={soil} onChange={() => setSoil(p => !p)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-gray-700 text-[10px] text-gray-600">
              FEMA NFHL • USFWS NWI • USGS NHD • USGS 3DEP • USDA NRCS SSURGO
            </div>
          </div>
        )}

        {/* ── Map Filters trigger button ── */}
        {/* ── Map Filters trigger button — bottom right ── */}
        <button
          onClick={() => setShowFiltersPanel(p => !p)}
          className={`absolute bottom-4 right-3 z-[1100] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border transition-colors ${
            showFiltersPanel
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-200 hover:border-orange-500/50 hover:text-white'
          }`}
        >
          <SlidersHorizontal size={15} />
          Map Filters &amp; View
        </button>

        {/* Parcel info panel */}
        {parcelData && (
          <div className="absolute left-3 z-[1000] rounded-xl shadow-2xl border border-gray-600 p-4 w-[300px]" style={{ bottom: '80px', backgroundColor: 'rgb(26, 35, 50)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                <MapPin size={13} className="text-amber-400" />
                Parcel Info
              </p>
              <button
                onClick={() => {
                  setParcelData(null);
                  setParcelLatLng(null);
                  setShowBuildability(false);
                  setBuildability(null);
                  if (buildabilityLayerRef.current) { buildabilityLayerRef.current.remove(); buildabilityLayerRef.current = null; }
                  if (parcelLayerRef.current) { parcelLayerRef.current.remove(); parcelLayerRef.current = null; }
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            {parcelData.error ? (
              <p className="text-xs text-red-400">{parcelData.error}</p>
            ) : (
              <div className="space-y-2 text-xs">
                {parcelData.owner && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Owner</p>
                    <p className="text-white font-medium">{parcelData.owner}</p>
                  </div>
                )}
                {parcelData.mailAddr && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Mailing Address</p>
                    <p className="text-gray-200">{parcelData.mailAddr}</p>
                  </div>
                )}
                {parcelData.siteAddr && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Site Address</p>
                    <p className="text-gray-200">{parcelData.siteAddr}</p>
                  </div>
                )}
                {parcelData.parcelId && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Parcel ID</p>
                    <p className="text-gray-200 font-mono text-sm">{parcelData.parcelId}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-2 mt-1 border-t border-gray-700/60">
                  <div>
                    <p className="text-[10px] text-gray-500">Acres</p>
                    <p className="text-white font-semibold">{parcelData.acres != null ? Number(parcelData.acres).toFixed(2) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Land Value</p>
                    <p className="text-white font-semibold">{parcelData.landVal != null ? `$${parcelData.landVal >= 1000 ? Math.round(parcelData.landVal / 1000) + 'k' : parcelData.landVal}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Total Value</p>
                    <p className="text-white font-semibold">{parcelData.totVal != null ? `$${parcelData.totVal >= 1000 ? Math.round(parcelData.totVal / 1000) + 'k' : parcelData.totVal}` : '—'}</p>
                  </div>
                </div>
                {(parcelData.landUse || parcelData.saleYear || parcelData.county) && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {parcelData.landUse && (
                      <div>
                        <p className="text-[10px] text-gray-500">Land Use</p>
                        <p className="text-gray-200 capitalize">{parcelData.landUse.toLowerCase()}</p>
                      </div>
                    )}
                    {parcelData.saleYear && (
                      <div>
                        <p className="text-[10px] text-gray-500">Last Sale</p>
                        <p className="text-gray-200">{parcelData.saleYear}</p>
                      </div>
                    )}
                    {parcelData.county && (
                      <div>
                        <p className="text-[10px] text-gray-500">County</p>
                        <p className="text-gray-200">{parcelData.county}</p>
                      </div>
                    )}
                    {parcelData.subdivision && (
                      <div>
                        <p className="text-[10px] text-gray-500">Subdivision</p>
                        <p className="text-gray-200 capitalize">{parcelData.subdivision.toLowerCase()}</p>
                      </div>
                    )}
                  </div>
                )}
                {/* Action buttons */}
                <div className="pt-1 border-t border-gray-700/60 space-y-1.5">
                  <button
                    onClick={() => setShowAddToPipeline(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: '#1a1f3a', color: '#818cf8', border: '1px solid #4338ca' }}
                  >
                    <PlusCircle size={12} />
                    Add to Pipeline
                  </button>
                  {parcelLatLng && (
                    <a
                      href={`https://maps.google.com/maps?q=&layer=c&cbll=${parcelLatLng.lat},${parcelLatLng.lng}&cbp=11,0,0,0,0&z=17`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ backgroundColor: '#1a2535', color: '#38bdf8', border: '1px solid #0284c7' }}
                    >
                      <ExternalLink size={12} />
                      Google Street View
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (showBuildability) {
                        setShowBuildability(false);
                        setBuildability(null);
                        if (buildabilityLayerRef.current) { buildabilityLayerRef.current.remove(); buildabilityLayerRef.current = null; }
                      } else {
                        setShowBuildability(true);
                        showBuildabilityOverlay(parcelData.geometry);
                      }
                    }}
                    disabled={buildabilityLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: showBuildability ? '#16a34a' : '#1e3a2f', color: showBuildability ? '#fff' : '#4ade80', border: '1px solid #16a34a' }}
                  >
                    <TreePine size={12} />
                    {buildabilityLoading ? 'Analyzing...' : showBuildability ? 'Hide Buildability' : 'Buildability'}
                  </button>
                  {buildabilityLoading && (
                    <p className="text-[10px] text-gray-500 text-center mt-1.5">Fetching flood, wetland & slope data...</p>
                  )}
                  {buildability && !buildabilityLoading && (
                    <div className="mt-2 rounded-lg p-2.5 space-y-2" style={{ backgroundColor: '#0f1f17', border: '1px solid #166534' }}>
                      {buildability.error ? (
                        <p className="text-[10px] text-red-400">{buildability.error}</p>
                      ) : (
                        <>
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Buildability</p>
                              <p className="text-[10px] text-gray-500">{buildability.buildableAcres} ac buildable</p>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: buildability.pct >= 70 ? '#4ade80' : buildability.pct >= 40 ? '#facc15' : '#f87171' }}>
                              {buildability.pct}%
                            </p>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${buildability.pct}%`, backgroundColor: buildability.pct >= 70 ? '#4ade80' : buildability.pct >= 40 ? '#facc15' : '#f87171' }} />
                          </div>
                          {/* Constraints */}
                          <div className="space-y-1 pt-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#3b82f6', display: 'inline-block' }} />FEMA Flood</span>
                              <span className="text-gray-300">{buildability.floodPct}%</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#06b6d4', display: 'inline-block' }} />Wetlands</span>
                              <span className="text-gray-300">{buildability.wetlandPct}%</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="flex items-center gap-1 text-gray-400"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: '#f59e0b', display: 'inline-block' }} />Steep Slope (&gt;5%)</span>
                              <span className="text-gray-300">{buildability.slopePctNonBuildable}%</span>
                            </div>
                          </div>
                          {/* Slope breakdown */}
                          {buildability.slope && (
                            <div className="pt-1.5 border-t border-gray-700/60 space-y-0.5">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Slope Analysis</p>
                              {[
                                { label: 'Flat (0–0.5%)', val: buildability.slope.flat },
                                { label: 'Minimal (0.5–5%)', val: buildability.slope.minimal },
                                { label: 'Moderate (5–10%)', val: buildability.slope.moderate },
                                { label: 'Heavy (10–15%)', val: buildability.slope.heavy },
                                { label: 'Extreme (15%+)', val: buildability.slope.extreme },
                              ].map(({ label, val }) => (
                                <div key={label} className="flex justify-between text-[10px]">
                                  <span className="text-gray-500">{label}</span>
                                  <span className="text-gray-300">{val ?? 0}%</span>
                                </div>
                              ))}
                              <p className="text-[10px] text-gray-600 pt-0.5">Avg slope: {buildability.slope.avg}%</p>
                            </div>
                          )}
                          {/* Legend */}
                          <div className="flex gap-2 text-[10px] pt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: '#22c55e' }} />Buildable</span>
                            {buildability.hasFlood && <span className="flex items-center gap-1 text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: '#3b82f6' }} />Flood</span>}
                            {buildability.hasWetlands && <span className="flex items-center gap-1 text-gray-500"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: '#06b6d4' }} />Wetland</span>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddToPipeline && parcelData && (
        <AddToPipelineModal
          parcelData={parcelData}
          onClose={() => setShowAddToPipeline(false)}
        />
      )}
    </div>
  );
}
