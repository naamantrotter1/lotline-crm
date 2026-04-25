import { DollarSign, Percent, TrendingUp, Calendar, ArrowDownToLine, Layers } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

const TOOLTIPS = {
  capital:      'The total amount of money you have contributed to this project.',
  equity:       "Your ownership percentage of this deal's profits and returns.",
  projReturn:   'Your estimated share of the projected profit based on your equity percentage.',
  projInterest: 'Estimated total interest income based on your loan amount, rate, and hold period.',
  payout:       'The date we expect to distribute your returns. Subject to change based on market conditions.',
  distributed:  'Cash you have already received from this investment across all distribution types.',
};

function fmt(n)  { return n != null ? `$${Math.round(n).toLocaleString()}` : null; }
function fmtPct(n) { return n != null ? `${Number(n).toFixed(2)}%` : null; }
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Metric({ icon: Icon, label, value, tooltip, color = 'text-gray-900 dark:text-white', comingSoon = false }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-500 dark:text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5 mb-0.5">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <InfoTooltip text={tooltip} />
        </div>
        {value ? (
          <p className={`text-sm font-bold ${color}`}>{value}</p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">{comingSoon ? 'Coming soon' : '—'}</p>
        )}
      </div>
    </div>
  );
}

const HARD_MONEY = ['Hard Money Loan', 'Hard Money (Land + Home)', 'Hard Money'];
const CCP_TRIGGER_LABELS = { date: 'Date', milestone: 'Milestone', manual_call: 'Manual Call' };

export default function YourPosition({ deal, totalDistributed }) {
  const sd = deal.scenario_data ?? {};
  const isHardMoney = HARD_MONEY.includes(deal.financing);
  const isProfitSplit = deal.financing === 'Profit Split';
  const isCCP = deal.financing === 'Committed Capital Partner';
  const ccpTranches = sd.ccpTranches ?? [];

  // Projected return: interest income for hard money, equity share for profit split
  let projReturn = null;
  if (isHardMoney && deal.investor_capital_contributed) {
    const rate = sd.interestRate ?? 13;
    const months = sd.holdPeriod ?? 6;
    projReturn = deal.investor_capital_contributed * (rate / 100 / 12) * months;
  } else if (isProfitSplit && deal.investor_equity_pct) {
    // Prefer canonical cost total; fall back to partial legacy sum
    const totalCost = deal.total_actual != null
      ? Number(deal.total_actual)
      : (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.setup ?? 0) +
        (deal.septic ?? 0) + (deal.electric ?? 0) + (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.water_cost ?? 0);
    const sellCost = (deal.arv ?? 0) * 0.045;
    const projProfit = Math.max(0, (deal.arv ?? 0) - totalCost - sellCost);
    projReturn = projProfit * (deal.investor_equity_pct / 100);
  }

  // Target payout: use stored date, or estimate from closing_date + balloon term
  let payoutDate = deal.projected_payout_date ?? null;
  if (!payoutDate && deal.closing_date && isHardMoney) {
    const balloon = sd.balloonTerm ?? 12;
    const d = new Date(deal.closing_date);
    d.setMonth(d.getMonth() + balloon);
    payoutDate = d.toISOString();
  }

  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-4 rounded-full bg-accent" />
        <h2 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Your Position</h2>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-4 ml-3.5">Personal to your investment</p>

      <div>
        <Metric
          icon={DollarSign}
          label="Capital Contributed"
          value={fmt(deal.investor_capital_contributed)}
          tooltip={TOOLTIPS.capital}
          color="text-accent"
          comingSoon
        />
        {!isHardMoney && (
          <Metric
            icon={Percent}
            label="Pro-Rata %"
            value={fmtPct(deal.investor_equity_pct)}
            tooltip={TOOLTIPS.equity}
            comingSoon
          />
        )}
        <Metric
          icon={TrendingUp}
          label="Projected Return"
          value={fmt(projReturn)}
          tooltip={isHardMoney ? TOOLTIPS.projInterest : TOOLTIPS.projReturn}
          color="text-green-400"
          comingSoon
        />
        <Metric
          icon={Calendar}
          label="Target Payout Date"
          value={fmtDate(payoutDate)}
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

      {/* CCP draw schedule */}
      {isCCP && ccpTranches.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={11} className="text-gray-400" />
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Draw Schedule</p>
          </div>
          <div className="space-y-1.5">
            {ccpTranches.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  Tranche {t.sequence ?? i + 1}
                  {t.triggerType ? ` · ${CCP_TRIGGER_LABELS[t.triggerType] ?? t.triggerType}` : ''}
                  {t.triggerDate ? ` · ${new Date(t.triggerDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                </span>
                <span className="font-semibold text-gray-800 dark:text-white">{fmt(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
