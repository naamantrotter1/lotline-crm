import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import * as topojson from 'topojson-client';
import { AppContext } from '../../App';
import CountyDetail from '../RightPanel/CountyDetail';
import api from '../../api';

const METRIC_CONFIG = {
  median_sale_price:     { label: 'Median Price',        higherIsBetter: null,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  median_price_per_acre: { label: 'Median Price/Acre',   higherIsBetter: null,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  median_days_on_market: { label: 'Days on Market',      higherIsBetter: false, fmt: v => v?.toFixed(0) + 'd' },
  sell_through_rate_pct: { label: 'Sell Through (STR)',  higherIsBetter: true,  fmt: v => v?.toFixed(1) + '%' },
  absorption_rate_pct:   { label: 'Absorption Rate',     higherIsBetter: true,  fmt: v => v?.toFixed(1) + '%' },
  months_of_supply:      { label: 'Months of Supply',    higherIsBetter: false, fmt: v => v?.toFixed(1) },
  opportunity_score:     { label: 'Opportunity Score',   higherIsBetter: true,  fmt: v => v?.toFixed(0) },
  demand_score:          { label: 'Demand Score',        higherIsBetter: true,  fmt: v => v?.toFixed(0) },
  population_growth_pct: { label: 'Pop Growth',          higherIsBetter: true,  fmt: v => v?.toFixed(1) + '%' },
  median_income:         { label: 'Median Income',       higherIsBetter: true,  fmt: v => '$' + Math.round(v/1000) + 'k' },
};

// Green → Yellow → Red color scale
function scoreToColor(norm, higherIsBetter) {
  // norm = 0..1, higherIsBetter determines direction
  const t = higherIsBetter ? norm : (1 - norm);
  // t=1 → green, t=0.5 → yellow, t=0 → red
  if (t >= 0.66) return { color: `hsl(${Math.round(t * 120)}, 70%, 45%)`, opacity: 0.75 };
  if (t >= 0.33) return { color: `hsl(${Math.round(t * 120)}, 70%, 45%)`, opacity: 0.75 };
  return         { color: `hsl(${Math.round(t * 120)}, 70%, 40%)`, opacity: 0.75 };
}

function normalize(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

const PIPELINE_COLORS = {
  development: '#f97316', // orange — Deal Overview / active build
  land:        '#a855f7', // purple — Land Acquisition
  sales:       '#34d399', // green  — Sales
};

export default function MapView() {
  const { filters, setFilters, selectedCounty, setSelectedCounty, mapLayers, setMapLayers } = useContext(AppContext);
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const choropleth  = useRef(null);
  const markersRef  = useRef({ listings: null, comps: null, deals: null, landAcquisition: null, flood: null });

  const [counties,  setCounties]  = useState([]);
  const [listings,  setListings]  = useState([]);
  const [deals,     setDeals]     = useState([]);
  const [geojson,   setGeojson]   = useState(null);
  const [zipGeojson, setZipGeojson] = useState(null);
  const [zipStats,   setZipStats]   = useState([]);
  const [heatLevel,  setHeatLevel]  = useState('county'); // 'county' | 'zip'
  const [bottomOpen, setBottomOpen] = useState(true);
  const [mapStyle, setMapStyle]   = useState('light'); // 'light' | 'satellite'
  const baseTilesRef = useRef([]);
  const zipChoropleth = useRef(null);
  const stateBordersRef = useRef(null);
  const [stateGeojson, setStateGeojson] = useState(null);
  const [layers, setLayers] = useState({
    counties: true, listings: true, comps: false, deals: true, landAcquisition: true, flood: false,
  });
  const [tableSort, setTableSort] = useState({ col: 'opportunity_score', dir: -1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);

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

  // ── Initialize Leaflet map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [35.3, -79.5],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    // Load light basemap tiles
    baseTilesRef.current = TILE_LAYERS.light.map(t => L.tileLayer(t.url, t.opts).addTo(map));

    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  // ── Swap basemap when mapStyle changes ────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !L) return;
    baseTilesRef.current.forEach(t => t.remove());
    baseTilesRef.current = TILE_LAYERS[mapStyle].map(t => L.tileLayer(t.url, t.opts).addTo(map));
    // Push base tiles below other layers
    baseTilesRef.current.forEach(t => t.setZIndex(0));
  }, [mapStyle]);

  // ── Fetch county GeoJSON from US Atlas CDN ─────────────────────────────────
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
      .then(r => r.json())
      .then(us => {
        // topojson → geojson
        
        if (topojson) {
          const gj = topojson.feature(us, us.objects.counties);
          const filtered = {
            ...gj,
            features: gj.features.filter(f =>
              String(f.id).startsWith('37') || String(f.id).startsWith('45')
            ),
          };
          setGeojson(filtered);

          // Also extract state boundaries for NC (37) and SC (45)
          const sgj = topojson.feature(us, us.objects.states);
          const statesFiltered = {
            ...sgj,
            features: sgj.features.filter(f =>
              String(f.id) === '37' || String(f.id) === '45'
            ),
          };
          setStateGeojson(statesFiltered);
        }
      })
      .catch(() => {
        // fallback: no boundary layer, just markers
        console.warn('Could not load county GeoJSON');
      });
  }, []);

  // ── Render state border outlines ──────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!L || !map || !stateGeojson) return;
    if (stateBordersRef.current) { stateBordersRef.current.remove(); stateBordersRef.current = null; }
    const layer = L.geoJSON(stateGeojson, {
      style: () => ({
        fillColor: 'transparent', fillOpacity: 0,
        color: '#000000', weight: 3, opacity: 1,
        dashArray: null,
      }),
      interactive: false,
    });
    layer.addTo(map);
    stateBordersRef.current = layer;
    return () => { if (stateBordersRef.current) stateBordersRef.current.remove(); };
  }, [stateGeojson]);

  // ── Fetch counties data ────────────────────────────────────────────────────
  useEffect(() => {
    api.counties.list({
      state: filters.state !== 'Both' ? filters.state : undefined,
      period: filters.period,
      propertyType: filters.propertyType || 'All',
      acreageRange: filters.acreageRange || 'All',
      listingStatus: filters.listingStatus || 'sold',
    }).then(r => setCounties(r.data || []))
      .catch(() => {});
  }, [filters.state, filters.period, filters.propertyType, filters.acreageRange, filters.listingStatus]);

  // ── Fetch listings (or comps when Sold status selected) ───────────────────
  useEffect(() => {
    if (!layers.listings) return;
    // Parse acreage range into min/max_acres params
    const acreageParams = (() => {
      const r = filters.acreageRange;
      if (!r || r === 'All') return {};
      if (r.endsWith('+')) return { min_acres: parseFloat(r) };
      const [mn, mx] = r.split('-').map(Number);
      return { min_acres: mn, max_acres: mx };
    })();

    if (filters.listingStatus === 'sold') {
      api.comps.list({
        state: filters.state !== 'Both' ? filters.state : undefined,
        property_type: filters.propertyType !== 'All' ? filters.propertyType : undefined,
        ...acreageParams,
        limit: 300,
      }).then(r => {
        const comps = (r.data || []).map(c => ({
          ...c,
          list_price: c.sale_price,
        }));
        setListings(comps);
      }).catch(() => {});
    } else {
      api.listings.list({
        state: filters.state !== 'Both' ? filters.state : undefined,
        max_price: filters.maxPrice < 500000 ? filters.maxPrice : undefined,
        property_type: filters.propertyType !== 'All' ? filters.propertyType : undefined,
        ...acreageParams,
        limit: 300,
      }).then(r => setListings(r.data || [])).catch(() => {});
    }
  }, [filters.state, filters.maxPrice, filters.propertyType, filters.listingStatus, filters.acreageRange, layers.listings]);

  // ── Fetch deals ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.deals.list().then(r => setDeals(r.data || [])).catch(() => {});
  }, []);

  // ── Load zip code GeoJSON (lazy, only when zip heat map is selected) ─────────
  useEffect(() => {
    if (heatLevel !== 'zip' || zipGeojson) return;
    Promise.all([
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/nc_north_carolina_zip_codes_geo.min.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/sc_south_carolina_zip_codes_geo.min.json').then(r => r.json()),
    ]).then(([nc, sc]) => {
      setZipGeojson({
        type: 'FeatureCollection',
        features: [...(nc.features || []), ...(sc.features || [])],
      });
    }).catch(() => console.warn('Could not load zip GeoJSON'));
  }, [heatLevel]);

  // ── Fetch zip stats ────────────────────────────────────────────────────────
  useEffect(() => {
    if (heatLevel !== 'zip') return;
    api.zipStats.list({
      state: filters.state !== 'Both' ? filters.state : undefined,
      period: filters.period,
    }).then(r => setZipStats(r.data || [])).catch(() => {});
  }, [heatLevel, filters.state, filters.period]);

  // ── Render ZIP choropleth ──────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!L || !map) return;
    if (zipChoropleth.current) { zipChoropleth.current.remove(); zipChoropleth.current = null; }
    if (heatLevel !== 'zip' || !zipGeojson || !zipStats.length) return;

    const metric = filters.metric;
    const cfg = METRIC_CONFIG[metric] || { higherIsBetter: true, fmt: v => v };
    const lookup = {};
    zipStats.forEach(z => { lookup[z.zip_code] = z; });
    const vals = zipStats.map(z => z[metric]).filter(v => v != null);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);

    const layer = L.geoJSON(zipGeojson, {
      style: (feature) => {
        const zip = feature.properties?.ZCTA5CE10 || feature.properties?.GEOID10 || feature.properties?.zip;
        const data = zip ? lookup[zip] : null;
        const val = data?.[metric];
        if (val == null) return { fillColor: '#D8D5CB', fillOpacity: 0.3, color: '#B0ADA3', weight: 0.5 };
        const norm = normalize(val, minVal, maxVal);
        const { color, opacity } = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: opacity * 0.9, color: 'rgba(255,255,255,0.4)', weight: 0.5 };
      },
      onEachFeature: (feature, lyr) => {
        const zip = feature.properties?.ZCTA5CE10 || feature.properties?.GEOID10 || feature.properties?.zip;
        const data = zip ? lookup[zip] : null;
        const val = data?.[metric];
        const label = val != null ? cfg.fmt(val) : '–';
        lyr.bindTooltip(`
          <div class="p-2">
            <div class="font-bold text-[#333638]">ZIP ${zip}</div>
            <div class="text-xs text-[#767C80]">${cfg.label}: <span class="text-[#333638] font-medium">${label}</span></div>
            ${data ? `<div class="text-xs text-[#A0A5A8] mt-0.5">${data.active_listings} active · ${data.sold_count} sold</div>` : '<div class="text-xs text-[#A0A5A8]">No data</div>'}
          </div>
        `, { sticky: true });
        lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 1, weight: 1.5 }));
        lyr.on('mouseout',  () => layer.resetStyle(lyr));
      },
    });
    layer.addTo(map);
    zipChoropleth.current = layer;
    return () => { if (zipChoropleth.current) zipChoropleth.current.remove(); };
  }, [zipGeojson, zipStats, filters.metric, heatLevel]);

  // ── Render choropleth when geojson + counties ready ────────────────────────
  useEffect(() => {
    
    const map = leafletMap.current;
    if (!L || !map || !geojson || !counties.length) return;

    // Remove old layer first
    if (choropleth.current) { choropleth.current.remove(); choropleth.current = null; }

    // Don't show county fill when in zip mode (keep outline only)
    if (heatLevel === 'zip') {
      if (!layers.counties) return;
      // Show county borders only (no fill) as context layer
      const borderLayer = L.geoJSON(geojson, {
        style: () => ({ fillColor: 'transparent', fillOpacity: 0, color: '#B0ADA3', weight: 1 }),
      });
      borderLayer.addTo(map);
      choropleth.current = borderLayer;
      return () => { if (choropleth.current) choropleth.current.remove(); };
    }

    // Build a lookup: fips → county data
    const lookup = {};
    counties.forEach(c => { lookup[c.fips_code] = c; });

    // Get metric range for normalization
    const metric = filters.metric;
    const vals = counties.map(c => c[metric]).filter(v => v != null);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const cfg = METRIC_CONFIG[metric] || { higherIsBetter: true, fmt: v => v };

    if (!layers.counties) return;

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const fips  = String(feature.id).padStart(5, '0');
        const data  = lookup[fips];
        const val   = data?.[metric];
        if (val == null) return { fillColor: '#D8D5CB', fillOpacity: 0.4, color: '#B0ADA3', weight: 0.8 };
        const norm = normalize(val, minVal, maxVal);
        const { color, opacity } = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: opacity, color: 'rgba(255,255,255,0.5)', weight: 0.8 };
      },
      onEachFeature: (feature, lyr) => {
        const fips = String(feature.id).padStart(5, '0');
        const data = lookup[fips];
        if (!data) return;

        const val = data[metric];
        const label = cfg.fmt(val);
        lyr.bindTooltip(`
          <div class="p-2">
            <div class="font-bold text-[#333638]">${data.name}, ${data.state}</div>
            <div class="text-xs text-[#767C80]">${cfg.label}: <span class="text-[#333638] font-medium">${label ?? '–'}</span></div>
            <div class="text-xs text-[#A0A5A8] mt-0.5">Click for details</div>
          </div>
        `, { sticky: true });

        lyr.on('click', () => setSelectedCounty(fips));
        lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.9, weight: 2 }));
        lyr.on('mouseout',  () => layer.resetStyle(lyr));
      },
    });

    layer.addTo(map);
    choropleth.current = layer;

    return () => { if (choropleth.current) choropleth.current.remove(); };
  }, [geojson, counties, filters.metric, layers.counties, heatLevel]);

  // ── Render development deal markers (Deals toggle) ────────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!L || !map) return;

    if (markersRef.current.deals) { markersRef.current.deals.remove(); markersRef.current.deals = null; }
    if (!mapLayers?.deals || !deals.length) return;

    const group = L.layerGroup();
    deals.filter(d => d.pipeline === 'development').forEach(d => {
      if (!d.lat || !d.lng) return;
      const color = PIPELINE_COLORS.development;
      const marker = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}80;"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        }),
      });
      const profit = d.projected_profit;
      marker.bindPopup(`
        <div class="p-3 min-w-[220px]">
          <div class="flex items-center gap-2 mb-2">
            <span style="background:${color}" class="px-2 py-0.5 rounded-full text-xs text-white font-medium">
              Deals
            </span>
            <span class="text-xs text-gray-400">${(d.status || '').replace(/_/g,' ')}</span>
          </div>
          <div class="font-bold text-white text-sm mb-1">${d.county_name}, ${d.state}</div>
          <div class="text-xs text-gray-300 truncate mb-2">${d.address}</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="text-gray-400">All-in:</span> <span class="text-white">$${Math.round(d.all_in_cost/1000)}k</span></div>
            <div><span class="text-gray-400">Target:</span> <span class="text-white">$${Math.round(d.target_sale_price/1000)}k</span></div>
            <div><span class="text-gray-400">Profit:</span> <span class="text-green-400">+$${Math.round(profit/1000)}k</span></div>
            <div><span class="text-gray-400">ROI:</span> <span class="text-green-400">${d.projected_roi_pct?.toFixed(1)}%</span></div>
          </div>
          ${d.notes ? `<div class="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">${d.notes}</div>` : ''}
        </div>
      `);
      group.addLayer(marker);
    });
    group.addTo(map);
    markersRef.current.deals = group;

    return () => { group.remove(); };
  }, [deals, mapLayers?.deals]);

  // ── Render land acquisition markers (Land Acq toggle) ─────────────────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!L || !map) return;

    if (markersRef.current.landAcquisition) { markersRef.current.landAcquisition.remove(); markersRef.current.landAcquisition = null; }
    if (!mapLayers?.landAcquisition || !deals.length) return;

    const group = L.layerGroup();
    deals.filter(d => d.pipeline === 'land').forEach(d => {
      if (!d.lat || !d.lng) return;
      const color = PIPELINE_COLORS.land;
      // Diamond shape for land acquisition deals
      const marker = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}80;transform:rotate(45deg);"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        }),
      });
      marker.bindPopup(`
        <div class="p-3 min-w-[220px]">
          <div class="flex items-center gap-2 mb-2">
            <span style="background:${color}" class="px-2 py-0.5 rounded-full text-xs text-white font-medium">
              Land Acquisition
            </span>
            <span class="text-xs text-gray-400">${(d.status || '').replace(/_/g,' ')}</span>
          </div>
          <div class="font-bold text-white text-sm mb-1">${d.county_name}, ${d.state}</div>
          <div class="text-xs text-gray-300 truncate mb-2">${d.address}</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="text-gray-400">All-in:</span> <span class="text-white">$${Math.round((d.all_in_cost||0)/1000)}k</span></div>
            <div><span class="text-gray-400">Target:</span> <span class="text-white">$${Math.round((d.target_sale_price||0)/1000)}k</span></div>
          </div>
          ${d.notes ? `<div class="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">${d.notes}</div>` : ''}
        </div>
      `);
      group.addLayer(marker);
    });
    group.addTo(map);
    markersRef.current.landAcquisition = group;

    return () => { group.remove(); };
  }, [deals, mapLayers?.landAcquisition]);

  // ── Render active listings markers (CRM deals with status 'listed') ────────
  useEffect(() => {
    const map = leafletMap.current;
    if (!L || !map) return;

    if (markersRef.current.activeListings) { markersRef.current.activeListings.remove(); markersRef.current.activeListings = null; }
    if (!mapLayers?.activeListings || !deals.length) return;

    const group = L.layerGroup();
    deals.filter(d => d.pipeline === 'sales').forEach(d => {
      if (!d.lat || !d.lng) return;
      const color = PIPELINE_COLORS.sales;
      const marker = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:3px;background:${color};border:2px solid white;box-shadow:0 0 6px ${color}80;"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        }),
      });
      marker.bindPopup(`
        <div class="p-3 min-w-[220px]">
          <div class="flex items-center gap-2 mb-2">
            <span style="background:${color}" class="px-2 py-0.5 rounded-full text-xs text-white font-medium">Active Listing</span>
          </div>
          <div class="font-bold text-white text-sm mb-1">${d.county_name}, ${d.state}</div>
          <div class="text-xs text-gray-300 truncate mb-2">${d.address}</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="text-gray-400">All-in:</span> <span class="text-white">$${Math.round((d.all_in_cost||0)/1000)}k</span></div>
            <div><span class="text-gray-400">Target:</span> <span class="text-white">$${Math.round((d.target_sale_price||0)/1000)}k</span></div>
            <div><span class="text-gray-400">Profit:</span> <span class="text-green-400">+$${Math.round((d.projected_profit||0)/1000)}k</span></div>
            <div><span class="text-gray-400">ROI:</span> <span class="text-green-400">${d.projected_roi_pct?.toFixed(1)}%</span></div>
          </div>
          ${d.notes ? `<div class="text-xs text-gray-500 mt-2 border-t border-gray-700 pt-2">${d.notes}</div>` : ''}
        </div>
      `);
      group.addLayer(marker);
    });
    group.addTo(map);
    markersRef.current.activeListings = group;

    return () => { group.remove(); };
  }, [deals, mapLayers?.activeListings]);

  // ── Table ──────────────────────────────────────────────────────────────────
  const sortedCounties = [...counties].sort((a, b) => {
    const v = (c) => c[tableSort.col] ?? -Infinity;
    return tableSort.dir * ((v(b) > v(a)) ? 1 : -1);
  });

  const handleSort = (col) => setTableSort(prev =>
    prev.col === col ? { col, dir: -prev.dir } : { col, dir: -1 }
  );

  const exportCsv = () => {
    const rows = [
      ['County','State','Opp Score','Demand','Mo Supply','Abs Rate','Med Price','DOM','Sell Thru','Pop Growth','Income'],
      ...counties.map(c => [
        c.name, c.state,
        c.opportunity_score, c.demand_score, c.months_of_supply,
        c.absorption_rate_pct, c.median_sale_price, c.median_days_on_market,
        c.sell_through_rate_pct, c.growth_pct, c.median_income,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `lotline-county-stats-${filters.period}.csv`;
    a.click();
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    const lower = q.toLowerCase();
    // County name matches
    const countyMatches = counties
      .filter(c => c.name.toLowerCase().includes(lower))
      .slice(0, 6)
      .map(c => ({ type: 'county', label: `${c.name} County, ${c.state}`, data: c }));
    // ZIP code match (5 digits)
    const zipMatches = /^\d{3,5}$/.test(q.trim())
      ? [{ type: 'zip', label: `ZIP ${q.trim()}`, data: { zip: q.trim() } }]
      : [];
    const results = [...countyMatches, ...zipMatches];
    setSearchResults(results);
    setSearchOpen(results.length > 0);
  };

  const handleSearchSelect = async (result) => {
    setSearchQuery(result.label);
    setSearchOpen(false);
    const map = leafletMap.current;
    if (!map) return;

    if (result.type === 'county') {
      const fips = result.data.fips_code;
      setSelectedCounty(fips);
      // Find bounds from geojson
      if (geojson) {
        const feature = geojson.features.find(f => String(f.id).padStart(5,'0') === fips);
        if (feature) {
          const layer = L.geoJSON(feature);
          map.fitBounds(layer.getBounds(), { padding: [40, 40] });
          return;
        }
      }
      // Fallback: fly to county centroid via Nominatim
      const c = result.data;
      map.flyTo([c.lat || 35.3, c.lng || -79.5], 10);
    } else if (result.type === 'zip') {
      // Try zip GeoJSON first
      if (zipGeojson) {
        const feature = zipGeojson.features.find(f =>
          (f.properties?.ZCTA5CE10 || f.properties?.zip) === result.data.zip
        );
        if (feature) {
          const layer = L.geoJSON(feature);
          map.fitBounds(layer.getBounds(), { padding: [60, 60] });
          return;
        }
      }
      // Geocode via Nominatim
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${result.data.zip}&countrycodes=us&format=json&limit=1`
        );
        const data = await res.json();
        if (data[0]) map.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 13);
      } catch {}
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchOpen(false);
    const map = leafletMap.current;
    if (!map) return;
    // Try geocoding the address via Nominatim (constrained to NC/SC)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=us&viewbox=-84.5,33.5,-75.5,36.6&bounded=0&format=json&limit=1`
      );
      const data = await res.json();
      if (data[0]) {
        map.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 14);
      }
    } catch {}
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Map + bottom panel */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Search bar */}
        <div className="absolute top-3 left-12 z-[1000]" style={{ width: 260 }}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A5A8]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="Search address, county, or ZIP…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-raised text-[#333638] placeholder-[#A0A5A8] focus:outline-none focus:border-brand-500 shadow-sm"
              />
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-surface-raised border border-surface-border rounded-lg shadow-lg overflow-hidden z-[9999]">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => handleSearchSelect(r)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-surface-overlay flex items-center gap-2"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.type === 'county' ? 'bg-brand-500/10 text-brand-500' : 'bg-surface-overlay text-[#767C80]'}`}>
                      {r.type === 'county' ? 'County' : 'ZIP'}
                    </span>
                    <span className="text-[#333638]">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Layer toggle bar */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1 items-end">
          <div className="card px-3 py-2 flex gap-3 text-xs items-center">
            {/* Basemap toggle */}
            <div className="flex gap-1 border-r border-surface-border pr-3 mr-1">
              <button onClick={() => setMapStyle('light')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${mapStyle === 'light' ? 'bg-brand-500 text-white' : 'text-[#767C80] hover:text-[#333638]'}`}>
                Map
              </button>
              <button onClick={() => setMapStyle('satellite')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${mapStyle === 'satellite' ? 'bg-brand-500 text-white' : 'text-[#767C80] hover:text-[#333638]'}`}>
                Satellite
              </button>
            </div>
            {/* Heat map level toggle */}
            <div className="flex gap-1 border-r border-surface-border pr-3 mr-1">
              <button onClick={() => setHeatLevel('county')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${heatLevel === 'county' ? 'bg-brand-500 text-white' : 'text-[#767C80] hover:text-[#333638]'}`}>
                County
              </button>
              <button onClick={() => setHeatLevel('zip')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${heatLevel === 'zip' ? 'bg-brand-500 text-white' : 'text-[#767C80] hover:text-[#333638]'}`}>
                ZIP
              </button>
            </div>
            {Object.entries({ counties:'Counties', comps:'Comps' }).map(([k,label]) => (
              <label key={k} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={layers[k]}
                  onChange={() => setLayers(p => ({ ...p, [k]: !p[k] }))}
                  className="accent-brand-500 w-3 h-3"
                />
                <span className="text-[#333638]">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-3 z-[1000] card px-3 py-2 text-xs">
          <p className="text-label mb-1.5">{METRIC_CONFIG[filters.metric]?.label}</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full" style={{
              background: 'linear-gradient(to right, #dc2626, #f59e0b, #22c55e)'
            }} />
          </div>
          <div className="flex justify-between mt-1 text-[#A0A5A8]" style={{ width: 96 }}>
            <span>{METRIC_CONFIG[filters.metric]?.higherIsBetter === false ? 'Good' : 'Low'}</span>
            <span>{METRIC_CONFIG[filters.metric]?.higherIsBetter === false ? 'Poor' : 'High'}</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{background: PIPELINE_COLORS.development}} /><span className="text-[#767C80]">Deals</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5" style={{background: PIPELINE_COLORS.land, transform:'rotate(45deg)'}} /><span className="text-[#767C80]">Land Acq.</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded" style={{background: PIPELINE_COLORS.sales}} /><span className="text-[#767C80]">Sales</span></div>
          </div>
        </div>

        {/* Map */}
        <div ref={mapRef} className="flex-1" style={{ zIndex: 0 }} />

      </div>

      {/* Right detail panel */}
      {selectedCounty && (
        <CountyDetail fips={selectedCounty} onClose={() => setSelectedCounty(null)} />
      )}
    </div>
  );
}

function ScoreCell({ v }) {
  if (v == null) return <span className="text-[#A0A5A8]">–</span>;
  const color = v >= 70 ? 'text-green-600' : v >= 45 ? 'text-yellow-600' : 'text-red-500';
  return <span className={`font-semibold tabular-nums ${color}`}>{v.toFixed(0)}</span>;
}
