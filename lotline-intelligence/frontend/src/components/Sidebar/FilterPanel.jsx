import React, { useContext } from 'react';
import { AppContext } from '../../App';

const PERIODS     = ['30d','90d','6mo','1yr','2yr'];
const METRICS     = [
  { value: 'opportunity_score',  label: 'Opportunity Score' },
  { value: 'demand_score',       label: 'Demand Score' },
  { value: 'months_of_supply',   label: 'Months of Supply' },
  { value: 'absorption_rate_pct',label: 'Absorption Rate' },
  { value: 'median_sale_price',  label: 'Median Price' },
  { value: 'median_days_on_market', label: 'Days on Market' },
  { value: 'sell_through_rate_pct', label: 'Sell Through Rate' },
  { value: 'population_growth_pct', label: 'Population Growth' },
  { value: 'median_income',      label: 'Median Income' },
];
const ACREAGE_OPTS = ['All','0-1','1-2','2-5','5-10','10+'];
const STATES       = ['Both','NC','SC'];

export default function FilterPanel({ onExport }) {
  const { filters, setFilters } = useContext(AppContext);

  const set = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <aside className="w-64 flex-shrink-0 bg-crm-sidebar border-r border-crm-sidebar-border flex flex-col overflow-y-auto scrollbar-thin">
      <div className="p-3 border-b border-crm-sidebar-border">
        <h2 className="text-xs font-semibold text-crm-sidebar-muted uppercase tracking-wider">Filters</h2>
      </div>

      <div className="flex-1 p-3 space-y-5">
        {/* State */}
        <FilterGroup label="State">
          <div className="flex gap-1">
            {STATES.map(s => (
              <button key={s}
                onClick={() => set('state', s)}
                className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                  filters.state === s
                    ? 'bg-brand-500 text-white'
                    : 'bg-crm-sidebar-hover text-crm-sidebar-muted hover:text-crm-sidebar-text'
                }`}
              >{s}</button>
            ))}
          </div>
        </FilterGroup>

        {/* Metric */}
        <FilterGroup label="Choropleth Metric">
          <select
            value={filters.metric}
            onChange={e => set('metric', e.target.value)}
            className="w-full bg-crm-sidebar-hover border border-crm-sidebar-border rounded-lg px-2 py-1.5 text-sm text-crm-sidebar-text focus:outline-none focus:border-brand-500"
          >
            {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </FilterGroup>

        {/* Period */}
        <FilterGroup label="Time Period">
          <div className="flex gap-1 flex-wrap">
            {PERIODS.map(p => (
              <button key={p}
                onClick={() => set('period', p)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  filters.period === p
                    ? 'bg-brand-500 text-white'
                    : 'bg-crm-sidebar-hover text-crm-sidebar-muted hover:text-crm-sidebar-text'
                }`}
              >{p}</button>
            ))}
          </div>
        </FilterGroup>

        {/* Acreage */}
        <FilterGroup label="Acreage Range">
          <div className="grid grid-cols-3 gap-1">
            {ACREAGE_OPTS.map(a => (
              <button key={a}
                onClick={() => set('acreageRange', a)}
                className={`py-1 text-xs rounded font-medium transition-colors ${
                  filters.acreageRange === a
                    ? 'bg-brand-500 text-white'
                    : 'bg-crm-sidebar-hover text-crm-sidebar-muted hover:text-crm-sidebar-text'
                }`}
              >{a}</button>
            ))}
          </div>
        </FilterGroup>

        {/* Property type */}
        <FilterGroup label="Property Type">
          <div className="px-2 py-1.5 bg-crm-sidebar-hover rounded-lg text-sm text-crm-sidebar-text border border-crm-sidebar-border">
            Manufactured Homes
          </div>
        </FilterGroup>

        {/* Price range */}
        <FilterGroup label={`Price Range: $${(filters.minPrice/1000).toFixed(0)}k – $${(filters.maxPrice/1000).toFixed(0)}k`}>
          <div className="space-y-2">
            <input type="range" min={0} max={500000} step={10000}
              value={filters.maxPrice}
              onChange={e => set('maxPrice', Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </FilterGroup>

        {/* Active filter badges */}
        <ActiveBadges filters={filters} set={set} />
      </div>

      {/* Export */}
      <div className="p-3 border-t border-crm-sidebar-border">
        <button onClick={onExport}
          className="w-full py-1.5 text-xs rounded font-medium bg-crm-sidebar-hover text-crm-sidebar-muted hover:text-crm-sidebar-text border border-crm-sidebar-border transition-colors">
          Export CSV
        </button>
      </div>
    </aside>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-crm-sidebar-muted uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function ActiveBadges({ filters, set }) {
  const badges = [];
  if (filters.state !== 'Both')         badges.push({ label: filters.state, key: 'state', reset: 'Both' });
  if (filters.acreageRange !== 'All')   badges.push({ label: filters.acreageRange + ' ac', key: 'acreageRange', reset: 'All' });
  if (filters.maxPrice < 500000)        badges.push({ label: `<$${filters.maxPrice/1000}k`, key: 'maxPrice', reset: 500000 });

  if (!badges.length) return null;

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-crm-sidebar-muted uppercase tracking-wide">Active Filters</label>
      <div className="flex flex-wrap gap-1">
        {badges.map(b => (
          <button key={b.key}
            onClick={() => set(b.key, b.reset)}
            className="px-2 py-0.5 rounded-full text-xs bg-brand-500/20 text-brand-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            {b.label} ×
          </button>
        ))}
      </div>
    </div>
  );
}
