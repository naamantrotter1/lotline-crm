import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../lib/DealsContext';
import { ChevronDown, User, Calendar, CheckSquare, Square } from 'lucide-react';
import { calcNetProfit } from '../data/deals';

// ── Column definitions (matches Lovable CRM) ──────────────────────────────────
const DEV_COLUMNS = [
  {
    key: 'land_clearing', label: 'Land Clearing', color: '#16a34a', bg: '#dcfce7',
    subtasks: ['Land clearing scheduled', 'Land clearing complete'],
    tagOnly: true, // only show deals tagged 'Land Clearing'
  },
  {
    key: 'permits', label: 'Permits', color: '#d97706', bg: '#fef3c7',
    subtasks: ['Permits submitted', 'Permits approved'],
  },
  {
    key: 'mh_order', label: 'Mobile Home Order', color: '#7c3aed', bg: '#ede9fe',
    subtasks: ['Order mobile home', 'MH ordered'],
  },
  {
    key: 'setup_crew', label: 'Set-Up Crew', color: '#0891b2', bg: '#cffafe',
    subtasks: ['Schedule set-up crew', 'Set-up crew scheduled', 'Set-up crew complete (home set)', 'De-title home (after set)'],
  },
  {
    key: 'septic', label: 'Septic', color: '#ea580c', bg: '#ffedd5',
    subtasks: ['Schedule septic', 'Septic scheduled', 'Septic complete'],
  },
  {
    key: 'well', label: 'Well', color: '#2563eb', bg: '#dbeafe',
    subtasks: ['Schedule well', 'Well scheduled', 'Well complete'],
  },
  {
    key: 'electrical', label: 'Electrical', color: '#ca8a04', bg: '#fef9c3',
    subtasks: ['Schedule electrical', 'Electrical scheduled', 'Electrical complete'],
  },
  {
    key: 'plumbing', label: 'Plumbing', color: '#4f46e5', bg: '#e0e7ff',
    subtasks: ['Schedule plumbing hook-up (well/septic)', 'Plumbing scheduled', 'Plumbing complete'],
  },
  {
    key: 'hvac', label: 'HVAC', color: '#be185d', bg: '#fce7f3',
    subtasks: ['Schedule HVAC', 'HVAC scheduled', 'HVAC complete'],
  },
  {
    key: 'skirting', label: 'Skirting', color: '#059669', bg: '#d1fae5',
    subtasks: ['Schedule skirting', 'Skirting scheduled', 'Skirting complete'],
  },
  {
    key: 'steps', label: 'Steps / Entry', color: '#7c3aed', bg: '#f3e8ff',
    subtasks: ['Order steps (front & back)', 'Steps ordered', 'Steps delivery date', 'Schedule steps install', 'Steps installed'],
  },
  {
    key: 'final_grade', label: 'Final Grade', color: '#374151', bg: '#f3f4f6',
    subtasks: ['Final grade scheduled', 'Final grade complete'],
  },
  {
    key: 'inspection', label: 'Final Inspection & CO', color: '#dc2626', bg: '#fee2e2',
    subtasks: ['Schedule final building inspection', 'Final building inspection scheduled', 'Final building inspection passed', 'Certificate of Occupancy (CO) received'],
  },
  {
    key: 'list_home', label: 'List Home', color: '#0891b2', bg: '#e0f2fe',
    subtasks: ['List home'],
  },
];

// All subtasks that count toward the total (exclude land_clearing)
const COUNTED_COLUMNS = DEV_COLUMNS.filter(c => !c.tagOnly);
const TOTAL_SUBTASKS = COUNTED_COLUMNS.reduce((sum, c) => sum + c.subtasks.length, 0);

const DEAL_OVERVIEW_STAGES = new Set(['Development']);
function loadDevDeals() {
  const all = (() => { try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; } })();
  return all
    .map(d => ({ ...d, stage: localStorage.getItem(`lotline_deal_stage_${d.id}`) || d.stage }))
    .filter(d => DEAL_OVERVIEW_STAGES.has(d.stage));
}
// devDeals now computed inside component from context

