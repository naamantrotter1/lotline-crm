import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { Layers, Droplets, Waves, AlertTriangle, ZoomIn, MapPin, X, TreePine, Mountain, SlidersHorizontal, Search, ChevronDown, PlusCircle, ExternalLink, Home, Filter } from 'lucide-react';
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

  // ── MH Comps ──────────────────────────────────────────────────────────────
  const [showCompsPanel, setShowCompsPanel] = useState(false);
  const [parcelTab, setParcelTab] = useState('summary');
  const [mhForSale,      setMhForSale]      = useState(false);
  const [mhSold,         setMhSold]         = useState(false);
  const [compsLoading,   setCompsLoading]   = useState(false);
  const [compsCount,     setCompsCount]     = useState({ forSale: 0, sold: 0 });
  const mhForSaleLayerRef = useRef(null);
  const mhSoldLayerRef    = useRef(null);

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

  // ── Filter & Export Parcels ────────────────────────────────────────────────
  const parcelFilterRef = useRef({});
  const [showParcelFilterPanel, setShowParcelFilterPanel] = useState(false);
  const [pfSec, setPfSec] = useState({
    parcel: true, aiScrubbing: true, advanced: false, owner: false,
    assessor: false, sale: false, lien: false, structure: false,
  });
  const DEFAULT_PF = {
    county: '', subdivision: '', zips: '', acresMin: '', acresMax: '',
    maxImprovPct: '', cityLimits: '', zoningType: '', landUse: '',
    vacantOnly: true, removeBadSlope: true, removeLandLocked: true,
    onlyLandLocked: false, removeHOA: false, maxWetland: '', maxFlood: '',
    roadFrontageMin: '', roadFrontageMax: '',
    dedupeOwners: false, outOfState: false, outOfCounty: false, outOfZip: false,
    excludeCorporate: false, onlyInterFamily: false, taxDelinquent: false,
    ownershipMin: '', ownershipMax: '', includeKeywords: '', excludeKeywords: '',
    totalValueMin: '', totalValueMax: '', landValueMin: '', landValueMax: '',
    improveValueMin: '', improveValueMax: '', marketTotalMin: '', marketTotalMax: '',
    marketLandMin: '', marketLandMax: '', marketImproveMin: '', marketImproveMax: '',
    taxDelinquentYears: '',
    salePriceMin: '', salePriceMax: '', salePriceType: '', lastSaleFrom: '', lastSaleTo: '',
    sellerName: '', deedType: '',
    mortgageMin: '', mortgageMax: '', mortgageFromYear: '', mortgageToYear: '',
    financingType: '', mortgageType: '', interestMin: '', interestMax: '',
    structureSqftMin: '', structureSqftMax: '', structureCountMin: '', structureCountMax: '',
  };
  const [pf, setPf] = useState(DEFAULT_PF);

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
    if (map.getZoom() < 11) {
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
    const _pf = parcelFilterRef.current;
    let _parcelUrl = `${PROXY}/api/proxy/parcel-boundaries?bbox=${bbox}`;
    if (_pf.acresMin) _parcelUrl += `&acresMin=${encodeURIComponent(_pf.acresMin)}`;
    if (_pf.acresMax) _parcelUrl += `&acresMax=${encodeURIComponent(_pf.acresMax)}`;
    if (_pf.county)   _parcelUrl += `&county=${encodeURIComponent(_pf.county)}`;
    fetch(_parcelUrl, { signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        console.log('[parcels] response:', data.features?.length ?? 0, 'features');
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

    // Initial layer load (handles case where user has saved zoom ≥ 11)
    setTimeout(() => refreshGeoJSONRef.current?.(map), 500);

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

  // ── MH Comps fetch + render ────────────────────────────────────────────────
  const fetchMHComps = async (map, status) => {
    const center = map.getCenter();
    try {
      const r = await fetch(`${PROXY}/api/proxy/mh-comps?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}&status=${status}&radius=15`);
      const data = await r.json();
      if (!Array.isArray(data.results)) return [];
      return data.results;
    } catch { return []; }
  };

  const buildMHMarker = (comp, isSale) => {
    const color   = isSale ? '#22c55e' : '#3b82f6';
    const price   = comp.price ? `$${comp.price >= 1000 ? Math.round(comp.price / 1000) + 'k' : comp.price}` : '—';
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:3px 6px;border-radius:6px;border:2px solid rgba(255,255,255,0.7);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${price}</div>`,
      iconAnchor: [0, 0],
    });
    const marker = L.marker([comp.lat, comp.lng], { icon });
    const soldInfo = comp.soldDate ? `<p style="color:#9ca3af;font-size:10px">Sold: ${comp.soldDate}</p>` : '';
    const daysInfo = comp.daysOn != null ? `<p style="color:#9ca3af;font-size:10px">${comp.daysOn} days on market</p>` : '';
    const link = comp.url ? `<a href="${comp.url}" target="_blank" rel="noopener noreferrer" style="color:#f97316;font-size:10px">View on Zillow ↗</a>` : '';
    marker.bindPopup(`
      <div style="min-width:180px;font-family:system-ui,sans-serif">
        <p style="font-weight:700;font-size:13px;margin:0 0 4px">${price}</p>
        <p style="font-size:11px;color:#374151;margin:0 0 2px">${comp.address || ''}</p>
        <p style="font-size:11px;color:#6b7280;margin:0 0 4px">${[comp.beds ? comp.beds + ' bd' : '', comp.baths ? comp.baths + ' ba' : '', comp.sqft ? comp.sqft.toLocaleString() + ' sqft' : ''].filter(Boolean).join(' · ')}</p>
        ${soldInfo}${daysInfo}${link}
      </div>
    `);
    return marker;
  };

  const refreshMHComps = async (map) => {
    if (!mhForSale && !mhSold) return;
    setCompsLoading(true);
    const [saleResults, soldResults] = await Promise.all([
      mhForSale ? fetchMHComps(map, 'forsale') : Promise.resolve([]),
      mhSold    ? fetchMHComps(map, 'sold')    : Promise.resolve([]),
    ]);

    // For Sale layer
    if (mhForSaleLayerRef.current) { mhForSaleLayerRef.current.remove(); mhForSaleLayerRef.current = null; }
    if (mhForSale && saleResults.length) {
      const lg = L.layerGroup(saleResults.map(c => buildMHMarker(c, true)));
      lg.addTo(map);
      mhForSaleLayerRef.current = lg;
    }

    // Sold layer
    if (mhSoldLayerRef.current) { mhSoldLayerRef.current.remove(); mhSoldLayerRef.current = null; }
    if (mhSold && soldResults.length) {
      const lg = L.layerGroup(soldResults.map(c => buildMHMarker(c, false)));
      lg.addTo(map);
      mhSoldLayerRef.current = lg;
    }

    setCompsCount({ forSale: saleResults.length, sold: soldResults.length });
    setCompsLoading(false);
  };

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    // Clear layers if both off
    if (!mhForSale) {
      if (mhForSaleLayerRef.current) { mhForSaleLayerRef.current.remove(); mhForSaleLayerRef.current = null; }
      setCompsCount(p => ({ ...p, forSale: 0 }));
    }
    if (!mhSold) {
      if (mhSoldLayerRef.current) { mhSoldLayerRef.current.remove(); mhSoldLayerRef.current = null; }
      setCompsCount(p => ({ ...p, sold: 0 }));
    }
    if (mhForSale || mhSold) refreshMHComps(map);
  }, [mhForSale, mhSold]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Filter & Export helpers ────────────────────────────────────────────────
  const exportParcelsCsv = () => {
    const layer = parcelBoundaryLayerRef.current;
    if (!layer) { alert('No parcels visible. Zoom into a parcel area first.'); return; }
    const rows = [];
    layer.eachLayer(l => {
      const p = l.feature?.properties || {};
      const center = l.getBounds?.()?.getCenter?.();
      rows.push({
        parno: p.parno || '', state: p.state || '', county: p.county || '',
        acres: p.gis_acres || p.acres || '', owner: p.owner || '',
        address: p.situsadd || p.siteAddr || '', landValue: p.landval || '',
        lat: center?.lat?.toFixed(6) || '', lng: center?.lng?.toFixed(6) || '',
      });
    });
    if (!rows.length) { alert('No parcels to export.'); return; }
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(','),
      ...rows.map(r => keys.map(k => `"${String(r[k]).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'parcels-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const applyParcelFilters = () => {
    parcelFilterRef.current = { ...pf };
    const map = leafletMap.current;
    if (map && parcelBoundariesRef.current) fetchParcelBoundaries(map);
  };

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

        {/* ── Filter & Export Parcels panel ── */}
        {showParcelFilterPanel && (
          <div
            className="absolute left-0 z-[1100] bg-gray-900 border-r border-gray-700 shadow-2xl flex flex-col"
            style={{ top: '56px', bottom: 0, width: '300px' }}
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Filter size={14} className="text-orange-400" />
                Filter Parcels
              </p>
              <button onClick={() => setShowParcelFilterPanel(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">

              {/* ── Parcel section ── */}
              <button onClick={() => setPfSec(p => ({ ...p, parcel: !p.parcel }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50">
                Parcel <ChevronDown size={11} className={pfSec.parcel ? 'rotate-180' : ''} />
              </button>
              {pfSec.parcel && (
                <div className="space-y-3 pt-2 pb-1">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Counties</label>
                    <input value={pf.county} onChange={e => setPf(p => ({ ...p, county: e.target.value }))}
                      placeholder="Enter county name..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Subdivision</label>
                    <input value={pf.subdivision} onChange={e => setPf(p => ({ ...p, subdivision: e.target.value }))}
                      placeholder="Enter subdivision name..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Include ZIPs</label>
                    <input value={pf.zips} onChange={e => setPf(p => ({ ...p, zips: e.target.value }))}
                      placeholder="Search ZIP..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Acres Range</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.acresMin} onChange={e => setPf(p => ({ ...p, acresMin: e.target.value }))}
                        placeholder="From"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.acresMax} onChange={e => setPf(p => ({ ...p, acresMax: e.target.value }))}
                        placeholder="To"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Max Improvement %</label>
                    <input type="number" value={pf.maxImprovPct} onChange={e => setPf(p => ({ ...p, maxImprovPct: e.target.value }))}
                      placeholder="%"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">City Limits</label>
                    <select value={pf.cityLimits} onChange={e => setPf(p => ({ ...p, cityLimits: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500/70">
                      <option value="">Include Everything</option>
                      <option value="inside">Inside City Limits</option>
                      <option value="outside">Outside City Limits</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Zoning Type</label>
                    <input value={pf.zoningType} onChange={e => setPf(p => ({ ...p, zoningType: e.target.value }))}
                      placeholder="Enter zoning type..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Land Use</label>
                    <input value={pf.landUse} onChange={e => setPf(p => ({ ...p, landUse: e.target.value }))}
                      placeholder="Enter land use code..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                </div>
              )}

              {/* ── AI Scrubbing ── */}
              <button onClick={() => setPfSec(p => ({ ...p, aiScrubbing: !p.aiScrubbing }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50 mt-2">
                AI Scrubbing <ChevronDown size={11} className={pfSec.aiScrubbing ? 'rotate-180' : ''} />
              </button>
              {pfSec.aiScrubbing && (
                <div className="space-y-3 pt-2 pb-1">
                  {[
                    { key: 'vacantOnly',        label: 'Keep Only Vacant Land',     desc: 'Remove parcels with AI-detected buildings' },
                    { key: 'removeBadSlope',    label: 'Remove Bad Slope Land',     desc: 'Remove parcels with too much slope' },
                    { key: 'removeLandLocked',  label: 'Remove Land Locked Land',   desc: 'Remove parcels without road access' },
                    { key: 'onlyLandLocked',    label: 'Only Land Locked Land',     desc: 'Only include parcels without road access' },
                    { key: 'removeHOA',         label: 'Remove HOA Parcels',        desc: 'Remove parcels with HOA deed restrictions' },
                  ].map(({ key, label, desc }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-200">{label}</span>
                        <Toggle active={pf[key]} onChange={() => setPf(p => ({ ...p, [key]: !p[key] }))} />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Max Wetland Coverage (%)</label>
                    <input type="number" value={pf.maxWetland} onChange={e => setPf(p => ({ ...p, maxWetland: e.target.value }))}
                      placeholder="%"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Max Flood Coverage (%)</label>
                    <input type="number" value={pf.maxFlood} onChange={e => setPf(p => ({ ...p, maxFlood: e.target.value }))}
                      placeholder="%"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Road Frontage (Feet)</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.roadFrontageMin} onChange={e => setPf(p => ({ ...p, roadFrontageMin: e.target.value }))}
                        placeholder="Min Feet"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.roadFrontageMax} onChange={e => setPf(p => ({ ...p, roadFrontageMax: e.target.value }))}
                        placeholder="Max Feet"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Owner ── */}
              <button onClick={() => setPfSec(p => ({ ...p, owner: !p.owner }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50 mt-2">
                Owner <ChevronDown size={11} className={pfSec.owner ? 'rotate-180' : ''} />
              </button>
              {pfSec.owner && (
                <div className="space-y-3 pt-2 pb-1">
                  {[
                    { key: 'dedupeOwners',    label: 'Deduplicate Owners' },
                    { key: 'outOfState',      label: 'Out of State Owner' },
                    { key: 'outOfCounty',     label: 'Out of County Owner' },
                    { key: 'outOfZip',        label: 'Out of ZIP Owner' },
                    { key: 'excludeCorporate',label: 'Exclude Corporate Owners' },
                    { key: 'onlyInterFamily', label: 'Only Inter-Family Transfers' },
                    { key: 'taxDelinquent',   label: 'Owner Is Tax Delinquent' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-200">{label}</span>
                      <Toggle active={pf[key]} onChange={() => setPf(p => ({ ...p, [key]: !p[key] }))} />
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Ownership Length (Months)</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.ownershipMin} onChange={e => setPf(p => ({ ...p, ownershipMin: e.target.value }))}
                        placeholder="Min"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.ownershipMax} onChange={e => setPf(p => ({ ...p, ownershipMax: e.target.value }))}
                        placeholder="Max"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Only Include Keywords</label>
                    <input value={pf.includeKeywords} onChange={e => setPf(p => ({ ...p, includeKeywords: e.target.value }))}
                      placeholder="Include keywords..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Exclude Keywords</label>
                    <input value={pf.excludeKeywords} onChange={e => setPf(p => ({ ...p, excludeKeywords: e.target.value }))}
                      placeholder="Exclude keywords..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                </div>
              )}

              {/* ── County Assessor ── */}
              <button onClick={() => setPfSec(p => ({ ...p, assessor: !p.assessor }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50 mt-2">
                County Assessor <ChevronDown size={11} className={pfSec.assessor ? 'rotate-180' : ''} />
              </button>
              {pfSec.assessor && (
                <div className="space-y-3 pt-2 pb-1">
                  {[
                    { label: 'Total Value', kMin: 'totalValueMin', kMax: 'totalValueMax' },
                    { label: 'Land Value', kMin: 'landValueMin', kMax: 'landValueMax' },
                    { label: 'Improvement Value', kMin: 'improveValueMin', kMax: 'improveValueMax' },
                    { label: 'Market Total Value', kMin: 'marketTotalMin', kMax: 'marketTotalMax' },
                    { label: 'Market Land Value', kMin: 'marketLandMin', kMax: 'marketLandMax' },
                    { label: 'Market Improvement Value', kMin: 'marketImproveMin', kMax: 'marketImproveMax' },
                  ].map(({ label, kMin, kMax }) => (
                    <div key={kMin}>
                      <label className="text-[10px] text-gray-400 block mb-1">{label}</label>
                      <div className="flex gap-2">
                        <input type="number" value={pf[kMin]} onChange={e => setPf(p => ({ ...p, [kMin]: e.target.value }))}
                          placeholder="From"
                          className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                        <input type="number" value={pf[kMax]} onChange={e => setPf(p => ({ ...p, [kMax]: e.target.value }))}
                          placeholder="To"
                          className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Owner Hasn't Paid Taxes For At Least X Years</label>
                    <input type="number" value={pf.taxDelinquentYears} onChange={e => setPf(p => ({ ...p, taxDelinquentYears: e.target.value }))}
                      placeholder="5 years"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                </div>
              )}

              {/* ── Sale Info ── */}
              <button onClick={() => setPfSec(p => ({ ...p, sale: !p.sale }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50 mt-2">
                Sale Info <ChevronDown size={11} className={pfSec.sale ? 'rotate-180' : ''} />
              </button>
              {pfSec.sale && (
                <div className="space-y-3 pt-2 pb-1">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Sale Price</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.salePriceMin} onChange={e => setPf(p => ({ ...p, salePriceMin: e.target.value }))}
                        placeholder="From"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.salePriceMax} onChange={e => setPf(p => ({ ...p, salePriceMax: e.target.value }))}
                        placeholder="To"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Sale Price Type</label>
                    <input value={pf.salePriceType} onChange={e => setPf(p => ({ ...p, salePriceType: e.target.value }))}
                      placeholder="Enter sale price type..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Last Sale Date</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.lastSaleFrom} onChange={e => setPf(p => ({ ...p, lastSaleFrom: e.target.value }))}
                        placeholder="From Year"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.lastSaleTo} onChange={e => setPf(p => ({ ...p, lastSaleTo: e.target.value }))}
                        placeholder="To Year"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Seller Name</label>
                    <input value={pf.sellerName} onChange={e => setPf(p => ({ ...p, sellerName: e.target.value }))}
                      placeholder="Enter name..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Transaction Deed Type</label>
                    <input value={pf.deedType} onChange={e => setPf(p => ({ ...p, deedType: e.target.value }))}
                      placeholder="Enter document type..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                </div>
              )}

              {/* ── Open Lien ── */}
              <button onClick={() => setPfSec(p => ({ ...p, lien: !p.lien }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50 mt-2">
                Open Lien <ChevronDown size={11} className={pfSec.lien ? 'rotate-180' : ''} />
              </button>
              {pfSec.lien && (
                <div className="space-y-3 pt-2 pb-1">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Mortgage Amount</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.mortgageMin} onChange={e => setPf(p => ({ ...p, mortgageMin: e.target.value }))}
                        placeholder="From"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.mortgageMax} onChange={e => setPf(p => ({ ...p, mortgageMax: e.target.value }))}
                        placeholder="To"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Mortgage Recording Date</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.mortgageFromYear} onChange={e => setPf(p => ({ ...p, mortgageFromYear: e.target.value }))}
                        placeholder="From Year"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.mortgageToYear} onChange={e => setPf(p => ({ ...p, mortgageToYear: e.target.value }))}
                        placeholder="To Year"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Financing Type</label>
                    <input value={pf.financingType} onChange={e => setPf(p => ({ ...p, financingType: e.target.value }))}
                      placeholder="Enter financing type..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Mortgage Type</label>
                    <input value={pf.mortgageType} onChange={e => setPf(p => ({ ...p, mortgageType: e.target.value }))}
                      placeholder="Enter loan type..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Interest Rate</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.interestMin} onChange={e => setPf(p => ({ ...p, interestMin: e.target.value }))}
                        placeholder="From"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.interestMax} onChange={e => setPf(p => ({ ...p, interestMax: e.target.value }))}
                        placeholder="To"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Structure ── */}
              <button onClick={() => setPfSec(p => ({ ...p, structure: !p.structure }))}
                className="w-full flex items-center justify-between py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-gray-700/50 mt-2">
                Structure <ChevronDown size={11} className={pfSec.structure ? 'rotate-180' : ''} />
              </button>
              {pfSec.structure && (
                <div className="space-y-3 pt-2 pb-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Total Structure Square Feet</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.structureSqftMin} onChange={e => setPf(p => ({ ...p, structureSqftMin: e.target.value }))}
                        placeholder="Min"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.structureSqftMax} onChange={e => setPf(p => ({ ...p, structureSqftMax: e.target.value }))}
                        placeholder="Max"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Total Structure Count</label>
                    <div className="flex gap-2">
                      <input type="number" value={pf.structureCountMin} onChange={e => setPf(p => ({ ...p, structureCountMin: e.target.value }))}
                        placeholder="Min"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                      <input type="number" value={pf.structureCountMax} onChange={e => setPf(p => ({ ...p, structureCountMax: e.target.value }))}
                        placeholder="Max"
                        className="w-1/2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/70" />
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-700 p-3 flex gap-2">
              <button
                onClick={() => { setPf(DEFAULT_PF); parcelFilterRef.current = {}; }}
                className="px-3 py-2 text-xs text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                Clear
              </button>
              <button
                onClick={exportParcelsCsv}
                className="px-3 py-2 text-xs text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
              >
                Export CSV
              </button>
              <button
                onClick={applyParcelFilters}
                className="flex-1 py-2 text-xs font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-400 transition-colors"
              >
                Filter Parcels
              </button>
            </div>
          </div>
        )}

        {/* ── Map Filters panel ── */}
        {showFiltersPanel && (
          <div className="absolute bottom-16 right-3 z-[1100] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-72 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers size={14} className="text-orange-400" />
                Data Layers &amp; View
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

        {/* ── MH Comps panel ── */}
        {showCompsPanel && (
          <div className="absolute z-[1100] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 w-64 overflow-hidden" style={{ bottom: '56px', right: '200px' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Home size={13} className="text-green-400" />
                MH Comps
              </p>
              <button onClick={() => setShowCompsPanel(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Manufactured Homes · 15 mi radius</p>

              {/* For Sale */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-200">For Sale</span>
                  {mhForSale && compsCount.forSale > 0 && (
                    <span className="text-[10px] text-gray-400">({compsCount.forSale})</span>
                  )}
                </div>
                <Toggle active={mhForSale} onChange={() => setMhForSale(p => !p)} />
              </div>

              {/* Sold */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-200">Sold</span>
                  {mhSold && compsCount.sold > 0 && (
                    <span className="text-[10px] text-gray-400">({compsCount.sold})</span>
                  )}
                </div>
                <Toggle active={mhSold} onChange={() => setMhSold(p => !p)} />
              </div>

              {compsLoading && (
                <p className="text-[11px] text-orange-400 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
                  Loading comps…
                </p>
              )}
              {(mhForSale || mhSold) && !compsLoading && compsCount.forSale === 0 && compsCount.sold === 0 && (
                <p className="text-[11px] text-gray-500">No results in this area. Try panning the map.</p>
              )}
            </div>
          </div>
        )}

        {/* ── MH Comps button ── */}
        <button
          onClick={() => setShowCompsPanel(p => !p)}
          className={`absolute bottom-4 z-[1100] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border transition-colors ${
            showCompsPanel || mhForSale || mhSold
              ? 'bg-green-600 border-green-600 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-200 hover:border-green-500/50 hover:text-white'
          }`}
          style={{ right: '200px' }}
        >
          <Home size={15} />
          MH Comps
          {(mhForSale || mhSold) && (
            <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
          )}
        </button>

        {/* ── Filter & Export Parcels button — top left ── */}
        <button
          onClick={() => setShowParcelFilterPanel(p => !p)}
          className={`absolute top-3 left-3 z-[1100] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg border transition-colors ${
            showParcelFilterPanel
              ? 'bg-orange-500 border-orange-500 text-white'
              : 'bg-gray-900 border-gray-700 text-gray-200 hover:border-orange-500/50 hover:text-white'
          }`}
        >
          <Filter size={15} />
          Filter &amp; Export Parcels
        </button>

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
          Data Layers &amp; View
        </button>

        {/* Parcel info panel */}
        {parcelData && (
          <div className="absolute left-3 z-[1000] rounded-xl shadow-2xl border border-gray-600 w-[420px] flex flex-col" style={{ bottom: '80px', top: '80px', backgroundColor: 'rgb(26, 35, 50)' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-700/60">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold text-white leading-tight truncate">
                    {parcelData.owner || 'Unknown Owner'}
                  </p>
                  <p className="text-xs text-emerald-400 mt-0.5">
                    {parcelData.acres != null ? `${Number(parcelData.acres).toFixed(2)} acres` : '—'}
                    {parcelData.parcelId ? <span className="text-gray-400"> · APN: {parcelData.parcelId}</span> : null}
                  </p>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {parcelData.landUse && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-700/40 capitalize">
                        {parcelData.landUse.toLowerCase()}
                      </span>
                    )}
                    {parcelData.state && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-900/60 text-blue-300 border border-blue-700/40">
                        {parcelData.state}
                      </span>
                    )}
                    {parcelData.county && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-700/60 text-gray-300 border border-gray-600/40">
                        {parcelData.county} Co.
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setParcelData(null);
                    setParcelLatLng(null);
                    setShowBuildability(false);
                    setBuildability(null);
                    if (buildabilityLayerRef.current) { buildabilityLayerRef.current.remove(); buildabilityLayerRef.current = null; }
                    if (parcelLayerRef.current) { parcelLayerRef.current.remove(); parcelLayerRef.current = null; }
                  }}
                  className="flex-shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            {!parcelData.error && (
              <div className="flex-shrink-0 flex border-b border-gray-700/60 px-2 pt-1">
                {['Summary','Parcel','Owner','Insights','Metrics'].map(t => (
                  <button
                    key={t}
                    onClick={() => setParcelTab(t.toLowerCase())}
                    className={`px-3 py-2 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
                      parcelTab === t.toLowerCase()
                        ? 'border-emerald-400 text-emerald-400'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >{t}</button>
                ))}
              </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto text-xs">
              {parcelData.error ? (
                <p className="text-red-400 p-4">{parcelData.error}</p>
              ) : (() => {
                const impPct = parcelData.bldgVal != null && parcelData.totVal > 0
                  ? ((parcelData.bldgVal / parcelData.totVal) * 100).toFixed(1) + '%'
                  : '—';
                const ownershipLen = parcelData.saleYear
                  ? `${new Date().getFullYear() - parseInt(parcelData.saleYear)} years ago`
                  : '—';
                const fmt$ = v => v != null ? `$${Number(v).toLocaleString()}` : '—';
                const Row = ({ label, val, right }) => (
                  <div className="flex justify-between gap-3 py-1.5 border-b border-gray-700/30">
                    <span className="text-gray-500 flex-shrink-0">{label}</span>
                    <span className={`text-right ${right ? 'text-white font-semibold' : 'text-gray-200'}`}>{val ?? '—'}</span>
                  </div>
                );
                const Section = ({ title, children }) => (
                  <div className="px-4 pt-3 pb-1">
                    {title && <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-1">{title}</p>}
                    {children}
                  </div>
                );

                if (parcelTab === 'summary') return (
                  <div className="space-y-0">
                    <Section>
                      <Row label="APN" val={parcelData.parcelId} />
                      <Row label="Site Address" val={parcelData.siteAddr} />
                      <Row label="County" val={parcelData.county} />
                      <Row label="State" val={parcelData.state} />
                      <Row label="GPS" val={parcelLatLng ? `${parcelLatLng.lat.toFixed(6)}, ${parcelLatLng.lng.toFixed(6)}` : null} />
                      <Row label="Acres (GIS)" val={parcelData.acres != null ? Number(parcelData.acres).toFixed(2) : null} />
                      <Row label="Land Use" val={parcelData.landUse} />
                      <Row label="Last Sale Year" val={parcelData.saleYear} />
                    </Section>
                    <Section title="Valuation">
                      <Row label="Assessed Land Value" val={fmt$(parcelData.landVal)} right />
                      <Row label="Assessed Improvement" val={fmt$(parcelData.bldgVal)} right />
                      <Row label="Total Value" val={fmt$(parcelData.totVal)} right />
                      <Row label="Improvement %" val={impPct} />
                    </Section>
                    {parcelLatLng && (
                      <Section title="Links">
                        <div className="flex gap-2 pb-2">
                          <a href={`https://www.google.com/maps/search/?api=1&query=${parcelLatLng.lat},${parcelLatLng.lng}`} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium"
                            style={{ backgroundColor: '#1a2535', color: '#38bdf8', border: '1px solid #0284c7' }}>
                            <ExternalLink size={10} /> Maps
                          </a>
                          <a href={`https://earth.google.com/web/@${parcelLatLng.lat},${parcelLatLng.lng},100a,500d,35y,0h,0t,0r`} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium"
                            style={{ backgroundColor: '#1a2535', color: '#86efac', border: '1px solid #16a34a' }}>
                            <ExternalLink size={10} /> Earth
                          </a>
                          <a href={`https://maps.google.com/maps?q=&layer=c&cbll=${parcelLatLng.lat},${parcelLatLng.lng}&cbp=11,0,0,0,0&z=17`} target="_blank" rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium"
                            style={{ backgroundColor: '#1a2535', color: '#c4b5fd', border: '1px solid #7c3aed' }}>
                            <ExternalLink size={10} /> Street
                          </a>
                        </div>
                      </Section>
                    )}
                  </div>
                );

                if (parcelTab === 'parcel') return (
                  <div>
                    <Section>
                      <Row label="County" val={parcelData.county} />
                      <Row label="Acres" val={parcelData.acres != null ? Number(parcelData.acres).toFixed(2) : null} />
                      <Row label="APN" val={parcelData.parcelId} />
                      <Row label="Calculated Acres" val={null} />
                      <Row label="GPS" val={parcelLatLng ? `${parcelLatLng.lat.toFixed(7)}, ${parcelLatLng.lng.toFixed(7)}` : null} />
                      <Row label="Improvement %" val={impPct} />
                      <Row label="Zoning" val={parcelData.zoning} />
                      <Row label="Current Land Use" val={parcelData.landUse} />
                      <Row label="Subdivision" val={parcelData.subdivision} />
                      <Row label="Legal Description" val={null} />
                    </Section>
                    <Section title="Structures">
                      <Row label="Structures" val={null} />
                      <Row label="Structure Count" val={null} />
                      <Row label="Structure Year Built" val={null} />
                    </Section>
                    <Section title="Mortgage">
                      <Row label="Mortgage Amount" val={null} />
                      <Row label="Mortgage Length" val={null} />
                      <Row label="Mortgage Lender" val={null} />
                      <Row label="Mortgage Matures In" val={null} />
                      <Row label="Mortgage Type" val={null} />
                      <Row label="Loan Type" val={null} />
                      <Row label="Mortgage Interest" val={null} />
                    </Section>
                  </div>
                );

                if (parcelTab === 'owner') return (
                  <div>
                    <Section>
                      <div className="py-2 border-b border-gray-700/30">
                        <p className="text-white font-semibold">{parcelData.owner || '—'}</p>
                        <p className="text-gray-400 mt-0.5">{parcelData.mailAddr || '—'}</p>
                      </div>
                      <Row label="Out of State" val={null} />
                      <Row label="Out of County" val={null} />
                      <Row label="Out of ZIP" val={null} />
                      <Row label="Ownership Length" val={ownershipLen} />
                      <Row label="Prior Owner Name" val={null} />
                    </Section>
                    <Section title="Chain of Ownership">
                      <p className="text-gray-600 text-[11px] py-2">Available with data subscription</p>
                    </Section>
                  </div>
                );

                if (parcelTab === 'insights') return (
                  <div>
                    <Section>
                      <Row label="Land Locked" val={null} />
                      <Row label="Road Frontage" val={null} />
                      <Row label="Wetlands" val={buildability && !buildability.error ? `${buildability.wetlandPct}%` : null} />
                      <Row label="Flood Zone" val={buildability && !buildability.error ? `${buildability.floodPct}%` : null} />
                    </Section>
                    <Section title="Elevation">
                      <Row label="Min Elevation" val={null} />
                      <Row label="Max Elevation" val={null} />
                      <Row label="Avg Elevation" val={null} />
                    </Section>
                    <Section title="Slope">
                      <Row label="Min Slope" val={buildability?.slope ? '0%' : null} />
                      <Row label="Max Slope" val={buildability?.slope ? `${buildability.slope.avg > 0 ? buildability.slope.avg : '—'}%` : null} />
                      <Row label="Avg Slope" val={buildability?.slope ? `${buildability.slope.avg}%` : null} />
                    </Section>
                    {!buildability && (
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => { setShowBuildability(true); showBuildabilityOverlay(parcelData.geometry); }}
                          disabled={buildabilityLoading}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold mt-2"
                          style={{ backgroundColor: '#1e3a2f', color: '#4ade80', border: '1px solid #16a34a' }}
                        >
                          <TreePine size={12} />
                          {buildabilityLoading ? 'Analyzing...' : 'Run Buildability Analysis'}
                        </button>
                        {buildabilityLoading && <p className="text-[10px] text-gray-500 text-center mt-1">Fetching flood, wetland & slope data...</p>}
                      </div>
                    )}
                    {buildability && !buildability.error && (
                      <Section title="Buildability">
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-gray-400">Buildable area</p>
                            <p className="text-gray-500 text-[10px]">{buildability.buildableAcres} ac</p>
                          </div>
                          <p className="text-3xl font-bold" style={{ color: buildability.pct >= 70 ? '#4ade80' : buildability.pct >= 40 ? '#facc15' : '#f87171' }}>
                            {buildability.pct}%
                          </p>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden mb-2">
                          <div className="h-full rounded-full" style={{ width: `${buildability.pct}%`, backgroundColor: buildability.pct >= 70 ? '#4ade80' : buildability.pct >= 40 ? '#facc15' : '#f87171' }} />
                        </div>
                        {buildability.slope && (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mt-3 mb-1">Slope Breakdown</p>
                            {[
                              { label: 'Flat (0–0.5%)', val: buildability.slope.flat },
                              { label: 'Minimal (0.5–5%)', val: buildability.slope.minimal },
                              { label: 'Moderate (5–10%)', val: buildability.slope.moderate },
                              { label: 'Heavy (10–15%)', val: buildability.slope.heavy },
                              { label: 'Extreme (15%+)', val: buildability.slope.extreme },
                            ].map(({ label, val }) => (
                              <div key={label} className="flex justify-between py-1 border-b border-gray-700/30">
                                <span className="text-gray-500">{label}</span>
                                <span className="text-gray-300">{val ?? 0}%</span>
                              </div>
                            ))}
                          </>
                        )}
                      </Section>
                    )}
                  </div>
                );

                if (parcelTab === 'metrics') return (
                  <div>
                    <Section>
                      <div className="py-2 text-gray-400 border-b border-gray-700/30">
                        {parcelData.acres != null ? `${Math.floor(parcelData.acres)} to ${Math.ceil(parcelData.acres) + 1} Acres` : 'Acreage unknown'}
                      </div>
                    </Section>
                    <Section title="Market Activity">
                      <Row label="Active" val={null} />
                      <Row label="Pending" val={null} />
                      <Row label="1yr STR" val={null} />
                      <Row label="Median Sold PPA" val={null} />
                    </Section>
                    <Section title="Sold">
                      <Row label="Sold 1mo" val={null} />
                      <Row label="Sold 3mo" val={null} />
                      <Row label="Sold 6mo" val={null} />
                      <Row label="Sold 1yr" val={null} />
                    </Section>
                    <div className="px-4 pb-3">
                      <p className="text-[10px] text-gray-600 mt-2">Market metrics available with data subscription</p>
                    </div>
                  </div>
                );

                return null;
              })()}
            </div>

            {/* Fixed footer — action buttons */}
            {!parcelData.error && (
              <div className="flex-shrink-0 border-t border-gray-700/60 p-3 space-y-2">
                <button
                  onClick={() => setShowAddToPipeline(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: '#1a1f3a', color: '#818cf8', border: '1px solid #4338ca' }}
                >
                  <PlusCircle size={12} /> Add to Pipeline
                </button>
                {parcelTab !== 'insights' && (
                  <button
                    onClick={() => {
                      setParcelTab('insights');
                      if (!showBuildability) { setShowBuildability(true); showBuildabilityOverlay(parcelData.geometry); }
                    }}
                    disabled={buildabilityLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ backgroundColor: showBuildability ? '#16a34a' : '#1e3a2f', color: showBuildability ? '#fff' : '#4ade80', border: '1px solid #16a34a' }}
                  >
                    <TreePine size={12} />
                    {buildabilityLoading ? 'Analyzing...' : 'Buildability'}
                  </button>
                )}
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
