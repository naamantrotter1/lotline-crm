import { MapPin } from 'lucide-react';

const ARV_DATA = [
  { county: 'Brunswick', state: 'NC', minArv: 220000, maxArv: 280000, avgArv: 255000, comps: 12, lastUpdated: '2026-03' },
  { county: 'Duplin', state: 'NC', minArv: 230000, maxArv: 275000, avgArv: 252000, comps: 7, lastUpdated: '2026-03' },
  { county: 'Dorchester', state: 'SC', minArv: 265000, maxArv: 330000, avgArv: 300000, comps: 9, lastUpdated: '2026-04' },
  { county: 'Chowan', state: 'NC', minArv: 200000, maxArv: 260000, avgArv: 230000, comps: 5, lastUpdated: '2026-03' },
  { county: 'Rutherford', state: 'NC', minArv: 210000, maxArv: 270000, avgArv: 245000, comps: 8, lastUpdated: '2026-03' },
  { county: 'Marion', state: 'SC', minArv: 230000, maxArv: 275000, avgArv: 255000, comps: 14, lastUpdated: '2026-03' },
  { county: 'Lincoln', state: 'NC', minArv: 210000, maxArv: 260000, avgArv: 235000, comps: 6, lastUpdated: '2026-02' },
  { county: 'Rowan', state: 'NC', minArv: 210000, maxArv: 260000, avgArv: 235000, comps: 10, lastUpdated: '2026-03' },
  { county: 'Horry', state: 'SC', minArv: 225000, maxArv: 310000, avgArv: 265000, comps: 25, lastUpdated: '2026-04' },
  { county: 'Iredell', state: 'NC', minArv: 220000, maxArv: 280000, avgArv: 250000, comps: 11, lastUpdated: '2026-03' },
  { county: 'York', state: 'SC', minArv: 265000, maxArv: 340000, avgArv: 300000, comps: 8, lastUpdated: '2026-04' },
];

export default function ArvDatabase() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <MapPin size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">ARV Database</h1>
          <p className="text-sm text-gray-500">After-repair value comparables by county</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Counties Tracked', value: ARV_DATA.length },
          { label: 'Total Comps', value: ARV_DATA.reduce((s, d) => s + d.comps, 0) },
          { label: 'Avg ARV (All Markets)', value: `$${Math.round(ARV_DATA.reduce((s, d) => s + d.avgArv, 0) / ARV_DATA.length).toLocaleString()}` },
          { label: 'States Tracked', value: 2 },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-sidebar">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">County</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">State</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Min ARV</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Avg ARV</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Max ARV</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Comps</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Updated</th>
            </tr>
          </thead>
          <tbody>
            {ARV_DATA.map((row) => (
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
      </div>
    </div>
  );
}
