/**
 * ImportantDates — sidebar section showing all milestone dates for a deal,
 * grouped by phase (Due Diligence / Development / Sale).
 *
 * Single source of truth: deal_milestones table (milestone_key + eta).
 * Real-time subscription keeps the view in sync across all open sessions.
 * Writing a date here, or writing the same milestone_key from the
 * DueDiligence / Development pipeline boards, updates the same row.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ── Phase / milestone definitions ─────────────────────────────────────────────
export const PHASES = [
  {
    label: 'Due Diligence',
    keys: [
      { key: 'perc_tests_scheduled',  label: 'Perc Tests Scheduled' },
      { key: 'land_survey_scheduled', label: 'Land Survey Scheduled' },
      { key: 'env_permits_submitted', label: 'Env. Permits Submitted' },
      { key: 'env_permits_approved',  label: 'Env. Permits Approved' },
    ],
  },
  {
    label: 'Development',
    keys: [
      { key: 'land_closed',                 label: 'Land Closed' },
      { key: 'home_ordered',                label: 'Home Ordered' },
      { key: 'land_clearing_scheduled',     label: 'Land Clearing Scheduled' },
      { key: 'building_permits_submitted',  label: 'Building Permits Submitted' },
      { key: 'building_permits_approved',   label: 'Building Permits Approved' },
      { key: 'setup_contractor_scheduled',  label: 'Set Up Contractor Scheduled' },
      { key: 'septic_install_scheduled',    label: 'Septic Install Scheduled' },
      { key: 'well_install_scheduled',      label: 'Well Install Scheduled' },
      { key: 'power_company_scheduled',     label: 'Power Company Scheduled' },
      { key: 'septic_installs_completed',   label: 'Septic Installs Completed' },
      { key: 'well_installs_completed',     label: 'Well Installs Completed' },
      { key: 'power_connections_completed', label: 'Power Connections Completed' },
      { key: 'home_delivered',              label: 'Home Delivered / Set Up' },
      { key: 'co_received',                 label: 'CO Received' },
    ],
  },
  {
    label: 'Sale',
    keys: [
      { key: 'home_listed',         label: 'Home Listed' },
      { key: 'home_under_contract', label: 'Home Under Contract' },
      { key: 'home_closed',         label: 'Home Closed' },
    ],
  },
];

export const ALL_MILESTONE_KEYS = PHASES.flatMap(p => p.keys.map(k => k.key));

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateColor(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  if (d < today) return 'text-red-500';
  return 'text-green-600';
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImportantDates({ deal, readOnly }) {
  const [dates,   setDates]   = useState({}); // { [milestone_key]: 'YYYY-MM-DD' }
  const [editing, setEditing] = useState(null);
  const instanceId = useRef(Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    if (!supabase || !deal?.id) return;
    const { data } = await supabase
      .from('deal_milestones')
      .select('milestone_key, eta')
      .eq('deal_id', deal.id)
      .in('milestone_key', ALL_MILESTONE_KEYS);
    if (data) {
      const map = {};
      for (const row of data) {
        if (row.eta) map[row.milestone_key] = row.eta;
      }
      setDates(map);
    }
  }, [deal?.id]);

  useEffect(() => { load(); }, [load]);

  // Real-time: any update to deal_milestones for this deal triggers reload
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const dealId = deal.id;
    const ch = supabase
      .channel(`imp-dates-${dealId}-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_milestones' },
        (payload) => {
          const row = payload.new || payload.old;
          if (row?.deal_id === dealId) load();
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [deal?.id, load]);

  const handleChange = async (key, value) => {
    setDates(prev => {
      const next = { ...prev };
      if (value) next[key] = value; else delete next[key];
      return next;
    });
    setEditing(null);
    if (!supabase) return;

    const label = PHASES.flatMap(p => p.keys).find(k => k.key === key)?.label || key;

    if (value) {
      // Upsert milestone, get back the id for linking to deal_events
      const { data: ms } = await supabase
        .from('deal_milestones')
        .upsert(
          { deal_id: deal.id, milestone_key: key, eta: value, status: 'in_progress' },
          { onConflict: 'deal_id,milestone_key' }
        )
        .select('id')
        .single();

      // Sync directly to deal_events so it shows on the calendar immediately
      if (ms?.id && deal.organization_id) {
        await supabase.from('deal_events').upsert(
          {
            organization_id: deal.organization_id,
            deal_id:         deal.id,
            title:           label,
            event_type:      'milestone',
            start_at:        `${value}T00:00:00`,
            all_day:         true,
            color:           '#3b82f6',
            source_table:    'deal_milestones',
            source_id:       ms.id,
            deleted_at:      null,
          },
          { onConflict: 'source_table,source_id', ignoreDuplicates: false }
        );
      }
    } else {
      const { data: ms } = await supabase
        .from('deal_milestones')
        .update({ eta: null })
        .eq('deal_id', deal.id)
        .eq('milestone_key', key)
        .select('id')
        .single();

      // Soft-delete the calendar event
      if (ms?.id) {
        await supabase.from('deal_events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('source_table', 'deal_milestones')
          .eq('source_id', ms.id);
      }
    }
  };

  const setCount = Object.keys(dates).length;

  return (
    <div>
      {setCount > 0 && (
        <p className="text-[10px] text-gray-400 mb-2">
          {setCount} of {ALL_MILESTONE_KEYS.length} dates set
        </p>
      )}
      {PHASES.map(phase => (
        <div key={phase.label} className="mb-2">
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1 pt-1 border-t border-gray-50 first:border-0 first:pt-0">
            {phase.label}
          </p>
          {phase.keys.map(({ key, label }) => {
            const val = dates[key] || '';
            const color = dateColor(val);
            return (
              <div
                key={key}
                className="py-1 flex items-center justify-between border-b border-gray-50 last:border-0 group"
              >
                <span className="text-[11px] text-gray-500 flex-1 min-w-0 pr-1 leading-snug">{label}</span>

                {editing === key && !readOnly ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={val}
                    onBlur={e => handleChange(key, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(null); }}
                    className="text-[11px] border border-accent/60 rounded px-1 py-0.5 focus:outline-none w-32 flex-shrink-0"
                  />
                ) : (
                  <button
                    disabled={readOnly}
                    onClick={() => !readOnly && setEditing(key)}
                    className={`text-[11px] font-medium flex items-center gap-0.5 flex-shrink-0 transition-opacity
                      ${val ? color : 'text-gray-300'}
                      ${!readOnly ? 'hover:opacity-70 cursor-pointer' : 'cursor-default'}`}
                  >
                    {val ? (
                      fmtDate(val)
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <Calendar size={10} className="text-gray-300" />
                        {!readOnly && (
                          <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                            Set
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
