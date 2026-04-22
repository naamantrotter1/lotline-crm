import { DollarSign, Percent, TrendingUp, Calendar, ArrowDownToLine } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

const TOOLTIPS = {
  capital:      'The total amount of money you have contributed to this project.',
  equity:       "Your ownership percentage of this deal's profits and returns.",
  projReturn:   'Your estimated share of the projected profit based on your equity percentage.',
  payout:       'The date we expect to distribute your returns. Subject to change based on market conditions.',
  distributed:  'Cash you have already received from this investment across all distribution types.',
};

function fmt(n)  { return n != null ? `$${Math.round(n).toLocaleString()}` : null; }
function fmtPct(n) { return n != null ? `${Number(n).toFixed(2)}%` : null; }
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Metric({ icon: Icon, label, value, tooltip, color = 'text-white', comingSoon = false }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5 mb-0.5">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
          <InfoTooltip text={tooltip} />
        </div>
        {value ? (
          <p className={`text-sm font-bold ${color}`}>{value}</p>
        ) : (
          <p className="text-sm text-gray-600 italic">{comingSoon ? 'Coming soon' : '—'}</p>
        )}
      </div>
    </div>
  );
}

export default function YourPosition({ deal, totalDistributed }) {
  const totalCost = (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
    (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
    (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.water_cost ?? 0);
  const sellCost  = (deal.arv ?? 0) * 0.045;
  const projProfit = Math.max(0, (deal.arv ?? 0) - totalCost - sellCost);
  const projReturn = deal.investor_equity_pct
    ? projProfit * (deal.investor_equity_pct / 100)
    : null;

  return (
    <div className="bg-[#1c2130] rounded-2xl border border-white/8 p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-4 rounded-full bg-accent" />
        <h2 className="text-xs font-semibold text-white uppercase tracking-widest">Your Position</h2>
      </div>
      <p className="text-[10px] text-gray-600 mb-4 ml-3.5">Personal to your investment</p>

      <div>
        <Metric
          icon={DollarSign}
          label="Capital Contributed"
          value={fmt(deal.investor_capital_contributed)}
          tooltip={TOOLTIPS.capital}
          color="text-accent"
          comingSoon
        />
        <Metric
          icon={Percent}
          label="Pro-Rata %"
          value={fmtPct(deal.investor_equity_pct)}
          tooltip={TOOLTIPS.equity}
          comingSoon
        />
        <Metric
          icon={TrendingUp}
          label="Projected Return"
          value={fmt(projReturn)}
          tooltip={TOOLTIPS.projReturn}
          color="text-green-400"
          comingSoon
        />
        <Metric
          icon={Calendar}
          label="Target Payout Date"
          value={fmtDate(deal.projected_payout_date)}
          tooltip={TOOLTIPS.payout}
          color="text-blue-400"
          comingSoon
        />
        <Metric
          icon={ArrowDownToLine}
          label="Distributions To-Date"
          value={totalDistributed > 0 ? fmt(totalDistributed) : null}
          tooltip={TOOLTIPS.distributed}
          color="text-purple-400"
        />
      </div>
    </div>
  );
}
