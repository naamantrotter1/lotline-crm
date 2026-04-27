import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../lib/DealsContext';
import { ChevronDown, ChevronUp, CheckSquare, Square, Calendar } from 'lucide-react';
import { calcNetProfit } from '../data/deals';
import { supabase } from '../lib/supabase';
import ContractorPicker from '../components/deal/ContractorPicker';

// ── Column definitions ─────────────────────────────────────────────────────────
// milestoneKey  → deal_milestones.milestone_key (two-way sync with Important Dates sidebar)
// contractorType → filters ContractorPicker to matching contacts
const DEV_COLUMNS = [
  {
    key: 'land_clearing', label: 'Land Clearing',
    color: '#16a34a', bg: '#dcfce7',
    subtasks: ['Land clearing scheduled', 'Land clearing complete'],
    tagOnly: true,
    milestoneKey: 'land_clearing_scheduled',
    contractorType: 'Land Clearing Contractor',
    dateLabel: 'Land Clearing Scheduled',
  },
  {
    key: 'env_permits', label: 'Environmental Permits',
    color: '#16a34a', bg: '#dcfce7',
    subtasks: ['Septic Permit', 'Well Permit', 'Construction Authorization Permit'],
    milestoneKey: 'env_permits_submitted',
    contractorType: 'Environmental Consultant',
    dateLabel: 'Permits Submitted',
  },
  {
    key: 'mh_order', label: 'Mobile Home Order',
    color: '#7c3aed', bg: '#ede9fe',
    subtasks: ['Order mobile home', 'MH ordered'],
    milestoneKey: 'home_ordered',
    contractorType: 'Home Dealer',
    dateLabel: 'Home Ordered',
  },
  {
    key: 'construction_permits', label: 'Construction Permits',
    color: '#d97706', bg: '#fef3c7',
    subtasks: ['Building Permit', 'Electrical Permit', 'Plumbing Permit', 'Mechanical Permit'],
    milestoneKey: 'building_permits_submitted',
    contractorType: 'Permit Expeditor',
    dateLabel: 'Permits Submitted',
  },
  {
    key: 'setup_crew', label: 'Set-Up Crew',
    color: '#0891b2', bg: '#cffafe',
    subtasks: ['Schedule set-up crew', 'Set-up crew scheduled', 'Set-up crew complete (home set)', 'De-title home (after set)'],
    milestoneKey: 'setup_contractor_scheduled',
    contractorType: 'Home Setup Contractor',
    dateLabel: 'Set-Up Scheduled',
  },
  {
    key: 'septic', label: 'Septic',
    color: '#ea580c', bg: '#ffedd5',
    subtasks: ['Schedule septic', 'Septic scheduled', 'Septic complete'],
    milestoneKey: 'septic_install_scheduled',
    contractorType: 'Septic Contractor',
    dateLabel: 'Septic Scheduled',
  },
  {
    key: 'well', label: 'Well',
    color: '#2563eb', bg: '#dbeafe',
    subtasks: ['Schedule well', 'Well scheduled', 'Well complete'],
    milestoneKey: 'well_install_scheduled',
    contractorType: 'Well Drilling Contractor',
    dateLabel: 'Well Scheduled',
  },
  {
    key: 'electrical', label: 'Electrical',
    color: '#ca8a04', bg: '#fef9c3',
    subtasks: ['Schedule electrical', 'Electrical scheduled', 'Electrical complete'],
    milestoneKey: 'power_company_scheduled',
    contractorType: 'Electrician',
    dateLabel: 'Electrical Scheduled',
  },
  {
    key: 'plumbing', label: 'Plumbing',
    color: '#4f46e5', bg: '#e0e7ff',
    subtasks: ['Schedule plumbing hook-up (well/septic)', 'Plumbing scheduled', 'Plumbing complete'],
    milestoneKey: null,
    contractorType: 'Plumbing Contractor',
  },
  {
    key: 'hvac', label: 'HVAC',
    color: '#be185d', bg: '#fce7f3',
    subtasks: ['Schedule HVAC', 'HVAC scheduled', 'HVAC complete'],
    milestoneKey: null,
    contractorType: 'HVAC Contractor',
  },
  {
    key: 'skirting', label: 'Skirting',
    color: '#059669', bg: '#d1fae5',
    subtasks: ['Schedule skirting', 'Skirting scheduled', 'Skirting complete'],
    milestoneKey: null,
    contractorType: 'Skirting Contractor',
  },
  {
    key: 'steps', label: 'Steps / Entry',
    color: '#7c3aed', bg: '#f3e8ff',
    subtasks: ['Order steps (front & back)', 'Steps ordered', 'Steps delivery date', 'Schedule steps install', 'Steps installed'],
    milestoneKey: null,
    contractorType: null,
  },
  {
    key: 'final_grade', label: 'Final Grade',
    color: '#374151', bg: '#f3f4f6',
    subtasks: ['Final grade scheduled', 'Final grade complete'],
    milestoneKey: null,
    contractorType: 'Land Clearing Contractor',
  },
  {
    key: 'inspection', label: 'Final Inspection & CO',
    color: '#dc2626', bg: '#fee2e2',
    subtasks: ['Schedule final building inspection', 'Final building inspection scheduled', 'Final building inspection passed', 'Certificate of Occupancy (CO) received'],
    milestoneKey: 'co_received',
    contractorType: 'General Contractor',
    dateLabel: 'CO Received',
  },
  {
    key: 'list_home', label: 'List Home',
    color: '#0891b2', bg: '#e0f2fe',
    subtasks: ['List home'],
    milestoneKey: 'home_listed',
    contractorType: 'Real Estate Agent',
    dateLabel: 'Home Listed',
  },
];

