import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import {
  Calculator, TrendingUp, Search, ExternalLink, Map,
  ArrowUpRight, ArrowDownRight, Minus, X,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt    = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtK   = (n) => n == null ? '–' : '$' + Math.round(n / 1000) + 'k';
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';
const num    = (s)  => Number(String(s).replace(/[^0-9.]/g, '')) || 0;

// ── Static county market data ─────────────────────────────────────────────────
const COUNTY_DATA = [
  {
    fips: '37019', name: 'Brunswick', state: 'NC',
    medianSalePrice: 385000, medianDOM: 42, monthsSupply: 3.2,
    absorptionRate: 31.2, activeListing: 412, soldCount: 128,
    oppScore: 78, demandScore: 82, mhFriendly: true, priority: true,
    popGrowth: 4.8, medianIncome: 62400, unemployment: 3.9,
    listToSale: 98.2, sellThrough: 71.4,
  },
  {
    fips: '37081', name: 'Guilford', state: 'NC',
    medianSalePrice: 295000, medianDOM: 28, monthsSupply: 2.1,
    absorptionRate: 47.6, activeListing: 631, soldCount: 301,
    oppScore: 72, demandScore: 88, mhFriendly: true, priority: true,
    popGrowth: 1.2, medianIncome: 55800, unemployment: 4.2,
    listToSale: 99.1, sellThrough: 84.2,
  },
  {
    fips: '45051', name: 'Horry', state: 'SC',
    medianSalePrice: 310000, medianDOM: 38, monthsSupply: 3.8,
    absorptionRate: 26.3, activeListing: 892, soldCount: 234,
    oppScore: 74, demandScore: 79, mhFriendly: true, priority: true,
    popGrowth: 3.6, medianIncome: 51200, unemployment: 4.8,
    listToSale: 97.4, sellThrough: 66.7,
  },
  {
    fips: '37067', name: 'Forsyth', state: 'NC',
    medianSalePrice: 265000, medianDOM: 31, monthsSupply: 2.4,
    absorptionRate: 41.7, activeListing: 445, soldCount: 185,
    oppScore: 68, demandScore: 75, mhFriendly: false, priority: false,
    popGrowth: 0.9, medianIncome: 53100, unemployment: 4.5,
    listToSale: 98.8, sellThrough: 80.1,
  },
  {
    fips: '37119', name: 'Mecklenburg', state: 'NC',
    medianSalePrice: 420000, medianDOM: 22, monthsSupply: 1.8,
    absorptionRate: 55.6, activeListing: 1240, soldCount: 689,
    oppScore: 65, demandScore: 91, mhFriendly: false, priority: false,
    popGrowth: 2.1, medianIncome: 72300, unemployment: 3.4,
    listToSale: 99.8, sellThrough: 88.6,
  },
  {
    fips: '37183', name: 'Wake', state: 'NC',
    medianSalePrice: 465000, medianDOM: 19, monthsSupply: 1.6,
    absorptionRate: 62.5, activeListing: 1820, soldCount: 1138,
    oppScore: 61, demandScore: 94, mhFriendly: false, priority: false,
    popGrowth: 2.8, medianIncome: 84600, unemployment: 3.1,
    listToSale: 100.2, sellThrough: 91.3,
  },
  {
    fips: '37051', name: 'Cumberland', state: 'NC',
    medianSalePrice: 198000, medianDOM: 45, monthsSupply: 4.1,
    absorptionRate: 24.4, activeListing: 387, soldCount: 94,
    oppScore: 71, demandScore: 66, mhFriendly: true, priority: false,
    popGrowth: -0.3, medianIncome: 46800, unemployment: 5.8,
    listToSale: 96.8, sellThrough: 62.3,
  },
  {
    fips: '45015', name: 'Berkeley', state: 'SC',
    medianSalePrice: 345000, medianDOM: 35, monthsSupply: 3.1,
    absorptionRate: 32.3, activeListing: 521, soldCount: 168,
    oppScore: 69, demandScore: 77, mhFriendly: true, priority: false,
    popGrowth: 3.1, medianIncome: 64200, unemployment: 3.7,
    listToSale: 98.0, sellThrough: 72.4,
  },
  {
    fips: '45045', name: 'Greenville', state: 'SC',
    medianSalePrice: 318000, medianDOM: 29, monthsSupply: 2.6,
    absorptionRate: 38.5, activeListing: 712, soldCount: 274,
    oppScore: 70, demandScore: 83, mhFriendly: false, priority: false,
    popGrowth: 2.4, medianIncome: 58900, unemployment: 3.9,
    listToSale: 99.0, sellThrough: 78.3,
  },
  {
    fips: '45083', name: 'Spartanburg', state: 'SC',
    medianSalePrice: 275000, medianDOM: 33, monthsSupply: 2.8,
    absorptionRate: 35.7, activeListing: 498, soldCount: 178,
    oppScore: 66, demandScore: 71, mhFriendly: true, priority: false,
    popGrowth: 1.8, medianIncome: 52400, unemployment: 4.3,
    listToSale: 97.9, sellThrough: 74.5,
  },
];

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
  { key: 'oppScore',        label: 'Opp Score' },
  { key: 'demandScore',     label: 'Demand' },
  { key: 'monthsSupply',    label: 'Mo. Supply' },
  { key: 'absorptionRate',  label: 'Abs. Rate' },
  { key: 'medianSalePrice', label: 'Med. Sale' },
  { key: 'medianDOM',       label: 'DOM' },
  { key: 'listToSale',      label: 'L/S Ratio' },
  { key: 'sellThrough',     label: 'Sell Thru' },
  { key: 'activeListing',   label: 'Active' },
  { key: 'soldCount',       label: 'Sold' },
  { key: 'popGrowth',       label: 'Pop Growth' },
  { key: 'medianIncome',    label: 'Med. Income' },
  { key: 'unemployment',    label: 'Unemp.' },
];

