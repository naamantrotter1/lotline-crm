import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import LiveBadge from '../components/UI/LiveBadge';
import { CheckCircle2, Calendar, User, ChevronDown } from 'lucide-react';
import { calcNetProfit } from '../data/deals';

// ── Column definitions ────────────────────────────────────────────────────────
const DD_COLUMNS = [
  { key: 'survey',        label: 'Survey / Boundary Review',            color: '#2563eb', bg: '#dbeafe', hasDate: false, hasContractor: true  },
  { key: 'zoning',        label: 'Zoning & Land Use Verification',      color: '#7c3aed', bg: '#ede9fe', hasDate: false, hasContractor: false },
  { key: 'hoa',           label: 'HOA / Deed Restrictions Review',      color: '#db2777', bg: '#fce7f3', hasDate: false, hasContractor: false },
  { key: 'perc_test',     label: 'Perc Test',                           color: '#16a34a', bg: '#dcfce7', hasDate: true,  hasContractor: true  },
  { key: 'flood_zone',    label: 'Flood Zone & Environmental Check',    color: '#0891b2', bg: '#cffafe', hasDate: false, hasContractor: false },
  { key: 'utilities',     label: 'Utilities & Access Confirmation',     color: '#ea580c', bg: '#ffedd5', hasDate: false, hasContractor: false },
];

const TOTAL_TASKS = DD_COLUMNS.length;

// Map legacy ddTasksCompleted names → column keys for seeding
const INIT_MAP = {
  'Perk Test': 'perc_test', 'Perc Test / Soil Report': 'perc_test',
  'Survey': 'survey', 'Title Search': 'title_search',
  'Zoning Verification': 'zoning', 'Flood Zone Check': 'flood_zone',
  'Utility Check': 'utilities', 'HOA Check': 'hoa',
  'Final DD Review': 'attorney',
};

const DEAL_OVERVIEW_STAGES = new Set(['Contract Signed', 'Due Diligence', 'Development', 'Complete']);

