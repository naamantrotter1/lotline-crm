import { Home } from 'lucide-react';

const SALES_STAGES = [
  'Listed',
  'Showing',
  'Offer Received',
  'Under Contract',
  'Inspection',
  'Appraisal',
  'Closing',
];

export default function Sales() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Sales Pipeline</h1>
        <p className="text-sm text-gray-500 mt-1">0 active listings — deals appear here once ready to sell</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {SALES_STAGES.map((stage) => (
          <div key={stage} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sidebar text-sm">{stage}</h3>
              <span className="bg-sidebar text-white text-xs font-bold px-2 py-0.5 rounded-full">0</span>
            </div>
            <div className="bg-white/60 rounded-xl p-6 text-center border-2 border-dashed border-gray-200 min-h-32 flex flex-col items-center justify-center gap-2">
              <Home size={24} className="text-gray-300" />
              <p className="text-sm text-gray-400">No listings</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
