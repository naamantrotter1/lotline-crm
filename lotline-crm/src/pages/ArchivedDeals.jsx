import { useState } from 'react';
import { Archive, XCircle } from 'lucide-react';
import { useDeals } from '../lib/DealsContext';

function StatusBadge({ deal }) {
  if (deal.deadDeal) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
        <XCircle size={10} /> Dead Deal
      </span>
    );
  }
  return (
    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
      Archived
    </span>
  );
}

function DealsTable({ deals }) {
  if (deals.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-8 text-center text-gray-400">
        <Archive size={40} className="mx-auto mb-3 text-gray-300" />
        <p>No deals in this view</p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Address</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Last Stage</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Archived Date</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ARV</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id} className={`border-b border-gray-100 hover:bg-white/50 transition-colors ${deal.deadDeal ? 'bg-red-50/30' : ''}`}>
              <td className="py-3 px-4 text-sm text-gray-800">{deal.address}</td>
              <td className="py-3 px-4"><StatusBadge deal={deal} /></td>
              <td className="py-3 px-4">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {deal.lastStage || deal.stage || '—'}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-gray-500">
                {deal.archivedAt ? new Date(deal.archivedAt).toLocaleDateString() : (deal.archivedDate || '—')}
              </td>
              <td className="py-3 px-4 text-sm text-right text-gray-700">
                {deal.arv ? `$${Number(deal.arv).toLocaleString()}` : '—'}
              </td>
              <td className={`py-3 px-4 text-sm text-right font-semibold ${(deal.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {deal.netProfit !== undefined ? `$${deal.netProfit.toLocaleString()}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'dead',     label: 'Dead Deals' },
  { value: 'archived', label: 'Archived' },
];

export default function ArchivedDeals() {
  const [tab, setTab] = useState('land');
  const [filter, setFilter] = useState('all');
  const { archivedDeals, deals } = useDeals();

  const allArchivedDeals = [
    ...archivedDeals,
    ...deals.filter(d => d.isArchived),
  ].filter((d, i, arr) => arr.findIndex(x => String(x.id) === String(d.id)) === i);

  const landArchived = allArchivedDeals.filter(d =>
    d.pipeline === 'Land Acquisition' || d.pipeline === 'land-acquisition'
  );
  const dealArchived = allArchivedDeals.filter(d =>
    d.pipeline === 'Deal Overview' || d.pipeline === 'deal-overview' ||
    // Deals that entered Deal Overview have contract_signed_at set even if pipeline slug didn't update
    (d.contractSignedAt && d.pipeline !== 'Land Acquisition' && d.pipeline !== 'land-acquisition')
  );

  const applyFilter = (list) => {
    if (filter === 'dead')     return list.filter(d => d.deadDeal);
    if (filter === 'archived') return list.filter(d => !d.deadDeal);
    return list;
  };

  const activeList = tab === 'land' ? landArchived : dealArchived;
  const deadCount  = activeList.filter(d => d.deadDeal).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-500 rounded-lg">
          <Archive size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Archived Deals</h1>
          <p className="text-sm text-gray-500">Deals removed from active pipelines</p>
        </div>
      </div>

      {/* Pipeline tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
            {dealArchived.filter(d => d.deadDeal).length > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                <XCircle size={9} />{dealArchived.filter(d => d.deadDeal).length} dead
              </span>
            )}
          </button>
        </div>

        {/* Status filter */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === opt.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
              {opt.value === 'dead' && deadCount > 0 && (
                <span className="ml-1 text-red-500">({deadCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <DealsTable deals={applyFilter(activeList)} />
    </div>
  );
}
