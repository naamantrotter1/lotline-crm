import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Star, User, DollarSign, Calendar, Search, ClipboardList, Hammer, CheckCircle2, TreePine, SplitSquareHorizontal } from 'lucide-react';
import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';

const STAGES = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];

const STAGE_META = {
  'Contract Signed': { icon: ClipboardList,  color: '#c2410c', bg: '#fff7ed' },
  'Due Diligence':   { icon: Search,         color: '#b45309', bg: '#fffbeb' },
  'Development':     { icon: Hammer,         color: '#15803d', bg: '#f0fdf4' },
  'Complete':        { icon: CheckCircle2,   color: '#6366f1', bg: '#eef2ff' },
};

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

const TAG_STYLES = {
  'Land Clearing': { bg: '#dcfce7', text: '#15803d', icon: TreePine },
  'Subdivide':     { bg: '#fef3c7', text: '#b45309', icon: SplitSquareHorizontal },
};

function isSubdividable(deal) {
  const saved = localStorage.getItem(`lotline_subdivide_${deal.id}`);
  if (saved !== null) return saved === 'Yes';
  return (deal.tags || []).includes('Subdivide');
}

function isLandClearing(deal) {
  const saved = localStorage.getItem(`lotline_land_clearing_${deal.id}`);
  if (saved !== null) return saved === 'Yes';
  return (deal.tags || []).includes('Land Clearing');
}

function DealCard({ deal, onClick }) {
  const [starred, setStarred] = useState(false);
  const netProfit    = calcNetProfit(deal);
  const closing      = closingCountdown(deal.closeDate);
  const subdivide    = isSubdividable(deal);
  const landClearing = isLandClearing(deal);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 cursor-pointer hover:shadow-md transition-all group"
    >
      {/* Drag handle + address + star + grade */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex flex-col gap-0.5 mt-1 opacity-30 group-hover:opacity-60 transition-opacity flex-shrink-0">
          {[0,1,2].map(r => (
            <div key={r} className="flex gap-0.5">
              {[0,1].map(c => <div key={c} className="w-1 h-1 rounded-full bg-gray-400" />)}
            </div>
          ))}
        </div>
        <span className="text-sm font-semibold text-gray-900 leading-snug flex-1">{deal.address}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setStarred(p => !p); }}
            className={`transition-colors ${starred ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>
          {deal.grade && (
            <span className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
              deal.grade === 'A' ? 'bg-green-100 text-green-700' :
              deal.grade === 'B' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>{deal.grade}</span>
          )}
        </div>
      </div>

      {/* Investor + tags */}
      {(deal.investor || subdivide || landClearing) && (
        <div className="flex flex-wrap gap-1.5 mb-2 ml-4">
          {deal.investor && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 font-medium">
              <User size={10} />
              {deal.investor}
            </span>
          )}
          {landClearing && (() => {
            const s = TAG_STYLES['Land Clearing'];
            return (
              <span style={{ backgroundColor: s.bg, color: s.text }}
                className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border border-current/10">
                <TreePine size={10} />
                Land Clearing
              </span>
            );
          })()}
          {subdivide && (() => {
            const s = TAG_STYLES['Subdivide'];
            return (
              <span style={{ backgroundColor: s.bg, color: s.text }}
                className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border border-current/10">
                <SplitSquareHorizontal size={10} />
                Subdivide
              </span>
            );
          })()}
        </div>
      )}

      {/* ARV */}
      <div className="text-xs text-gray-500 ml-4 mb-1">
        ARV: <span className="font-semibold text-gray-800">${(deal.arv || 0).toLocaleString()}</span>
      </div>

      {/* Profit */}
      <div className="flex items-center gap-1 ml-4 mb-2">
        <DollarSign size={11} className={netProfit >= 0 ? 'text-green-600' : 'text-red-500'} />
        <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          ${Math.abs(netProfit).toLocaleString()}
        </span>
        {deal.financing && (
          <span className="text-xs text-gray-400">({deal.financing})</span>
        )}
      </div>

      {/* Closing date + countdown */}
      {(deal.closeDate || closing) && (
        <div className="flex items-center justify-between ml-4">
          {deal.closeDate ? (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={10} className="text-orange-400" />
              {formatCloseDate(deal.closeDate)}
            </span>
          ) : <span />}
          {closing && (
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              closing.past ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {closing.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function loadCustomDeals() {
  try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; }
}

export default function DealOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const [customDeals, setCustomDeals] = useState(loadCustomDeals);

  // Re-sync whenever we navigate back to this page
  useEffect(() => {
    setCustomDeals(loadCustomDeals());
  }, [location.key]);

  const allDeals = [...DEAL_OVERVIEW_DEALS, ...customDeals].map(d => ({
    ...d,
    stage: localStorage.getItem(`lotline_deal_stage_${d.id}`) || d.stage,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Deal Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">{allDeals.length} active deals across all stages</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {STAGES.map(stage => {
          const meta  = STAGE_META[stage];
          const Icon  = meta.icon;
          const deals = allDeals.filter(d => d.stage === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-80">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: meta.bg }}>
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <h3 className="font-semibold text-gray-700 text-sm">{stage}</h3>
                </div>
                <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                  {deals.length}
                </span>
              </div>

              {/* Cards */}
              <div>
                {deals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => navigate(`/deal/${deal.id}`)}
                  />
                ))}
                {deals.length === 0 && (
                  <div className="rounded-2xl p-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 bg-white/50">
                    Empty
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
