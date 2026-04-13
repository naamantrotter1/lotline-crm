import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Calendar, User, ChevronDown, Star } from 'lucide-react';
import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';

// ── Column definitions ────────────────────────────────────────────────────────
const DD_COLUMNS = [
  { key: 'title_search',  label: 'Title Search',                       color: '#d97706', bg: '#fef3c7', hasDate: false, hasContractor: false },
  { key: 'survey',        label: 'Survey / Boundary Review',            color: '#2563eb', bg: '#dbeafe', hasDate: false, hasContractor: true  },
  { key: 'zoning',        label: 'Zoning & Land Use Verification',      color: '#7c3aed', bg: '#ede9fe', hasDate: false, hasContractor: true  },
  { key: 'perc_test',     label: 'Perc Test',                           color: '#16a34a', bg: '#dcfce7', hasDate: true,  hasContractor: true  },
  { key: 'flood_zone',    label: 'Flood Zone & Environmental Check',    color: '#0891b2', bg: '#cffafe', hasDate: false, hasContractor: true  },
  { key: 'utilities',     label: 'Utilities & Access Confirmation',     color: '#ea580c', bg: '#ffedd5', hasDate: false, hasContractor: true  },
  { key: 'tax_lien',      label: 'Tax & Lien Search',                   color: '#4f46e5', bg: '#e0e7ff', hasDate: false, hasContractor: false },
  { key: 'hoa',           label: 'HOA / Deed Restrictions Review',      color: '#db2777', bg: '#fce7f3', hasDate: false, hasContractor: false },
  { key: 'attorney',      label: 'Attorney Review',                     color: '#374151', bg: '#f3f4f6', hasDate: false, hasContractor: false },
];

const TOTAL_TASKS = DD_COLUMNS.length;

// Map legacy ddTasksCompleted names → column keys for initialization
const INIT_MAP = {
  'Perk Test': 'perc_test', 'Perc Test / Soil Report': 'perc_test',
  'Survey': 'survey', 'Title Search': 'title_search',
  'Zoning Verification': 'zoning', 'Flood Zone Check': 'flood_zone',
  'Utility Check': 'utilities', 'HOA Check': 'hoa',
  'Final DD Review': 'attorney',
};

const ddDeals = DEAL_OVERVIEW_DEALS.filter(d => d.stage === 'Due Diligence');

// ── localStorage helpers ──────────────────────────────────────────────────────
const lsGet  = (k)      => localStorage.getItem(k) || '';
const lsSet  = (k, v)   => localStorage.setItem(k, v);
const taskKey = (id, col) => `dd_${id}_${col}`;

function getTaskStatus(dealId, colKey) {
  return lsGet(taskKey(dealId, colKey)) || 'not_started';
}
function setTaskStatus(dealId, colKey, status) {
  lsSet(taskKey(dealId, colKey), status);
}
function getCompletedCount(dealId) {
  return DD_COLUMNS.filter(c => getTaskStatus(dealId, c.key) === 'complete').length;
}

// Seed from deal.ddTasksCompleted (run once)
function seedInitialState() {
  for (const deal of ddDeals) {
    for (const name of (deal.ddTasksCompleted || [])) {
      const k = INIT_MAP[name];
      if (k) {
        const lk = taskKey(deal.id, k);
        if (!localStorage.getItem(lk)) lsSet(lk, 'complete');
      }
    }
  }
}
seedInitialState();

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCloseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-');
  return `${m}/${d}/${y}`;
}

