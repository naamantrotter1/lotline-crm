import { useState } from 'react';
import { HOME_MODELS } from '../data/homeModels';
import { Search, Plus, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import Button from '../components/UI/Button';

export default function HomeModels() {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('price');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = HOME_MODELS
    .filter((m) =>
      [m.model, m.manufacturer, m.sections].some((v) =>
        v.toLowerCase().includes(search.toLowerCase())
      )
    )
    .sort((a, b) => {
      const v1 = a[sortKey];
      const v2 = b[sortKey];
      const dir = sortDir === 'asc' ? 1 : -1;
      return v1 > v2 ? dir : v1 < v2 ? -dir : 0;
    });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-accent" /> : <ChevronDown size={12} className="text-accent" />;
  };

  const TH = ({ col, label }) => (
    <th
      className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">
        {label} <SortIcon col={col} />
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Home Models</h1>
          <p className="text-sm text-gray-500 mt-1">{HOME_MODELS.length} models in catalog</p>
        </div>
        <Button>
          <Plus size={14} className="mr-1" />
          Add Model
        </Button>
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <TH col="manufacturer" label="Manufacturer" />
                <TH col="model" label="Model" />
                <TH col="sections" label="Type" />
                <TH col="beds" label="Beds" />
                <TH col="baths" label="Baths" />
                <TH col="sqft" label="Sq Ft" />
                <TH col="price" label="Price" />
                <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((model) => (
                <tr key={model.id} className="border-b border-gray-100 hover:bg-white/60 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-sidebar">{model.manufacturer}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{model.model}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      model.sections === 'Single-Wide'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {model.sections}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-center text-gray-700">{model.beds}</td>
                  <td className="py-3 px-4 text-sm text-center text-gray-700">{model.baths}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{model.sqft.toLocaleString()} sf</td>
                  <td className="py-3 px-4 text-sm font-semibold text-accent">${model.price.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    {model.link ? (
                      <a href={model.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Models', value: HOME_MODELS.length },
          { label: 'Single-Wide', value: HOME_MODELS.filter((m) => m.sections === 'Single-Wide').length },
          { label: 'Double-Wide', value: HOME_MODELS.filter((m) => m.sections === 'Double-Wide').length },
          { label: 'Avg Price', value: `$${Math.round(HOME_MODELS.reduce((s, m) => s + m.price, 0) / HOME_MODELS.length).toLocaleString()}` },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-sidebar">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
