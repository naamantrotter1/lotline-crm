import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';
import { GradeBadge, Tag } from '../components/UI/Badge';
import { CheckCircle, Clock, MapPin } from 'lucide-react';

const devDeals = DEAL_OVERVIEW_DEALS.filter((d) => d.stage === 'Development');

const DEV_STAGES = [
  'Land Clearing',
  'Permits',
  'Footers & Foundation',
  'Home Delivery',
  'Setup & Tie-Down',
  'Utilities',
  'Finishing Work',
  'Final Inspection',
];

function DevCard({ deal }) {
  const netProfit = calcNetProfit(deal);
  const tasksComplete = deal.devTasksComplete || 0;
  const totalTasks = 38;
  const pct = Math.round((tasksComplete / totalTasks) * 100);

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 pr-2">
          <p className="text-sm font-semibold text-sidebar leading-tight">{deal.address}</p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin size={10} />{deal.county}, {deal.state}
          </p>
        </div>
        <GradeBadge grade={deal.grade} />
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {deal.investor && deal.investor !== 'Cash' && (
          <Tag type="investor">{deal.investor}</Tag>
        )}
        {(deal.tags || []).map((tag) => (
          <Tag key={tag} type={tag}>{tag}</Tag>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <span className="text-gray-500">ARV</span>
          <p className="font-semibold text-gray-800">${(deal.arv || 0).toLocaleString()}</p>
        </div>
        <div>
          <span className="text-gray-500">Net Profit</span>
          <p className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            ${netProfit.toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Financing</span>
          <p className="font-medium text-gray-700">{deal.financing}</p>
        </div>
        <div>
          <span className="text-gray-500">Acreage</span>
          <p className="font-medium text-gray-700">{deal.acreage} ac</p>
        </div>
      </div>

      {deal.utilityScenario && (
        <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg mb-3">
          {deal.utilityScenario}
        </div>
      )}

      {/* Task Progress */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Dev Progress</span>
          <span>{tasksComplete}/{totalTasks} tasks ({pct}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-accent h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {deal.daysInPipeline !== undefined && (
          <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            <Clock size={10} />
            Day {deal.daysInPipeline}
          </span>
        )}
        {deal.leadSource && (
          <span className="text-xs text-gray-400">{deal.leadSource}</span>
        )}
      </div>

      {deal.notes && (
        <p className="mt-3 text-xs text-gray-500 bg-white rounded-lg p-2 leading-relaxed">
          {deal.notes}
        </p>
      )}
    </div>
  );
}

export default function Development() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Development</h1>
        <p className="text-sm text-gray-500 mt-1">{devDeals.length} active development projects</p>
      </div>

      {/* Stage Reference */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-sidebar text-sm mb-3">Development Stages</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {DEV_STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200">
                <span className="w-5 h-5 rounded-full bg-sidebar text-white flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                {stage}
              </div>
              {i < DEV_STAGES.length - 1 && (
                <div className="w-4 h-0.5 bg-gray-300 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devDeals.map((deal) => (
          <DevCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
