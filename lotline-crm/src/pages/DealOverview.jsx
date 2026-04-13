import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Star, User, DollarSign, Calendar } from 'lucide-react';
import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';
import { GradeBadge } from '../components/UI/Badge';

const STAGES = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];

function closingCountdown(dateStr) {
  if (!dateStr) return null;
  const close = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  close.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - close) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d to close`, past: false };
  if (diff === 0) return { label: 'Closes today', past: false };
  return { label: `Day ${diff}`, past: true };
}

function formatCloseDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function DealCard({ deal, onClick }) {
  const [starred, setStarred] = useState(false);
  const netProfit = calcNetProfit(deal);
  const closing = closingCountdown(deal.closeDate);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-2 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Address + star + grade */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-800 leading-snug flex-1">{deal.address}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setStarred(p => !p); }}
            className={`transition-colors ${starred ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>
          {deal.grade && <GradeBadge grade={deal.grade} />}
        </div>
      </div>

      {/* Investor pill */}
      {deal.investor && deal.investor !== 'Cash' && (
        <div className="flex items-center gap-1 mb-2">
          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
            <User size={10} />
            {deal.investor}
          </span>
        </div>
      )}

      {/* ARV */}
      <div className="text-xs text-gray-500 mb-1">
        ARV: <span className="font-medium text-gray-800">${(deal.arv || 0).toLocaleString()}</span>
      </div>

      {/* Profit */}
      <div className="flex items-center gap-1 mb-1">
        <DollarSign size={11} className={netProfit >= 0 ? 'text-green-600' : 'text-red-500'} />
        <span className={`text-xs font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          ${Math.abs(netProfit).toLocaleString()}
        </span>
        {deal.financing && (
          <span className="text-xs text-gray-400">({deal.financing})</span>
        )}
      </div>

      {/* Close date + countdown/countup */}
      <div className="flex items-center justify-between mt-1">
        {deal.closeDate ? (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar size={10} />
            Closing: {formatCloseDate(deal.closeDate)}
          </span>
        ) : <span />}
        {closing && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            closing.past
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-600'
          }`}>
            {closing.label}
          </span>
        )}
      </div>
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
