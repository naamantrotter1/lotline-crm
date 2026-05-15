import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import LiveBadge from '../components/UI/LiveBadge';
import ContractorPicker from '../components/deal/ContractorPicker';
import { CheckCircle2, Calendar, Search, Star } from 'lucide-react';
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

// Maps DD milestone keys → ImportantDates eta keys (cross-write when date is saved)
const DD_DATE_TO_IMPORTANT = { perc_test: 'perc_tests_scheduled' };

// Contractor type per hasContractor column (used when auto-creating Key Contacts)
const DD_CONTRACTOR_TYPE = { survey: 'Land Surveyor', perc_test: 'Soil Scientist' };

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

  const saveDate = (val) => {
    const newStatus = status === 'not_started' && val ? 'in_progress' : status;
    if (newStatus !== status) setStatus(newStatus);
    onMilestoneChange(deal.id, column.key, { status: newStatus, date: val, contractor });
  };

  const handleDate = (e) => {
    e.stopPropagation();
    const val = e.target.value;
    setDate(val);
    // Only persist when the user has a complete date (non-empty).
    // type="date" returns '' while the user is still filling in day/month/year
    // segments — saving that empty value would clear the field mid-entry.
    // Clearing is handled by onBlur instead.
    if (val) saveDate(val);
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
              onBlur={e => { e.stopPropagation(); if (!e.target.value && milestone?.date) saveDate(''); }}
              className="text-[10px] text-gray-600 bg-transparent outline-none flex-1 min-w-0"
            />
          </div>
        </div>
      )}

      {/* Contractor */}
      {column.hasContractor && (
        <div className="mb-2" onClick={e => e.stopPropagation()}>
          <ContractorPicker
            dealId={deal.id}
            stageKey={`dd_${column.key}_cont`}
            contractorType={DD_CONTRACTOR_TYPE[column.key]}
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
  const { deals, realtimeStatus } = useDeals();
  const { activeOrgId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // milestones: { [dealId]: { [colKey]: { status, date, contractor } } }
  const [milestones, setMilestones] = useState({});

  const filterSearch   = searchParams.get('q')       || '';
  const filterOwner    = searchParams.get('owner')   || '';
  const filterLender   = searchParams.get('lender')  || '';
  const filterStarred  = searchParams.get('starred') === '1';

  const setParam = (k, v) => setSearchParams(prev => {
    const n = new URLSearchParams(prev);
    v ? n.set(k, v) : n.delete(k);
    return n;
  });

  const allDdDeals = useMemo(() => (
    deals.filter(d => DEAL_OVERVIEW_STAGES.has(d.stage) && !d.isArchived)
  ), [deals]);

  const owners = useMemo(() => [...new Set(allDdDeals.map(d => d.dealOwner).filter(Boolean))].sort(), [allDdDeals]);

  const ddDeals = useMemo(() => allDdDeals.filter(deal => {
    if (filterOwner && deal.dealOwner !== filterOwner) return false;
    if (filterLender === 'has'  && !deal.investor)  return false;
    if (filterLender === 'none' && deal.investor)   return false;
    if (filterStarred && !deal.is_starred) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (![deal.address, deal.county, deal.state, deal.dealOwner].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [allDdDeals, filterOwner, filterLender, filterStarred, filterSearch]);

  const sortedDeals = useMemo(() => (
    [...ddDeals].sort((a, b) => {
      if (!a.closeDate && !b.closeDate) return 0;
      if (!a.closeDate) return 1;
      if (!b.closeDate) return -1;
      return new Date(a.closeDate) - new Date(b.closeDate);
    })
  ), [ddDeals]);

  // Stable key of sorted deal IDs — prevents re-fetching on unrelated deal field changes
  const dealIdsKey = useMemo(() =>
    ddDeals.map(d => String(d.id)).sort().join(','),
  [ddDeals]);

  // Realtime: push deal_milestones changes from any user into local state
  useEffect(() => {
    if (!supabase || !activeOrgId) return;

    // Unique name prevents stale-channel reuse: React's cleanup (removeChannel)
    // is async, so a fixed name could return the old errored channel on remount.
    const channelName = `dd_milestones_${activeOrgId}_${Math.random().toString(36).slice(2)}`;
    let retryTimer = null;
    let currentChannel = null;

    function handleRow(payload) {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.organization_id && row.organization_id !== activeOrgId) return;
      if (row.milestone_key?.startsWith('dev_')) return;
      const { deal_id, milestone_key, status, completed_at, note } = row;
      setMilestones(prev => ({
        ...prev,
        [deal_id]: {
          ...(prev[deal_id] || {}),
          [milestone_key]: {
            status:     status === 'pending' ? 'not_started' : (status || 'not_started'),
            // completed_at is timestamptz — slice to YYYY-MM-DD for the date input
            date:       completed_at ? completed_at.slice(0, 10) : '',
            contractor: note || '',
          },
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
            console.warn('[DueDiligence] dd_milestones realtime error:', status, err, '— retrying in 2s');
            // Retry after a short delay: CHANNEL_ERROR can happen when the JWT
            // hasn't been applied to the WebSocket yet (INITIAL_SESSION race).
            // By the time the retry fires, supabase.js onAuthStateChange has run
            // and setAuth has been called with the user's access token.
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

  // Load milestones from Supabase; migrate legacy localStorage data on first load
  useEffect(() => {
    if (!dealIdsKey || !supabase || !activeOrgId) return;
    const dealIds = dealIdsKey.split(',').filter(Boolean);
    if (!dealIds.length) return;

    supabase
      .from('deal_milestones')
      .select('deal_id, milestone_key, status, completed_at, note')
      .in('deal_id', dealIds)
      .then(({ data }) => {
        const map = {};
        for (const row of (data || [])) {
          if (!map[row.deal_id]) map[row.deal_id] = {};
          map[row.deal_id][row.milestone_key] = {
            status:     row.status === 'pending' ? 'not_started' : (row.status || 'not_started'),
            // completed_at is timestamptz — slice to YYYY-MM-DD so <input type="date"> renders correctly
            date:       row.completed_at ? row.completed_at.slice(0, 10) : '',
            contractor: row.note || '',
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
                completed_at: null,
                note: null,
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
                completed_at: lsDate  || null,
                note:          lsCont  || null,
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
  }, [dealIdsKey, activeOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsertMilestone = useCallback(async (dealId, colKey, data) => {
    const sid = String(dealId);
    setMilestones(prev => ({
      ...prev,
      [sid]: { ...(prev[sid] || {}), [colKey]: data },
    }));

    if (!supabase || !activeOrgId) return;

    // 1. Save the DD milestone row
    {
      const { error } = await supabase.from('deal_milestones').upsert({
        organization_id: activeOrgId,
        deal_id:         sid,
        milestone_key:   colKey,
        status:          data.status,
        completed_at:    data.date || null,
        note:            data.contractor || null,
      }, { onConflict: 'deal_id,milestone_key' });
      if (error) console.error('[DD] upsertMilestone step1 error:', error.code, error.message, error.details, error.hint);
    }

    // 2. Mirror date to ImportantDates eta so the deal sidebar shows it immediately.
    //    Only write eta — omit status so we never hit the legacy status check constraint.
    const impKey = DD_DATE_TO_IMPORTANT[colKey];
    if (impKey) {
      const { error } = await supabase.from('deal_milestones').upsert({
        organization_id: activeOrgId,
        deal_id:         sid,
        milestone_key:   impKey,
        eta:             data.date || null,
      }, { onConflict: 'deal_id,milestone_key' });
      if (error) console.error('[DD] upsertMilestone step2 (ImportantDates cross-write) error:', error.code, error.message, error.details, error.hint);
    }

    // 3. Link contractor name to Key Contacts in the deal sidebar.
    //    Uses a stable stage_key so changing the name updates the same slot.
    const contType = DD_CONTRACTOR_TYPE[colKey];
    if (contType) {
      const name = data.contractor?.trim();
      const stageKey = `dd_${colKey}_cont`;
      if (name) {
        // Try to find an existing contact by first_name or company
        let { data: found } = await supabase.from('contacts').select('id')
          .eq('organization_id', activeOrgId).ilike('first_name', name).limit(1);
        if (!found?.length) {
          ({ data: found } = await supabase.from('contacts').select('id')
            .eq('organization_id', activeOrgId).ilike('company', name).limit(1));
        }
        let contactId = found?.[0]?.id;
        if (!contactId) {
          // Create a minimal contact from the entered name
          const parts = name.split(/\s+/);
          const { data: created } = await supabase.from('contacts')
            .insert({
              organization_id: activeOrgId,
              first_name:      parts[0],
              last_name:       parts.slice(1).join(' ') || null,
              contractor_type: contType,
            })
            .select('id').single();
          if (created?.id) {
            await supabase.from('contact_types').insert({ contact_id: created.id, type: contType });
            contactId = created.id;
          }
        }
        if (contactId) {
          await supabase.from('deal_stage_contacts').upsert(
            { deal_id: sid, organization_id: activeOrgId, stage_key: stageKey, contact_id: contactId },
            { onConflict: 'deal_id,stage_key' }
          );
        }
      } else {
        // Contractor cleared → remove from Key Contacts
        await supabase.from('deal_stage_contacts').delete()
          .eq('deal_id', sid).eq('stage_key', stageKey);
      }
    }
  }, [activeOrgId]);

  return (
    <div className="space-y-0">
      {/* Header bar */}
      <div className="flex items-center mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sidebar">Due Diligence</h1>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-gray-500">
            {ddDeals.length === allDdDeals.length ? `${allDdDeals.length} deals` : `${ddDeals.length} of ${allDdDeals.length} deals`}
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
