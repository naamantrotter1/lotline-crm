import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import api from '../api';

const fmt    = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';
const fmtK   = (n) => n == null ? '–' : (n >= 1000 ? (n/1000).toFixed(0) + 'k' : n);

const btnBase = 'px-2 py-1 text-xs rounded font-medium transition-colors';
const btnActive = `${btnBase} bg-brand-500 text-white`;
const btnInactive = `${btnBase} bg-surface-overlay text-[#767C80] hover:text-[#333638]`;

export default function Reports() {
  const { filters } = useContext(AppContext);
  const [rankings, setRankings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('90d');
  const [state,    setState]    = useState('Both');
  const [selected, setSelected] = useState(null);
  const [report,   setReport]   = useState(null);

  useEffect(() => {
    setLoading(true);
    api.reports.bestMarkets({
      period,
      state: state !== 'Both' ? state : undefined,
    }).then(r => {
      setRankings(r.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, state]);

  const loadReport = (fips) => {
    setSelected(fips);
    api.reports.county(fips, { period })
      .then(setReport)
      .catch(() => setReport(null));
  };

  const exportCsv = () => {
    const cols = ['rank','county','state','opportunity_score','demand_score','months_of_supply',
      'absorption_rate_pct','median_sale_price','median_days_on_market','active_listings','sold_count',
      'growth_pct','median_income','mh_friendly_zoning','priority_market'];
    const csv = [cols, ...rankings.map(r => cols.map(c => r[c] ?? ''))].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `lotline-best-markets-${period}.csv`;
    a.click();
  };

  const scoreColor = (s) => s >= 70 ? 'text-green-600' : s >= 45 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="flex h-full overflow-hidden bg-surface-base">
      {/* Rankings list */}
      <div className="flex flex-col w-[560px] flex-shrink-0 border-r border-surface-border">
        {/* Toolbar */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-raised">
          <h1 className="font-bold text-[#333638]">Best Markets</h1>
          <div className="flex gap-1">
            {['30d','90d','6mo','1yr'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={period === p ? btnActive : btnInactive}>
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {['Both','NC','SC'].map(s => (
              <button key={s} onClick={() => setState(s)}
                className={state === s ? btnActive : btnInactive}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="btn-ghost text-xs ml-auto">Export CSV</button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#767C80]">Loading...</div>
          ) : (
            <table className="data-table w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left w-8">#</th>
                  <th className="text-left">County</th>
                  <th>Opp Score</th>
                  <th>Mo Supply</th>
                  <th>Med Price</th>
                  <th>DOM</th>
                  <th>Growth</th>
                  <th>Income</th>
                  <th>MH Zone</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map(r => (
                  <tr key={r.fips_code}
                    onClick={() => loadReport(r.fips_code)}
                    className={`cursor-pointer ${selected === r.fips_code ? 'bg-brand-500/10' : ''}`}>
                    <td className="text-[#A0A5A8] font-mono">{r.rank}</td>
                    <td className="font-medium text-[#333638] whitespace-nowrap">
                      {r.county}
                      <span className="ml-1 text-[#767C80]">{r.state}</span>
                      {r.priority_market && <span className="ml-1 text-brand-500">★</span>}
                    </td>
                    <td><span className={`font-bold tabular-nums ${scoreColor(r.opportunity_score)}`}>{r.opportunity_score?.toFixed(0)}</span></td>
                    <td className="tabular-nums">{r.months_of_supply?.toFixed(1)}</td>
                    <td className="tabular-nums">{r.median_sale_price ? '$' + Math.round(r.median_sale_price/1000) + 'k' : '–'}</td>
                    <td className="tabular-nums">{r.median_days_on_market?.toFixed(0)}d</td>
                    <td className="tabular-nums">
                      <span className={r.growth_pct >= 0 ? 'text-green-600' : 'text-red-500'}>{fmtPct(r.growth_pct)}</span>
                    </td>
                    <td className="tabular-nums">${fmtK(r.median_income)}</td>
                    <td>{r.mh_friendly_zoning ? <span className="badge badge-green">Yes</span> : <span className="badge badge-gray">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* County report detail */}
      <div className="flex-1 overflow-auto scrollbar-thin p-4">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#A0A5A8]">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-sm">Click a county to view its market report</p>
          </div>
        ) : !report ? (
          <div className="flex items-center justify-center h-32 text-[#767C80]">Loading report...</div>
        ) : (
          <CountyReport report={report} period={period} />
        )}
      </div>
    </div>
  );
}

function CountyReport({ report, period }) {
  const c   = report.county;
  const cs  = report.current_stats;
  const scoreColor = (s) => s >= 70 ? 'text-green-600' : s >= 45 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#333638]">{c.name} County, {c.state}</h2>
          <p className="text-[#767C80] text-sm mt-0.5">Market Report · {period} period · Generated {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          {c.mh_friendly_zoning && <span className="badge badge-green">MH Friendly</span>}
          {c.priority_market    && <span className="badge badge-blue">★ Priority</span>}
        </div>
      </div>

      {/* Score cards */}
      {cs && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-label">LotLine Opportunity Score</p>
            <p className={`text-5xl font-black tabular-nums mt-2 ${scoreColor(cs.opportunity_score)}`}>
              {cs.opportunity_score?.toFixed(0)}
            </p>
            <div className="h-2 bg-surface-border rounded-full mt-3 overflow-hidden">
              <div className={`h-full rounded-full ${cs.opportunity_score >= 70 ? 'bg-green-500' : cs.opportunity_score >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${cs.opportunity_score}%` }} />
            </div>
          </div>
          <div className="card p-4">
            <p className="text-label">Demand Score</p>
            <p className={`text-5xl font-black tabular-nums mt-2 ${scoreColor(cs.demand_score)}`}>
              {cs.demand_score?.toFixed(0)}
            </p>
            <div className="h-2 bg-surface-border rounded-full mt-3 overflow-hidden">
              <div className={`h-full rounded-full ${cs.demand_score >= 70 ? 'bg-green-500' : cs.demand_score >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${cs.demand_score}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* All periods */}
      {report.stats?.length > 0 && (
        <div className="card p-4">
          <h3 className="text-label mb-3">Market Metrics by Period</h3>
          <table className="data-table w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">Period</th>
                <th>Active</th>
                <th>Sold</th>
                <th>Med Price</th>
                <th>Mo Supply</th>
                <th>Abs Rate</th>
                <th>DOM</th>
                <th>L/S</th>
                <th>Opp</th>
              </tr>
            </thead>
            <tbody>
              {report.stats.map(s => (
                <tr key={s.period} className={s.period === period ? 'bg-brand-500/10' : ''}>
                  <td className="font-mono font-medium">{s.period}</td>
                  <td className="tabular-nums">{s.active_listings}</td>
                  <td className="tabular-nums">{s.sold_count}</td>
                  <td className="tabular-nums">{s.median_sale_price ? '$' + Math.round(s.median_sale_price/1000) + 'k' : '–'}</td>
                  <td className="tabular-nums">{s.months_of_supply?.toFixed(1)}</td>
                  <td className="tabular-nums">{fmtPct(s.absorption_rate_pct)}</td>
                  <td className="tabular-nums">{s.median_days_on_market?.toFixed(0)}d</td>
                  <td className="tabular-nums">{fmtPct(s.list_to_sale_ratio_pct)}</td>
                  <td><span className={`font-bold tabular-nums ${scoreColor(s.opportunity_score)}`}>{s.opportunity_score?.toFixed(0)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Demographics */}
      <div className="card p-4">
        <h3 className="text-label mb-3">Demographics</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            ['Population',    c.population?.toLocaleString()],
            ['Pop Growth',    fmtPct(c.population_growth_pct)],
            ['Median Income', fmt(c.median_household_income)],
            ['Median HV',     fmt(c.median_home_value)],
            ['Unemployment',  fmtPct(c.unemployment_rate)],
            ['Flood Risk',    fmtPct(c.flood_risk_pct)],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface-overlay rounded-lg p-3">
              <p className="text-label text-[10px]">{label}</p>
              <p className="font-semibold text-[#333638] mt-1 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparable markets */}
      {report.comparable_markets?.length > 0 && (
        <div className="card p-4">
          <h3 className="text-label mb-3">Comparable {c.state} Markets</h3>
          <div className="space-y-2">
            {report.comparable_markets.map(m => (
              <div key={m.fips_code} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0 text-sm">
                <span className="text-[#333638]">{m.name}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[#767C80]">{m.median_sale_price ? '$' + Math.round(m.median_sale_price/1000) + 'k' : '–'}</span>
                  <span className="text-[#767C80]">{m.months_of_supply?.toFixed(1)} mo</span>
                  <span className={`font-bold tabular-nums ${scoreColor(m.opportunity_score)}`}>{m.opportunity_score?.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
