import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';
import { GradeBadge, Tag } from '../components/UI/Badge';
import { CheckCircle, Circle, Clock } from 'lucide-react';

const DD_TASKS = [
  'Perc Test / Soil Report',
  'Survey',
  'Title Search',
  'Zoning Verification',
  'Flood Zone Check',
  'Utility Check',
  'HOA Check',
  'Environmental Check',
  'Final DD Review',
];

const ddDeals = DEAL_OVERVIEW_DEALS.filter((d) => d.stage === 'Due Diligence');

function DDCard({ deal }) {
  const netProfit = calcNetProfit(deal);
  const completedTasks = Math.floor(Math.random() * 4); // placeholder progress
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 pr-2">
          <p className="text-sm font-semibold text-sidebar leading-tight">{deal.address}</p>
          <p className="text-xs text-gray-500 mt-0.5">{deal.county}, {deal.state}</p>
        </div>
        <GradeBadge grade={deal.grade} />
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {deal.investor && (
          <Tag type="investor">{deal.investor}</Tag>
        )}
        {(deal.tags || []).map((tag) => (
          <Tag key={tag} type={tag}>{tag}</Tag>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-gray-500">ARV: <span className="font-semibold text-gray-800">${(deal.arv || 0).toLocaleString()}</span></span>
        <span className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>${netProfit.toLocaleString()}</span>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>DD Progress</span>
          <span>{completedTasks}/{DD_TASKS.length} tasks</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-accent h-1.5 rounded-full transition-all"
            style={{ width: `${(completedTasks / DD_TASKS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        {deal.daysInPipeline !== undefined && (
          <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            <Clock size={10} />
            Day {deal.daysInPipeline}
          </span>
        )}
        {deal.closeDate && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Closing: {deal.closeDate}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DueDiligence() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Due Diligence</h1>
        <p className="text-sm text-gray-500 mt-1">{ddDeals.length} deals in due diligence phase</p>
      </div>

      {/* DD Checklist Reference */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-sidebar text-sm mb-3">Standard DD Checklist</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {DD_TASKS.map((task, i) => (
            <div key={task} className="flex items-center gap-2 text-xs text-gray-600">
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0 text-gray-400 font-bold">
                {i + 1}
              </div>
              <span>{task}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deal Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ddDeals.map((deal) => (
          <DDCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
