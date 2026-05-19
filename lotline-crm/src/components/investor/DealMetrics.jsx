import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, Hammer, Calendar, List, X } from 'lucide-react';
import InfoTooltip from './InfoTooltip';
import { fetchCostLines } from '../../lib/costBreakdownData';

const TOOLTIPS = {
  arv:       'After-Repair Value — the estimated market price of the completed home.',
  buildCost: 'Total hard costs: land, home, permits, setup, utilities, and site work.',
  deployed:  'Total capital invested in this project to date.',
  close:     'The date the land/lot purchase closes.',
};

function fmt(n)  { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Metric({ icon: Icon, label, value, tooltip, color = 'text-gray-900 dark:text-white', comingSoon = false, action = null }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/8 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-gray-500 dark:text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5 mb-0.5">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
          <InfoTooltip text={tooltip} />
          {action}
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

// ── Build-cost line-item breakdown modal ────────────────────────────────────
function BuildCostBreakdownModal({ dealId, total, onClose }) {
  const [lines, setLines] = useState(null);
  useEffect(() => {
    let active = true;
    fetchCostLines(dealId).then(rows => {
      if (active) setLines(rows || []);
    });
    return () => { active = false; };
  }, [dealId]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1c2130] rounded-2xl border border-gray-200 dark:border-white/8 w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Build Cost Breakdown</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Actual line-item expenses for this deal</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {lines === null ? (
            <div className="px-5 py-8 text-center text-xs text-gray-400">Loading…</div>
          ) : lines.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-gray-400">No line items recorded yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-white/8">
                  <th className="px-5 py-2 font-medium">Line Item</th>
                  <th className="px-5 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {lines.map(l => (
                  <tr key={l.id ?? `${l.deal_id}-${l.field_key}`} className="text-gray-700 dark:text-gray-200">
                    <td className="px-5 py-2">{l.label ?? l.field_label ?? l.field_key}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{fmt(Number(l.actual ?? l.actual_amount ?? l.amount ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-white/8 font-semibold text-gray-900 dark:text-white">
                  <td className="px-5 py-3">Total</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function DealMetrics({ deal }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Prefer canonical cost total (set by fetchMyDeal enrichment via deal_cost_summary_view).
  // Falls back to legacy flat column sum for unenriched deal objects.
  const totalCost = deal.total_actual != null
    ? Number(deal.total_actual)
    : (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
      (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
      (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.water_cost ?? 0) +
      (deal.footers ?? 0) + (deal.underpinning ?? 0) + (deal.decks ?? 0) +
      (deal.driveway ?? 0) + (deal.landscaping ?? 0);
      // water_sewer dropped — duplicated Public Water + Public Sewer (migration 125)
  const closeDate  = deal.projected_payout_date ?? deal.close_date;

  const buildCostAction = totalCost > 0 ? (
    <button
      onClick={() => setShowBreakdown(true)}
      title="See line-item breakdown"
      aria-label="See line-item breakdown"
      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded text-gray-400 hover:text-accent hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
    >
      <List size={11} />
    </button>
  ) : null;

  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-2xl border border-gray-200 dark:border-white/8 p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-4 rounded-full bg-blue-500" />
        <h2 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-widest">Deal Metrics</h2>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-4 ml-3.5">Project-level financials</p>

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
          action={buildCostAction}
          comingSoon
        />
        <Metric
          icon={Calendar}
          label="Land Close Date"
          value={fmtDate(closeDate)}
          tooltip={TOOLTIPS.close}
          color="text-blue-400"
          comingSoon
        />
      </div>

      {showBreakdown && (
        <BuildCostBreakdownModal
          dealId={deal.id}
          total={totalCost}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  );
}
