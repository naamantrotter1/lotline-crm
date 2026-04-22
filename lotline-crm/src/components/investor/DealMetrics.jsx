import { TrendingUp, Hammer, BarChart2, DollarSign, Calendar } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

const TOOLTIPS = {
  arv:       'After-Repair Value — the estimated market price of the completed home.',
  buildCost: 'Total hard costs: land, home, permits, setup, utilities, and site work.',
  deployed:  'Total capital invested in this project to date.',
  profit:    'Estimated profit = ARV minus all build costs and ~4.5% selling costs.',
  irr:       'Internal Rate of Return — the annualized profit rate if the project closes on schedule.',
  close:     'The date we expect to close the sale and distribute proceeds.',
};

function fmt(n)  { return `$${Math.round(n ?? 0).toLocaleString()}`; }
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

export default function DealMetrics({ deal }) {
  const totalCost = (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
    (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
    (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.water_cost ?? 0) +
    (deal.footers ?? 0) + (deal.underpinning ?? 0) + (deal.decks ?? 0) +
    (deal.driveway ?? 0) + (deal.landscaping ?? 0) + (deal.water_sewer ?? 0);
  const sellCost   = (deal.arv ?? 0) * 0.045;
  const projProfit = Math.max(0, (deal.arv ?? 0) - totalCost - sellCost);
  const closeDate  = deal.projected_payout_date ?? deal.close_date;

  return (
    <div className="bg-[#1c2130] rounded-2xl border border-white/8 p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-4 rounded-full bg-blue-500" />
        <h2 className="text-xs font-semibold text-white uppercase tracking-widest">Deal Metrics</h2>
      </div>
      <p className="text-[10px] text-gray-600 mb-4 ml-3.5">Project-level financials</p>

      <div>
        <Metric
          icon={TrendingUp}
          label="After-Repair Value"
          value={deal.arv ? fmt(deal.arv) : null}
          tooltip={TOOLTIPS.arv}
          color="text-green-400"
          comingSoon
        />
        <Metric
          icon={Hammer}
          label="Build Cost"
          value={totalCost > 0 ? fmt(totalCost) : null}
          tooltip={TOOLTIPS.buildCost}
          comingSoon
        />
        <Metric
          icon={DollarSign}
          label="Projected Profit"
          value={projProfit > 0 ? fmt(projProfit) : null}
          tooltip={TOOLTIPS.profit}
          color="text-accent"
          comingSoon
        />
        <Metric
          icon={BarChart2}
          label="Projected IRR"
          value={deal.projected_irr ? `${deal.projected_irr}%` : null}
          tooltip={TOOLTIPS.irr}
          color="text-purple-400"
          comingSoon
        />
        <Metric
          icon={Calendar}
          label="Expected Close"
          value={fmtDate(closeDate)}
          tooltip={TOOLTIPS.close}
          color="text-blue-400"
          comingSoon
        />
      </div>
    </div>
  );
}
