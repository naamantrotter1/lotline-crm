import { useState } from 'react';
import { Archive } from 'lucide-react';
import { useDeals } from '../lib/DealsContext';

export default function ArchivedDeals() {
  const [tab, setTab] = useState('land');
  const { archivedDeals, deals } = useDeals();

  // Combine deals marked isArchived from main deals list + dedicated archived list
  const allArchivedDeals = [
    ...archivedDeals,
    ...deals.filter(d => d.isArchived),
  ].filter((d, i, arr) => arr.findIndex(x => String(x.id) === String(d.id)) === i);

  const landArchived = allArchivedDeals.filter(d =>
    d.pipeline === 'Land Acquisition' || d.pipeline === 'land-acquisition'
  );
  const dealArchived = allArchivedDeals.filter(d =>
    d.pipeline === 'Deal Overview' || d.pipeline === 'deal-overview'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-500 rounded-lg">
          <Archive size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Archived Deals</h1>
          <p className="text-sm text-gray-500">Deals that have been removed from active pipelines</p>
        </div>
      </div>

      <div className="flex bg-card rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('land')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'land' ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500'}`}
        >
          Land Acquisition ({landArchived.length})
        </button>
        <button
          onClick={() => setTab('deals')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'deals' ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500'}`}
        >
          Deal Overview ({dealArchived.length})
        </button>
      </div>

      {tab === 'land' && (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Address</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Pipeline</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Last Stage</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Archived Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ARV</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {landArchived.map((deal) => (
                <tr key={deal.id} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-800">{deal.address}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{deal.pipeline}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{deal.lastStage}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">{deal.archivedDate}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-700">
                    {deal.arv ? `$${deal.arv.toLocaleString()}` : '—'}
                  </td>
                  <td className={`py-3 px-4 text-sm text-right font-semibold ${(deal.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {deal.netProfit !== undefined ? `$${deal.netProfit.toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deals' && dealArchived.length === 0 && (
        <div className="bg-card rounded-xl shadow-sm p-8 text-center text-gray-400">
          <Archive size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No archived deal overview entries</p>
        </div>
      )}

      {tab === 'deals' && dealArchived.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Address</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Pipeline</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Last Stage</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Archived Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ARV</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Net Profit</th>
              </tr>
            </thead>
            <tbody>
              {dealArchived.map((deal) => (
                <tr key={deal.id} className="border-b border-gray-100 hover:bg-white/50 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-800">{deal.address}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{deal.pipeline}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{deal.lastStage}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">{deal.archivedDate}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-700">
                    {deal.arv ? `$${deal.arv.toLocaleString()}` : '—'}
                  </td>
                  <td className={`py-3 px-4 text-sm text-right font-semibold ${(deal.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {deal.netProfit !== undefined ? `$${deal.netProfit.toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
