import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../App';

const STATUSES = [
  { value: 'for_sale', label: 'For Sale' },
  { value: 'sold',     label: 'Sold' },
];

const PERIODS = [
  { value: '7d',  label: '7 Days' },
  { value: '14d', label: '14 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6mo', label: '6 Months' },
  { value: '1yr', label: '1 Year' },
  { value: '2yr', label: '2 Years' },
  { value: '3yr', label: '3 Years' },
  { value: '5yr', label: '5 Years' },
];

const DATA_TYPES = [
  { value: 'All',                label: 'All' },
  { value: 'Manufactured Homes', label: 'Manufactured' },
  { value: 'Single Family',      label: 'Single Family' },
  { value: 'Land',               label: 'Land' },
];

const ACREAGE_OPTS = [
  { value: 'All',     label: 'All' },
  { value: '0-1',     label: '0–1 acres' },
  { value: '1-2',     label: '1–2 acres' },
  { value: '2-5',     label: '2–5 acres' },
  { value: '5-10',    label: '5–10 acres' },
  { value: '10-20',   label: '10–20 acres' },
  { value: '20-50',   label: '20–50 acres' },
  { value: '50-70',   label: '50–70 acres' },
  { value: '70-100',  label: '70–100 acres' },
  { value: '100-150', label: '100–150 acres' },
  { value: '150+',    label: '150+ acres' },
];

const METRICS = [
  { value: 'median_sale_price',      label: 'Median Price' },
  { value: 'median_price_per_acre',  label: 'Median Price/Acre' },
  { value: 'median_days_on_market',  label: 'Days on Market' },
  { value: 'sell_through_rate_pct',  label: 'Sell Through Rate (STR)' },
  { value: 'absorption_rate_pct',    label: 'Absorption Rate' },
  { value: 'months_of_supply',       label: 'Months of Supply' },
];

const METRIC_INFO = {
  median_sale_price: {
    title: 'Median Sale Price',
    description: 'The middle sale price of all properties that closed in the selected time period. Half of sales occurred above this price, half below. Best used to gauge overall market price levels.',
  },
  median_price_per_acre: {
    title: 'Median Price Per Acre',
    description: 'The middle price-per-acre across all sold properties in the period. Normalizes for lot size, making it easier to compare value across counties with different average parcel sizes.',
  },
  median_days_on_market: {
    title: 'Days on Market (DOM)',
    description: 'The median number of days properties sat on the market before going under contract. Lower DOM = faster-moving market. High DOM may indicate overpricing or weak demand.',
  },
  sell_through_rate_pct: {
    title: 'Sell Through Rate (STR)',
    description: 'The percentage of listed properties that actually sold versus expired or were withdrawn. A high STR (80%+) signals strong demand. A low STR means many listings are failing to sell.',
  },
  absorption_rate_pct: {
    title: 'Absorption Rate',
    description: 'The percentage of total available properties (active listings + sold) that were purchased in the period. Higher absorption = more competitive market. Above 20% typically indicates a seller\'s market.',
  },
  months_of_supply: {
    title: 'Months of Supply (MOS)',
    description: 'At the current sales pace, how many months it would take to sell all active inventory. Under 6 months = seller\'s market. Over 6 months = buyer\'s market. Under 3 months = very hot market.',
  },
};

const STATES = ['Both', 'NC', 'SC'];

const MAP_LAYER_OPTS = [
  { value: 'deals',          label: 'Deals' },
  { value: 'landAcquisition',label: 'Land Acquisition' },
  { value: 'activeListings', label: 'Active Listings' },
];

