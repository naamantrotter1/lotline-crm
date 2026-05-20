// Dense, sortable investor table on the operator "By Investor" tab.
// Click a row → opens the InvestorDrawer (URL-driven by ?investor=<id>).
// Per-row "Portal" button impersonates that investor.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MoreVertical, Send, Pencil } from 'lucide-react';
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

// Status derivation from existing data: Active if any deals, Pending Invite if
// has email but no deals, Inactive if neither.
export function deriveInvestorStatus(inv) {
  if (!inv || inv.name === 'Cash') return null;
  if ((inv.activeDeals || 0) > 0) return 'active';
  if (inv.email) return 'pending_invite';
  return 'inactive';
}

const STATUS_PILL_CLASSES = {
  active:         'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  pending_invite: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  inactive:       'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300',
};
const STATUS_PILL_LABEL = {
  active: 'Active', pending_invite: 'Pending', inactive: 'Inactive',
};

function StatusPill({ status }) {
  if (!status) return null;
  return (
    <span className={`inline-block text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_PILL_CLASSES[status]}`}>
      {STATUS_PILL_LABEL[status]}
    </span>
  );
}

function RowKebab({ inv, isCash, onViewPortal, onSendInvite, onEditTerms }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5"
        aria-label="Row actions"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 bg-white dark:bg-[#252b3d] rounded-md shadow-lg border border-gray-200 dark:border-white/10 py-1">
          {!isCash && onViewPortal && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onViewPortal(inv); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <ExternalLink size={12} /> View Portal
            </button>
          )}
          {!isCash && onSendInvite && inv.email && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onSendInvite(inv); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <Send size={12} /> Send Invite
            </button>
          )}
          {!isCash && onEditTerms && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onEditTerms(inv); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <Pencil size={12} /> Edit Terms
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────
export default function InvestorTable({
  investors,
  searchValue,
  sortValue,
  statusFilter,
  onClearFilters,
  onRowClick,
  onViewPortal,
  onSendInvite,
  onEditTerms,
  hasStandardTerms,
  termsBadgeText,
}) {
  const visibleInvestors = useMemo(() => {
    const q = (searchValue || '').trim().toLowerCase();
    const statusSet = new Set(statusFilter || []);

    const filtered = investors.filter(inv => {
      if (q) {
        const name = String(inv.name || '').toLowerCase();
        const terms = String(termsBadgeText?.(inv) || '').toLowerCase();
        if (!(name.includes(q) || terms.includes(q))) return false;
      }
      if (statusSet.size > 0) {
        const status = deriveInvestorStatus(inv);
        if (!status || !statusSet.has(status)) return false;
      }
      return true;
    });
    const sorter = SORTERS[sortValue] || SORTERS.capital_desc;
    return [...filtered].sort(sorter);
  }, [investors, searchValue, sortValue, statusFilter, termsBadgeText]);

  const hasFilters = statusFilter && statusFilter.length > 0;

  if (visibleInvestors.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 p-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {searchValue || hasFilters ? (
          <>
            <p className="mb-2">No investors match these filters.</p>
            {onClearFilters && (
              <button onClick={onClearFilters} className="text-accent text-xs font-medium hover:underline">
                Clear filters
              </button>
            )}
          </>
        ) : (
          <p>No investors yet.</p>
        )}
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
          const termsLabel = hasStandardTerms?.(inv) ? termsBadgeText?.(inv) : null;

          const onRowKeyDown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRowClick?.(inv);
            }
          };

          return (
            <div
              key={inv.id}
              tabIndex={0}
              role="button"
              aria-label={`Open details for ${inv.name}`}
              onClick={() => onRowClick?.(inv)}
              onKeyDown={onRowKeyDown}
              className="hover:bg-gray-50 dark:hover:bg-white/[0.03] focus:bg-gray-50 dark:focus:bg-white/[0.03] focus:outline-none cursor-pointer transition-colors"
            >
              {/* ── Desktop grid row (md+) ───────────────────────────── */}
              <div className="hidden md:grid md:grid-cols-[1fr_140px_140px_100px_100px_80px_140px] md:gap-4 md:items-center px-5 py-3">
                {/* Investor */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={inv.name} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{inv.name}</p>
                      <StatusPill status={deriveInvestorStatus(inv)} />
                    </div>
                    {termsLabel ? (
                      <span className="inline-block text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded mt-0.5">
                        {termsLabel}
                      </span>
                    ) : !isCash ? (
                      <span className="inline-block text-[10px] font-medium text-gray-400 italic mt-0.5">No terms set</span>
                    ) : (
                      <span className="inline-block text-[10px] font-medium text-gray-400 mt-0.5">Cash deals</span>
                    )}
                  </div>
                </div>

                <div className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{fmtUsd(inv.capitalInvested)}</div>
                <div className="text-right text-sm font-medium text-gray-700 dark:text-gray-300">{fmtUsd(inv.totalReturns)}</div>
                <div className={`text-right text-sm font-semibold ${signedColor(inv.roiPct)}`}>{fmtPct(inv.roiPct)}</div>
                <div className={`text-right text-sm font-semibold ${signedColor(inv.avgAnnualizedRoi)}`}>{fmtPct(inv.avgAnnualizedRoi)}</div>
                <div className="text-center">
                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 text-xs font-bold rounded-full bg-accent/10 text-accent">
                    {inv.activeDeals || 0}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1">
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
                  <RowKebab inv={inv} isCash={isCash} onViewPortal={onViewPortal} onSendInvite={onSendInvite} onEditTerms={onEditTerms} />
                </div>
              </div>

              {/* ── Mobile card (< md) ───────────────────────────────── */}
              <div className="md:hidden px-4 py-3 space-y-2.5">
                <div className="flex items-start gap-3">
                  <Avatar name={inv.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{inv.name}</p>
                      <StatusPill status={deriveInvestorStatus(inv)} />
                    </div>
                    {termsLabel ? (
                      <span className="inline-block text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded mt-1">{termsLabel}</span>
                    ) : !isCash ? (
                      <span className="inline-block text-[10px] font-medium text-gray-400 italic mt-1">No terms set</span>
                    ) : null}
                  </div>
                  <RowKebab inv={inv} isCash={isCash} onViewPortal={onViewPortal} onSendInvite={onSendInvite} onEditTerms={onEditTerms} />
                </div>

                <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 dark:bg-white/[0.03] rounded-md p-2">
                  <div>
                    <p className="text-[9px] uppercase text-gray-400 tracking-wider">Capital</p>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{fmtUsd(inv.capitalInvested)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-gray-400 tracking-wider">ROI %</p>
                    <p className={`text-xs font-bold ${signedColor(inv.roiPct)}`}>{fmtPct(inv.roiPct)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-gray-400 tracking-wider">Ann.</p>
                    <p className={`text-xs font-bold ${signedColor(inv.avgAnnualizedRoi)}`}>{fmtPct(inv.avgAnnualizedRoi)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-gray-400 tracking-wider">Deals</p>
                    <p className="text-xs font-bold text-accent">{inv.activeDeals || 0}</p>
                  </div>
                </div>

                {!isCash && onViewPortal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewPortal(inv); }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent/5"
                  >
                    <ExternalLink size={12} /> View Portal
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
