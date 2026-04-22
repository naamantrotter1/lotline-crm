import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingUp, DollarSign, CheckCircle, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { submitInvestmentInterest } from '../../lib/investorPortalData';
import { supabase } from '../../lib/supabase';

function fmt(n)  { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtPct(n) { return n != null ? `${Number(n).toFixed(1)}%` : '—'; }

const STAGE_COLORS = {
  'Due Diligence': 'bg-yellow-500/15 text-yellow-400',
  'Development':   'bg-blue-500/15 text-blue-400',
  'Contract Signed': 'bg-green-500/15 text-green-400',
  'Complete':      'bg-purple-500/15 text-purple-400',
};

function ReserveModal({ deal, investor, onClose, onSuccess }) {
  const [amount, setAmount]   = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) { setError('Please enter a valid amount.'); return; }
    setSaving(true);
    const { error: err } = await submitInvestmentInterest({
      investorId: investor.id,
      dealId: deal.id,
      amount: Number(amount),
      notes,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1c2130] rounded-2xl border border-white/10 w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Reserve Interest</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{deal.address}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white ml-3">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Investment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full pl-7 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-accent/50"
                required
              />
            </div>
            {deal.min_check_size && (
              <p className="text-[10px] text-gray-500 mt-1">Minimum: {fmt(deal.min_check_size)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Any questions or specifics…"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-accent/50 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Submitting…' : 'Submit Interest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DealCard({ deal, investor, myInterestIds }) {
  const [expanded, setExpanded]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(myInterestIds.has(deal.id));

  const totalCost  = (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
    (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
    (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.water_cost ?? 0);
  const sellCosts  = (deal.arv ?? 0) * 0.045;
  const projProfit = Math.max(0, (deal.arv ?? 0) - totalCost - sellCosts);

  const alloc      = deal.remaining_allocation;
  const pctFilled  = alloc != null && deal.min_check_size
    ? Math.min(100, Math.round(((deal.min_check_size - alloc) / deal.min_check_size) * 100))
    : null;

  const stageColor = STAGE_COLORS[deal.stage] ?? 'bg-white/10 text-gray-400';

  return (
    <>
      {showModal && investor && (
        <ReserveModal
          deal={deal}
          investor={investor}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setSubmitted(true); setShowModal(false); }}
        />
      )}

      <div className="bg-[#1c2130] rounded-xl border border-white/8 overflow-hidden">
        {/* Main row */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-sm font-semibold text-white truncate">{deal.address}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageColor}`}>{deal.stage}</span>
              </div>
              {deal.county && (
                <p className="text-xs text-gray-500">{deal.county}, {deal.state}</p>
              )}
            </div>

            <div className="flex-shrink-0 flex items-center gap-2">
              {submitted ? (
                <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-3 py-1.5 rounded-lg">
                  <CheckCircle size={12} /> Interest Submitted
                </span>
              ) : (
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
                >
                  Reserve Interest
                </button>
              )}
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-gray-500 hover:text-white transition-colors p-1"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>

          {/* Key metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: 'ARV',            value: fmt(deal.arv),           color: 'text-white'       },
              { label: 'Target IRR',     value: fmtPct(deal.projected_irr), color: 'text-green-400' },
              { label: 'Min Check',      value: deal.min_check_size ? fmt(deal.min_check_size) : '—', color: 'text-blue-400' },
              { label: 'Proj. Profit',   value: fmt(projProfit),         color: 'text-purple-400'  },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                <p className={`text-sm font-bold mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Allocation fill bar */}
          {pctFilled !== null && (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Allocation filled</span>
                <span>{pctFilled}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${pctFilled}%` }}
                />
              </div>
              {alloc != null && (
                <p className="text-[10px] text-gray-500 mt-1">{fmt(alloc)} remaining</p>
              )}
            </div>
          )}
        </div>

        {/* Expandable proforma */}
        {expanded && (
          <div className="border-t border-white/8 px-5 py-4 bg-white/2 space-y-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Proforma</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                { label: 'Land',           value: fmt(deal.land)        },
                { label: 'Mobile Home',    value: fmt(deal.mobile_home) },
                { label: 'Permits',        value: fmt(deal.permits)     },
                { label: 'Setup',          value: fmt(deal.setup)       },
                { label: 'Septic',         value: fmt(deal.septic)      },
                { label: 'Well',           value: fmt(deal.well)        },
                { label: 'Electric',       value: fmt(deal.electric)    },
                { label: 'HVAC',           value: fmt(deal.hvac)        },
                { label: 'Total Cost',     value: fmt(totalCost),       bold: true  },
                { label: 'Selling Costs',  value: fmt(sellCosts)        },
                { label: 'Proj. Profit',   value: fmt(projProfit),      bold: true, green: true },
              ].filter(r => r.bold || (r.value !== '$0')).map(({ label, value, bold, green }) => (
                <div key={label} className="flex justify-between">
                  <span className={bold ? 'text-gray-300 font-semibold' : 'text-gray-500'}>{label}</span>
                  <span className={bold ? (green ? 'text-green-400 font-semibold' : 'text-white font-semibold') : 'text-gray-300'}>{value}</span>
                </div>
              ))}
            </div>

            {deal.financing && (
              <div className="pt-2 border-t border-white/8 flex justify-between text-xs">
                <span className="text-gray-500">Financing</span>
                <span className="text-gray-300">{deal.financing}</span>
              </div>
            )}
            {deal.utility_scenario && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Utilities</span>
                <span className="text-gray-300">{deal.utility_scenario}</span>
              </div>
            )}
            {deal.home_model && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Home Model</span>
                <span className="text-gray-300">{deal.home_model}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function InvestorOpportunities() {
  const { investor }               = useOutletContext();
  const [deals, setDeals]          = useState([]);
  const [myInterest, setMyInterest] = useState([]);
  const [loading, setLoading]      = useState(true);

  useEffect(() => {
    if (!investor) return;
    Promise.all([
      // Fetch deals flagged as visible_to_investors with allocation remaining
      supabase
        .from('deals')
        .select('*')
        .eq('visible_to_investors', true)
        .eq('is_archived', false)
        .order('projected_irr', { ascending: false, nullsFirst: false }),

      // Fetch my existing interest submissions
      supabase
        .from('investment_interest')
        .select('deal_id')
        .eq('investor_id', investor.id),
    ]).then(([{ data: dealsData }, { data: interestData }]) => {
      setDeals(dealsData ?? []);
      setMyInterest((interestData ?? []).map(r => r.deal_id).filter(Boolean));
      setLoading(false);
    });
  }, [investor]);

  const myInterestIds = new Set(myInterest);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Opportunities</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {deals.length} active deal{deals.length !== 1 ? 's' : ''} available for investment
        </p>
      </div>

      {/* Summary */}
      {!loading && deals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: 'Avg Target IRR',
              value: (() => {
                const withIrr = deals.filter(d => d.projected_irr);
                if (!withIrr.length) return '—';
                return fmtPct(withIrr.reduce((s, d) => s + d.projected_irr, 0) / withIrr.length);
              })(),
              icon: TrendingUp,
              color: 'text-green-400',
            },
            {
              label: 'Total Allocation',
              value: fmt(deals.reduce((s, d) => s + (d.remaining_allocation ?? 0), 0)),
              icon: DollarSign,
              color: 'text-blue-400',
            },
            {
              label: 'Interest Submitted',
              value: myInterest.length,
              icon: Clock,
              color: 'text-accent',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#1c2130] rounded-xl p-4 border border-white/8">
              <Icon size={13} className={`mb-1 ${color}`} />
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Deal list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/5 rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-[#1c2130] rounded-xl p-12 text-center border border-white/8">
          <TrendingUp size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No opportunities available right now.</p>
          <p className="text-gray-600 text-xs mt-1">Check back soon as new deals come online.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {deals.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              investor={investor}
              myInterestIds={myInterestIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
