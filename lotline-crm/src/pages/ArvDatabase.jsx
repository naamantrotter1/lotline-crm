import { useState, useMemo } from 'react';
import { MapPin, Search } from 'lucide-react';

const ARV_DATA = [
  { county: 'Alamance', state: 'NC', minArv: 150000, maxArv: 220900, avgArv: 191700, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Bertie', state: 'NC', minArv: 35000, maxArv: 35000, avgArv: 35000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Brunswick', state: 'NC', minArv: 125000, maxArv: 265000, avgArv: 199326, comps: 25, lastUpdated: 'Apr 2026' },
  { county: 'Buncombe', state: 'NC', minArv: 231000, maxArv: 400000, avgArv: 296368, comps: 19, lastUpdated: 'Apr 2026' },
  { county: 'Burke', state: 'NC', minArv: 125000, maxArv: 237000, avgArv: 198550, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Caldwell', state: 'NC', minArv: 167500, maxArv: 257500, avgArv: 221800, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Carteret', state: 'NC', minArv: 190000, maxArv: 249400, avgArv: 223471, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Caswell', state: 'NC', minArv: 130000, maxArv: 130000, avgArv: 130000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Catawba', state: 'NC', minArv: 170000, maxArv: 215000, avgArv: 189000, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Chowan', state: 'NC', minArv: 120000, maxArv: 250000, avgArv: 175200, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Clay', state: 'NC', minArv: 135000, maxArv: 135000, avgArv: 135000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Columbus', state: 'NC', minArv: 120000, maxArv: 231000, avgArv: 178580, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Craven', state: 'NC', minArv: 160000, maxArv: 255500, avgArv: 208757, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Cumberland', state: 'NC', minArv: 175000, maxArv: 260000, avgArv: 215975, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Currituck', state: 'NC', minArv: 180000, maxArv: 180000, avgArv: 180000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Dare', state: 'NC', minArv: 186000, maxArv: 186000, avgArv: 186000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Davidson', state: 'NC', minArv: 105200, maxArv: 106000, avgArv: 105600, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Davie', state: 'NC', minArv: 106000, maxArv: 115000, avgArv: 110500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Duplin', state: 'NC', minArv: 145000, maxArv: 175000, avgArv: 160000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Durham', state: 'NC', minArv: 150000, maxArv: 280000, avgArv: 215000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Edgecombe', state: 'NC', minArv: 75000, maxArv: 125000, avgArv: 100000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Forsyth', state: 'NC', minArv: 105000, maxArv: 105000, avgArv: 105000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Franklin', state: 'NC', minArv: 165000, maxArv: 240000, avgArv: 202500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Gaston', state: 'NC', minArv: 175000, maxArv: 320000, avgArv: 224292, comps: 13, lastUpdated: 'Apr 2026' },
  { county: 'Graham', state: 'NC', minArv: 658000, maxArv: 658000, avgArv: 658000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Granville', state: 'NC', minArv: 124735, maxArv: 124735, avgArv: 124735, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Guilford', state: 'NC', minArv: 135000, maxArv: 220000, avgArv: 182975, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Harnett', state: 'NC', minArv: 176220, maxArv: 205000, avgArv: 190610, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Haywood', state: 'NC', minArv: 65000, maxArv: 65000, avgArv: 65000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Henderson', state: 'NC', minArv: 210000, maxArv: 318000, avgArv: 249322, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Hertford', state: 'NC', minArv: 30500, maxArv: 30500, avgArv: 30500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Hoke', state: 'NC', minArv: 143000, maxArv: 275000, avgArv: 193522, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Iredell', state: 'NC', minArv: 155000, maxArv: 281000, avgArv: 234371, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Johnston', state: 'NC', minArv: 205000, maxArv: 249900, avgArv: 220033, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Jones', state: 'NC', minArv: 125000, maxArv: 200000, avgArv: 164500, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Lee', state: 'NC', minArv: 90000, maxArv: 155000, avgArv: 122500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Lenoir', state: 'NC', minArv: 115000, maxArv: 178000, avgArv: 153300, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Lincoln', state: 'NC', minArv: 140000, maxArv: 259000, avgArv: 202091, comps: 11, lastUpdated: 'Apr 2026' },
  { county: 'Macon', state: 'NC', minArv: 59000, maxArv: 59000, avgArv: 59000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Madison', state: 'NC', minArv: 95000, maxArv: 95000, avgArv: 95000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Martin', state: 'NC', minArv: 25000, maxArv: 30000, avgArv: 27500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'McDowell', state: 'NC', minArv: 155000, maxArv: 270000, avgArv: 222667, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Mecklenburg', state: 'NC', minArv: 230000, maxArv: 255000, avgArv: 242500, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Moore', state: 'NC', minArv: 140000, maxArv: 175000, avgArv: 160375, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Nash', state: 'NC', minArv: 115500, maxArv: 214900, avgArv: 174971, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'New Hanover', state: 'NC', minArv: 220000, maxArv: 330000, avgArv: 267000, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Northampton', state: 'NC', minArv: 100000, maxArv: 100000, avgArv: 100000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Onslow', state: 'NC', minArv: 160000, maxArv: 275000, avgArv: 213276, comps: 17, lastUpdated: 'Apr 2026' },
  { county: 'Orange', state: 'NC', minArv: 145000, maxArv: 300000, avgArv: 216429, comps: 7, lastUpdated: 'Apr 2026' },
  { county: 'Pamlico', state: 'NC', minArv: 165000, maxArv: 211000, avgArv: 191500, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Pasquotank', state: 'NC', minArv: 209000, maxArv: 235000, avgArv: 222000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Pender', state: 'NC', minArv: 130000, maxArv: 285000, avgArv: 211568, comps: 37, lastUpdated: 'Apr 2026' },
  { county: 'Perquimans', state: 'NC', minArv: 120000, maxArv: 232000, avgArv: 188796, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Pitt', state: 'NC', minArv: 40000, maxArv: 80000, avgArv: 60000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Randolph', state: 'NC', minArv: 140000, maxArv: 273145, avgArv: 212807, comps: 21, lastUpdated: 'Apr 2026' },
  { county: 'Robeson', state: 'NC', minArv: 137000, maxArv: 222900, avgArv: 177170, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Rockingham', state: 'NC', minArv: 130000, maxArv: 199900, avgArv: 172040, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Rowan', state: 'NC', minArv: 170000, maxArv: 328000, avgArv: 238253, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Rutherford', state: 'NC', minArv: 115000, maxArv: 225000, avgArv: 176258, comps: 12, lastUpdated: 'Apr 2026' },
  { county: 'Sampson', state: 'NC', minArv: 80000, maxArv: 174383, avgArv: 138423, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Scotland', state: 'NC', minArv: 145000, maxArv: 187000, avgArv: 166000, comps: 2, lastUpdated: 'Apr 2026' },
  { county: 'Stanly', state: 'NC', minArv: 174000, maxArv: 339500, avgArv: 254278, comps: 9, lastUpdated: 'Apr 2026' },
  { county: 'Stokes', state: 'NC', minArv: 165000, maxArv: 165000, avgArv: 165000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Surry', state: 'NC', minArv: 196000, maxArv: 257000, avgArv: 223000, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Swain', state: 'NC', minArv: 111500, maxArv: 111500, avgArv: 111500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Transylvania', state: 'NC', minArv: 145900, maxArv: 299000, avgArv: 233940, comps: 10, lastUpdated: 'Apr 2026' },
  { county: 'Tyrrell', state: 'NC', minArv: 7500, maxArv: 7500, avgArv: 7500, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Union', state: 'NC', minArv: 170000, maxArv: 352500, avgArv: 258156, comps: 20, lastUpdated: 'Apr 2026' },
  { county: 'Vance', state: 'NC', minArv: 155000, maxArv: 275000, avgArv: 232900, comps: 5, lastUpdated: 'Apr 2026' },
  { county: 'Wake', state: 'NC', minArv: 228960, maxArv: 339000, avgArv: 273561, comps: 14, lastUpdated: 'Apr 2026' },
  { county: 'Warren', state: 'NC', minArv: 168958, maxArv: 288500, avgArv: 231226, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Washington', state: 'NC', minArv: 113500, maxArv: 175000, avgArv: 137833, comps: 3, lastUpdated: 'Apr 2026' },
  { county: 'Wayne', state: 'NC', minArv: 120000, maxArv: 212600, avgArv: 178550, comps: 6, lastUpdated: 'Apr 2026' },
  { county: 'Wilkes', state: 'NC', minArv: 168000, maxArv: 240000, avgArv: 216113, comps: 8, lastUpdated: 'Apr 2026' },
  { county: 'Wilson', state: 'NC', minArv: 738000, maxArv: 738000, avgArv: 738000, comps: 1, lastUpdated: 'Apr 2026' },
  { county: 'Yadkin', state: 'NC', minArv: 100000, maxArv: 156000, avgArv: 135750, comps: 4, lastUpdated: 'Apr 2026' },
  { county: 'Yancey', state: 'NC', minArv: 123043, maxArv: 240000, avgArv: 201395, comps: 8, lastUpdated: 'Apr 2026' },
];

const AVG_ARV_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: 'Under $100k', min: 0, max: 100000 },
  { label: '$100k – $150k', min: 100000, max: 150000 },
  { label: '$150k – $200k', min: 150000, max: 200000 },
  { label: '$200k – $250k', min: 200000, max: 250000 },
  { label: '$250k+', min: 250000, max: Infinity },
];

const STATE_OPTIONS = ['All', ...Array.from(new Set(ARV_DATA.map(d => d.state))).sort()];

export default function ArvDatabase() {
  const [stateFilter, setStateFilter] = useState('All');
  const [arvRange, setArvRange] = useState('All');
  const [minComps, setMinComps] = useState('All');
  const [countySearch, setCountySearch] = useState('');
  const [sortKey, setSortKey] = useState('county');
  const [sortDir, setSortDir] = useState('asc');

  const filtered = useMemo(() => {
    const range = AVG_ARV_RANGES.find(r => r.label === arvRange) || AVG_ARV_RANGES[0];
    const minCompsNum = minComps === 'All' ? 0 : parseInt(minComps);

    return [...ARV_DATA]
      .filter(d =>
        (stateFilter === 'All' || d.state === stateFilter) &&
        d.avgArv >= range.min && d.avgArv < range.max &&
        d.comps >= minCompsNum &&
        d.county.toLowerCase().includes(countySearch.toLowerCase())
      )
      .sort((a, b) => {
        let av = a[sortKey], bv = b[sortKey];
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [stateFilter, arvRange, minComps, countySearch, sortKey, sortDir]);

  const totalComps = filtered.reduce((s, d) => s + d.comps, 0);
  const avgOfAvgs = filtered.length ? Math.round(filtered.reduce((s, d) => s + d.avgArv, 0) / filtered.length) : 0;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortArrow = ({ col }) => (
    <span className="ml-1 opacity-50">
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <MapPin size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">ARV Database</h1>
          <p className="text-sm text-gray-500">NC manufactured home sold comps — Zillow (built 2022–2026)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Counties Shown', value: filtered.length },
          { label: 'Total Comps', value: totalComps.toLocaleString() },
          { label: 'Avg ARV (Filtered)', value: `$${avgOfAvgs.toLocaleString()}` },
          { label: 'States', value: Array.from(new Set(filtered.map(d => d.state))).join(', ') || '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-sidebar">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* County search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search county..."
              value={countySearch}
              onChange={e => setCountySearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-accent w-40"
            />
          </div>

          {/* State */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">State</label>
            <select
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white"
            >
              {STATE_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Avg ARV range */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Avg ARV</label>
            <select
              value={arvRange}
              onChange={e => setArvRange(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white"
            >
              {AVG_ARV_RANGES.map(r => <option key={r.label}>{r.label}</option>)}
            </select>
          </div>

          {/* Min comps */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-gray-500 font-medium">Min Comps</label>
            <select
              value={minComps}
              onChange={e => setMinComps(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent bg-white"
            >
              {['All', '2', '3', '5', '10'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {(stateFilter !== 'All' || arvRange !== 'All' || minComps !== 'All' || countySearch) && (
            <button
              onClick={() => { setStateFilter('All'); setArvRange('All'); setMinComps('All'); setCountySearch(''); }}
              className="text-xs text-accent hover:underline ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                { key: 'county', label: 'County' },
                { key: 'state', label: 'State' },
                { key: 'minArv', label: 'Min ARV' },
                { key: 'avgArv', label: 'Avg ARV' },
                { key: 'maxArv', label: 'Max ARV' },
                { key: 'comps', label: 'Comps' },
                { key: 'lastUpdated', label: 'Updated' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none
                    ${col.key === 'county' || col.key === 'state' ? 'text-left' : 'text-right'}`}
                >
                  {col.label}<SortArrow col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-gray-400">No counties match the current filters.</td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={`${row.county}-${row.state}`} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                <td className="py-3 px-4 text-sm font-medium text-sidebar">{row.county}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.state === 'NC' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {row.state}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-600">${row.minArv.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-right font-semibold text-accent">${row.avgArv.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-right text-gray-600">${row.maxArv.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-right text-gray-600">{row.comps}</td>
                <td className="py-3 px-4 text-sm text-right text-gray-400">{row.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          Source: Zillow sold listings · NC manufactured homes built 2022–2026 · 984 listings collected · 851 mapped to counties · Outliers removed · Updated April 2026
        </div>
      </div>
    </div>
  );
}
