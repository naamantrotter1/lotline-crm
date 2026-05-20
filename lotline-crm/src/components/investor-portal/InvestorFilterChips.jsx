// Filter chip row for the By Investor table.
// Three groups:
//   • Status: active / pending_invite / inactive  (multi-select)
//   • Deals:  any / 0 / 1-3 / 4+                  (single-select)
//   • Terms:  chip per distinct terms string      (multi-select)
//
// State is fully controlled by the parent ByInvestorTab so it can be
// reflected in the URL / KPI tile click handlers.

import { X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active',         label: 'Active'         },
  { value: 'pending_invite', label: 'Pending Invite' },
  { value: 'inactive',       label: 'Inactive'       },
];

const DEALS_OPTIONS = [
  { value: 'any', label: 'Any deals' },
  { value: '0',   label: '0 deals'   },
  { value: '1-3', label: '1–3 deals' },
  { value: '4+',  label: '4+ deals'  },
];

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-white dark:bg-[#1c2130] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-accent/40'
      }`}
    >
      {children}
    </button>
  );
}

export default function InvestorFilterChips({
  statusFilter,        // string[] of values selected
  onToggleStatus,
  dealsFilter,         // string (single)
  onChangeDeals,
  termsOptions,        // string[]
  termsFilter,         // string[]
  onToggleTerms,
  onClearAll,
}) {
  const anyActive =
    (statusFilter && statusFilter.length > 0) ||
    (dealsFilter && dealsFilter !== 'any') ||
    (termsFilter && termsFilter.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5">Status</span>
        {STATUS_OPTIONS.map(o => (
          <Chip
            key={o.value}
            active={(statusFilter || []).includes(o.value)}
            onClick={() => onToggleStatus?.(o.value)}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      {/* Deals */}
      <div className="flex items-center gap-1.5 ml-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5">Deals</span>
        {DEALS_OPTIONS.map(o => (
          <Chip
            key={o.value}
            active={(dealsFilter || 'any') === o.value && o.value !== 'any'}
            onClick={() => onChangeDeals?.(o.value === dealsFilter ? 'any' : o.value)}
          >
            {o.label}
          </Chip>
        ))}
      </div>

      {/* Terms */}
      {termsOptions && termsOptions.length > 0 && (
        <div className="flex items-center gap-1.5 ml-1 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-0.5">Terms</span>
          {termsOptions.map(t => (
            <Chip
              key={t}
              active={(termsFilter || []).includes(t)}
              onClick={() => onToggleTerms?.(t)}
            >
              {t}
            </Chip>
          ))}
        </div>
      )}

      {/* Clear all */}
      {anyActive && (
        <button
          onClick={onClearAll}
          className="ml-1 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-rose-500"
        >
          <X size={12} /> Clear all
        </button>
      )}
    </div>
  );
}
