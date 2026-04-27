import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { CheckCircle2, Calendar } from 'lucide-react';
import { calcNetProfit } from '../data/deals';
import { supabase } from '../lib/supabase';
import ContractorPicker from '../components/deal/ContractorPicker';

// ── Column definitions ────────────────────────────────────────────────────────
// milestoneKey  → deal_milestones.milestone_key (two-way sync with Important Dates sidebar)
// contractorType → filters ContractorPicker to matching contacts
const DD_COLUMNS = [
  {
    key: 'survey',
    label: 'Survey / Boundary Review',
    color: '#2563eb', bg: '#dbeafe',
    hasDate: true,
    milestoneKey: 'land_survey_scheduled',
    contractorType: 'Land Surveyor',
    dateLabel: 'Survey Scheduled',
  },
  {
    key: 'zoning',
    label: 'Zoning & Land Use Verification',
    color: '#7c3aed', bg: '#ede9fe',
    hasDate: false,
    milestoneKey: null,
    contractorType: null,
  },
  {
    key: 'hoa',
    label: 'HOA / Deed Restrictions Review',
    color: '#db2777', bg: '#fce7f3',
    hasDate: false,
    milestoneKey: null,
    contractorType: null,
  },
  {
    key: 'perc_test',
    label: 'Perc Test',
    color: '#16a34a', bg: '#dcfce7',
    hasDate: true,
    milestoneKey: 'perc_tests_scheduled',
    contractorType: 'Soil Scientist',
    dateLabel: 'Perc Test Scheduled',
  },
  {
    key: 'flood_zone',
    label: 'Flood Zone & Environmental Check',
    color: '#0891b2', bg: '#cffafe',
    hasDate: true,
    milestoneKey: 'env_permits_submitted',
    contractorType: 'Environmental Consultant',
    dateLabel: 'Env. Permits Submitted',
  },
  {
    key: 'utilities',
    label: 'Utilities & Access Confirmation',
    color: '#ea580c', bg: '#ffedd5',
    hasDate: false,
    milestoneKey: null,
    contractorType: null,
  },
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

const DEAL_OVERVIEW_STAGES = new Set(['Contract Signed', 'Due Diligence', 'Development', 'Complete']);

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
function DDTaskCard({ deal, column, onUpdate, milestoneDate, onMilestoneChange, taskStatuses, onTaskStatusChange }) {
  const navigate = useNavigate();

  // Read status from Supabase state; fall back to localStorage for backward compat
  const dbStatus = taskStatuses[`${deal.id}:dd_${column.key}`];
  const dbDate   = taskStatuses[`${deal.id}:dd_${column.key}_date`];

  const [status, setStatus] = useState(
    dbStatus ?? localStorage.getItem(`dd_${deal.id}_${column.key}`) ?? 'not_started'
  );
  const [date, setDate] = useState(
    milestoneDate || dbDate || localStorage.getItem(`dd_${deal.id}_${column.key}_date`) || ''
  );

  // Sync when Supabase data arrives or changes (e.g. another user updated it)
  useEffect(() => {
    if (dbStatus !== undefined && dbStatus !== status) setStatus(dbStatus);
  }, [dbStatus]); // eslint-disable-line

  useEffect(() => {
    const incoming = milestoneDate || dbDate;
    if (incoming && incoming !== date) setDate(incoming);
  }, [milestoneDate, dbDate]); // eslint-disable-line

  if (status === 'complete') return null;

  const completed   = DD_COLUMNS.filter(c => (taskStatuses[`${deal.id}:dd_${c.key}`] ?? localStorage.getItem(`dd_${deal.id}_${c.key}`) ?? 'not_started') === 'complete').length;
  const netProfit   = calcNetProfit(deal);
  const days        = getDayCount(deal.contractDate);
  const isInProgress = status === 'in_progress';

  const markComplete = (e) => {
    e.stopPropagation();
    setStatus('complete');
    onTaskStatusChange(deal.id, `dd_${column.key}`, 'complete');
    onUpdate();
  };

  const handleDate = (e) => {
    e.stopPropagation();
    const val = e.target.value;
    setDate(val);
    onTaskStatusChange(deal.id, `dd_${column.key}_date`, val);
    if (status === 'not_started' && val) {
      setStatus('in_progress');
      onTaskStatusChange(deal.id, `dd_${column.key}`, 'in_progress');
      onUpdate();
    }
    // Sync to deal_milestones (two-way link with Important Dates sidebar)
    if (column.milestoneKey) {
      onMilestoneChange(deal.id, column.milestoneKey, val);
    }
  };

  return (
    <div
      onClick={() => navigate(`/deal/${deal.id}`, { state: { deal } })}
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

      {/* Date picker — two-way synced to deal_milestones */}
      {column.hasDate && (
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

      {/* Contractor picker — queries contacts by contractor_type */}
      {column.contractorType && (
        <div className="mb-2">
          <ContractorPicker
            dealId={deal.id}
            stageKey={column.key}
            contractorType={column.contractorType}
          />
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
  const { deals } = useDeals();
  const { activeOrgId } = useAuth();
  const [tick, setTick] = useState(0);
  const [milestones, setMilestones] = useState({});
  // taskStatuses: { '${dealId}:${taskKey}': value }
  const [taskStatuses, setTaskStatuses] = useState({});
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const ddDeals = useMemo(() =>
    deals.filter(d => DEAL_OVERVIEW_STAGES.has(d.stage) && !d.isArchived)
  , [deals]);

  const sortedDeals = [...ddDeals].sort((a, b) => {
    if (!a.closeDate && !b.closeDate) return 0;
    if (!a.closeDate) return 1;
    if (!b.closeDate) return -1;
    return new Date(a.closeDate) - new Date(b.closeDate);
  });

  // ── Seed legacy data from deal.ddTasksCompleted into Supabase ────────────
  const seedLegacyStatuses = useCallback(async (dealsToSeed) => {
    if (!supabase || !activeOrgId) return;
    const rows = [];
    for (const deal of dealsToSeed) {
      for (const name of (deal.ddTasksCompleted || [])) {
        const k = INIT_MAP[name];
        if (k) rows.push({ deal_id: deal.id, organization_id: activeOrgId, task_key: `dd_${k}`, value: 'complete' });
      }
    }
    if (rows.length) {
      await supabase.from('deal_task_statuses').upsert(rows, { onConflict: 'deal_id,organization_id,task_key', ignoreDuplicates: true });
    }
  }, [activeOrgId]);

  // ── Load all task statuses for visible deals ──────────────────────────────
  const loadTaskStatuses = useCallback(async () => {
    if (!supabase || !ddDeals.length) return;
    const dealIds = ddDeals.map(d => d.id);
    const { data } = await supabase
      .from('deal_task_statuses')
      .select('deal_id, task_key, value')
      .in('deal_id', dealIds);
    if (data) {
      const map = {};
      for (const row of data) map[`${row.deal_id}:${row.task_key}`] = row.value;
      setTaskStatuses(map);
    }
  }, [ddDeals]);

  useEffect(() => {
    loadTaskStatuses();
    seedLegacyStatuses(ddDeals);
  }, [loadTaskStatuses, seedLegacyStatuses, ddDeals]);

  // ── Real-time: task status changes from other users ───────────────────────
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel(`dd-task-statuses-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_task_statuses' },
        (payload) => {
          const row = payload.new || payload.old;
          if (row && ddDeals.some(d => d.id === row.deal_id)) {
            if (payload.eventType === 'DELETE') {
              setTaskStatuses(prev => {
                const next = { ...prev };
                delete next[`${row.deal_id}:${row.task_key}`];
                return next;
              });
            } else {
              setTaskStatuses(prev => ({ ...prev, [`${row.deal_id}:${row.task_key}`]: payload.new.value }));
            }
          }
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [ddDeals]); // eslint-disable-line

  // ── Write a task status to Supabase ──────────────────────────────────────
  const handleTaskStatusChange = useCallback(async (dealId, taskKey, value) => {
    setTaskStatuses(prev => ({ ...prev, [`${dealId}:${taskKey}`]: value }));
    if (!supabase || !activeOrgId) return;
    await supabase.from('deal_task_statuses').upsert(
      { deal_id: dealId, organization_id: activeOrgId, task_key: taskKey, value },
      { onConflict: 'deal_id,organization_id,task_key' }
    );
  }, [activeOrgId]);

  // ── Load milestones ───────────────────────────────────────────────────────
  const loadMilestones = useCallback(async () => {
    if (!supabase || !ddDeals.length) return;
    const mKeys = DD_COLUMNS.filter(c => c.milestoneKey).map(c => c.milestoneKey);
    const dealIds = ddDeals.map(d => d.id);
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
  }, [ddDeals]);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel(`dd-milestones-${instanceId.current}`)
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
      {/* Header bar */}
      <div className="flex items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Due Diligence</h1>
          <p className="text-sm text-gray-500">{ddDeals.length} deals</p>
        </div>
      </div>

      {/* Kanban board */}
      <div
        key={tick}
        className="flex gap-3 overflow-x-auto pb-4"
        style={{ minHeight: 'calc(100vh - 220px)' }}
      >
        {DD_COLUMNS.map(col => {
          const getStatus = (dealId) =>
            taskStatuses[`${dealId}:dd_${col.key}`] ??
            localStorage.getItem(`dd_${dealId}_${col.key}`) ??
            'not_started';
          const colDeals = sortedDeals.filter(d => getStatus(d.id) !== 'complete');
          return (
            <div key={col.key} className="flex-shrink-0 w-60">
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
                {colDeals.map(deal => (
                  <DDTaskCard
                    key={`${deal.id}-${col.key}`}
                    deal={deal}
                    column={col}
                    onUpdate={forceUpdate}
                    milestoneDate={col.milestoneKey ? milestones[`${deal.id}/${col.milestoneKey}`] : undefined}
                    onMilestoneChange={handleMilestoneChange}
                    taskStatuses={taskStatuses}
                    onTaskStatusChange={handleTaskStatusChange}
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
