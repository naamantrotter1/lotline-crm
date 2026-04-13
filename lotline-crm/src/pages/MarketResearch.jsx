import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import {
  Calculator, TrendingUp, Search, ExternalLink, Map,
  ArrowUpRight, ArrowDownRight, Minus, X, ChevronDown, Info, Building2, MapPin,
} from 'lucide-react';
import BuilderNetworkPage from './BuilderNetwork';
import CountyDatabasePage from './CountyDatabase';
import ArvDatabasePage from './ArvDatabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEAL_OVERVIEW_DEALS, LAND_DEALS } from '../data/deals.js';
import { MARKET_COUNTY_DATA as COUNTY_DATA, _score } from '../data/counties.js';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt    = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtK   = (n) => n == null ? '–' : '$' + Math.round(n / 1000) + 'k';
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';
const num    = (s)  => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';
const inpDark = 'w-full bg-sidebar/5 border border-gray-200 rounded-lg px-3 py-2 text-sm text-sidebar focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

// ── Shared components ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-sidebar' }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-300">–</span>;
  const color = score >= 70 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500';
  return <span className={`font-bold tabular-nums ${color}`}>{score}</span>;
}

function TrendIcon({ val }) {
  if (val == null) return null;
  if (val > 0) return <ArrowUpRight size={12} className="text-green-500 inline" />;
  if (val < 0) return <ArrowDownRight size={12} className="text-red-500 inline" />;
  return <Minus size={12} className="text-gray-400 inline" />;
}

// ── TAB 1: Deal Analyzer ──────────────────────────────────────────────────────
const DEAL_DEFAULTS = {
  countyFips: '37019',
  acquisition: 32000,
  homeCost: 94500,
  install: 8500,
  closing: 4200,
  carrying: 2800,
  targetSale: 249000,
};