// Legacy localStorage helpers — read-only, used only for one-time migration
const lsGet  = (k) => localStorage.getItem(k) || '';
const taskKey = (id, col) => `dd_${id}_${col}`;

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
function DDTaskCard({ deal, column, milestone, dealMilestones, onMilestoneChange }) {
  const navigate = useNavigate();

  const [status,     setStatus]     = useState(milestone?.status     || 'not_started');
  const [date,       setDate]       = useState(milestone?.date        || '');
  const [contractor, setContractor] = useState(milestone?.contractor  || '');
  const [editingCont, setEditingCont] = useState(false);

  // Sync when parent data arrives (Supabase load / migration)
  useEffect(() => {
    setStatus(milestone?.status     || 'not_started');
    setDate(milestone?.date        || '');
    setContractor(milestone?.contractor  || '');
  }, [milestone?.status, milestone?.date, milestone?.contractor]);

  if (status === 'complete') return null;

  const completed   = DD_COLUMNS.filter(c => dealMilestones?.[c.key]?.status === 'complete').length;
  const netProfit   = calcNetProfit(deal);
  const days        = getDayCount(deal.contractDate);
  const isInProgress = status === 'in_progress';

  const markComplete = (e) => {
    e.stopPropagation();
    setStatus('complete');
    onMilestoneChange(deal.id, column.key, { status: 'complete', date, contractor });
  };

  const handleDate = (e) => {
    e.stopPropagation();
    const val = e.target.value;
    setDate(val);
    const newStatus = status === 'not_started' && val ? 'in_progress' : status;
    if (newStatus !== status) setStatus(newStatus);
    onMilestoneChange(deal.id, column.key, { status: newStatus, date: val, contractor });
  };

  const saveContractor = (val) => {
    setContractor(val);
    setEditingCont(false);
    const newStatus = status === 'not_started' && val ? 'in_progress' : status;
    if (newStatus !== status) setStatus(newStatus);
    onMilestoneChange(deal.id, column.key, { status: newStatus, date, contractor: val });
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
  const { deals, realtimeStatus } = useDeals();
  const { activeOrgId } = useAuth();

  // milestones: { [dealId]: { [colKey]: { status, date, contractor } } }
  const [milestones, setMilestones] = useState({});

  const ddDeals = useMemo(() => (
    deals.filter(d => DEAL_OVERVIEW_STAGES.has(d.stage) && !d.isArchived)
  ), [deals]);

  const sortedDeals = useMemo(() => (
    [...ddDeals].sort((a, b) => {
      if (!a.closeDate && !b.closeDate) return 0;
      if (!a.closeDate) return 1;
      if (!b.closeDate) return -1;
      return new Date(a.closeDate) - new Date(b.closeDate);
    })
  ), [ddDeals]);

  // Load milestones from Supabase; migrate legacy localStorage data on first load
  useEffect(() => {
    if (!ddDeals.length || !supabase || !activeOrgId) return;
    const dealIds = ddDeals.map(d => String(d.id));

    supabase
      .from('deal_milestones')
      .select('deal_id, milestone_key, status, completed_date, notes')
      .in('deal_id', dealIds)
      .then(({ data }) => {
        const map = {};
        for (const row of (data || [])) {
          if (!map[row.deal_id]) map[row.deal_id] = {};
          map[row.deal_id][row.milestone_key] = {
            status:     row.status || 'not_started',
            date:       row.completed_date || '',
            contractor: row.notes || '',
          };
        }

        // One-time migration: seed Supabase from localStorage + ddTasksCompleted
        const toMigrate = [];
        for (const deal of ddDeals) {
          const sid = String(deal.id);

          // Seed from deal.ddTasksCompleted array
          for (const name of (deal.ddTasksCompleted || [])) {
            const k = INIT_MAP[name];
            if (k && !map[sid]?.[k]) {
              if (!map[sid]) map[sid] = {};
              map[sid][k] = { status: 'complete', date: '', contractor: '' };
              toMigrate.push({
                organization_id: activeOrgId,
                deal_id: sid,
                milestone_key: k,
                status: 'complete',
                completed_date: null,
                notes: null,
              });
            }
          }

          // Seed from raw localStorage keys
          for (const col of DD_COLUMNS) {
            if (map[sid]?.[col.key]) continue;
            const lsStatus = lsGet(taskKey(deal.id, col.key));
            const lsDate   = lsGet(`${taskKey(deal.id, col.key)}_date`);
            const lsCont   = lsGet(`${taskKey(deal.id, col.key)}_cont`);
            if (lsStatus || lsDate || lsCont) {
              if (!map[sid]) map[sid] = {};
              map[sid][col.key] = {
                status:     lsStatus || 'not_started',
                date:       lsDate   || '',
                contractor: lsCont   || '',
              };
              toMigrate.push({
                organization_id: activeOrgId,
                deal_id: sid,
                milestone_key: col.key,
                status: lsStatus || 'not_started',
                completed_date: lsDate  || null,
                notes:          lsCont  || null,
              });
            }
          }
        }

        if (toMigrate.length) {
          supabase
            .from('deal_milestones')
            .upsert(toMigrate, { onConflict: 'deal_id,milestone_key' })
            .then(() => {});
        }

        setMilestones(map);
      });
  }, [ddDeals, activeOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsertMilestone = useCallback(async (dealId, colKey, data) => {
    const sid = String(dealId);
    setMilestones(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || {}), [colKey]: data },
    }));

    if (!supabase || !activeOrgId) return;
    await supabase.from('deal_milestones').upsert({
      organization_id: activeOrgId,
      deal_id:         sid,
      milestone_key:   colKey,
      status:          data.status,
      completed_date:  data.date || null,
      notes:           data.contractor || null,
    }, { onConflict: 'deal_id,milestone_key' });
  }, [activeOrgId]);

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex items-center mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sidebar">Due Diligence</h1>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-gray-500">{ddDeals.length} deals</p>
        </div>
      </div>

      {/* Kanban board */}
      <div
        className="flex gap-3 overflow-x-auto pb-4"
        style={{ minHeight: 'calc(100vh - 220px)' }}
      >
        {DD_COLUMNS.map(col => {
          const colDeals = sortedDeals.filter(
            d => milestones[String(d.id)]?.[col.key]?.status !== 'complete'
          );
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
                    milestone={milestones[String(deal.id)]?.[col.key]}
                    dealMilestones={milestones[String(deal.id)]}
                    onMilestoneChange={upsertMilestone}
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
