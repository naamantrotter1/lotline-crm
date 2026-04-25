import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Briefcase, Search, ChevronRight } from 'lucide-react';
import { fetchMyDeals } from '../../lib/investorPortalData';

const STAGE_ORDER = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];
const STAGE_COLORS = {
  'Contract Signed': { bg: 'bg-green-500/15',  text: 'text-green-400'  },
  'Due Diligence':   { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  'Development':     { bg: 'bg-blue-500/15',   text: 'text-blue-400'   },
  'Complete':        { bg: 'bg-purple-500/15', text: 'text-purple-400' },
};

function fmt(n)    { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvestorDeals() {
  const { investor }     = useOutletContext();
  const [deals, setDeals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]   = useState('');

  useEffect(() => {
    if (!investor) return;
    fetchMyDeals(investor.name).then(({ deals: d }) => { setDeals(d); setLoading(false); });
  }, [investor]);

  const filtered = deals.filter(d =>
    (d.address ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (d.stage   ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Deals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{deals.length} active deal{deals.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search deals…"
            className="pl-8 pr-4 py-2 bg-gray-100 dark:bg-white/8 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-accent/50 w-52"
          />
        </div>
      </div>

      {/* Pipeline stage summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAGE_ORDER.map(stage => {
          const count = deals.filter(d => d.stage === stage).length;
          const { bg, text } = STAGE_COLORS[stage] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
          return (
            <div key={stage} className={`${bg} rounded-xl p-4 border border-gray-200 dark:border-white/8`}>
              <p className={`text-lg font-bold ${text}`}>{count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stage}</p>
            </div>
          );
        })}
      </div>

      {/* Deal list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-100 dark:bg-white/8 rounded-xl h-24 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1c2130] rounded-xl p-12 text-center border border-gray-200 dark:border-white/8">
          <Briefcase size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">{query ? 'No matching deals.' : 'No deals assigned yet.'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
          {filtered.map(deal => {
            const stageIdx = STAGE_ORDER.indexOf(deal.stage);
            const pct = stageIdx >= 0 ? Math.round(((stageIdx + 1) / STAGE_ORDER.length) * 100) : 0;
            const { bg, text } = STAGE_COLORS[deal.stage] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
            const totalCost = deal.total_actual != null
              ? Number(deal.total_actual)
              : (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
                (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
                (deal.hvac ?? 0) + (deal.clear_land ?? 0);
            return (
              <Link
                key={deal.id}
                to={`/investor/deals/${deal.id}`}
                className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-accent transition-colors truncate">{deal.address}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>{deal.stage}</span>
                    {deal.close_date && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">Close: {fmtDate(deal.close_date)}</span>
                    )}
                  </div>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-white/10 rounded-full h-1">
                    <div className="bg-accent h-1 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex-shrink-0 text-right mr-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ARV</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(deal.arv)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Capital</p>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmt(totalCost)}</p>
                </div>
                <ChevronRight size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-accent transition-colors flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