function DealAnalyzer() {
  const [inputs, setInputs] = useState(DEAL_DEFAULTS);
  const setI = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const county = COUNTY_DATA.find(c => c.fips === inputs.countyFips) || null;

  const allIn      = num(inputs.acquisition) + num(inputs.homeCost) + num(inputs.install) + num(inputs.closing) + num(inputs.carrying);
  const targetSale = num(inputs.targetSale);
  const profit     = targetSale - allIn;
  const roi        = allIn > 0 ? (profit / allIn) * 100 : 0;
  const margin     = targetSale > 0 ? (profit / targetSale) * 100 : 0;

  const estDOM = county
    ? Math.round(county.medianDOM * (roi > 25 ? 0.85 : roi > 15 ? 1.0 : 1.15))
    : null;

  const waterfall = [
    { name: 'Land',     value: num(inputs.acquisition), color: '#60a5fa' },
    { name: 'Home',     value: num(inputs.homeCost),    color: '#818cf8' },
    { name: 'Install',  value: num(inputs.install),     color: '#a78bfa' },
    { name: 'Closing',  value: num(inputs.closing),     color: '#c4b5fd' },
    { name: 'Carrying', value: num(inputs.carrying),    color: '#ddd6fe' },
    { name: 'Profit',   value: Math.max(profit, 0),     color: profit >= 0 ? '#22c55e' : '#ef4444' },
  ];

  return (
    <div className="flex gap-5 h-full">
      {/* Left — inputs */}
      <div className="w-72 flex-shrink-0 space-y-4">
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Target County</p>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Select County</label>
            <select value={inputs.countyFips} onChange={e => setI('countyFips', e.target.value)} className={inp}>
              {COUNTY_DATA.map(c => (
                <option key={c.fips} value={c.fips}>{c.name} County, {c.state}</option>
              ))}
            </select>
            {county && (
              <p className="text-xs text-accent mt-1 font-medium">
                Median sale: {fmtK(county.medianSalePrice)} · DOM: {county.medianDOM}d · Opp Score: {county.oppScore}/100
              </p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Cost Inputs</p>
          {[
            { label: 'Land Acquisition',    key: 'acquisition', hint: 'Parcel purchase price' },
            { label: 'Manufactured Home',   key: 'homeCost',    hint: 'Invoice from manufacturer' },
            { label: 'Install & Setup',     key: 'install',     hint: 'Foundation, delivery, hookups' },
            { label: 'Closing Costs',       key: 'closing',     hint: 'Title, recording, legal' },
            { label: 'Carrying Costs',      key: 'carrying',    hint: 'Taxes, insurance during hold' },
          ].map(({ label, key, hint }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={inputs[key]} onChange={e => setI(key, e.target.value)}
                  className={inp + ' pl-7'} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-2">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">Target Sale Price</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" value={inputs.targetSale} onChange={e => setI('targetSale', e.target.value)}
              className={inp + ' pl-7 font-semibold text-sidebar'} />
          </div>
          {county && (
            <p className="text-xs text-gray-400">
              County median: {fmtK(county.medianSalePrice)}{' '}
              <span className={targetSale <= county.medianSalePrice * 1.1 ? 'text-green-600' : 'text-yellow-600'}>
                ({targetSale > county.medianSalePrice ? '+' : ''}{((targetSale - county.medianSalePrice) / county.medianSalePrice * 100).toFixed(0)}% vs median)
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Right — results */}
      <div className="flex-1 space-y-4 overflow-auto">
        {/* P&L summary */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total All-In Cost" value={fmt(allIn)} sub="all costs combined" />
          <StatCard label="Projected Profit" value={fmt(profit)} sub="sale − all-in"
            color={profit >= 0 ? 'text-green-600' : 'text-red-500'} />
          <StatCard label="ROI" value={fmtPct(roi)} sub="profit ÷ all-in"
            color={roi >= 20 ? 'text-green-600' : roi >= 10 ? 'text-yellow-600' : 'text-red-500'} />
          <StatCard label="Net Margin" value={fmtPct(margin)} sub="profit ÷ sale price"
            color={margin >= 15 ? 'text-green-600' : 'text-yellow-600'} />
        </div>

        {/* Break-even + DOM */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">Break-Even Analysis</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Break-Even Price</p>
              <p className="text-2xl font-bold text-sidebar tabular-nums">{fmt(allIn)}</p>
              <p className="text-xs text-gray-400 mt-1">Minimum to recover costs</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Safety Margin</p>
              <p className={`text-2xl font-bold tabular-nums ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(Math.abs(profit))}</p>
              <p className="text-xs text-gray-400 mt-1">{profit >= 0 ? 'Above break-even' : 'Current loss'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Est. Days to Sell</p>
              <p className="text-2xl font-bold text-sidebar tabular-nums">{estDOM ?? '–'}{estDOM ? 'd' : ''}</p>
              <p className="text-xs text-gray-400 mt-1">Based on county median DOM</p>
            </div>
          </div>
        </div>

        {/* Waterfall chart */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">Cost Stack vs Sale Price</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfall} margin={{ top: 4, right: 16, left: 50, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [fmt(v)]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                cursor={{ fill: 'rgba(249,115,22,0.06)' }}
              />
              <ReferenceLine y={targetSale} stroke="#f97316" strokeDasharray="4 4"
                label={{ value: 'Target Sale', fill: '#f97316', fontSize: 11, position: 'right' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfall.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* County context */}
        {county && (
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-bold text-sidebar mb-4">Market Context — {county.name} County, {county.state}</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Median Sale Price', value: fmtK(county.medianSalePrice),
                  sub: targetSale <= county.medianSalePrice * 1.1 ? 'In range' : 'Above median',
                  color: targetSale <= county.medianSalePrice * 1.1 ? 'text-green-600' : 'text-yellow-600' },
                { label: 'Months of Supply', value: county.monthsSupply.toFixed(1),
                  sub: county.monthsSupply < 4 ? 'Seller market' : county.monthsSupply < 7 ? 'Balanced' : 'Buyer market',
                  color: county.monthsSupply < 4 ? 'text-green-600' : county.monthsSupply < 7 ? 'text-yellow-600' : 'text-red-500' },
                { label: 'Absorption Rate', value: fmtPct(county.absorptionRate), sub: '90-day period', color: 'text-sidebar' },
                { label: 'Opportunity Score', value: county.oppScore + '/100', sub: 'LotLine score',
                  color: county.oppScore >= 70 ? 'text-green-600' : 'text-yellow-600' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TAB 2: Market Stats ───────────────────────────────────────────────────────
const SORT_COLS = [
  { key: 'name',            label: 'County' },
  { key: 'medianPpa',       label: 'Avg ARV',     info: 'Average After-Repair Value — median price per acre. Lower values indicate larger, rural parcels.' },
  { key: 'oppScore',        label: 'Opp Score',   info: 'Composite 0–100 score combining absorption rate, months of supply, and population growth. Higher = better market opportunity.' },
  { key: 'demandScore',     label: 'Demand',      info: 'Composite 0–100 score combining sell-through rate, days on market, and absorption rate. Higher = stronger buyer demand.' },
  { key: 'medianDOM',       label: 'DOM',         info: 'Days on Market — median days a parcel sits on the market before going under contract. Lower is better.' },
  { key: 'absorptionRate',  label: 'Abs. Rate',   info: 'Absorption Rate — percentage of available inventory that sold in the period. Higher means faster-moving market.' },
  { key: 'monthsSupply',    label: 'Mo. Supply',  info: 'Months of Supply — how long current inventory would last at the current sales pace. Under 6 months = seller\'s market.' },
  { key: 'sellThrough',     label: 'Sell Thru',   info: 'Sell-Through Rate — percentage of listed properties that actually sold. Higher means stronger buyer demand.' },
  { key: 'medianSalePrice', label: 'Med. Sale',   info: 'Median sale price of parcels closed in the selected period.' },
  { key: 'medianIncome',    label: 'Med. Income', info: 'Median household income for the county. Higher income areas typically support stronger land values.' },
  { key: 'unemployment',    label: 'Unemp.',      info: 'Unemployment rate for the county. Lower unemployment generally correlates with stronger housing demand.' },
  { key: 'popGrowth',       label: 'Pop Growth',  info: 'Annual population growth rate (%). Positive growth drives land demand; negative signals a shrinking market.' },
  { key: 'listToSale',      label: 'L/S Ratio' },
  { key: 'activeListing',   label: 'Active' },
  { key: 'soldCount',       label: 'Sold' },
];

function ColHeader({ col, sort, onSort }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <th
      onClick={() => onSort(col.key)}
      className={`text-left py-3 px-3 font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-accent transition-colors ${sort.col === col.key ? 'text-accent' : 'text-gray-500'}`}
    >
      <div className="flex items-center gap-1">
        <span>{col.label}</span>
        {sort.col === col.key && <span>{sort.dir === 1 ? '↑' : '↓'}</span>}
        {col.info && (
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors leading-none"
            >
              <Info size={11} />
            </button>
            {showTip && (
              <div className="absolute left-0 top-5 z-[3000] bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 w-60 shadow-2xl leading-relaxed font-normal normal-case tracking-normal pointer-events-none">
                {col.info}
              </div>
            )}
          </div>
        )}
      </div>
    </th>
  );
}

function MarketStats() {
  const [timePeriod, setTimePeriod] = useState('90 days');
  const [dataType,   setDataType]   = useState('Manufactured');
  const [acreage,    setAcreage]    = useState('All');
  const [status,     setStatus]     = useState('Sold');
  const [sort,       setSort]       = useState({ col: 'oppScore', dir: -1 });
  const [search,     setSearch]     = useState('');

  const handleSort = (col) => setSort(p => p.col === col ? { col, dir: -p.dir } : { col, dir: -1 });

  const adj  = TIME_ADJ[timePeriod]  ?? TIME_ADJ['90 days'];
  const sadj = STATUS_ADJ[status]    ?? STATUS_ADJ['Sold'];

  const filtered = applyDataType(
    COUNTY_DATA
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
      .filter(r => ACREAGE_FILTER[acreage]?.(r))
      .filter(r => DATA_TYPE_FILTERS[dataType]?.(r))
      .filter(r => !(dataType === 'Land' && r.medianPpa > 500000)),
    dataType
  ).map(c => ({
    ...c,
    absorptionRate:  Math.min(98,  +(c.absorptionRate * adj.act   * sadj.act).toFixed(1)),
    sellThrough:     Math.min(500, +(c.sellThrough    * adj.act   * sadj.act).toFixed(1)),
    medianDOM:       Math.round(c.medianDOM       * adj.dom   * sadj.dom),
    medianSalePrice: Math.round(c.medianSalePrice * adj.price * sadj.price),
    medianPpa:       Math.round(c.medianPpa       * adj.price * sadj.price),
    monthsSupply:    +(c.monthsSupply * sadj.supply).toFixed(1),
  })).map(c => _score(c)).sort((a, b) => {
    const va = a[sort.col], vb = b[sort.col];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return sort.dir * (va < vb ? -1 : va > vb ? 1 : 0);
  });

  const exportCsv = () => {
    const cols = SORT_COLS.map(c => c.key);
    const rows = [SORT_COLS.map(c => c.label), ...filtered.map(r => cols.map(c => r[c] ?? ''))];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `lotline-market-stats.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex items-center gap-1.5">
        <FilterDropdown label="Status"    value={status}     onChange={setStatus}
          options={['Sold','For Sale']}
          tooltip="Filter by listing status — Sold shows closed transactions; For Sale shows active listings." />
        <FilterDropdown label="Time"      value={timePeriod} onChange={setTimePeriod}
          options={['7 days','14 days','30 days','90 days','6 months','1 year','2 years','3 years','5 years']}
          tooltip="Lookback window for market data. Shorter windows show recent trends; longer windows smooth out seasonality." />
        <FilterDropdown label="Data"      value={dataType}   onChange={v => setDataType(v)}
          options={['All','Land','House','Townhouse','Condo','MultiFamily','Manufactured']}
          tooltip="Property type to include in the stats. 'Land' filters to vacant parcels only — best for land acquisition analysis." />
        <FilterDropdown label="Acreage"   value={acreage}    onChange={setAcreage}
          options={['All','0-1 acre','1-2 acres','2-5 acres','5-10 acres','10-20 acres','20-50 acres','50-70 acres','70-100 acres','100-150 acres','150+ acres']}
          tooltip="Narrow results to parcels within a specific size range. Useful for targeting MH-ready lot sizes (1–10 acres)." />
        <div className="flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg border border-gray-200 bg-white flex-1 min-w-0">
          <Search size={11} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search county…"
            className="flex-1 min-w-0 text-xs bg-transparent outline-none placeholder-gray-400" />
          {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X size={11} /></button>}
        </div>
        <button onClick={exportCsv} className="text-xs text-gray-500 hover:text-accent transition-colors font-medium whitespace-nowrap shrink-0">Export CSV</button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                {SORT_COLS.map(col => (
                  <ColHeader key={col.key} col={col} sort={sort} onSort={handleSort} />
                ))}
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MH Zone</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.fips} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-3 font-semibold text-sidebar whitespace-nowrap">{r.name}, {r.state}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.medianPpa ? fmtK(r.medianPpa) : '–'}</td>
                  <td className="py-3 px-3"><ScoreBadge score={r.oppScore} /></td>
                  <td className="py-3 px-3"><ScoreBadge score={r.demandScore} /></td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.medianDOM}d</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.absorptionRate)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.monthsSupply.toFixed(1)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.sellThrough)}</td>
                  <td className="py-3 px-3 tabular-nums font-semibold text-sidebar">{fmtK(r.medianSalePrice)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtK(r.medianIncome)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.unemployment)}</td>
                  <td className="py-3 px-3 tabular-nums">
                    <span className={r.popGrowth >= 0 ? 'text-green-600' : 'text-red-500'}>
                      <TrendIcon val={r.popGrowth} /> {fmtPct(r.popGrowth)}
                    </span>
                  </td>
                  <td className="py-3 px-3 tabular-nums">
                    <span className={r.listToSale >= 98 ? 'text-green-600' : 'text-gray-600'}>{fmtPct(r.listToSale)}</span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.activeListing}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.soldCount}</td>
                  <td className="py-3 px-3">
                    {r.mhFriendly
                      ? <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Yes</span>
                      : <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No</span>}
                  </td>
                  <td className="py-3 px-3">
                    {r.priority && <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">★ Priority</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 bg-gray-50">
          {filtered.length} of {COUNTY_DATA.length} counties · {dataType} · {timePeriod} · {status}
        </div>
      </div>
    </div>
  );
}

// ── TAB 3: Comp Finder ────────────────────────────────────────────────────────
const COMP_LINKS = [
  { name: 'Zillow', url: 'https://www.zillow.com/homes/for_sale/', desc: 'Largest listing database, filter by sold homes', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { name: 'Realtor.com', url: 'https://www.realtor.com/realestateandhomes-search/', desc: 'MLS-connected data, strong comp history', color: 'bg-red-50 border-red-200 text-red-700' },
  { name: 'Redfin', url: 'https://www.redfin.com/', desc: 'Best for sold price accuracy and DOM data', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  { name: 'LandWatch', url: 'https://www.landwatch.com/', desc: 'Land and rural property comps', color: 'bg-green-50 border-green-200 text-green-700' },
  { name: 'Land.com', url: 'https://www.land.com/', desc: 'Largest land-only listing network', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { name: 'MHVillage', url: 'https://www.mhvillage.com/', desc: 'Manufactured home specific comps and sales', color: 'bg-purple-50 border-purple-200 text-purple-700' },
];

const COUNTY_PORTALS = [
  { name: 'Brunswick County GIS', url: 'https://data-brunsco.opendata.arcgis.com/', desc: 'Permit data, parcel maps, sales data' },
  { name: 'Guilford County GIS', url: 'https://www.guilfordcountync.gov/our-county/gis', desc: 'Property records and parcel search' },
  { name: 'Horry County GIS', url: 'https://www.horrycounty.org/departments/geographic-information-systems', desc: 'Active permits database and parcel lookup' },
  { name: 'NC Property Tax Search', url: 'https://www.ncdor.gov/taxes-forms/property-tax', desc: 'Statewide property valuation data' },
  { name: 'SC Property Tax Search', url: 'https://www.scdor.gov/property-taxes', desc: 'Statewide property valuation data' },
];

function CompFinder() {
  const [state, setState] = useState('NC');
  const [county, setCounty] = useState('');
  const [zip, setZip] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minAcres, setMinAcres] = useState('');
  const [maxAcres, setMaxAcres] = useState('');

  const buildZillowUrl = () => {
    const base = `https://www.zillow.com/homes/recently_sold/`;
    const params = [];
    if (zip) return `https://www.zillow.com/homes/recently_sold/${zip}_rb/`;
    if (county && state) return `https://www.zillow.com/homes/recently_sold/${county}-county-${state.toLowerCase()}_rb/`;
    return base;
  };

  const buildRealtorUrl = () => {
    if (zip) return `https://www.realtor.com/realestateandhomes-search/${zip}`;
    if (county && state) return `https://www.realtor.com/realestateandhomes-search/${county.replace(/\s+/g, '-')}-County_${state}`;
    return 'https://www.realtor.com/realestateandhomes-search/';
  };

  const buildMHVillageUrl = () => {
    if (state) return `https://www.mhvillage.com/homes/?state=${state.toLowerCase()}`;
    return 'https://www.mhvillage.com/homes/';
  };

  return (
    <div className="space-y-5">
      {/* Quick search builder */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-bold text-sidebar mb-4">Quick Search Builder</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">State</label>
            <select value={state} onChange={e => setState(e.target.value)} className={inp}>
              <option>NC</option><option>SC</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">County</label>
            <input value={county} onChange={e => setCounty(e.target.value)} placeholder="e.g. Brunswick" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">ZIP Code</label>
            <input value={zip} onChange={e => setZip(e.target.value)} placeholder="e.g. 28462" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min Price</label>
            <input value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="$100,000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Price</label>
            <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="$400,000" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Acreage Range</label>
            <div className="flex gap-2">
              <input value={minAcres} onChange={e => setMinAcres(e.target.value)} placeholder="Min" className={inp} />
              <input value={maxAcres} onChange={e => setMaxAcres(e.target.value)} placeholder="Max" className={inp} />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <a href={buildZillowUrl()} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Search Zillow <ExternalLink size={13} />
          </a>
          <a href={buildRealtorUrl()} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
            Search Realtor.com <ExternalLink size={13} />
          </a>
          <a href={buildMHVillageUrl()} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors">
            Search MHVillage <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Comp sources */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">Comp Data Sources</p>
          <div className="space-y-2">
            {COMP_LINKS.map(({ name, url, desc, color }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm ${color}`}>
                <div>
                  <p className="text-sm font-semibold">{name}</p>
                  <p className="text-xs opacity-80 mt-0.5">{desc}</p>
                </div>
                <ExternalLink size={14} className="flex-shrink-0 ml-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>

        {/* County data portals */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-bold text-sidebar mb-4">County Data Portals</p>
          <div className="space-y-2">
            {COUNTY_PORTALS.map(({ name, url, desc }) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:border-accent/40 hover:bg-accent/5 transition-all group">
                <div>
                  <p className="text-sm font-semibold text-sidebar group-hover:text-accent transition-colors">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <ExternalLink size={14} className="flex-shrink-0 ml-3 text-gray-400 group-hover:text-accent transition-colors" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TAB 4: Heat Map ───────────────────────────────────────────────────────────
const METRIC_CONFIG = {
  // breaks = [b0, b1, b2, b3] → 5 bands: <b0, b0-b1, b1-b2, b2-b3, ≥b3
  oppScore:        { label: 'Opportunity Score',  higherIsBetter: true,  fmt: v => v.toFixed(0) + '/100', breaks: [30, 45, 62, 75]   },
  demandScore:     { label: 'Demand Score',       higherIsBetter: true,  fmt: v => v.toFixed(0) + '/100', breaks: [40, 55, 65, 75]   },
  medianSalePrice: { label: 'Median Sale Price',  higherIsBetter: null,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  medianDOM:       { label: 'Days on Market',     higherIsBetter: false, fmt: v => v.toFixed(0) + 'd',   breaks: [65, 80, 130, 160] },
  monthsSupply:    { label: 'Months of Supply',   higherIsBetter: false, fmt: v => v.toFixed(1) + ' mo', breaks: [4,  6,  11,  15]  },
  absorptionRate:  { label: 'Absorption Rate',    higherIsBetter: true,  fmt: v => v.toFixed(1) + '%',   breaks: [33, 52, 64,  76]  },
  sellThrough:     { label: 'Sell-Through Rate',  higherIsBetter: true,  fmt: v => v.toFixed(1) + '%',   breaks: [55, 105, 155, 210] },
  popGrowth:       { label: 'Pop. Growth',        higherIsBetter: true,  fmt: v => v.toFixed(1) + '%',   breaks: [-1, 0.5, 2,   4]  },
  medianIncome:    { label: 'Median Income',      higherIsBetter: true,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  medianPpa:       { label: '$ / Acre',           higherIsBetter: null,  fmt: v => '$' + Math.round(v).toLocaleString() },
};

// ── Filter config ─────────────────────────────────────────────────────────────
const TIME_FACTOR = {
  '7 days': 7/365, '14 days': 14/365, '30 days': 30/365,
  '90 days': 90/365, '6 months': 0.5, '1 year': 1.0,
  '2 years': 2.0, '3 years': 3.0, '5 years': 5.0,
};

// Absolute multipliers for Market Stats table (90 days = baseline 1.0)
const TIME_ADJ = {
  '7 days':   { act: 1.42, price: 1.12, dom: 0.70 },
  '14 days':  { act: 1.30, price: 1.08, dom: 0.78 },
  '30 days':  { act: 1.16, price: 1.05, dom: 0.87 },
  '90 days':  { act: 1.00, price: 1.00, dom: 1.00 },
  '6 months': { act: 0.92, price: 0.96, dom: 1.10 },
  '1 year':   { act: 0.84, price: 0.92, dom: 1.18 },
  '2 years':  { act: 0.76, price: 0.86, dom: 1.28 },
  '3 years':  { act: 0.68, price: 0.80, dom: 1.38 },
  '5 years':  { act: 0.58, price: 0.73, dom: 1.52 },
};

// Status-based multipliers: For Sale = active listing metrics vs Sold = closed metrics
const STATUS_ADJ = {
  'Sold':     { price: 1.00, dom: 1.00, act: 1.00, supply: 1.00 },
  'For Sale': { price: 1.06, dom: 1.32, act: 0.78, supply: 1.45 },
};

const ACREAGE_FILTER = {
  'All':          () => true,
  '0-1 acre':     c => c.medianPpa > 200000,
  '1-2 acres':    c => c.medianPpa > 80000  && c.medianPpa <= 200000,
  '2-5 acres':    c => c.medianPpa > 35000  && c.medianPpa <= 80000,
  '5-10 acres':   c => c.medianPpa > 18000  && c.medianPpa <= 35000,
  '10-20 acres':  c => c.medianPpa > 10000  && c.medianPpa <= 18000,
  '20-50 acres':  c => c.medianPpa > 5000   && c.medianPpa <= 10000,
  '50-70 acres':  c => c.medianPpa > 3500   && c.medianPpa <= 5000,
  '70-100 acres': c => c.medianPpa > 2500   && c.medianPpa <= 3500,
  '100-150 acres':c => c.medianPpa > 1500   && c.medianPpa <= 2500,
  '150+ acres':   c => c.medianPpa <= 1500,
};

function getActiveMetric(statistic, status) {
  if (statistic === 'Transactions')            return status === 'For Sale' ? 'monthsSupply' : 'absorptionRate';
  if (statistic === 'Median Price')            return 'medianSalePrice';
  if (statistic === 'Median Price/Acre')       return 'medianPpa';
  if (statistic === 'Sell Through Rate (STR)') return 'sellThrough';
  if (statistic === 'Days on Market')          return 'medianDOM';
  if (statistic === 'Opportunity Score')       return 'oppScore';
  if (statistic === 'Demand Score')            return 'demandScore';
  return 'absorptionRate';
}

// ── Per-type data adjustments ─────────────────────────────────────────────────
// Each property type uses income + land metrics to derive realistic type-specific
// prices, DOM, absorption, and supply figures. "Land" = raw data unchanged.
const DATA_TYPE_FILTERS = {
  All:         () => true,
  Land:        () => true,
  House:       () => true,
  Townhouse:   c => c.medianIncome > 42000,
  Condo:       c => c.medianIncome > 50000,
  MultiFamily: c => c.medianIncome > 38000,
  Manufactured:      () => true,
};

function applyDataType(counties, dataType) {
  if (dataType === 'All') return counties;
  if (dataType === 'Land') return counties;
  return counties.map(c => {
    const inc = c.medianIncome;
    switch (dataType) {
      case 'House':
        return { ...c,
          medianSalePrice: Math.round(inc * 4.0),
          medianDOM:       Math.round(c.medianDOM * 0.72),
          absorptionRate:  Math.min(90, +(c.absorptionRate * 1.18).toFixed(1)),
          monthsSupply:    +(c.monthsSupply * 0.72).toFixed(1),
          sellThrough:     Math.min(380, +(c.sellThrough * 1.14).toFixed(1)),
        };
      case 'Townhouse':
        return { ...c,
          medianSalePrice: Math.round(inc * 3.2),
          medianDOM:       Math.round(c.medianDOM * 0.68),
          absorptionRate:  Math.min(90, +(c.absorptionRate * 1.14).toFixed(1)),
          monthsSupply:    +(c.monthsSupply * 0.65).toFixed(1),
          sellThrough:     Math.min(380, +(c.sellThrough * 1.12).toFixed(1)),
        };
      case 'Condo':
        return { ...c,
          medianSalePrice: Math.round(inc * 2.6),
          medianDOM:       Math.round(c.medianDOM * 0.55),
          absorptionRate:  Math.min(90, +(c.absorptionRate * 1.22).toFixed(1)),
          monthsSupply:    +(c.monthsSupply * 0.55).toFixed(1),
          sellThrough:     Math.min(380, +(c.sellThrough * 1.20).toFixed(1)),
        };
      case 'MultiFamily':
        return { ...c,
          medianSalePrice: Math.round(inc * 5.5),
          medianDOM:       Math.round(c.medianDOM * 1.08),
          absorptionRate:  +(c.absorptionRate * 0.88).toFixed(1),
          monthsSupply:    +(c.monthsSupply * 1.12).toFixed(1),
          sellThrough:     +(c.sellThrough * 0.90).toFixed(1),
        };
      case 'Manufactured':
        return { ...c,
          medianSalePrice: Math.round(inc * 1.8),
          medianDOM:       Math.round(c.medianDOM * (c.mhFriendly ? 0.88 : 1.18)),
          absorptionRate:  c.mhFriendly ? Math.min(90, +(c.absorptionRate * 1.12).toFixed(1)) : +(c.absorptionRate * 0.80).toFixed(1),
          monthsSupply:    +(c.monthsSupply * (c.mhFriendly ? 0.85 : 1.22)).toFixed(1),
          sellThrough:     c.mhFriendly ? Math.min(380, +(c.sellThrough * 1.10).toFixed(1)) : +(c.sellThrough * 0.82).toFixed(1),
        };
      default:
        return c;
    }
  });
}

// ── LandPortal-style filter dropdown ─────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange, tooltip }) {
  const [open, setOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="flex items-center gap-0.5">
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-lg border text-xs transition-all whitespace-nowrap select-none
            ${open
              ? 'border-gray-400 bg-white shadow-sm ring-1 ring-gray-200'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
            }`}
        >
          <span className="text-gray-400 font-normal">{label}:</span>
          <span className="font-semibold text-gray-700 ml-0.5">{value}</span>
          <ChevronDown size={11} className={`ml-0.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-[2000] min-w-[160px] py-1.5 overflow-hidden">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between gap-4
                  ${value === opt ? 'bg-green-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span>{opt}</span>
                {value === opt && <span className="text-green-500 font-bold text-base leading-none">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {tooltip && (
        <div className="relative">
          <button
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Info size={12} />
          </button>
          {showTip && (
            <div className="absolute left-0 top-6 z-[3000] bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 w-60 shadow-2xl leading-relaxed pointer-events-none">
              {tooltip}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function normalize(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

// Percentile-rank normalization: colors by rank so there's always a full
// red→yellow→green spread regardless of how tightly the data clusters.
function makePercentileNorm(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return function percentileNorm(val) {
    if (n === 0) return 0.5;
    if (n === 1) return 0.5;
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < val) lo = mid + 1; else hi = mid;
    }
    return lo / (n - 1);
  };
}

// Fixed-threshold normalization: maps a value to [0,1] using 4 breakpoints.
// Values ≥ b3 are capped at 1.0 (avoids outliers skewing the whole scale).
function makeThresholdNorm(breaks) {
  const [b0, b1, b2, b3] = breaks;
  return function(val) {
    if (val >= b3) return 1.0;
    if (val >= b2) return 0.75 + ((val - b2) / (b3 - b2)) * 0.25;
    if (val >= b1) return 0.50 + ((val - b1) / (b2 - b1)) * 0.25;
    if (val >= b0) return 0.25 + ((val - b0) / (b1 - b0)) * 0.25;
    if (b0 === 0)  return 0;
    return Math.max(0, (val / b0) * 0.25);
  };
}

function scoreToColor(norm, higherIsBetter) {
  const t    = higherIsBetter === false ? (1 - norm) : norm;
  const hue  = Math.round(t * 120);
  const sat  = 85;
  // Lightness peaks in the middle (yellow) and drops at both ends,
  // making deep red and deep green clearly distinct from their neighbors.
  const lght = t < 0.5
    ? Math.round(38 + t * 16)          // 38% at t=0 (red) → 46% at t=0.5 (yellow)
    : Math.round(46 - (t - 0.5) * 24); // 46% at t=0.5 → 34% at t=1 (green)
  return `hsl(${hue}, ${sat}%, ${lght}%)`;
}

// ── Zip choropleth helpers ────────────────────────────────────────────────────
function getFeatureCentroid(feature) {
  const coords = feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates[0]
    : feature.geometry.coordinates[0][0];
  let sx = 0, sy = 0;
  coords.forEach(([x, y]) => { sx += x; sy += y; });
  return [sx / coords.length, sy / coords.length];
}

function pointInFeature([px, py], feature) {
  let inside = false;
  const polys = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
  polys.forEach(poly => {
    const ring = poly[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
        inside = !inside;
    }
  });
  return inside;
}

function HeatMap() {
  const mapRef       = useRef(null);
  const leafletMap   = useRef(null);
  const choropleth   = useRef(null);
  const zipLayer     = useRef(null);
  const zipCountyMap = useRef({});

  // ── Filter state ──────────────────────────────────────────────────────────
  const [groupBy,    setGroupBy]    = useState('County');
  const [status,     setStatus]     = useState('Sold');
  const [timePeriod, setTimePeriod] = useState('90 days');
  const [dataType,   setDataType]   = useState('Manufactured');
  const [acreage,    setAcreage]    = useState('All');
  const [statistic,  setStatistic]  = useState('Days on Market');

  const stateLayer       = useRef(null);
  const stateBorderLayer = useRef(null);
  const [stateGeojson, setStateGeojson] = useState(null);
  const [stateBorderGeojson, setStateBorderGeojson] = useState(null);

  // ── Pipeline overlay state ────────────────────────────────────────────────
  const [showDealOverview,  setShowDealOverview]  = useState(false);
  const [showLandAcq,       setShowLandAcq]       = useState(false);
  const [showSales,         setShowSales]         = useState(false);
  const dealOverviewLayer = useRef(null);
  const landAcqLayer      = useRef(null);
  const salesLayer        = useRef(null);

  // ── Map state (declared early so searchQuery useEffect can reference geojson) ─
  const [geojson,     setGeojson]     = useState(null);
  const [zipGeojson,  setZipGeojson]  = useState(null);
  const [zipLoading,  setZipLoading]  = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [loading,     setLoading]     = useState(true);

  // ── Unified search (county name or ZIP) ──────────────────────────────────
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchInfo,   setSearchInfo]   = useState(null); // { lat, lon, fips, label, type:'zip'|'county' }
  const [searchStatus, setSearchStatus] = useState('');   // '' | 'loading' | 'found' | 'error'

  // Keep backward-compat aliases used in filter/choropleth logic
  const zipFilter = searchInfo?.type === 'zip'    ? searchInfo.zip    : '';
  const zipInfo   = searchInfo?.type === 'zip'    ? searchInfo        : null;

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchInfo(null); setSearchStatus(''); return; }

    // ── ZIP code (5 digits) ──────────────────────────────────────────────
    if (/^\d{5}$/.test(q)) {
      setSearchStatus('loading');
      fetch(`https://api.zippopotam.us/us/${q}`)
        .then(r => r.ok ? r.json() : Promise.reject('not found'))
        .then(async data => {
          const place     = data.places[0];
          const lat       = parseFloat(place.latitude);
          const lon       = parseFloat(place.longitude);
          const stateAbbr = place['state abbreviation'];
          const fcc = await fetch(
            `https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&showall=false&format=json`
          ).then(r => r.json());
          const fips       = fcc.County?.FIPS?.substring(0, 5);
          const countyName = fcc.County?.name;
          const inRegion   = fips?.startsWith('37') || fips?.startsWith('45');
          if (!inRegion) { setSearchStatus('error'); setSearchInfo(null); return; }
          setSearchInfo({ type: 'zip', zip: q, lat, lon, fips, label: `ZIP ${q} — ${countyName} Co., ${stateAbbr}` });
          setSearchStatus('found');
          setGroupBy('Zip Code');
          if (leafletMap.current) leafletMap.current.flyTo([lat, lon], 12, { duration: 1 });
        })
        .catch(() => { setSearchStatus('error'); setSearchInfo(null); });
      return;
    }

    // ── County name (text) ───────────────────────────────────────────────
    const match = COUNTY_DATA.find(c =>
      c.name.toLowerCase().startsWith(q.toLowerCase())
    ) || COUNTY_DATA.find(c =>
      c.name.toLowerCase().includes(q.toLowerCase())
    );
    if (match) {
      // Find county centroid from geojson if available, else use a rough lat/lon lookup
      setSearchInfo({ type: 'county', fips: match.fips, label: `${match.name} County, ${match.state}` });
      setSearchStatus('found');
      setGroupBy('County');
      // Fly to county using geojson centroid if loaded
      if (geojson) {
        const feat = geojson.features.find(f => {
          const id = String(f.id ?? f.properties?.GEOID ?? f.properties?.GEO_ID ?? '').replace(/^0500000US/, '');
          return id === match.fips;
        });
        if (feat) {
          const [cx, cy] = getFeatureCentroid(feat);
          if (leafletMap.current) leafletMap.current.flyTo([cy, cx], 9, { duration: 1 });
        }
      }
    } else if (q.length >= 2) {
      setSearchStatus('error');
      setSearchInfo(null);
    } else {
      setSearchInfo(null);
      setSearchStatus('');
    }
  }, [searchQuery, geojson]);

  // Derive active metric + config from filters
  const metric = getActiveMetric(statistic, status);
  const cfg    = METRIC_CONFIG[metric];

  // 1. Filter by search (zip or county), acreage + data-type availability
  const filteredCounties = COUNTY_DATA.filter(c => {
    if (searchInfo?.type === 'zip'    && c.fips !== searchInfo.fips) return false;
    if (searchInfo?.type === 'county' && c.fips !== searchInfo.fips) return false;
    if (!ACREAGE_FILTER[acreage]?.(c))         return false;
    if (!(DATA_TYPE_FILTERS[dataType]?.(c)))   return false;
    if (dataType === 'Land' && c.medianPpa > 500000) return false;
    return true;
  });

  // 2. Apply per-type metric adjustments + time-period scaling + status adjustment
  const timeFactor = TIME_FACTOR[timePeriod] ?? 1.0;
  const sadj = STATUS_ADJ[status] ?? STATUS_ADJ['Sold'];

  const displayCounties = applyDataType(filteredCounties, dataType).map(c => {
    // Shorter periods show more market volatility: growing markets look hotter,
    // declining markets look cooler relative to the annual average.
    const volatility = 1 - timeFactor;           // 0 at "1 year", ~0.98 at "7 days"
    const g = Math.max(-2, Math.min(4, c.popGrowth));
    const activityBoost = g >  0.5 ? 1 + volatility * 0.30 * (g / 4)
                        : g < -0.3 ? 1 - volatility * 0.22 * Math.abs(g / 3)
                        : 1 + volatility * 0.02;
    const priceBoost = 1 + volatility * (g > 1 ? 0.07 : g < 0 ? -0.04 : 0.01);
    return {
      ...c,
      absorptionRate:  +(c.absorptionRate * activityBoost * sadj.act).toFixed(1),
      sellThrough:     +(c.sellThrough    * activityBoost * sadj.act).toFixed(1),
      medianDOM:       Math.round(c.medianDOM  / activityBoost * sadj.dom),
      medianSalePrice: Math.round(c.medianSalePrice * priceBoost * sadj.price),
      medianPpa:       Math.round(c.medianPpa       * priceBoost * sadj.price),
      monthsSupply:    +(c.monthsSupply * sadj.supply).toFixed(1),
    };
  }).map(c => _score(c));

  const values = displayCounties.map(c => c[metric]).filter(v => v != null);
  const minV   = values.length ? Math.min(...values) : 0;
  const maxV   = values.length ? Math.max(...values) : 1;

  // Load NC/SC/GA/TN/VA county boundaries + state outlines from CDN
  useEffect(() => {
    setLoading(true);
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
      .then(r => r.json())
      .then(async us => {
        const { feature } = await import('topojson-client');
        const gj = feature(us, us.objects.counties);
        setGeojson({
          ...gj,
          features: gj.features.filter(f => {
            const id = String(f.id);
            return id.startsWith('37') || id.startsWith('45') ||
                   id.startsWith('13') || id.startsWith('47') || id.startsWith('51');
          }),
        });
        // State outlines — filtered to the same 5 states
        const stateGj = feature(us, us.objects.states);
        setStateBorderGeojson({
          ...stateGj,
          features: stateGj.features.filter(f => {
            const id = String(f.id);
            return ['37','45','13','47','51'].includes(id);
          }),
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Draw permanent state border overlay (always on top of county/zip choropleth)
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !stateBorderGeojson) return;
    if (stateBorderLayer.current) { stateBorderLayer.current.remove(); stateBorderLayer.current = null; }
    stateBorderLayer.current = L.geoJSON(stateBorderGeojson, {
      style: {
        fillColor:   'transparent',
        fillOpacity: 0,
        color:       '#0f172a',
        weight:      3,
        opacity:     1,
        dashArray:   null,
      },
      pane: 'stateBorderPane',
      interactive: false,
    }).addTo(map);
  }, [stateBorderGeojson, leafletMap.current]);

  // Load zip code boundaries when Zip Code view is selected
  useEffect(() => {
    if (groupBy !== 'Zip Code' || zipGeojson) return;
    setZipLoading(true);
    Promise.all([
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/nc_north_carolina_zip_codes_geo.min.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/sc_south_carolina_zip_codes_geo.min.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ga_georgia_zip_codes_geo.min.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/tn_tennessee_zip_codes_geo.min.json').then(r => r.json()),
      fetch('https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/va_virginia_zip_codes_geo.min.json').then(r => r.json()),
    ]).then(([nc, sc, ga, tn, va]) => {
      setZipGeojson({ type: 'FeatureCollection', features: [...nc.features, ...sc.features, ...ga.features, ...tn.features, ...va.features] });
      setZipLoading(false);
    }).catch(() => setZipLoading(false));
  }, [groupBy, zipGeojson]);

  // Pre-compute zip → county FIPS mapping once both GeoJSONs are available
  useEffect(() => {
    if (!zipGeojson || !geojson || Object.keys(zipCountyMap.current).length > 0) return;
    const mapping = {};
    zipGeojson.features.forEach(zf => {
      const zip = zf.properties.ZCTA5CE10 || zf.properties.ZCTA5CE20 || zf.properties.ZIP_CODE;
      if (!zip) return;
      const c = getFeatureCentroid(zf);
      const match = geojson.features.find(cf => pointInFeature(c, cf));
      if (match) mapping[zip] = String(match.id).padStart(5, '0');
    });
    zipCountyMap.current = mapping;
  }, [zipGeojson, geojson]);

  // Init Leaflet
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [35.5, -82.5], zoom: 6,
      zoomControl: true, attributionControl: false,
    });
    // Custom pane for state borders — always above choropleth layers
    map.createPane('stateBorderPane');
    map.getPane('stateBorderPane').style.zIndex = 410;
    map.getPane('stateBorderPane').style.pointerEvents = 'none';
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',   { maxZoom: 19 }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  // Redraw county choropleth when filters or geojson change
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !geojson || groupBy === 'Zip Code' || groupBy === 'State') return;
    if (choropleth.current) { choropleth.current.remove(); choropleth.current = null; }
    if (zipLayer.current)   { zipLayer.current.remove();   zipLayer.current   = null; }
    if (stateLayer.current) { stateLayer.current.remove(); stateLayer.current = null; }

    const pctNorm = cfg.breaks ? makeThresholdNorm(cfg.breaks) : makePercentileNorm(values);

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const fips   = String(feature.id).padStart(5, '0');
        const county = displayCounties.find(c => c.fips === fips);
        if (!county || county[metric] == null) {
          return { fillColor: '#e5e7eb', fillOpacity: 0.45, color: '#fff', weight: 0.8 };
        }
        const norm  = pctNorm(county[metric]);
        const color = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: 0.82, color: '#fff', weight: 0.8 };
      },
      onEachFeature: (feature, lyr) => {
        const fips   = String(feature.id).padStart(5, '0');
        const county = displayCounties.find(c => c.fips === fips);
        lyr.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2.5, color: '#16a34a', fillOpacity: 0.95 });
            if (county) {
              const val = county[metric] != null ? cfg.fmt(county[metric]) : '–';
              e.target.bindTooltip(
                `<strong>${county.name} County, ${county.state}</strong><br/>${cfg.label}: <strong>${val}</strong>`,
                { sticky: true, className: 'leaflet-tooltip-custom' }
              ).openTooltip();
            }
          },
          mouseout: (e) => { layer.resetStyle(e.target); e.target.unbindTooltip(); },
          click:    ()  => { if (county) setSelected(county); },
        });
      },
    });
    layer.addTo(map);
    choropleth.current = layer;
  }, [geojson, metric, displayCounties, minV, maxV, cfg, statistic, timeFactor, timePeriod, dataType, groupBy]);

  // Redraw zip code choropleth
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !zipGeojson || groupBy !== 'Zip Code') return;
    if (zipLayer.current)   { zipLayer.current.remove();   zipLayer.current   = null; }
    if (choropleth.current) { choropleth.current.remove(); choropleth.current = null; }

    const pctNorm = cfg.breaks ? makeThresholdNorm(cfg.breaks) : makePercentileNorm(values);

    const layer = L.geoJSON(zipGeojson, {
      style: (feature) => {
        const zip    = feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20 || feature.properties.ZIP_CODE;
        const fips   = zipCountyMap.current[zip];
        const county = fips ? displayCounties.find(c => c.fips === fips) : null;
        if (!county || county[metric] == null)
          return { fillColor: '#e5e7eb', fillOpacity: 0.45, color: '#fff', weight: 0.5 };
        const norm  = pctNorm(county[metric]);
        const color = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: 0.82, color: '#fff', weight: 0.5 };
      },
      onEachFeature: (feature, lyr) => {
        const zip    = feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20 || feature.properties.ZIP_CODE;
        const fips   = zipCountyMap.current[zip];
        const county = fips ? displayCounties.find(c => c.fips === fips) : null;
        lyr.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2, color: '#16a34a', fillOpacity: 0.95 });
            if (county) {
              const val = county[metric] != null ? cfg.fmt(county[metric]) : '–';
              e.target.bindTooltip(
                `<strong>ZIP ${zip}</strong><br/>${county.name} County, ${county.state}<br/>${cfg.label}: <strong>${val}</strong>`,
                { sticky: true, className: 'leaflet-tooltip-custom' }
              ).openTooltip();
            }
          },
          mouseout: (e) => { layer.resetStyle(e.target); e.target.unbindTooltip(); },
          click:    ()  => { if (county) setSelected(county); },
        });
      },
    });
    layer.addTo(map);
    zipLayer.current = layer;
  }, [zipGeojson, groupBy, metric, displayCounties, minV, maxV, cfg, statistic, timeFactor, timePeriod, dataType]);

  // Load state boundaries lazily when State view is selected
  useEffect(() => {
    if (groupBy !== 'State' || stateGeojson) return;
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(r => r.json())
      .then(async us => {
        const { feature } = await import('topojson-client');
        const gj = feature(us, us.objects.states);
        setStateGeojson({
          ...gj,
          features: gj.features.filter(f =>
            ['37', '45', '13', '47', '51'].includes(String(f.id))
          ),
        });
      });
  }, [groupBy, stateGeojson]);

  // Redraw state choropleth
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !stateGeojson || groupBy !== 'State') return;
    if (stateLayer.current)  { stateLayer.current.remove();  stateLayer.current  = null; }
    if (choropleth.current)  { choropleth.current.remove();  choropleth.current  = null; }
    if (zipLayer.current)    { zipLayer.current.remove();    zipLayer.current    = null; }

    // Aggregate metrics per state
    const stateData = {};
    const STATE_FIPS = { NC: '37', SC: '45', GA: '13', TN: '47', VA: '51' };
    ['NC', 'SC', 'GA', 'TN', 'VA'].forEach(st => {
      const counties = displayCounties.filter(c => c.state === st && c[metric] != null);
      if (!counties.length) return;
      const avg = counties.reduce((s, c) => s + c[metric], 0) / counties.length;
      stateData[STATE_FIPS[st]] = { state: st, value: avg, counties };
    });

    const stateValues = Object.values(stateData).map(d => d.value);
    const sPctNorm = cfg.breaks ? makeThresholdNorm(cfg.breaks) : makePercentileNorm(stateValues);

    const layer = L.geoJSON(stateGeojson, {
      style: (feature) => {
        const id   = String(feature.id);
        const data = stateData[id];
        if (!data) return { fillColor: '#e5e7eb', fillOpacity: 0.45, color: '#fff', weight: 1.5 };
        const norm  = sPctNorm(data.value);
        const color = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: 0.82, color: '#fff', weight: 2 };
      },
      onEachFeature: (feature, lyr) => {
        const id   = String(feature.id);
        const data = stateData[id];
        lyr.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 3, color: '#16a34a', fillOpacity: 0.95 });
            if (data) {
              e.target.bindTooltip(
                `<strong>${data.state}</strong><br/>${cfg.label}: <strong>${cfg.fmt(data.value)}</strong><br/><span style="color:#888;font-size:11px">avg of ${data.counties.length} counties · ${dataType}</span>`,
                { sticky: true, className: 'leaflet-tooltip-custom' }
              ).openTooltip();
            }
          },
          mouseout: (e) => { layer.resetStyle(e.target); e.target.unbindTooltip(); },
        });
      },
    });
    layer.addTo(map);
    stateLayer.current = layer;
    map.flyToBounds(layer.getBounds(), { padding: [30, 30], duration: 0.8 });
  }, [stateGeojson, groupBy, metric, displayCounties, cfg, dataType, timePeriod]);

  // ── Pipeline deal markers ─────────────────────────────────────────────────
  function makePipelineLayer(deals, color, labelFn) {
    const group = L.layerGroup();
    deals.forEach(deal => {
      if (!deal.lat || !deal.lng) return;
      const marker = L.circleMarker([deal.lat, deal.lng], {
        radius: 8, fillColor: color, color: '#fff',
        weight: 2, fillOpacity: 0.92,
      });
      marker.bindTooltip(labelFn(deal), { sticky: true, className: 'leaflet-tooltip-custom' });
      marker.on('click', () => {
        if (leafletMap.current) leafletMap.current.flyTo([deal.lat, deal.lng], 12, { duration: 0.8 });
      });
      group.addLayer(marker);
    });
    return group;
  }

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const customDeals = (() => { try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; } })();
    const allDealOverview = [...DEAL_OVERVIEW_DEALS, ...customDeals.filter(d => d.pipeline === 'deal-overview')];
    if (showDealOverview) {
      if (!dealOverviewLayer.current) {
        dealOverviewLayer.current = makePipelineLayer(allDealOverview, '#3b82f6',
          d => `<strong>${d.address}</strong><br/>Stage: ${d.stage}<br/>Pipeline: Deal Overview`);
        dealOverviewLayer.current.addTo(map);
      }
    } else {
      if (dealOverviewLayer.current) { dealOverviewLayer.current.remove(); dealOverviewLayer.current = null; }
    }
  }, [showDealOverview, leafletMap.current]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const customDeals = (() => { try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; } })();
    const allLandAcq = [...LAND_DEALS, ...customDeals.filter(d => d.pipeline === 'land-acquisition')];
    if (showLandAcq) {
      if (!landAcqLayer.current) {
        landAcqLayer.current = makePipelineLayer(allLandAcq, '#f59e0b',
          d => `<strong>${d.address}</strong><br/>Stage: ${d.stage}<br/>Pipeline: Land Acquisition`);
        landAcqLayer.current.addTo(map);
      }
    } else {
      if (landAcqLayer.current) { landAcqLayer.current.remove(); landAcqLayer.current = null; }
    }
  }, [showLandAcq, leafletMap.current]);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const customDeals = (() => { try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; } })();
    const salesDeals = customDeals.filter(d => d.pipeline === 'sales');
    if (showSales) {
      if (!salesLayer.current) {
        salesLayer.current = makePipelineLayer(salesDeals, '#10b981',
          d => `<strong>${d.address}</strong><br/>Stage: ${d.stage}<br/>Pipeline: Sales`);
        salesLayer.current.addTo(map);
      }
    } else {
      if (salesLayer.current) { salesLayer.current.remove(); salesLayer.current = null; }
    }
  }, [showSales, leafletMap.current]);

  return (
    <div className="space-y-0 -mx-1">

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-t-xl shadow-sm">

        {/* Row 1 — primary filters */}
        <div className="flex items-center gap-1.5 px-3 py-2">

          <FilterDropdown label="View"   value={groupBy} onChange={setGroupBy}
            options={['County','State','Zip Code']} />
          <FilterDropdown label="Status" value={status}  onChange={setStatus}
            options={['Sold','For Sale']} />

          <FilterDropdown label="Time"       value={timePeriod} onChange={setTimePeriod}
            options={['7 days','14 days','30 days','90 days','6 months','1 year','2 years','3 years','5 years']} />
          <FilterDropdown label="Data"       value={dataType}   onChange={v => { setDataType(v); setSelected(null); }}
            options={['All','Land','House','Townhouse','Condo','MultiFamily','Manufactured']} />
          <FilterDropdown label="Acreage"    value={acreage}    onChange={setAcreage}
            options={['All','0-1 acre','1-2 acres','2-5 acres','5-10 acres','10-20 acres','20-50 acres','50-70 acres','70-100 acres','100-150 acres','150+ acres']} />
          <FilterDropdown label="Statistics" value={statistic}  onChange={setStatistic}
            options={['Opportunity Score','Demand Score','Transactions','Days on Market','Sell Through Rate (STR)']} />

          {/* Pipeline dropdown */}
          {(() => {
            const pipelines = [
              { label: 'Deal Overview',    state: showDealOverview, set: setShowDealOverview, dot: 'bg-blue-500' },
              { label: 'Land Acquisition', state: showLandAcq,      set: setShowLandAcq,      dot: 'bg-amber-500' },
              { label: 'Sales',            state: showSales,         set: setShowSales,         dot: 'bg-emerald-500' },
            ];
            const activeCount = pipelines.filter(p => p.state).length;
            return (
              <div className="relative group">
                <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all">
                  <Map size={11} className="text-gray-400" />
                  Pipelines{activeCount > 0 ? ` (${activeCount})` : ''}
                  <ChevronDown size={11} className="text-gray-400" />
                </button>
                <div className="absolute left-0 top-full mt-1 z-[3000] bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[170px] hidden group-focus-within:block group-hover:block">
                  {pipelines.map(({ label, state, set, dot }) => (
                    <button key={label} onClick={() => set(v => !v)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs rounded-lg hover:bg-gray-50 transition-all text-left">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot} ${state ? 'ring-2 ring-offset-1 ring-gray-300' : 'opacity-40'}`} />
                      <span className={state ? 'font-semibold text-gray-800' : 'text-gray-500'}>{label}</span>
                      {state && <span className="ml-auto text-green-500 font-bold text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Search — fills remaining space */}
          <div className="relative flex-1 min-w-0">
            <div className={`flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg border text-xs transition-all w-full
              ${searchStatus === 'error'   ? 'border-red-300 bg-red-50'
              : searchStatus === 'found'   ? 'border-green-400 bg-green-50'
              : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <Search size={11} className="text-gray-400 shrink-0" />
              <input type="text" placeholder="County or ZIP…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 min-w-0 text-xs bg-transparent outline-none placeholder-gray-400" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchInfo(null); setSearchStatus(''); }}
                  className="text-gray-400 hover:text-gray-600">
                  <X size={11} />
                </button>
              )}
            </div>
            {searchStatus === 'found' && searchInfo && (
              <span className="absolute -bottom-4 left-0 text-xs text-green-600 whitespace-nowrap font-medium">
                {searchInfo.label}
              </span>
            )}
            {searchStatus === 'error' && (
              <span className="absolute -bottom-4 left-0 text-xs text-red-500 whitespace-nowrap">
                Not found in NC/SC
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Map + Side Panel ─────────────────────────────────────────────── */}
      <div className="flex border-x border-b border-gray-200 rounded-b-xl overflow-hidden shadow-sm bg-white" style={{ height: 720 }}>

        {/* Map */}
        <div className="relative flex-1 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-400 font-medium">Loading county boundaries…</p>
            </div>
          )}
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

          {/* Legend — bottom left, LandPortal style */}
          {(() => {
            const isInverse = cfg.higherIsBetter === false;
            const breaks = cfg.breaks;
            let segments;
            if (breaks) {
              const [b0, b1, b2, b3] = breaks;
              const f = cfg.fmt;
              segments = isInverse
                ? [
                    { label: 'High',    color: 'hsl(0,85%,38%)',   val: f(b3) + '+' },
                    { label: 'Mid/high', color: 'hsl(30,85%,42%)',  val: f(b2) + '–' + f(b3) },
                    { label: 'Medium',  color: 'hsl(60,85%,46%)',  val: f(b1) + '–' + f(b2) },
                    { label: 'Mid low',  color: 'hsl(90,85%,40%)',  val: f(b0) + '–' + f(b1) },
                    { label: 'Low',     color: 'hsl(120,85%,34%)', val: '<' + f(b0) },
                  ]
                : [
                    { label: 'Low',     color: 'hsl(0,85%,38%)',   val: '<' + f(b0) },
                    { label: 'Mid low',  color: 'hsl(30,85%,42%)',  val: f(b0) + '–' + f(b1) },
                    { label: 'Medium',  color: 'hsl(60,85%,46%)',  val: f(b1) + '–' + f(b2) },
                    { label: 'Mid/high', color: 'hsl(90,85%,40%)',  val: f(b2) + '–' + f(b3) },
                    { label: 'High',    color: 'hsl(120,85%,34%)', val: f(b3) + '+' },
                  ];
            } else {
              const sorted = [...values].sort((a, b) => a - b);
              const pct = (p) => sorted.length ? sorted[Math.round(p * (sorted.length - 1))] : null;
              segments = isInverse
                ? [
                    { label: 'High',    color: 'hsl(0,85%,38%)',   val: pct(1)    != null ? cfg.fmt(pct(1))    : '–' },
                    { label: 'Mid/high', color: 'hsl(30,85%,42%)',  val: pct(0.75) != null ? cfg.fmt(pct(0.75)) : '–' },
                    { label: 'Medium',  color: 'hsl(60,85%,46%)',  val: pct(0.5)  != null ? cfg.fmt(pct(0.5))  : '–' },
                    { label: 'Mid low',  color: 'hsl(90,85%,40%)',  val: pct(0.25) != null ? cfg.fmt(pct(0.25)) : '–' },
                    { label: 'Low',     color: 'hsl(120,85%,34%)', val: pct(0)    != null ? cfg.fmt(pct(0))    : '–' },
                  ]
                : [
                    { label: 'Low',     color: 'hsl(0,85%,38%)',   val: pct(0)    != null ? cfg.fmt(pct(0))    : '–' },
                    { label: 'Mid low',  color: 'hsl(30,85%,42%)',  val: pct(0.25) != null ? cfg.fmt(pct(0.25)) : '–' },
                    { label: 'Medium',  color: 'hsl(60,85%,46%)',  val: pct(0.5)  != null ? cfg.fmt(pct(0.5))  : '–' },
                    { label: 'Mid/high', color: 'hsl(90,85%,40%)',  val: pct(0.75) != null ? cfg.fmt(pct(0.75)) : '–' },
                    { label: 'High',    color: 'hsl(120,85%,34%)', val: pct(1)    != null ? cfg.fmt(pct(1))    : '–' },
                  ];
            }
            return (
              <div className="absolute bottom-5 left-5 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg px-4 py-3 pointer-events-none" style={{ minWidth: 220 }}>
                <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Color scale · {cfg.label}</p>
                {/* Gradient bar */}
                <div className="flex h-3 rounded-full overflow-hidden mb-1">
                  {segments.map((s, i) => (
                    <div key={i} style={{ flex: 1, background: s.color }} />
                  ))}
                </div>
                {/* 5 labels with values */}
                <div className="flex">
                  {segments.map((s, i) => (
                    <div key={i} className="flex flex-col items-center" style={{ flex: 1 }}>
                      <span className="text-[10px] font-semibold text-gray-600 leading-tight">{s.label}</span>
                      <span className="text-[9px] text-gray-400 leading-tight">{s.val ?? '–'}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 border-t border-gray-100 pt-1.5">
                  {status} · {timePeriod} · {dataType}
                </p>
              </div>
            );
          })()}

          {/* Stat badge — top right, shows active filter context */}
          <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200 shadow-md px-3 py-2">
            <p className="text-xs text-gray-500 font-medium">{statistic} · {acreage === 'All' ? 'All Sizes' : acreage}</p>
            <p className="text-base font-bold text-gray-800 tabular-nums">
              {displayCounties.length} <span className="text-xs font-normal text-gray-400">counties</span>
            </p>
          </div>
        </div>

        {/* Right panel — county detail (appears on click) */}
        <div className={`flex-shrink-0 border-l border-gray-200 overflow-y-auto transition-all duration-300 bg-white ${selected ? 'w-72' : 'w-0'}`}>
          {selected && (
            <div className="p-5 space-y-4 min-w-[288px]">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-0.5">
                    {selected.state} · {dataType} · {selected.priority ? '★ Priority' : 'County'}
                  </p>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">{selected.name} County</h3>
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5">
                  <X size={14} />
                </button>
              </div>

              {/* Active metric highlight */}
              <div className="rounded-xl border-2 border-green-200 bg-green-50 px-4 py-3">
                <p className="text-xs text-green-700 font-medium mb-0.5">{cfg.label}</p>
                <p className="text-2xl font-bold text-green-800 tabular-nums">
                  {selected[metric] != null ? cfg.fmt(selected[metric]) : '–'}
                </p>
                {statistic === 'Transactions' && (
                  <p className="text-xs text-green-600 mt-1">
                    ~{Math.round(selected.absorptionRate * timeFactor * 8)} est. in {timePeriod}
                  </p>
                )}
              </div>

              {/* Score row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Opp Score</p>
                  <p className={`text-xl font-bold tabular-nums ${selected.oppScore >= 70 ? 'text-green-600' : selected.oppScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {selected.oppScore}
                  </p>
                  <p className="text-xs text-gray-400">/100</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Demand</p>
                  <p className={`text-xl font-bold tabular-nums ${selected.demandScore >= 70 ? 'text-green-600' : selected.demandScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {selected.demandScore}
                  </p>
                  <p className="text-xs text-gray-400">/100</p>
                </div>
              </div>

              {/* Data grid */}
              <div className="space-y-0 rounded-xl border border-gray-200 overflow-hidden">
                {[
                  { label: 'Days on Market',    value: selected.medianDOM + ' days' },
                  { label: 'Months of Supply',  value: selected.monthsSupply.toFixed(1) + ' mo' },
                  { label: 'Absorption Rate',   value: fmtPct(selected.absorptionRate) },
                  { label: 'Sell-Through',       value: fmtPct(selected.sellThrough) },
                  { label: 'Pop. Growth',        value: fmtPct(selected.popGrowth), highlight: selected.popGrowth >= 2 ? 'text-green-600' : selected.popGrowth < 0 ? 'text-red-500' : '' },
                ].map(({ label, value, highlight }, i) => (
                  <div key={label} className={`flex items-center justify-between px-3 py-2.5 text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                    <span className="text-gray-500">{label}</span>
                    <span className={`font-semibold text-gray-800 tabular-nums ${highlight || ''}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="flex gap-2 flex-wrap">
                {selected.mhFriendly && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                    MH Friendly
                  </span>
                )}
                {selected.priority && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    ★ Priority Market
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'heatmap',  label: 'Heat Map',        icon: Map        },
  { id: 'arv',      label: 'Market Stats',    icon: MapPin     },
  { id: 'builders', label: 'Builder Network', icon: Building2  },
  { id: 'counties', label: 'County Database', icon: Info       },
];

export default function MarketResearch() {
  const [activeTab, setActiveTab] = useState('heatmap');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Market Research</h1>
        <p className="text-sm text-gray-500 mt-1">Analyze deals, compare county markets, and find comparable sales.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'heatmap'  && <HeatMap />}
      {activeTab === 'analyzer' && <DealAnalyzer />}
      {activeTab === 'comps'    && <CompFinder />}
      {activeTab === 'builders' && <BuilderNetworkPage />}
      {activeTab === 'counties' && <CountyDatabasePage />}
      {activeTab === 'arv'      && <ArvDatabasePage />}
    </div>
  );
}
