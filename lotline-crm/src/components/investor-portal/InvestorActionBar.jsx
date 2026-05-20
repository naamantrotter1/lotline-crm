// Action bar above the InvestorTable: search (debounced) + sort dropdown.
// Add Investor button / filter chips are deferred to later phases.

import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';

export const SORT_OPTIONS = [
  { value: 'capital_desc',     label: 'Capital Invested ↓' },
  { value: 'roi_pct_desc',     label: 'ROI % ↓'            },
  { value: 'ann_roi_desc',     label: 'Ann. ROI ↓'         },
  { value: 'deals_desc',       label: 'Deals ↓'            },
  { value: 'name_asc',         label: 'Name A→Z'           },
];

export default function InvestorActionBar({
  searchValue,
  onSearchChange,
  sortValue,
  onSortChange,
  totalCount,
  filteredCount,
  onRefresh,
  isRefreshing,
}) {
  // Local mirror so we can debounce the upward search emit.
  const [localSearch, setLocalSearch] = useState(searchValue || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== (searchValue || '')) onSearchChange?.(localSearch);
    }, 200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  // Cmd/Ctrl+K — focus search input (skipped while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showingFiltered = filteredCount != null && filteredCount !== totalCount;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 sm:max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          placeholder="Search investors by name or terms… (⌘K)"
          className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#1c2130] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {/* Right side: count + refresh + sort */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {showingFiltered
            ? `${filteredCount} of ${totalCount}`
            : `${totalCount} ${totalCount === 1 ? 'investor' : 'investors'}`}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-accent hover:border-accent/40 disabled:opacity-50 transition-colors"
            title="Refresh investor data"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        )}
        <select
          value={sortValue}
          onChange={e => onSortChange?.(e.target.value)}
          className="text-sm bg-white dark:bg-[#1c2130] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