const STAGE_ORDER = ['Contract Signed', 'Due Diligence', 'Development'];
const STAGE_COLORS = {
  'Contract Signed': { color: '#16a34a', bg: '#dcfce7' },
  'Due Diligence':   { color: '#d97706', bg: '#fef3c7' },
  'Development':     { color: '#2563eb', bg: '#dbeafe' },
};

// ── localStorage helpers ──────────────────────────────────────────────────────
const lsGet = (k)    => localStorage.getItem(k) || '';
const lsSet = (k, v) => localStorage.setItem(k, v);

function subtaskKey(dealId, colKey, subtaskIdx) {
  return `dev_${dealId}_${colKey}_${subtaskIdx}`;
}
function contractorKey(dealId, colKey) {
  return `dev_${dealId}_${colKey}_cont`;
}
function isSubtaskDone(dealId, colKey, idx) {
  return lsGet(subtaskKey(dealId, colKey, idx)) === '1';
}
function setSubtaskDone(dealId, colKey, idx, done) {
  lsSet(subtaskKey(dealId, colKey, idx), done ? '1' : '');
}
function isColComplete(dealId, col) {
  return col.subtasks.every((_, i) => isSubtaskDone(dealId, col.key, i));
}
function getTotalDone(dealId) {
  return COUNTED_COLUMNS.reduce((sum, col) =>
    sum + col.subtasks.filter((_, i) => isSubtaskDone(dealId, col.key, i)).length, 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDayCount(contractDate) {
  if (!contractDate) return null;
  const start = new Date(contractDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  return diff >= 0 ? diff : null;
}

function formatClose(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-');
  return `${m}/${d}/${y}`;
}

// ── Card ──────────────────────────────────────────────────────────────────────
function DevTaskCard({ deal, column, onUpdate }) {
  const navigate = useNavigate();

  const [checks, setChecks] = useState(() =>
    column.subtasks.map((_, i) => isSubtaskDone(deal.id, column.key, i))
  );
  const [contractor, setContractor] = useState(() => lsGet(contractorKey(deal.id, column.key)));
  const [editingCont, setEditingCont] = useState(false);

  const allDone = checks.every(Boolean);
  if (allDone) return null;

  const totalDone = getTotalDone(deal.id);
  const days = getDayCount(deal.contractDate);
  const inProgress = checks.some(Boolean);

  const toggle = (e, idx) => {
    e.stopPropagation();
    const next = [...checks];
    next[idx] = !next[idx];
    setSubtaskDone(deal.id, column.key, idx, next[idx]);
    setChecks(next);
    if (next.every(Boolean)) onUpdate(); // disappear from column
    else onUpdate();
  };

  const saveCont = (val) => {
    lsSet(contractorKey(deal.id, column.key), val);
    setContractor(val);
    setEditingCont(false);
  };

  return (
    <div
      onClick={() => navigate(`/deal/${deal.id}`)}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-2 cursor-pointer hover:shadow-md transition-all"
    >
      {/* Address */}
      <p className="text-[11px] font-semibold text-gray-900 leading-snug line-clamp-2 mb-1">{deal.address}</p>

      {/* Day + total progress */}
      <div className="flex items-center gap-2 mb-2">
        {days !== null && (
          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
            Day {days}
          </span>
        )}
        <span className={`text-[10px] font-medium ${inProgress ? 'text-orange-500' : 'text-gray-400'}`}>
          {totalDone}/{TOTAL_SUBTASKS} total
        </span>
        {deal.closeDate && (
          <span className="text-[10px] text-gray-400 ml-auto">
            {formatClose(deal.closeDate)}
          </span>
        )}
      </div>

      {/* Subtask checkboxes */}
      <div className="space-y-1 mb-2" onClick={e => e.stopPropagation()}>
        {column.subtasks.map((task, i) => (
          <button
            key={i}
            onClick={e => toggle(e, i)}
            className="flex items-center gap-1.5 w-full text-left group"
          >
            {checks[i]
              ? <CheckSquare size={12} className="text-green-500 flex-shrink-0" />
              : <Square size={12} className="text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
            }
            <span className={`text-[10px] leading-snug ${checks[i] ? 'line-through text-gray-300' : 'text-gray-600'}`}>
              {task}
            </span>
          </button>
        ))}
      </div>

      {/* Contractor */}
      <div onClick={e => e.stopPropagation()}>
        {contractor ? (
          <button
            onClick={e => { e.stopPropagation(); setEditingCont(true); }}
            className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 rounded-lg px-2 py-1 w-full text-left"
          >
            <User size={9} className="flex-shrink-0" />
            <span className="truncate">{contractor}</span>
          </button>
        ) : editingCont ? (
          <input
            autoFocus
            type="text"
            placeholder="Contractor name..."
            className="text-[10px] border border-gray-300 rounded-lg px-2 py-1 w-full outline-none focus:border-blue-400"
            onBlur={e => saveCont(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveCont(e.target.value); if (e.key === 'Escape') setEditingCont(false); }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setEditingCont(true); }}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg px-2 py-1 w-full transition-colors"
          >
            <ChevronDown size={9} />
            Add Contractor
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Development() {
  const { deals } = useDeals();
  const [tick, setTick]       = useState(0);
  const [sortBy, setSortBy]   = useState('closing');
  const [showSort, setShowSort] = useState(false);

  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const devDeals = useMemo(() =>
    deals.filter(d => DEAL_OVERVIEW_STAGES.has(d.stage) && !d.isArchived)
  , [deals]);

  const sortedDeals = [...devDeals].sort((a, b) => {
    if (sortBy === 'closing') {
      if (!a.closeDate && !b.closeDate) return 0;
      if (!a.closeDate) return 1;
      if (!b.closeDate) return -1;
      return new Date(a.closeDate) - new Date(b.closeDate);
    }
    if (sortBy === 'days') {
      return (getDayCount(b.contractDate) ?? 0) - (getDayCount(a.contractDate) ?? 0);
    }
    return 0;
  });

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-sidebar">Development</h1>
            <p className="text-sm text-gray-500">{devDeals.length} deals in pipeline</p>
          </div>
          <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
            All Deals <ChevronDown size={13} />
          </button>
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setShowSort(s => !s)}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            <Calendar size={13} />
            {sortBy === 'closing' ? 'Closing Date' : 'Days in Pipeline'}
            <ChevronDown size={13} />
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[170px] py-1">
              {[['closing', 'Closing Date'], ['days', 'Days in Pipeline']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setSortBy(val); setShowSort(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${sortBy === val ? 'text-accent font-medium' : 'text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div
        key={tick}
        className="flex gap-3 overflow-x-auto pb-4"
        style={{ minHeight: 'calc(100vh - 220px)' }}
      >
        {DEV_COLUMNS.map(col => {
          // Land Clearing: only show tagged deals; other columns: show all
          const colDeals = sortedDeals.filter(d => {
            if (col.tagOnly) return (d.tags || []).includes('Land Clearing') && !isColComplete(d.id, col);
            return !isColComplete(d.id, col);
          });

          return (
            <div key={col.key} className="flex-shrink-0 w-56">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-semibold text-gray-700 text-[11px] leading-tight truncate">{col.label}</h3>
                </div>
                <span className="bg-gray-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0 ml-1">
                  {colDeals.length}
                </span>
              </div>

              {/* Cards grouped by stage */}
              <div>
                {(() => {
                  if (colDeals.length === 0) {
                    return (
                      <div className="rounded-xl p-5 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 bg-white/50">
                        All tasks done ✓
                      </div>
                    );
                  }
                  return colDeals.map(deal => (
                    <DevTaskCard
                      key={`${deal.id}-${col.key}-${tick}`}
                      deal={deal}
                      column={col}
                      onUpdate={forceUpdate}
                    />
                  ));
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
