// Filter chip row for the By Investor table.
// One group:
//   • Status: active / pending_invite / inactive  (multi-select)
//
// State is fully controlled by the parent ByInvestorTab so it can be
// reflected in the URL / KPI tile click handlers.

import { X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'active',         label: 'Active'         },
  { value: 'pending_invite', label: 'Pending Invite' },
  { value: 'inactive',       label: 'Inactive'       },
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
  onClearAll,
}) {
  const anyActive = statusFilter && statusFilter.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
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

      {anyActive && (
        <button
          onClick={onClearAll}
          className="ml-1 inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-rose-500"
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
}
