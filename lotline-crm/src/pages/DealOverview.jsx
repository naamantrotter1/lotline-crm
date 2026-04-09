import { useNavigate } from 'react-router-dom';
import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';
import { GradeBadge, Tag } from '../components/UI/Badge';

const STAGES = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];

function DealCard({ deal, onClick }) {
  const netProfit = calcNetProfit(deal);
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-2 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <span className="text-xs font-semibold text-gray-800 leading-tight flex-1">{deal.address}</span>
        <GradeBadge grade={deal.grade} />
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {deal.investor && deal.investor !== 'Cash' && (
          <Tag type="investor">{deal.investor}</Tag>
        )}
        {(deal.tags || []).map((tag) => (
          <Tag key={tag} type={tag}>{tag}</Tag>
        ))}
      </div>
      <div className="text-xs text-gray-500">
        ARV: <span className="font-medium text-gray-800">${(deal.arv || 0).toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          ${netProfit.toLocaleString()}
        </span>
        <span className="text-xs font-normal text-gray-400">({deal.financing})</span>
      </div>
      {deal.daysInPipeline !== undefined && (
        <div className="mt-2">
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
            Day {deal.daysInPipeline}
          </span>
        </div>
      )}
      {deal.closeDate && (
        <div className="mt-2">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Closing: {deal.closeDate}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DealOverview() {
  const navigate = useNavigate();
  const stageCounts = STAGES.reduce((acc, stage) => {
    acc[stage] = DEAL_OVERVIEW_DEALS.filter((d) => d.stage === stage).length;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Deal Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          {DEAL_OVERVIEW_DEALS.length} active deals across all stages
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {STAGES.map((stage) => {
          const deals = DEAL_OVERVIEW_DEALS.filter((d) => d.stage === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sidebar text-sm">{stage}</h3>
                <span className="bg-sidebar text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {stageCounts[stage]}
                </span>
              </div>
              <div className="space-y-2">
                {deals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => navigate(`/deal/${deal.id}`)}
                  />
                ))}
                {deals.length === 0 && (
                  <div className="bg-white/60 rounded-xl p-4 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200">
                    No deals in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
