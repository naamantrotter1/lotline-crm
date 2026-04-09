import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App';
import api from '../api';

const fmt    = (n, d = 0) => n == null ? '–' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
const fmtP   = (n) => n == null ? '–' : '$' + Math.round(n / 1000) + 'k';
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';

const PERIODS = ['30d','90d','6mo','1yr','2yr'];
const SORT_COLS = [
  { key: 'name',                   label: 'County' },
  { key: 'opportunity_score',     label: 'Opp Score' },
  { key: 'demand_score',          label: 'Demand' },
  { key: 'months_of_supply',      label: 'Months Supply' },
  { key: 'absorption_rate_pct',   label: 'Abs Rate' },
  { key: 'median_sale_price',     label: 'Med Sale' },
  { key: 'median_list_price',     label: 'Med List' },
  { key: 'median_days_on_market', label: 'DOM' },
  { key: 'sell_through_rate_pct', label: 'Sell Thru' },
  { key: 'list_to_sale_ratio_pct',label: 'L/S Ratio' },
  { key: 'active_listings',       label: 'Active' },
  { key: 'sold_count',            label: 'Sold' },
  { key: 'growth_pct',            label: 'Pop Growth' },
  { key: 'median_income',         label: 'Med Income' },
  { key: 'unemployment_rate',     label: 'Unemp' },
];

const btnBase = 'px-2 py-1 text-xs rounded font-medium transition-colors';
const btnActive = `${btnBase} bg-brand-500 text-white`;
const btnInactive = `${btnBase} bg-surface-overlay text-[#767C80] hover:text-[#333638]`;

export default function MarketStats() {
  const { filters, setFilters } = useContext(AppContext);
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]   = useState({ col: 'opportunity_score', dir: -1 });
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.stats.counties({
      period: filters.period,
      state: filters.state !== 'Both' ? filters.state : undefined,
    }).then(r => {
      setData(r.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filters.period, filters.state]);

  const handleSort = (col) => setSort(p => p.col === col ? { col, dir: -p.dir } : { col, dir: -1 });

  const exportCsv = () => {
    const cols = SORT_COLS.map(c => c.key);
    const rows = [SORT_COLS.map(c => c.label), ...filtered.map(r => cols.map(c => r[c] ?? ''))];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `lotline-market-stats-${filters.period}.csv`;
    a.click();
  };

  const filtered = data
    .filter(r => !search || r.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = a[sort.col], vb = b[sort.col];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sort.dir * (va < vb ? -1 : va > vb ? 1 : 0);
    });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-raised">
        <h1 className="font-bold text-[#333638]">Market Stats Table</h1>

        {/* State */}
        <div className="flex gap-1 ml-4">
          {['Both','NC','SC'].map(s => (
            <button key={s} onClick={() => setFilters(f => ({ ...f, state: s }))}
              className={filters.state === s ? btnActive : btnInactive}>
              {s}
            </button>
          ))}
        </div>

        {/* Period */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setFilters(f => ({ ...f, period: p }))}
              className={filters.period === p ? btnActive : btnInactive}>
              {p}
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter county..."
          className="ml-auto bg-surface-base border border-surface-border rounded-lg px-3 py-1 text-sm text-[#333638] placeholder-[#A0A5A8] focus:outline-none focus:border-brand-500 w-40"
        />

        <button onClick={exportCsv} className="btn-ghost text-xs">Export CSV</button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[#767C80]">Loading...</div>
        ) : (
          <table className="data-table w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {SORT_COLS.map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    className={`cursor-pointer hover:text-[#333638] whitespace-nowrap ${sort.col === key ? 'text-brand-500' : ''}`}>
                    {label} {sort.col === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th>MH Zone</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.fips_code} className="cursor-pointer">
                  <td className="font-medium text-[#333638] whitespace-nowrap">
                    {r.name}
                  </td>
                  <td><ScoreCell v={r.opportunity_score} /></td>
                  <td><ScoreCell v={r.demand_score} /></td>
                  <td className="tabular-nums">{r.months_of_supply?.toFixed(1)}</td>
                  <td className="tabular-nums">{fmtPct(r.absorption_rate_pct)}</td>
                  <td className="tabular-nums">{fmtP(r.median_sale_price)}</td>
                  <td className="tabular-nums">{fmtP(r.median_list_price)}</td>
                  <td className="tabular-nums">{r.median_days_on_market?.toFixed(0)}d</td>
                  <td className="tabular-nums">{fmtPct(r.sell_through_rate_pct)}</td>
                  <td className="tabular-nums">{fmtPct(r.list_to_sale_ratio_pct)}</td>
                  <td className="tabular-nums">{r.active_listings}</td>
                  <td className="tabular-nums">{r.sold_count}</td>
                  <td className="tabular-nums">
                    <span className={r.growth_pct >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {fmtPct(r.growth_pct)}
                    </span>
                  </td>
                  <td className="tabular-nums">{fmtP(r.median_income)}</td>
                  <td className="tabular-nums">{fmtPct(r.unemployment_rate)}</td>
                  <td>
                    {r.mh_friendly_zoning
                      ? <span className="badge badge-green">Yes</span>
                      : <span className="badge badge-gray">No</span>}
                  </td>
                  <td>
                    {r.priority_market
                      ? <span className="badge badge-blue">★</span>
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-surface-border text-xs text-[#767C80] bg-surface-raised">
        {filtered.length} of {data.length} counties · {filters.period} period
      </div>
    </div>
  );
}

function ScoreCell({ v }) {
  if (v == null) return <span className="text-[#A0A5A8]">–</span>;
  const color = v >= 70 ? 'text-green-600' : v >= 45 ? 'text-yellow-600' : 'text-red-500';
  return <span className={`font-bold tabular-nums ${color}`}>{v.toFixed(0)}</span>;
}