// All subtasks that count toward the total (exclude land_clearing)
const COUNTED_COLUMNS = DEV_COLUMNS.filter(c => !c.tagOnly);
const TOTAL_SUBTASKS = COUNTED_COLUMNS.reduce((sum, c) => sum + c.subtasks.length, 0);

const DEAL_OVERVIEW_STAGES = new Set(['Development']);

// ── localStorage helpers ──────────────────────────────────────────────────────
const lsGet = (k)    => localStorage.getItem(k) || '';
const lsSet = (k, v) => localStorage.setItem(k, v);

function subtaskKey(dealId, colKey, subtaskIdx) {
  return `dev_${dealId}_${colKey}_${subtaskIdx}`;
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
function DevTaskCard({ deal, column, onUpdate, milestoneDate, onMilestoneChange }) {
  const navigate = useNavigate();

  const [checks, setChecks] = useState(() =>
    column.subtasks.map((_, i) => isSubtaskDone(deal.id, column.key, i))
  );
  const [contExpanded, setContExpanded] = useState(false);
  // Date: prefer milestoneDate from DB, fall back to localStorage
  const [date, setDate] = useState(
    milestoneDate || lsGet(`dev_${deal.id}_${column.key}_date`) || ''
  );

  // Keep in sync if parent's milestoneDate changes (real-time update)
  useEffect(() => {
    if (milestoneDate && milestoneDate !== date) {
      setDate(milestoneDate);
      lsSet(`dev_${deal.id}_${column.key}_date`, milestoneDate);
    }
  }, [milestoneDate]); // eslint-disable-line

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
    onUpdate();
  };

  const handleDate = (e) => {
    e.stopPropagation();
    const val = e.target.value;
    lsSet(`dev_${deal.id}_${column.key}_date`, val);
    setDate(val);
    if (column.milestoneKey) {
      onMilestoneChange(deal.id, column.milestoneKey, val);
    }
  };

  return (
    <div
      onClick={() => navigate(`/deal/${deal.id}`, { state: { deal } })}
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

      {/* Date field (only for columns with a milestoneKey) */}
      {column.milestoneKey && (
        <div className="mb-2" onClick={e => e.stopPropagation()}>
          <p className="text-[9px] text-gray-400 mb-0.5">{column.dateLabel}</p>
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

      {/* Contractor picker */}
      {column.contractorType && (
        <div className="mb-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); setContExpanded(v => !v); }}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 w-full mb-1"
          >
            {contExpanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            <span className="text-[10px] font-medium">{column.contractorType}</span>
          </button>
          {contExpanded && (
            <div onClick={e => e.stopPropagation()}>
              <ContractorPicker
                dealId={deal.id}
                stageKey={column.key}
                contractorType={column.contractorType}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Development() {
  const { deals } = useDeals();
  const [tick, setTick] = useState(0);
  const [milestones, setMilestones] = useState({});
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const devDeals = useMemo(() =>
    deals.filter(d => DEAL_OVERVIEW_STAGES.has(d.stage) && !d.isArchived)
  , [deals]);

  const sortedDeals = [...devDeals].sort((a, b) => {
    if (!a.closeDate && !b.closeDate) return 0;
    if (!a.closeDate) return 1;
    if (!b.closeDate) return -1;
    return new Date(a.closeDate) - new Date(b.closeDate);
  });

  // Load all deal_milestones for visible deals in one query
  const loadMilestones = useCallback(async () => {
    if (!supabase || !devDeals.length) return;
    const mKeys = DEV_COLUMNS.filter(c => c.milestoneKey).map(c => c.milestoneKey);
    const dealIds = devDeals.map(d => d.id);
    const { data } = await supabase
      .from('deal_milestones')
      .select('deal_id, milestone_key, eta')
      .in('deal_id', dealIds)
      .in('milestone_key', mKeys);
    if (data) {
      const map = {};
      for (const row of data) {
        if (row.eta) map[`${row.deal_id}/${row.milestone_key}`] = row.eta;
      }
      setMilestones(map);
    }
  }, [devDeals]);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  // Real-time: reload milestones when any change arrives
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel(`dev-milestones-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_milestones' },
        () => loadMilestones())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadMilestones]);

  const handleMilestoneChange = useCallback(async (dealId, milestoneKey, value) => {
    setMilestones(prev => {
      const next = { ...prev };
      if (value) next[`${dealId}/${milestoneKey}`] = value;
      else delete next[`${dealId}/${milestoneKey}`];
      return next;
    });
    if (!supabase) return;
    if (value) {
      await supabase.from('deal_milestones').upsert(
        { deal_id: dealId, milestone_key: milestoneKey, eta: value, status: 'in_progress' },
        { onConflict: 'deal_id,milestone_key' }
      );
    } else {
      await supabase.from('deal_milestones')
        .update({ eta: null })
        .eq('deal_id', dealId)
        .eq('milestone_key', milestoneKey);
    }
  }, []);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Development</h1>
          <p className="text-sm text-gray-500">{devDeals.length} deals in pipeline</p>
        </div>
      </div>

      {/* Kanban board */}
      <div
        key={tick}
        className="flex gap-3 overflow-x-auto pb-4"
        style={{ minHeight: 'calc(100vh - 220px)' }}
      >
        {DEV_COLUMNS.map(col => {
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

              {/* Cards */}
              <div>
                {colDeals.length === 0 ? (
                  <div className="rounded-xl p-5 text-center text-xs text-gray-400 border-2 border-dashed border-gray-200 bg-white/50">
                    All tasks done ✓
                  </div>
                ) : (
                  colDeals.map(deal => (
                    <DevTaskCard
                      key={`${deal.id}-${col.key}-${tick}`}
                      deal={deal}
                      column={col}
                      onUpdate={forceUpdate}
                      milestoneDate={col.milestoneKey ? milestones[`${deal.id}/${col.milestoneKey}`] : undefined}
                      onMilestoneChange={handleMilestoneChange}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
