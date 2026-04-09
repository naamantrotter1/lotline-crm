import React, { useState, useEffect } from 'react';
import api from '../api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

const fmt  = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';

const INPUT_DEFAULT = {
  county_fips:     '37061',
  acquisition:     32000,
  homeCost:        94500,
  closing:         4200,
  carrying:        2800,
  install:         8500,
  targetSale:      249000,
};

const inputCls = "w-full bg-crm-sidebar-hover border border-crm-sidebar-border rounded-lg px-3 py-2 text-sm text-crm-sidebar-text focus:outline-none focus:border-brand-500";

export default function DealAnalyzer() {
  const [inputs, setInputs] = useState(INPUT_DEFAULT);
  const [countyStats, setCountyStats] = useState(null);
  const [countyName, setCountyName] = useState('');
  const [topMarkets, setTopMarkets] = useState([]);

  const setI = (k, v) => setInputs(p => ({ ...p, [k]: v }));
  const num  = (s)    => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

  const allIn       = num(inputs.acquisition) + num(inputs.homeCost) + num(inputs.closing) + num(inputs.carrying) + num(inputs.install);
  const targetSale  = num(inputs.targetSale);
  const profit      = targetSale - allIn;
  const roi         = allIn > 0 ? (profit / allIn) * 100 : 0;
  const breakEven   = allIn;
  const margin      = targetSale > 0 ? (profit / targetSale) * 100 : 0;

  useEffect(() => {
    if (inputs.county_fips?.length === 5) {
      api.counties.get(inputs.county_fips)
        .then(r => {
          setCountyName(`${r.county?.name}, ${r.county?.state}`);
          const s90 = r.stats?.find(s => s.period === '90d');
          setCountyStats({ ...s90, ...r.county });
        })
        .catch(() => { setCountyStats(null); setCountyName(''); });
    }
    api.stats.topMarkets({ limit: 10 }).then(r => setTopMarkets(r.data || [])).catch(() => {});
  }, [inputs.county_fips]);

  const estimatedDOM = countyStats?.median_days_on_market
    ? Math.round(countyStats.median_days_on_market * (roi > 25 ? 0.85 : roi > 15 ? 1.0 : 1.15))
    : null;

  const waterfall = [
    { name: 'Land',     value: num(inputs.acquisition), fill: '#60a5fa' },
    { name: 'Home',     value: num(inputs.homeCost),    fill: '#818cf8' },
    { name: 'Install',  value: num(inputs.install),     fill: '#a78bfa' },
    { name: 'Closing',  value: num(inputs.closing),     fill: '#c4b5fd' },
    { name: 'Carrying', value: num(inputs.carrying),    fill: '#ddd6fe' },
    { name: 'Profit',   value: Math.max(profit, 0),     fill: '#22c55e' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: inputs - dark sidebar */}
      <div className="w-80 flex-shrink-0 bg-crm-sidebar border-r border-crm-sidebar-border p-4 overflow-y-auto scrollbar-thin space-y-5">
        <h2 className="font-bold text-crm-sidebar-text text-base">Deal Analyzer</h2>

        <div>
          <label className="text-xs text-crm-sidebar-muted uppercase tracking-wide block mb-1">County FIPS</label>
          <input value={inputs.county_fips} onChange={e => setI('county_fips', e.target.value)}
            placeholder="37061"
            className={inputCls} />
          {countyName && <p className="text-xs text-brand-400 mt-1">{countyName}</p>}
        </div>

        <div className="space-y-3">
          <p className="text-xs text-crm-sidebar-muted uppercase tracking-wide">Cost Inputs</p>
          {[
            { label: 'Land Acquisition Price', key: 'acquisition', hint: 'Parcel cost' },
            { label: 'Manufactured Home Cost', key: 'homeCost',    hint: 'Invoice from manufacturer' },
            { label: 'Install & Setup',        key: 'install',     hint: 'Foundation, utility hook-up, delivery' },
            { label: 'Closing Costs',          key: 'closing',     hint: 'Title, recording, legal' },
            { label: 'Carrying Costs',         key: 'carrying',    hint: 'Property tax, insurance during hold' },
          ].map(({ label, key, hint }) => (
            <div key={key}>
              <label className="text-xs text-crm-sidebar-muted block mb-1">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-sidebar-muted text-sm">$</span>
                <input
                  type="number" value={inputs[key]}
                  onChange={e => setI(key, e.target.value)}
                  className="w-full bg-crm-sidebar-hover border border-crm-sidebar-border rounded-lg pl-7 pr-3 py-2 text-sm text-crm-sidebar-text focus:outline-none focus:border-brand-500"
                />
              </div>
              <p className="text-xs text-crm-sidebar-muted/70 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>

        <div>
          <label className="text-xs text-crm-sidebar-muted block mb-1">Target Sale Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-sidebar-muted text-sm">$</span>
            <input type="number" value={inputs.targetSale} onChange={e => setI('targetSale', e.target.value)}
              className="w-full bg-crm-sidebar-hover border border-crm-sidebar-border rounded-lg pl-7 pr-3 py-2 text-sm font-semibold text-crm-sidebar-text focus:outline-none focus:border-brand-500" />
          </div>
          {countyStats?.median_sale_price && (
            <p className="text-xs text-crm-sidebar-muted mt-1">
              County median: {fmt(countyStats.median_sale_price)}
              {' '}({targetSale > countyStats.median_sale_price ? '+' : ''}
              {((targetSale - countyStats.median_sale_price) / countyStats.median_sale_price * 100).toFixed(0)}% vs median)
            </p>
          )}
        </div>
      </div>

      {/* Right: results - light */}
      <div className="flex-1 overflow-auto scrollbar-thin p-4 space-y-4 bg-surface-base">

        {/* P&L Summary */}
        <div className="grid grid-cols-4 gap-3">
          <ResultCard label="Total All-In Cost" value={fmt(allIn)} sub="acquisition + all costs" color="text-[#333638]" />
          <ResultCard label="Projected Profit"  value={fmt(profit)} sub="sale − all-in" color={profit >= 0 ? 'text-green-600' : 'text-red-500'} />
          <ResultCard label="ROI"               value={fmtPct(roi)} sub="profit ÷ all-in" color={roi >= 20 ? 'text-green-600' : roi >= 10 ? 'text-yellow-600' : 'text-red-500'} />
          <ResultCard label="Net Margin"        value={fmtPct(margin)} sub="profit ÷ sale price" color={margin >= 15 ? 'text-green-600' : 'text-yellow-600'} />
        </div>

        {/* Break-even */}
        <div className="card p-4">
          <h3 className="text-label mb-3">Break-Even Analysis</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[#767C80] text-xs mb-1">Break-Even Price</p>
              <p className="text-[#333638] font-bold text-xl tabular-nums">{fmt(breakEven)}</p>
              <p className="text-[#A0A5A8] text-xs mt-1">Minimum to recover costs</p>
            </div>
            <div>
              <p className="text-[#767C80] text-xs mb-1">Buffer Above Break-Even</p>
              <p className={`font-bold text-xl tabular-nums ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmt(Math.abs(profit))}
              </p>
              <p className="text-[#A0A5A8] text-xs mt-1">{profit >= 0 ? 'Safety margin' : 'Current loss'}</p>
            </div>
            <div>
              <p className="text-[#767C80] text-xs mb-1">Est. Days to Sell</p>
              <p className="text-[#333638] font-bold text-xl tabular-nums">{estimatedDOM ?? '–'}d</p>
              <p className="text-[#A0A5A8] text-xs mt-1">Based on county median DOM</p>
            </div>
          </div>
        </div>

        {/* Cost waterfall chart */}
        <div className="card p-4">
          <h3 className="text-label mb-3">Cost Stack vs Sale Price</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfall} margin={{ top: 4, right: 16, left: 60, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8D5CB" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#767C80', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} tick={{ fill: '#767C80', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [fmt(v)]}
                contentStyle={{ background: '#E9E7DD', border: '1px solid #D8D5CB', borderRadius: 8, color: '#333638', fontSize: 12 }}
              />
              <ReferenceLine y={targetSale} stroke="#DA7858" strokeDasharray="4 4"
                label={{ value: 'Target', fill: '#DA7858', fontSize: 11 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}
                cell={waterfall.map((entry, i) => <rect key={i} fill={entry.fill} />)}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* County context */}
        {countyStats && (
          <div className="card p-4">
            <h3 className="text-label mb-3">County Market Context — {countyName}</h3>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <ContextCard label="Median Sale Price"  value={fmt(countyStats.median_sale_price)}
                sub={targetSale > countyStats.median_sale_price ? 'Above median' : 'Below median'}
                color={targetSale <= countyStats.median_sale_price * 1.1 ? 'text-green-600' : 'text-yellow-600'} />
              <ContextCard label="Months of Supply"  value={countyStats.months_of_supply?.toFixed(1)}
                sub={countyStats.months_of_supply < 4 ? 'Seller market' : countyStats.months_of_supply < 7 ? 'Balanced' : 'Buyer market'}
                color={countyStats.months_of_supply < 4 ? 'text-green-600' : countyStats.months_of_supply < 7 ? 'text-yellow-600' : 'text-red-500'} />
              <ContextCard label="Absorption Rate"   value={fmtPct(countyStats.absorption_rate_pct)}
                sub="90-day" color="text-[#333638]" />
              <ContextCard label="Opp Score"         value={countyStats.opportunity_score?.toFixed(0) + '/100'}
                sub="LotLine score" color={countyStats.opportunity_score >= 70 ? 'text-green-600' : 'text-yellow-600'} />
            </div>
          </div>
        )}

        {/* Top markets */}
        <div className="card p-4">
          <h3 className="text-label mb-3">Top Markets by Opportunity Score</h3>
          <div className="space-y-2">
            {topMarkets.map((m, i) => (
              <div key={m.fips_code}
                className="flex items-center gap-3 py-1.5 border-b border-surface-border last:border-0 cursor-pointer hover:bg-surface-overlay rounded px-1 transition-colors"
                onClick={() => setI('county_fips', m.fips_code)}>
                <span className="text-[#A0A5A8] text-xs w-5 text-right font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#333638]">{m.county}, {m.state}</p>
                  <p className="text-xs text-[#767C80]">{fmt(m.median_sale_price)} median · {m.months_of_supply?.toFixed(1)} mo supply</p>
                </div>
                <span className={`font-bold text-sm tabular-nums ${m.opportunity_score >= 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {m.opportunity_score?.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <p className="text-label">{label}</p>
      <p className={`font-bold text-2xl tabular-nums mt-1 ${color}`}>{value}</p>
      <p className="text-[#767C80] text-xs mt-1">{sub}</p>
    </div>
  );
}

function ContextCard({ label, value, sub, color }) {
  return (
    <div className="bg-surface-overlay rounded-lg p-3">
      <p className="text-label text-[10px]">{label}</p>
      <p className={`font-bold text-lg tabular-nums mt-1 ${color}`}>{value}</p>
      <p className="text-[#A0A5A8] text-[10px] mt-0.5">{sub}</p>
    </div>
  );
}