function getDayCount(contractDate) {
  if (!contractDate) return null;
  const start = new Date(contractDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  return diff >= 0 ? diff : null;
}

// ── Task card ─────────────────────────────────────────────────────────────────
function DDTaskCard({ deal, column, onUpdate }) {
  const navigate = useNavigate();

  const [status,     setStatus]     = useState(() => getTaskStatus(deal.id, column.key));
  const [date,       setDate]       = useState(() => lsGet(`${taskKey(deal.id, column.key)}_date`));
  const [contractor, setContractor] = useState(() => lsGet(`${taskKey(deal.id, column.key)}_cont`));
  const [editingCont, setEditingCont] = useState(false);

  if (status === 'complete') return null;

  const completed   = getCompletedCount(deal.id);
  const netProfit   = calcNetProfit(deal);
  const days        = getDayCount(deal.contractDate);
  const isInProgress = status === 'in_progress';

  const markComplete = (e) => {
    e.stopPropagation();
    setTaskStatus(deal.id, column.key, 'complete');
    setStatus('complete');
    onUpdate();
  };

  const handleDate = (e) => {
    e.stopPropagation();
    const val = e.target.value;
    lsSet(`${taskKey(deal.id, column.key)}_date`, val);
    setDate(val);
    if (status === 'not_started' && val) {
      setTaskStatus(deal.id, column.key, 'in_progress');
      setStatus('in_progress');
      onUpdate();
    }
  };

  const saveContractor = (val) => {
    lsSet(`${taskKey(deal.id, column.key)}_cont`, val);
    setContractor(val);
    setEditingCont(false);
    if (status === 'not_started' && val) {
      setTaskStatus(deal.id, column.key, 'in_progress');
      setStatus('in_progress');
      onUpdate();
    }
  };

  return (
    <div
      onClick={() => navigate(`/deal/${deal.id}`)}
      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-2 cursor-pointer hover:shadow-md transition-all"
    >
      {/* Address + progress */}
      <div className="mb-1.5">
        <p className="text-[11px] font-semibold text-gray-900 leading-snug line-clamp-2">{deal.address}</p>
        <p className={`text-[10px] font-medium mt-0.5 ${isInProgress ? 'text-orange-500' : 'text-gray-400'}`}>
          {isInProgress ? 'In Progress' : 'Not Started'} {completed}/{TOTAL_TASKS}
        </p>
      </div>

      {/* ARV */}
      <div className="text-[10px] text-gray-500 mb-0.5">
        ARV: <span className="font-semibold text-gray-800">${(deal.arv || 0).toLocaleString()}</span>
      </div>

      {/* Profit */}
      <div className="text-[10px] mb-2">
        <span className={`font-semibold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          ${Math.abs(Math.round(netProfit)).toLocaleString()}
        </span>
        {deal.financing && (
          <span className="text-gray-400"> ({deal.financing})</span>
        )}
      </div>

      {/* Day + closing */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {days !== null && (
          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
            Day {days}
          </span>
        )}
        {deal.closeDate && (
          <span className="text-[10px] text-gray-400">
            Closing: {formatCloseDate(deal.closeDate)}
          </span>
        )}
      </div>

      {/* Date picker (Perc Test) */}
      {column.hasDate && (
        <div className="mb-2" onClick={e => e.stopPropagation()}>
          <p className="text-[9px] text-gray-400 mb-0.5">Perc Test Scheduled Date</p>
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50">
            <Calendar size={9} className="text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={date}
              onChange={handleDate}
              className="text-[10px] text-gray-600 bg-transparent outline-none flex-1 min-w-0"
            />
          </div>
        </div>
      )}

      {/* Contractor */}
      {column.hasContractor && (
        <div className="mb-2" onClick={e => e.stopPropagation()}>
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
              onBlur={e => saveContractor(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveContractor(e.target.value); if (e.key === 'Escape') setEditingCont(false); }}
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
      )}

      {/* Mark Complete */}
      <button
        onClick={markComplete}
        className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg py-1.5 transition-colors"
      >
        <CheckCircle2 size={11} />
        Mark Complete
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DueDiligence() {
  const [tick, setTick]     = useState(0);
  const [sortBy, setSortBy] = useState('closing');
  const [showSort, setShowSort] = useState(false);

  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const sortedDeals = [...ddDeals].sort((a, b) => {
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
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-sidebar">Due Diligence</h1>
            <p className="text-sm text-gray-500">{ddDeals.length} deals</p>
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
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[160px] py-1">
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
        {DD_COLUMNS.map(col => {
          const colDeals = sortedDeals.filter(d => getTaskStatus(d.id, col.key) !== 'complete');
          return (
            <div key={col.key} className="flex-shrink-0 w-60">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: col.color }}
                  />
                  <div
                    className="px-2 py-0.5 rounded-md flex-shrink-0"
                    style={{ backgroundColor: col.bg }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: col.color }}>
                      {col.label.split(' ')[0]}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-700 text-[11px] leading-tight truncate">{col.label}</h3>
                </div>
                <span className="bg-gray-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0 ml-1">
                  {colDeals.length}
                </span>
              </div>

              {/* Cards */}
              <div>
                {colDeals.map(deal => (
                  <DDTaskCard
                    key={`${deal.id}-${col.key}-${tick}`}
                    deal={deal}
                    column={col}
                    onUpdate={forceUpdate}
                  />
                ))}
                {colDeals.length === 0 && (
                  <div className="rounded-xl p-5 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 bg-white/50">
                    All complete ✓
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
