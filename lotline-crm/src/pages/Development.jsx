import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import LiveBadge from '../components/UI/LiveBadge';
import ContractorPicker from '../components/deal/ContractorPicker';
import { CheckSquare, Square, Search, Star } from 'lucide-react';

// ── Column definitions (matches Lovable CRM) ──────────────────────────────────
const DEV_COLUMNS = [
  {
    key: 'land_clearing', label: 'Land Clearing', color: '#16a34a', bg: '#dcfce7',
    subtasks: ['Land clearing scheduled', 'Land clearing complete'],
    tagOnly: true, // only show deals tagged 'Land Clearing'
  },
  {
    key: 'env_permits', label: 'Environmental Permits', color: '#16a34a', bg: '#dcfce7',
    subtasks: ['Septic Permit', 'Well Permit', 'Construction Authorization Permit'],
  },
  {
    key: 'mh_order', label: 'Mobile Home Order', color: '#7c3aed', bg: '#ede9fe',
    subtasks: ['Order mobile home', 'MH ordered'],
  },
  {
    key: 'construction_permits', label: 'Construction Permits', color: '#d97706', bg: '#fef3c7',
    subtasks: ['Building Permit', 'Electrical Permit', 'Plumbing Permit', 'Mechanical Permit'],
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

const STAGE_ORDER = ['Contract Signed', 'Due Diligence', 'Development'];
const STAGE_COLORS = {
  'Contract Signed': { color: '#16a34a', bg: '#dcfce7' },
  'Due Diligence':   { color: '#d97706', bg: '#fef3c7' },
  'Development':     { color: '#2563eb', bg: '#dbeafe' },
};

// Contractor type per dev column — drives ContractorPicker dropdown filtering
const DEV_CONTRACTOR_TYPE = {
  land_clearing:        'Land Clearing Contractor',
  env_permits:          'Permit Agent',
  mh_order:             'Home Dealer',
  construction_permits: 'General Contractor',
  setup_crew:           'Setup Crew',
  septic:               'Septic Contractor',
  well:                 'Well Driller',
  electrical:           'Electrician',
  plumbing:             'Plumber',
  hvac:                 'HVAC Contractor',
  skirting:             'Skirting Contractor',
  steps:                'Steps Contractor',
  final_grade:          'Grading Contractor',
  inspection:           'Inspector',
  list_home:            'Real Estate Agent',
};

// milestone_key format stored in deal_milestones: dev_{colKey}_{subtaskIdx}
function devMilKey(colKey, idx) { return `dev_${colKey}_${idx}`; }

function isColCompleteFn(dealMilestones, col) {
  return col.subtasks.every((_, i) => dealMilestones?.[devMilKey(col.key, i)] === true);
}

function getTotalDoneFn(dealMilestones) {
  return COUNTED_COLUMNS.reduce((sum, col) =>
    sum + col.subtasks.filter((_, i) => dealMilestones?.[devMilKey(col.key, i)] === true).length, 0);
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
function DevTaskCard({ deal, column, dealMilestones, onToggle }) {
  const navigate = useNavigate();

  // checks derived from Supabase-backed milestones passed from parent
  const checks = column.subtasks.map((_, i) => dealMilestones?.[devMilKey(column.key, i)] === true);


  const allDone = checks.every(Boolean);
  if (allDone) return null;

  const totalDone = getTotalDoneFn(dealMilestones);
  const days = getDayCount(deal.contractDate);
  const inProgress = checks.some(Boolean);

  const toggle = (e, idx) => {
    e.stopPropagation();
    onToggle(deal.id, column.key, idx, !checks[idx]);
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

      {/* Contractor picker */}
      <div onClick={e => e.stopPropagation()}>
        <ContractorPicker
          dealId={deal.id}
          stageKey={`dev_${column.key}_cont`}
          contractorType={DEV_CONTRACTOR_TYPE[column.key]}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Development() {
  const { deals, realtimeStatus } = useDeals();
  const { activeOrgId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // milestones: { [dealId]: { 'dev_colKey_idx': boolean } }
  const [milestones, setMilestones] = useState({});

  const filterSearch  = searchParams.get('q')       || '';
  const filterOwner   = searchParams.get('owner')   || '';
  const filterLender  = searchParams.get('lender')  || '';
  const filterStarred = searchParams.get('starred') === '1';

  const setParam = (k, v) => setSearchParams(prev => {
    const n = new URLSearchParams(prev);
    v ? n.set(k, v) : n.delete(k);
    return n;
  });

  const allDevDeals = useMemo(() =>
    deals.filter(d => DEAL_OVERVIEW_STAGES.has(d.stage) && !d.isArchived)
  , [deals]);

  const owners = useMemo(() => [...new Set(allDevDeals.map(d => d.dealOwner).filter(Boolean))].sort(), [allDevDeals]);

  const devDeals = useMemo(() => allDevDeals.filter(deal => {
    if (filterOwner && deal.dealOwner !== filterOwner) return false;
    if (filterLender === 'has'  && !deal.investor)  return false;
    if (filterLender === 'none' && deal.investor)   return false;
    if (filterStarred && !deal.is_starred) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (![deal.address, deal.county, deal.state, deal.dealOwner].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [allDevDeals, filterOwner, filterLender, filterStarred, filterSearch]);

  const sortedDeals = useMemo(() => [...devDeals].sort((a, b) => {
    if (!a.closeDate && !b.closeDate) return 0;
    if (!a.closeDate) return 1;
    if (!b.closeDate) return -1;
    return new Date(a.closeDate) - new Date(b.closeDate);
  }), [devDeals]);

  // Stable key of sorted deal IDs — only changes when deals are added/removed
  const dealIdsKey = useMemo(() =>
    devDeals.map(d => String(d.id)).sort().join(','),
  [devDeals]);

  // Load milestones from Supabase whenever the set of deal IDs changes
  useEffect(() => {
    if (!dealIdsKey || !supabase || !activeOrgId) return;
    const ids = dealIdsKey.split(',').filter(Boolean);
    if (!ids.length) return;
    supabase
      .from('deal_milestones')
      .select('deal_id, milestone_key, status')
      .in('deal_id', ids)
      .like('milestone_key', 'dev_%')
      .then(({ data }) => {
        const map = {};
        for (const row of (data || [])) {
          if (!map[row.deal_id]) map[row.deal_id] = {};
          map[row.deal_id][row.milestone_key] = row.status === 'complete';
        }
        setMilestones(map);
      });
  }, [dealIdsKey, activeOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: push milestone changes from other users into local state
  useEffect(() => {
    if (!supabase || !activeOrgId) return;

    // Unique name prevents stale-channel reuse (see DueDiligence.jsx for detail).
    const channelName = `dev_milestones_${activeOrgId}_${Math.random().toString(36).slice(2)}`;
    let retryTimer = null;
    let currentChannel = null;

    function handleRow(payload) {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.organization_id && row.organization_id !== activeOrgId) return;
      if (!row.milestone_key?.startsWith('dev_')) return;
      const { deal_id, milestone_key, status } = row;
      setMilestones(prev => ({
        ...prev,
        [deal_id]: {
          ...(prev[deal_id] || {}),
          [milestone_key]: status === 'complete',
        },
      }));
    }

    function subscribe() {
      currentChannel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'deal_milestones',
          // No server-side filter — causes CHANNEL_ERROR on postgres_changes subscriptions.
          // Filter org client-side instead (same pattern as dealsSync.js).
        }, handleRow)
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[Development] dev_milestones realtime error:', status, err, '— retrying in 2s');
            retryTimer = setTimeout(() => {
              supabase.removeChannel(currentChannel);
              subscribe();
            }, 2000);
          }
        });
    }

    subscribe();
    return () => {
      clearTimeout(retryTimer);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  }, [activeOrgId]);

  // Write a subtask toggle to Supabase + update local state optimistically
  const handleToggle = useCallback(async (dealId, colKey, idx, done) => {
    const sid = String(dealId);
    const milKey = devMilKey(colKey, idx);
    setMilestones(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || {}), [milKey]: done },
    }));
    if (!supabase || !activeOrgId) return;
    await supabase.from('deal_milestones').upsert({
      organization_id: activeOrgId,
      deal_id:         sid,
      milestone_key:   milKey,
      status:          done ? 'complete' : 'not_started',
      completed_at:    null,
      note:            null,
    }, { onConflict: 'deal_id,milestone_key' });
  }, [activeOrgId]);

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sidebar">Development</h1>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-gray-500">
            {devDeals.length === allDevDeals.length ? `${allDevDeals.length} deals in pipeline` : `${devDeals.length} of ${allDevDeals.length} deals`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Search deals…" value={filterSearch}
            onChange={e => setParam('q', e.target.value)}
            className="pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#c8613a] w-44 bg-white" />
        </div>
        {owners.length > 0 && (
          <select value={filterOwner} onChange={e => setParam('owner', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c8613a] text-gray-600 bg-white">
            <option value="">All Owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <select value={filterLender} onChange={e => setParam('lender', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c8613a] text-gray-600 bg-white">
          <option value="">All Lenders</option>
          <option value="has">Has Lender</option>
          <option value="none">No Lender</option>
        </select>
        <button onClick={() => setParam('starred', filterStarred ? '' : '1')}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${filterStarred ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}>
          <Star size={11} fill={filterStarred ? 'currentColor' : 'none'} />Starred
        </button>
        {(filterSearch || filterOwner || filterLender || filterStarred) && (
          <button onClick={() => setSearchParams({})} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear All</button>
        )}
      </div>

      {/* Kanban board */}
      <div
        className="flex gap-3 overflow-x-auto pb-4"
        style={{ minHeight: 'calc(100vh - 220px)' }}
      >
        {DEV_COLUMNS.map(col => {
          // Land Clearing: only show tagged deals; other columns: show all
          const colDeals = sortedDeals.filter(d => {
            const dm = milestones[String(d.id)] || {};
            const done = isColCompleteFn(dm, col);
            if (col.tagOnly) return (d.tags || []).includes('Land Clearing') && !done;
            return !done;
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
                ) : colDeals.map(deal => (
                  <DevTaskCard
                    key={`${deal.id}-${col.key}`}
                    deal={deal}
                    column={col}
                    dealMilestones={milestones[String(deal.id)] || {}}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