export default function TopFilterBar({ onExport }) {
  const { filters, setFilters, mapLayers, setMapLayers } = useContext(AppContext);
  const set = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const toggleLayer = (key) => setMapLayers(p => ({ ...p, [key]: !p[key] }));

  const activeLayerCount = Object.values(mapLayers || {}).filter(Boolean).length;
  const layersLabel = activeLayerCount === MAP_LAYER_OPTS.length ? 'All' : activeLayerCount === 0 ? 'None' : `${activeLayerCount} Active`;
  const statusLabel  = STATUSES.find(s => s.value === (filters.listingStatus || 'for_sale'))?.label ?? 'For Sale';
  const periodLabel  = PERIODS.find(p => p.value === filters.period)?.label ?? '90 Days';
  const dataLabel    = DATA_TYPES.find(d => d.value === filters.propertyType)?.label ?? 'All';
  const acreageLabel = ACREAGE_OPTS.find(a => a.value === filters.acreageRange)?.label ?? 'All';
  const metricLabel  = METRICS.find(m => m.value === filters.metric)?.label ?? 'Median Price';

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-surface-raised border-b border-surface-border">

      {/* State toggle */}
      <div className="flex gap-0.5 bg-surface-overlay rounded-lg p-0.5 flex-shrink-0">
        {STATES.map(s => (
          <button key={s} onClick={() => set('state', s)}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              filters.state === s
                ? 'bg-brand-500 text-white'
                : 'text-[#767C80] hover:text-[#333638]'
            }`}>
            {s}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-surface-border flex-shrink-0" />

      <FilterDropdown
        label="Status"
        value={statusLabel}
        options={STATUSES}
        selected={filters.listingStatus || 'for_sale'}
        onSelect={v => set('listingStatus', v)}
      />

      <FilterDropdown
        label="Time"
        value={periodLabel}
        options={PERIODS}
        selected={filters.period}
        onSelect={v => set('period', v)}
      />

      <FilterDropdown
        label="Data"
        value={dataLabel}
        options={DATA_TYPES}
        selected={filters.propertyType}
        onSelect={v => set('propertyType', v)}
      />

      <FilterDropdown
        label="Acreages"
        value={acreageLabel}
        options={ACREAGE_OPTS}
        selected={filters.acreageRange}
        onSelect={v => set('acreageRange', v)}
      />

      <FilterDropdown
        label="Statistics"
        value={metricLabel}
        options={METRICS}
        selected={filters.metric}
        onSelect={v => set('metric', v)}
      />
      <InfoButton metric={filters.metric} />

      <div className="h-5 w-px bg-surface-border flex-shrink-0" />

      <LayersDropdown
        label="Pipeline"
        value={layersLabel}
        options={MAP_LAYER_OPTS}
        layers={mapLayers || {}}
        onToggle={toggleLayer}
      />

      {onExport && (
        <>
          <div className="h-5 w-px bg-surface-border flex-shrink-0 ml-auto" />
          <button onClick={onExport}
            className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium border border-surface-border text-[#767C80] hover:text-[#333638] hover:border-brand-500 transition-colors">
            Export CSV
          </button>
        </>
      )}
    </div>
  );
}

function FilterDropdown({ label, value, options, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
          open
            ? 'bg-brand-500 text-white border-brand-500'
            : 'bg-surface-base text-[#333638] border-surface-border hover:border-brand-500 hover:text-brand-500'
        }`}
      >
        <span className={`font-normal ${open ? 'text-white/70' : 'text-[#A0A5A8]'}`}>{label}:</span>
        <span className="font-semibold">{value}</span>
        <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-surface-raised border border-surface-border rounded-xl shadow-lg min-w-[170px] py-1 overflow-y-auto max-h-72"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onSelect(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${
                selected === opt.value
                  ? 'bg-brand-500/10 text-brand-500 font-semibold'
                  : 'text-[#333638] hover:bg-surface-overlay'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selected === opt.value ? 'bg-brand-500' : ''}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoButton({ metric }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const info = METRIC_INFO[metric];
  if (!info) return null;

  const handleEnter = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      // Anchor tooltip's right edge to button's right edge
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setVisible(true);
  };

  return (
    <div className="flex-shrink-0">
      <button
        ref={btnRef}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
        className="w-5 h-5 rounded-full border border-surface-border bg-surface-base text-[#A0A5A8] hover:border-brand-500 hover:text-brand-500 flex items-center justify-center transition-colors text-[10px] font-bold"
        aria-label="Statistic info"
      >
        i
      </button>
      {visible && (
        <div
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, width: 288 }}
          className="bg-[#1e2124] text-white rounded-xl shadow-xl px-4 py-3 pointer-events-none"
        >
          <div style={{ position: 'absolute', top: -6, right: 4, width: 12, height: 12,
            background: '#1e2124', transform: 'rotate(45deg)' }} />
          <p className="text-xs font-semibold text-white mb-1.5 relative">{info.title}</p>
          <p className="text-xs text-white/70 leading-relaxed relative">{info.description}</p>
        </div>
      )}
    </div>
  );
}

function LayersDropdown({ label, value, options, layers, onToggle }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
          open
            ? 'bg-brand-500 text-white border-brand-500'
            : 'bg-surface-base text-[#333638] border-surface-border hover:border-brand-500 hover:text-brand-500'
        }`}
      >
        <span className={`font-normal ${open ? 'text-white/70' : 'text-[#A0A5A8]'}`}>{label}:</span>
        <span className="font-semibold">{value}</span>
        <svg className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-surface-raised border border-surface-border rounded-xl shadow-lg min-w-[180px] py-1"
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2.5 hover:bg-surface-overlay"
            >
              <span className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${
                layers[opt.value] ? 'bg-brand-500 border-brand-500' : 'border-surface-border bg-surface-base'
              }`}>
                {layers[opt.value] && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span className={layers[opt.value] ? 'text-[#333638] font-medium' : 'text-[#767C80]'}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
