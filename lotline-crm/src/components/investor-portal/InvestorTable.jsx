// Dense, sortable investor table — Phase 1 replacement for the card grid on
// the "By Investor" tab of the operator Investor Portal.
//
// Phase 1 scope:
//   • Renders one row per investor with avatar + terms chip.
//   • Numeric columns are right-aligned and color-coded for signed values.
//   • Click a row → toggle an inline "deals" sub-table (same data the old
//     card's "View Deals" expand exposed).
//   • Per-row "View Portal" button on the right impersonates that investor.
//
// Deferred (later phases): kebab menu, filter chips, side drawer, full a11y.

import { useMemo, useState } from 'react';
import { ExternalLink, ChevronRight } from 'lucide-react';
import Avatar from './Avatar.jsx';

// ── helpers ────────────────────────────────────────────────────────────────
const fmtUsd = (n) => `$${Number(n || 0).toLocaleString()}`;
const fmtPct = (n) => `${Number(n || 0).toFixed(2)}%`;

function signedColor(n) {
  if (n == null || Number.isNaN(Number(n))) return 'text-gray-500 dark:text-gray-400';
  return Number(n) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
}

const SORTERS = {
  capital_desc: (a, b) => b.capitalInvested - a.capitalInvested,
  roi_pct_desc: (a, b) => b.roiPct - a.roiPct,
  ann_roi_desc: (a, b) => b.avgAnnualizedRoi - a.avgAnnualizedRoi,
  deals_desc:   (a, b) => (b.activeDeals || 0) - (a.activeDeals || 0),
  name_asc:     (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
};

function buildDealsForInvestor(investor, contextDeals) {
  return (contextDeals || [])
    .filter(d => !d.isArchived && (d.allocations || []).some(a => a.investorId === investor.id))
    .map(d => ({
      id: d.id,
      address: d.address,
      stage: d.stage,
      totalCapital:
        d.investorCapitalContributed != null
          ? Number(d.investorCapitalContributed)
          : d.totalActual != null
          ? Number(d.totalActual)
          : (d.land || 0) + (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0),
      arv: d.arv || 0,
    }));
}

// ── main component ─────────────────────────────────────────────────────────
export default function InvestorTable({
  investors,
  contextDeals,
  searchValue,
  sortValue,
  onDealClick,
  onViewPortal,
  hasStandardTerms,
  termsBadgeText,
}) {
  const [expandedId, setExpandedId] = useState(null);

  const visibleInvestors = useMemo(() => {
    const q = (searchValue || '').trim().toLowerCase();
    const filtered = q
      ? investors.filter(inv => {
          const name = String(inv.name || '').toLowerCase();
          const terms = String(termsBadgeText?.(inv) || '').toLowerCase();
          return name.includes(q) || terms.includes(q);
        })
      : investors;
    const sorter = SORTERS[sortValue] || SORTERS.capital_desc;
    return [...filtered].sort(sorter);
  }, [investors, searchValue, sortValue, termsBadgeText]);

  if (visibleInvestors.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 p-10 text-center text-sm text-gray-400">
        {searchValue
          ? <>No investors match &quot;{searchValue}&quot;.</>
          : <>No investors yet.</>}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-[1fr_140px_140px_100px_100px_80px_140px] gap-4 px-5 py-3 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
        <div>Investor</div>
        <div className="text-right">Capital Invested</div>
        <div className="text-right">Total Returns</div>
        <div className="text-right">ROI %</div>
        <div className="text-right">Ann. ROI</div>
        <div className="text-center">Deals</div>
        <div className="text-right">Actions</div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {visibleInvestors.map(inv => {
          const isCash = inv.name === 'Cash';
          const isExpanded = expandedId === inv.id;
          const dealsList = isExpanded ? buildDealsForInvestor(inv, contextDeals) : [];
          const termsLabel = hasStandardTerms?.(inv) ? termsBadgeText?.(inv) : null;

          return (
            <div key={inv.id}>
              {/* Main row */}
              <div
                className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px_100px_100px_80px_140px] gap-2 md:gap-4 items-center px-5 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                onClick={() => setExpandedId(prev => (prev === inv.id ? null : inv.id))}
              >
                {/* Investor */}
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronRight
                    size={14}
                    className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <Avatar name={inv.name} size={32} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {inv.name}
                    </p>
                    {termsLabel ? (
                      <span className="inline-block text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded mt-0.5">
                        {termsLabel}
                      </span>
                    ) : !isCash ? (
                      <span className="inline-block text-[10px] font-medium text-gray-400 italic mt-0.5">
                        No terms set
                      </span>
                    ) : (
                      <span className="inline-block text-[10px] font-medium text-gray-400 mt-0.5">
                        Cash deals
                      </span>
                    )}
                  </div>
                </div>

                {/* Capital Invested */}
                <div className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {fmtUsd(inv.capitalInvested)}
                </div>

                {/* Total Returns */}
                <div className="text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                  {fmtUsd(inv.totalReturns)}
                </div>

                {/* ROI % */}
                <div className={`text-right text-sm font-semibold ${signedColor(inv.roiPct)}`}>
                  {fmtPct(inv.roiPct)}
                </div>

                {/* Ann. ROI */}
                <div className={`text-right text-sm font-semibold ${signedColor(inv.avgAnnualizedRoi)}`}>
                  {fmtPct(inv.avgAnnualizedRoi)}
                </div>

                {/* Deals badge */}
                <div className="text-center">
                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs font-bold rounded-full bg-accent/10 text-accent">
                    {inv.activeDeals || 0}
                  </span>
                </div>

                {/* Actions */}
                <div className="text-right">
                  {!isCash && onViewPortal && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewPortal(inv); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/5 transition-colors"
                      title="View portal as this investor"
                    >
                      <ExternalLink size={12} />
                      Portal
                    </button>
                  )}
                </div>
              </div>

              {/* Inline expanded deal list */}
              {isExpanded && (
                <div className="px-5 pb-3 pt-1 bg-gray-50/60 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
                  {dealsList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-3">No deals yet for this investor.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                      {dealsList.map(d => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between py-2 cursor-pointer hover:bg-white dark:hover:bg-white/[0.03] -mx-2 px-2 rounded"
                          onClick={() => onDealClick?.({ ...d, lender: inv.name })}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{d.address}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{d.stage || '—'}</p>
                          </div>
                          <div className="flex items-center gap-6 text-right ml-4">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase">Capital</p>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{fmtUsd(d.totalCapital)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase">ARV</p>
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{fmtUsd(d.arv)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
