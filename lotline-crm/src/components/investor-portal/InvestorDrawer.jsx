// Right-side overlay drawer for the operator "By Investor" view.
// Phase 2 scope: header + Overview tab + Deals tab. Deep-link via
// useSearchParams (?investor=<id>) so reload preserves the open drawer.
//
// Distributions / Documents / Activity tabs are stubbed (Phase 4).

import { useEffect, useMemo, useState } from 'react';
import { X, ExternalLink, ChevronRight, FileText, Download } from 'lucide-react';
import Avatar from './Avatar.jsx';
import {
  fetchInvestorDistributions,
  fetchMyDocuments,
  fetchNotifications,
} from '../../lib/investorPortalData';
import { computeDealInvestorCapital } from '../../lib/dealCapital';

function formatPhone(raw) {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

const TABS = [
  { key: 'overview',      label: 'Overview'      },
  { key: 'deals',         label: 'Deals'         },
  { key: 'distributions', label: 'Distributions' },
  { key: 'documents',     label: 'Documents'     },
  { key: 'activity',      label: 'Activity'      },
];

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString()}`;
const fmtPct = (n) => `${Number(n || 0).toFixed(2)}%`;

function signedColor(n) {
  if (n == null || Number.isNaN(Number(n))) return 'text-gray-500 dark:text-gray-400';
  return Number(n) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
}

function buildDealsForInvestor(investor, contextDeals) {
  return (contextDeals || [])
    .filter(d => !d.isArchived && (d.allocations || []).some(a => a.investorId === investor.id))
    .map(d => {
      const alloc = (d.allocations || []).find(a => a.investorId === investor.id) || {};
      return {
        id: d.id,
        address: d.address,
        stage: d.stage,
        // Capital is computed live from the deal's financing scenario so it
        // tracks any edit on the deal page. The allocation row is intentionally
        // not consulted here — it goes stale the moment a cost changes.
        totalCapital: computeDealInvestorCapital(d),
        arv: d.arv || 0,
        closeDate: d.closeDate || null,
        equityPct: alloc.profitSharePct ?? null,
        status: alloc.status || null,
      };
    });
}

export default function InvestorDrawer({
  investor,
  contextDeals,
  open,
  onClose,
  onViewPortal,
  onDealClick,
  hasStandardTerms,
  termsBadgeText,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  // Reset to overview each time a new investor is selected.
  useEffect(() => {
    if (open) setActiveTab('overview');
  }, [investor?.id, open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const deals = useMemo(
    () => (investor ? buildDealsForInvestor(investor, contextDeals) : []),
    [investor, contextDeals]
  );

  if (!open || !investor) return null;

  const isCash = investor.name === 'Cash';
  const termsLabel = hasStandardTerms?.(investor) ? termsBadgeText?.(investor) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Investor details for ${investor.name}`}
        className="fixed top-0 right-0 bottom-0 z-50 bg-white dark:bg-[#1c2130] shadow-2xl w-full sm:max-w-[540px] flex flex-col border-l border-gray-200 dark:border-white/10"
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-start gap-4">
            <Avatar name={investor.name} size={56} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{investor.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {termsLabel && (
                  <span className="text-[11px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                    {termsLabel}
                  </span>
                )}
                {investor.email && (
                  <a
                    href={`mailto:${investor.email}`}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-accent truncate"
                  >
                    {investor.email}
                  </a>
                )}
                {investor.phone && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatPhone(investor.phone)}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {!isCash && onViewPortal && (
                <button
                  onClick={() => onViewPortal(investor)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent/90 rounded-md"
                  title="View portal as this investor"
                >
                  <ExternalLink size={12} />
                  View Portal
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-white/5"
                aria-label="Close drawer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex items-center gap-1 mt-4 -mb-px overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'overview' && (
            <OverviewTab investor={investor} deals={deals} onDealClick={onDealClick} />
          )}
          {activeTab === 'deals' && (
            <DealsTab deals={deals} onDealClick={onDealClick} />
          )}
          {activeTab === 'distributions' && <DistributionsTab investorId={investor.id} />}
          {activeTab === 'documents' && <DocumentsTab investorId={investor.id} />}
          {activeTab === 'activity' && <ActivityTab investorId={investor.id} />}
        </div>
      </aside>
    </>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function OverviewTab({ investor, deals, onDealClick }) {
  const kpis = [
    { label: 'Capital Invested', value: fmtUsd(investor.capitalInvested) },
    { label: 'Total Returns',    value: fmtUsd(investor.totalReturns)    },
    { label: 'Avg Ann. ROI',     value: fmtPct(investor.avgAnnualizedRoi), color: signedColor(investor.avgAnnualizedRoi) },
  ];

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3">
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
            <p className={`text-base font-bold mt-1 ${color || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Position breakdown */}
      <div>
        <h3 className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Position breakdown
        </h3>
        {deals.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-3">No active positions.</p>
        ) : (
          <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg divide-y divide-gray-100 dark:divide-white/5">
            {deals.map(d => (
              <button
                key={d.id}
                onClick={() => onDealClick?.({ id: d.id, address: d.address, stage: d.stage })}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white dark:hover:bg-white/[0.04] text-left transition-colors"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{d.address}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {d.stage || '—'}
                    {d.status ? ` · ${d.status}` : ''}
                    {d.equityPct != null ? ` · ${Number(d.equityPct).toFixed(1)}% equity` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase">Capital</p>
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{fmtUsd(d.totalCapital)}</p>
                </div>
                <ChevronRight size={14} className="text-gray-400 ml-2 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DealsTab({ deals, onDealClick }) {
  const [sortValue, setSortValue] = useState('capital_desc');

  const sorted = useMemo(() => {
    const arr = [...deals];
    switch (sortValue) {
      case 'capital_desc': arr.sort((a, b) => b.totalCapital - a.totalCapital); break;
      case 'arv_desc':     arr.sort((a, b) => b.arv - a.arv); break;
      case 'close_asc':    arr.sort((a, b) => String(a.closeDate || '').localeCompare(String(b.closeDate || ''))); break;
      default: break;
    }
    return arr;
  }, [deals, sortValue]);

  if (deals.length === 0) {
    return <p className="text-xs text-gray-400 italic">No deals yet for this investor.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
        </span>
        <select
          value={sortValue}
          onChange={e => setSortValue(e.target.value)}
          className="text-xs bg-white dark:bg-[#252b3d] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-md px-2 py-1"
        >
          <option value="capital_desc">Capital ↓</option>
          <option value="arv_desc">ARV ↓</option>
          <option value="close_asc">Close date ↑</option>
        </select>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-white/5 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
        {sorted.map(d => (
          <button
            key={d.id}
            onClick={() => onDealClick?.({ id: d.id, address: d.address, stage: d.stage })}
            className="w-full px-3 py-3 text-left hover:bg-white dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{d.address}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {d.stage || '—'}
                  {d.status ? ` · ${d.status}` : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-gray-400 uppercase">Capital</p>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{fmtUsd(d.totalCapital)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-400">
              <span>ARV: {fmtUsd(d.arv)}</span>
              {d.closeDate && <span>Close: {d.closeDate}</span>}
              {d.equityPct != null && <span>{Number(d.equityPct).toFixed(1)}% equity</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/5 last:border-b-0">
      <div className="flex-1">
        <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-2/3 mb-2"></div>
        <div className="h-2 bg-gray-100 dark:bg-white/5 rounded w-1/3"></div>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-20"></div>
    </div>
  );
}

function EmptyTab({ label, hint }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 dark:border-white/10 p-6 text-center">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function DistributionsTab({ investorId }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchInvestorDistributions(investorId)
      .then(({ distributions, error }) => {
        if (!alive) return;
        if (error) setErr(error);
        setRows(distributions || []);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [investorId]);

  if (loading) return <div>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  if (err) return <EmptyTab label="Couldn't load distributions" hint={err.message || 'Try again later.'} />;
  if (rows.length === 0) return <EmptyTab label="No distributions yet" hint="Issued payouts will appear here." />;

  return (
    <div className="divide-y divide-gray-100 dark:divide-white/5 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
      {rows.map(d => (
        <div key={d.id} className="px-3 py-2.5 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
              {d.deals?.address || 'Distribution'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {d.date || '—'}{d.type ? ` · ${d.type}` : ''}
              {d.wire_reference ? ` · ref ${d.wire_reference}` : ''}
            </p>
          </div>
          <div className="text-right ml-3 flex-shrink-0">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{fmtUsd(d.amount)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsTab({ investorId }) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchMyDocuments(investorId).then(({ documents }) => {
      if (!alive) return;
      setDocs(documents || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [investorId]);

  if (loading) return <div>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  if (docs.length === 0) return <EmptyTab label="No documents shared yet" hint="Uploads scoped to this investor's deals will appear here." />;

  return (
    <div className="divide-y divide-gray-100 dark:divide-white/5 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
      {docs.map(doc => (
        <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
          <FileText size={16} className="text-accent flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
              {doc.category || doc.title || 'Document'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
              {doc.deals?.address || '—'}
              {doc.file_size_bytes ? ` · ${fmtBytes(doc.file_size_bytes)}` : ''}
            </p>
          </div>
          {doc.file_url && (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-md text-gray-500 hover:text-accent hover:bg-white dark:hover:bg-white/5"
              aria-label="Download document"
            >
              <Download size={14} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ investorId }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchNotifications(investorId).then(({ notifications }) => {
      if (!alive) return;
      setItems(notifications || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [investorId]);

  if (loading) return <div>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>;
  if (items.length === 0) return <EmptyTab label="No activity yet" hint="Invites, status changes, and messages will show up here." />;

  return (
    <ol className="relative border-l border-gray-200 dark:border-white/10 ml-2 space-y-3">
      {items.slice(0, 25).map(n => (
        <li key={n.id} className="ml-4">
          <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-accent" />
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            {n.title || n.type || 'Update'}
          </p>
          {n.body && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>}
          <p className="text-[10px] text-gray-400 mt-0.5">
            {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
