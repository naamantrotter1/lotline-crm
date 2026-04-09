import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../App';
import api from '../api';

const fmtP   = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';

export default function CompFinder() {
  const { filters } = useContext(AppContext);
  const [comps, setComps]     = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [localFilters, setLocalFilters] = useState({
    state:        filters.state !== 'Both' ? filters.state : '',
    county_fips:  '',
    zip:          '',
    min_price:    '',
    max_price:    '',
    min_acres:    '',
    max_acres:    '',
    property_type: '',
    date_from:    '',
    date_to:      '',
    max_dom:      '',
  });
  const [sort, setSort] = useState({ col: 'close_date', dir: -1 });

  const setF = (k, v) => setLocalFilters(p => ({ ...p, [k]: v }));

  const search = async () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v !== ''));
    try {
      const [data, sum] = await Promise.all([
        api.comps.list({ ...params, limit: 500, sort: sort.col }),
        api.comps.summary(params),
      ]);
      setComps(data.data || []);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  const handleSort = (col) => {
    setSort(p => p.col === col ? { col, dir: -p.dir } : { col, dir: -1 });
  };

  const sorted = [...comps].sort((a, b) => {
    const va = a[sort.col], vb = b[sort.col];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return sort.dir * (va < vb ? -1 : 1);
  });

  const toggleRow = (id) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const exportSelected = () => {
    const rows = selected.size > 0 ? comps.filter(c => selected.has(c.id)) : comps;
    const cols = ['county_name','state','zip_code','address','sale_price','list_price','acreage','price_per_acre','bedrooms','bathrooms','sqft','days_on_market','close_date','list_to_sale_ratio','property_type'];
    const csv  = [cols, ...rows.map(r => cols.map(c => r[c] ?? ''))].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'lotline-comps.csv';
    a.click();
  };

  const inputCls = "w-full bg-crm-sidebar-hover border border-crm-sidebar-border rounded-lg px-2 py-1.5 text-sm text-crm-sidebar-text placeholder-crm-sidebar-muted focus:outline-none focus:border-brand-500";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Filter sidebar */}
      <aside className="w-56 flex-shrink-0 bg-crm-sidebar border-r border-crm-sidebar-border p-3 space-y-4 overflow-y-auto scrollbar-thin">
        <h2 className="text-xs font-semibold text-crm-sidebar-muted uppercase tracking-wider">Comp Filters</h2>

        {[
          { label: 'State',         key: 'state',        placeholder: 'NC or SC' },
          { label: 'County FIPS',   key: 'county_fips',  placeholder: '37061' },
          { label: 'ZIP Code',      key: 'zip',          placeholder: '28328' },
          { label: 'Min Price',     key: 'min_price',    placeholder: '$150,000' },
          { label: 'Max Price',     key: 'max_price',    placeholder: '$300,000' },
          { label: 'Min Acres',     key: 'min_acres',    placeholder: '1' },
          { label: 'Max Acres',     key: 'max_acres',    placeholder: '5' },
          { label: 'From Date',     key: 'date_from',    placeholder: '2024-01-01', type: 'date' },
          { label: 'To Date',       key: 'date_to',      placeholder: '2025-12-31', type: 'date' },
          { label: 'Max DOM',       key: 'max_dom',      placeholder: '180' },
        ].map(({ label, key, placeholder, type = 'text' }) => (
          <div key={key}>
            <label className="text-xs text-crm-sidebar-muted uppercase tracking-wide block mb-1">{label}</label>
            <input
              type={type} value={localFilters[key]}
              onChange={e => setF(key, e.target.value)}
              placeholder={placeholder}
              className={inputCls}
            />
          </div>
        ))}

        <div>
          <label className="text-xs text-crm-sidebar-muted uppercase tracking-wide block mb-1">Property Type</label>
          <div className="px-2 py-1.5 bg-crm-sidebar-hover rounded-lg text-sm text-crm-sidebar-text border border-crm-sidebar-border">
            Manufactured Homes
          </div>
        </div>

        <button onClick={search} className="btn-primary w-full justify-center">Search Comps</button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-base">
        {/* Summary cards */}
        {summary && (
          <div className="flex-shrink-0 grid grid-cols-6 gap-3 p-3 border-b border-surface-border bg-surface-raised">
            <SummaryCard label="Total Sales"   value={Number(summary.total_sales).toLocaleString()} />
            <SummaryCard label="Median Price"  value={fmtP(summary.median_sale_price)} />
            <SummaryCard label="Median DOM"    value={`${Math.round(summary.median_dom ?? 0)}d`} />
            <SummaryCard label="Median $/Acre" value={fmtP(summary.median_ppa)} />
            <SummaryCard label="Median L/S"    value={fmtPct(summary.median_lts)} />
            <SummaryCard label="Med Acreage"   value={`${Number(summary.median_acreage || 0).toFixed(1)} ac`} />
          </div>
        )}

        {/* Table toolbar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2 border-b border-surface-border bg-surface-base">
          <span className="text-xs text-[#767C80]">{sorted.length} comps</span>
          {selected.size > 0 && <span className="text-xs text-brand-500">{selected.size} selected</span>}
          <div className="ml-auto flex gap-2">
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs">Clear Selection</button>
            )}
            <button onClick={exportSelected} className="btn-ghost text-xs">
              {selected.size > 0 ? `Export ${selected.size}` : 'Export All'} CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#767C80] text-sm">Searching...</div>
          ) : (
            <table className="data-table w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left w-8 bg-surface-raised"><input type="checkbox" className="accent-brand-500"
                    onChange={e => setSelected(e.target.checked ? new Set(comps.map(c => c.id)) : new Set())}
                  /></th>
                  {[
                    ['county_name','County'],['close_date','Close Date'],['sale_price','Sale Price'],
                    ['list_price','List Price'],['acreage','Acres'],['price_per_acre','$/Acre'],
                    ['bedrooms','Beds'],['sqft','SqFt'],['days_on_market','DOM'],
                    ['list_to_sale_ratio','L/S%'],['property_type','Type'],
                  ].map(([col, lbl]) => (
                    <th key={col} onClick={() => handleSort(col)}
                      className={`cursor-pointer hover:text-[#333638] whitespace-nowrap ${sort.col === col ? 'text-brand-500' : ''}`}>
                      {lbl} {sort.col === col ? (sort.dir === 1 ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => (
                  <tr key={c.id} onClick={() => toggleRow(c.id)}
                    className={`cursor-pointer ${selected.has(c.id) ? 'bg-brand-500/10' : ''}`}>
                    <td><input type="checkbox" className="accent-brand-500" readOnly checked={selected.has(c.id)} /></td>
                    <td className="whitespace-nowrap font-medium text-[#333638]">{c.county_name}, {c.state}</td>
                    <td className="whitespace-nowrap">{c.close_date?.slice(0, 10)}</td>
                    <td className="tabular-nums font-semibold text-[#333638]">{fmtP(c.sale_price)}</td>
                    <td className="tabular-nums text-[#767C80]">{fmtP(c.list_price)}</td>
                    <td className="tabular-nums">{Number(c.acreage).toFixed(2)}</td>
                    <td className="tabular-nums">{fmtP(c.price_per_acre)}</td>
                    <td className="tabular-nums">{c.bedrooms}</td>
                    <td className="tabular-nums">{c.sqft?.toLocaleString()}</td>
                    <td className="tabular-nums">
                      <span className={c.days_on_market > 120 ? 'text-red-500' : c.days_on_market > 60 ? 'text-yellow-600' : 'text-green-600'}>
                        {c.days_on_market}d
                      </span>
                    </td>
                    <td className="tabular-nums">
                      <span className={Number(c.list_to_sale_ratio) >= 98 ? 'text-green-600' : 'text-[#767C80]'}>
                        {fmtPct(c.list_to_sale_ratio)}
                      </span>
                    </td>
                    <td className="text-[#767C80] whitespace-nowrap">{c.property_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="stat-card">
      <p className="text-label">{label}</p>
      <p className="text-value text-lg">{value}</p>
    </div>
  );
}