function MarketStats() {
  const [stateFilter, setStateFilter] = useState('Both');
  const [sort, setSort] = useState({ col: 'oppScore', dir: -1 });
  const [search, setSearch] = useState('');

  const handleSort = (col) => setSort(p => p.col === col ? { col, dir: -p.dir } : { col, dir: -1 });

  const filtered = COUNTY_DATA
    .filter(r => stateFilter === 'Both' || r.state === stateFilter)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
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
      {/* Toolbar */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {['Both', 'NC', 'SC'].map(s => (
            <button key={s} onClick={() => setStateFilter(s)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${stateFilter === s ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="relative ml-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter county..." className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 w-40" />
        </div>
        <span className="text-xs text-gray-400 ml-2">{filtered.length} counties</span>
        <button onClick={exportCsv} className="ml-auto text-xs text-gray-500 hover:text-accent transition-colors font-medium">Export CSV</button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                {SORT_COLS.map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    className={`text-left py-3 px-3 font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-accent transition-colors ${sort.col === key ? 'text-accent' : 'text-gray-500'}`}>
                    {label} {sort.col === key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">MH Zone</th>
                <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.fips} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="py-3 px-3 font-semibold text-sidebar whitespace-nowrap">{r.name}, {r.state}</td>
                  <td className="py-3 px-3"><ScoreBadge score={r.oppScore} /></td>
                  <td className="py-3 px-3"><ScoreBadge score={r.demandScore} /></td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.monthsSupply.toFixed(1)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.absorptionRate)}</td>
                  <td className="py-3 px-3 tabular-nums font-semibold text-sidebar">{fmtK(r.medianSalePrice)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.medianDOM}d</td>
                  <td className="py-3 px-3 tabular-nums">
                    <span className={r.listToSale >= 98 ? 'text-green-600' : 'text-gray-600'}>{fmtPct(r.listToSale)}</span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.sellThrough)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.activeListing}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{r.soldCount}</td>
                  <td className="py-3 px-3 tabular-nums">
                    <span className={r.popGrowth >= 0 ? 'text-green-600' : 'text-red-500'}>
                      <TrendIcon val={r.popGrowth} /> {fmtPct(r.popGrowth)}
                    </span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtK(r.medianIncome)}</td>
                  <td className="py-3 px-3 tabular-nums text-gray-600">{fmtPct(r.unemployment)}</td>
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
          {filtered.length} of {COUNTY_DATA.length} counties · Manufactured home market data
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
  oppScore:        { label: 'Opportunity Score',  higherIsBetter: true,  fmt: v => v.toFixed(0) + '/100' },
  demandScore:     { label: 'Demand Score',       higherIsBetter: true,  fmt: v => v.toFixed(0) + '/100' },
  medianSalePrice: { label: 'Median Sale Price',  higherIsBetter: null,  fmt: v => '$' + Math.round(v/1000) + 'k' },
  medianDOM:       { label: 'Days on Market',     higherIsBetter: false, fmt: v => v.toFixed(0) + 'd' },
  monthsSupply:    { label: 'Months of Supply',   higherIsBetter: false, fmt: v => v.toFixed(1) },
  absorptionRate:  { label: 'Absorption Rate',    higherIsBetter: true,  fmt: v => v.toFixed(1) + '%' },
  popGrowth:       { label: 'Pop. Growth',        higherIsBetter: true,  fmt: v => v.toFixed(1) + '%' },
  medianIncome:    { label: 'Median Income',      higherIsBetter: true,  fmt: v => '$' + Math.round(v/1000) + 'k' },
};

function normalize(val, min, max) {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

function scoreToColor(norm, higherIsBetter) {
  const t = higherIsBetter === false ? (1 - norm) : norm;
  const hue = Math.round(t * 120); // 0=red, 60=yellow, 120=green
  return `hsl(${hue}, 70%, 42%)`;
}

function HeatMap() {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const choropleth = useRef(null);
  const [metric, setMetric]   = useState('oppScore');
  const [geojson, setGeojson] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);

  // Load NC+SC county boundaries from CDN
  useEffect(() => {
    setLoading(true);
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json')
      .then(r => r.json())
      .then(async us => {
        const { feature } = await import('topojson-client');
        const gj = feature(us, us.objects.counties);
        const filtered = {
          ...gj,
          features: gj.features.filter(f =>
            String(f.id).startsWith('37') || String(f.id).startsWith('45')
          ),
        };
        setGeojson(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Init Leaflet
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [35.0, -79.8],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
  }, []);

  // Draw choropleth when geojson or metric changes
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !geojson) return;
    if (choropleth.current) { choropleth.current.remove(); choropleth.current = null; }

    const cfg = METRIC_CONFIG[metric];
    const values = COUNTY_DATA.map(c => c[metric]).filter(v => v != null);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const fips = String(feature.id).padStart(5, '0');
        const county = COUNTY_DATA.find(c => c.fips === fips);
        if (!county || county[metric] == null) {
          return { fillColor: '#e5e7eb', fillOpacity: 0.6, color: '#fff', weight: 1 };
        }
        const norm  = normalize(county[metric], minV, maxV);
        const color = scoreToColor(norm, cfg.higherIsBetter);
        return { fillColor: color, fillOpacity: 0.75, color: '#fff', weight: 1 };
      },
      onEachFeature: (feature, lyr) => {
        const fips = String(feature.id).padStart(5, '0');
        const county = COUNTY_DATA.find(c => c.fips === fips);
        lyr.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2.5, color: '#f97316', fillOpacity: 0.9 });
            if (county) {
              const val = county[metric] != null ? cfg.fmt(county[metric]) : '–';
              e.target.bindTooltip(
                `<strong>${county.name} County, ${county.state}</strong><br/>${cfg.label}: ${val}`,
                { sticky: true, className: 'leaflet-tooltip-custom' }
              ).openTooltip();
            }
          },
          mouseout: (e) => {
            layer.resetStyle(e.target);
            e.target.unbindTooltip();
          },
          click: () => { if (county) setSelected(county); },
        });
      },
    });

    layer.addTo(map);
    choropleth.current = layer;
  }, [geojson, metric]);

  const cfg = METRIC_CONFIG[metric];
  const values = COUNTY_DATA.map(c => c[metric]).filter(v => v != null);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm px-5 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Color by:</span>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(METRIC_CONFIG).map(([key, { label }]) => (
            <button key={key} onClick={() => setMetric(key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${metric === key ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden" style={{ height: 520 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10 rounded-xl">
              <p className="text-sm text-gray-400">Loading county boundaries…</p>
            </div>
          )}
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

          {/* Legend */}
          <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl border border-gray-100 shadow-sm px-4 py-3 pointer-events-none">
            <p className="text-xs font-bold text-gray-500 mb-2">{cfg.label}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{cfg.higherIsBetter === false ? 'Better' : 'Lower'}</span>
              <div className="w-28 h-3 rounded-full" style={{
                background: cfg.higherIsBetter === false
                  ? 'linear-gradient(to right, hsl(120,70%,42%), hsl(60,70%,42%), hsl(0,70%,42%))'
                  : 'linear-gradient(to right, hsl(0,70%,42%), hsl(60,70%,42%), hsl(120,70%,42%))',
              }} />
              <span className="text-xs text-gray-500">{cfg.higherIsBetter === false ? 'Worse' : 'Higher'}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{cfg.fmt(minV)}</span>
              <span>{cfg.fmt(maxV)}</span>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-72 flex-shrink-0 space-y-3">
          {selected ? (
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Selected County</p>
                  <h3 className="text-base font-bold text-sidebar">{selected.name} County, {selected.state}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Opp Score',    value: selected.oppScore + '/100',            color: selected.oppScore >= 70 ? 'text-green-600' : 'text-yellow-600' },
                  { label: 'Demand Score', value: selected.demandScore + '/100',          color: selected.demandScore >= 70 ? 'text-green-600' : 'text-yellow-600' },
                  { label: 'Median Price', value: fmtK(selected.medianSalePrice),         color: 'text-sidebar' },
                  { label: 'Days on Mkt',  value: selected.medianDOM + 'd',               color: selected.medianDOM <= 30 ? 'text-green-600' : 'text-yellow-600' },
                  { label: 'Mo. Supply',   value: selected.monthsSupply.toFixed(1),       color: selected.monthsSupply < 4 ? 'text-green-600' : 'text-yellow-600' },
                  { label: 'Absorption',   value: fmtPct(selected.absorptionRate),        color: 'text-sidebar' },
                  { label: 'Pop Growth',   value: fmtPct(selected.popGrowth),             color: selected.popGrowth >= 0 ? 'text-green-600' : 'text-red-500' },
                  { label: 'Med Income',   value: fmtK(selected.medianIncome),            color: 'text-sidebar' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className={`text-sm font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selected.mhFriendly && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">MH Friendly</span>}
                {selected.priority   && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent">★ Priority Market</span>}
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center text-center gap-3" style={{ minHeight: 200 }}>
              <Map size={28} className="text-gray-200" />
              <p className="text-sm text-gray-400">Click a county on the map to see its market details</p>
            </div>
          )}

          {/* Rankings */}
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-sidebar">{cfg.label} Rankings</p>
            </div>
            <div className="divide-y divide-gray-50">
              {[...COUNTY_DATA]
                .filter(c => c[metric] != null)
                .sort((a, b) => cfg.higherIsBetter === false ? a[metric] - b[metric] : b[metric] - a[metric])
                .map((c, i) => {
                  const norm  = normalize(c[metric], minV, maxV);
                  const color = scoreToColor(norm, cfg.higherIsBetter);
                  return (
                    <div key={c.fips}
                      onClick={() => setSelected(c)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.fips === c.fips ? 'bg-accent/5' : ''}`}>
                      <span className="text-xs text-gray-400 w-4 text-right font-mono">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-sidebar truncate">{c.name}, {c.state}</p>
                      </div>
                      <span className="text-xs font-bold tabular-nums" style={{ color }}>{cfg.fmt(c[metric])}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'heatmap',  label: 'Heat Map',      icon: Map        },
  { id: 'analyzer', label: 'Deal Analyzer', icon: Calculator },
  { id: 'stats',    label: 'Market Stats',  icon: TrendingUp },
  { id: 'comps',    label: 'Comp Finder',   icon: Search     },
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
      {activeTab === 'stats'    && <MarketStats />}
      {activeTab === 'comps'    && <CompFinder />}
    </div>
  );
}
