import React, { useEffect, useState } from 'react';
import { TrendChart } from '../Charts/TrendChart';
import api from '../../api';

const fmt  = (n, d = 0) => n == null ? '–' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
const fmtP = (n) => n == null ? '–' : '$' + Math.round(n / 1000) + 'k';
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';
const scoreColor = (s) => s >= 70 ? 'text-green-600' : s >= 45 ? 'text-yellow-600' : 'text-red-500';
const scoreBg    = (s) => s >= 70 ? 'bg-green-500' : s >= 45 ? 'bg-yellow-500' : 'bg-red-500';

const STATUS_COLORS = {
  prospecting:          'badge-gray',
  due_diligence:        'badge-blue',
  under_contract:       'badge-yellow',
  permit_pending:       'badge-yellow',
  home_ordered:         'badge-blue',
  home_installed:       'badge-blue',
  listed:               'badge-green',
  under_contract_sale:  'badge-green',
  closed:               'badge-gray',
  dead:                 'badge-red',
};

export default function CountyDetail({ fips, onClose }) {
  const [data, setData]   = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fips) return;
    setLoading(true);
    Promise.all([
      api.counties.get(fips),
      api.counties.trend(fips),
    ]).then(([d, t]) => {
      setData(d);
      setTrend(t?.data || []);
    }).finally(() => setLoading(false));
  }, [fips]);

  if (!fips) return null;

  const stat90d = data?.stats?.find(s => s.period === '90d');
  const c = data?.county;

  return (
    <aside className="w-96 flex-shrink-0 bg-surface-base border-l border-surface-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-raised">
        {c ? (
          <div>
            <h2 className="font-bold text-[#333638] text-base">{c.name} County</h2>
            <p className="text-xs text-[#767C80]">{c.state} · FIPS {c.fips_code}</p>
          </div>
        ) : <div className="h-8 w-32 bg-surface-overlay animate-pulse rounded" />}
        <button onClick={onClose} className="text-[#767C80] hover:text-[#333638] text-xl leading-none">×</button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-[#767C80] text-sm">Loading...</div>
      )}

      {!loading && data && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Scores */}
          {stat90d && (
            <div className="p-4 grid grid-cols-2 gap-3 border-b border-surface-border">
              <ScoreCard label="LotLine Score" value={stat90d.opportunity_score} />
              <ScoreCard label="Demand Score"  value={stat90d.demand_score} />
            </div>
          )}

          {/* Key metrics grid */}
          {stat90d && (
            <div className="p-4 grid grid-cols-2 gap-3 border-b border-surface-border">
              <MetricCard label="Months of Supply"  value={fmt(stat90d.months_of_supply, 1)} sub="90d" />
              <MetricCard label="Absorption Rate"   value={fmtPct(stat90d.absorption_rate_pct)} sub="90d" />
              <MetricCard label="Median Sale Price"  value={fmtP(stat90d.median_sale_price)} sub="90d" />
              <MetricCard label="Days on Market"    value={fmt(stat90d.median_days_on_market, 0) + 'd'} sub="median" />
              <MetricCard label="Sell Through"      value={fmtPct(stat90d.sell_through_rate_pct)} sub="90d" />
              <MetricCard label="List-to-Sale"      value={fmtPct(stat90d.list_to_sale_ratio_pct)} sub="90d" />
              <MetricCard label="Active Listings"   value={fmt(stat90d.active_listings)} sub="current" />
              <MetricCard label="Sales (90d)"       value={fmt(stat90d.sold_count)} sub="closed" />
            </div>
          )}

          {/* All periods table */}
          {data.stats?.length > 0 && (
            <Section title="By Time Period">
              <div className="overflow-x-auto">
                <table className="data-table w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left">Period</th>
                      <th>Mo. Supply</th>
                      <th>Med Price</th>
                      <th>DOM</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.map(s => (
                      <tr key={s.period}>
                        <td className="font-mono text-[#767C80]">{s.period}</td>
                        <td>{fmt(s.months_of_supply, 1)}</td>
                        <td>{fmtP(s.median_sale_price)}</td>
                        <td>{fmt(s.median_days_on_market, 0)}d</td>
                        <td><span className={scoreColor(s.opportunity_score)}>{fmt(s.opportunity_score, 0)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* 24mo price trend */}
          {trend?.length > 0 && (
            <Section title="24-Month Price Trend">
              <TrendChart data={trend} dataKey="median_price" label="Median Price" height={130} />
            </Section>
          )}

          {/* Sales trend */}
          {trend?.length > 0 && (
            <Section title="Monthly Sales Volume">
              <TrendChart data={trend} dataKey="sales" label="Sales" type="bar" color="secondary" height={100} />
            </Section>
          )}

          {/* Demographics */}
          {c && (
            <Section title="Demographics">
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Population"     value={fmt(c.population)} />
                <MetricCard label="Pop Growth"     value={fmtPct(c.population_growth_pct)} />
                <MetricCard label="Median Income"  value={fmtP(c.median_household_income)} />
                <MetricCard label="Median HV"      value={fmtP(c.median_home_value)} />
                <MetricCard label="Unemployment"   value={fmtPct(c.unemployment_rate)} />
                <MetricCard label="Flood Risk"     value={fmtPct(c.flood_risk_pct)} />
              </div>
              <div className="mt-2 flex gap-2">
                {c.mh_friendly_zoning && <span className="badge badge-green">MH Friendly Zoning</span>}
                {c.priority_market    && <span className="badge badge-blue">LotLine Priority Market</span>}
              </div>
            </Section>
          )}

          {/* Active listings */}
          {data.listings?.length > 0 && (
            <Section title={`Active Listings (${data.listings.length})`}>
              <div className="space-y-2">
                {data.listings.slice(0, 8).map(l => (
                  <div key={l.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-surface-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs text-[#333638] truncate">{l.address}</p>
                      <p className="text-xs text-[#767C80]">{l.bedrooms}bd/{l.bathrooms}ba · {l.acreage}ac · {l.property_type}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-[#333638]">{fmtP(l.list_price)}</p>
                      <p className="text-xs text-[#767C80]">{l.days_on_market}d</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Sold comps */}
          {data.comps?.length > 0 && (
            <Section title={`Recent Sold Comps (${data.comps.length})`}>
              <div className="space-y-2">
                {data.comps.slice(0, 6).map(c => (
                  <div key={c.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-surface-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs text-[#333638] truncate">{c.address}</p>
                      <p className="text-xs text-[#767C80]">{c.acreage}ac · Closed {c.close_date?.slice(0,7)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-[#333638]">{fmtP(c.sale_price)}</p>
                      <p className="text-xs text-[#767C80]">{fmtPct(c.list_to_sale_ratio)} L/S</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Pipeline deals */}
          {data.deals?.length > 0 && (
            <Section title={`LotLine Deals (${data.deals.length})`}>
              <div className="space-y-2">
                {data.deals.map(d => (
                  <div key={d.id} className="p-2 bg-surface-overlay rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`badge ${STATUS_COLORS[d.status] || 'badge-gray'}`}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-[#767C80]">{d.assigned_to}</span>
                    </div>
                    <p className="text-xs text-[#333638] truncate">{d.address}</p>
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="text-[#767C80]">Target: {fmtP(d.target_sale_price)}</span>
                      <span className="text-green-600">+{fmtP(d.projected_profit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="h-8" />
        </div>
      )}
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <div className="p-4 border-b border-surface-border">
      <h3 className="text-label mb-3">{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-surface-raised rounded-lg p-2.5">
      <p className="text-label text-[10px]">{label}</p>
      <p className="text-[#333638] font-semibold text-sm mt-0.5 tabular-nums">{value}</p>
      {sub && <p className="text-[#A0A5A8] text-[10px]">{sub}</p>}
    </div>
  );
}

function ScoreCard({ label, value }) {
  const s = Number(value) || 0;
  return (
    <div className="bg-surface-raised rounded-lg p-3">
      <p className="text-label text-[10px]">{label}</p>
      <p className={`font-bold text-2xl tabular-nums mt-1 ${scoreColor(s)}`}>{s.toFixed(0)}</p>
      <div className="h-1.5 bg-surface-border rounded-full mt-2 overflow-hidden">
        <div className={`h-full rounded-full ${scoreBg(s)}`} style={{ width: `${s}%` }} />
      </div>
    </div>
  );
}
