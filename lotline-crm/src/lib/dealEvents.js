/**
 * dealEvents.js — data layer for the unified deal_events table.
 */
import { supabase } from './supabase';

// ── Color map ─────────────────────────────────────────────────────────────────
export const EVENT_TYPE_COLORS = {
  manual:       '#8b5cf6',
  meeting:      '#8b5cf6',
  task:         '#f97316',
  milestone:    '#3b82f6',
  stage_change: '#9ca3af',
  contractor:   '#22c55e',
  deadline:     '#ef4444',
  inspection:   '#06b6d4',
  perc_test:    '#3b82f6',
  land_survey:  '#3b82f6',
  permit:       '#a855f7',
  closing:      '#10b981',
  delivery:     '#f59e0b',
};

// Per-milestone-key colors (override the generic milestone blue)
export const MILESTONE_KEY_COLORS = {
  perc_tests_scheduled:        '#ea580c', // orange
  land_survey_scheduled:       '#d97706', // amber
  env_permits_submitted:       '#ca8a04', // yellow-dark
  env_permits_approved:        '#65a30d', // lime
  building_permits_submitted:  '#ea580c', // orange
  building_permits_approved:   '#16a34a', // green
  land_clearing_scheduled:     '#92400e', // brown
  septic_install_scheduled:    '#dc2626', // red
  septic_installs_completed:   '#dc2626', // red
  well_install_scheduled:      '#9333ea', // purple
  well_installs_completed:     '#9333ea', // purple
  power_company_scheduled:     '#ca8a04', // yellow
  power_connections_completed: '#ca8a04', // yellow
  home_ordered:                '#3b82f6', // blue
  setup_contractor_scheduled:  '#7c3aed', // violet
  home_delivered:              '#0ea5e9', // sky
  co_received:                 '#0d9488', // teal
  home_listed:                 '#0284c7', // sky-blue
  home_under_contract:         '#4f46e5', // indigo
  home_closed:                 '#059669', // emerald
  land_closed:                 '#10b981', // green
};

export const EVENT_TYPES = [
  { value: 'meeting',    label: 'Meeting'          },
  { value: 'inspection', label: 'Inspection'       },
  { value: 'contractor', label: 'Contractor Visit' },
  { value: 'deadline',   label: 'Deadline'         },
  { value: 'milestone',  label: 'Milestone'        },
  { value: 'manual',     label: 'Other'            },
];

export function eventColor(event) {
  if (event._milestoneKey && MILESTONE_KEY_COLORS[event._milestoneKey]) {
    return MILESTONE_KEY_COLORS[event._milestoneKey];
  }
  return event.color || EVENT_TYPE_COLORS[event.event_type] || '#8b5cf6';
}

/**
 * Extract just the street portion of a full address string.
 * "Blue Newkirk Rd, Magnolia, NC 28453" → "Blue Newkirk Rd"
 */
export function streetAddress(fullAddr) {
  if (!fullAddr) return '';
  return fullAddr.split(',')[0].trim();
}

/**
 * Categorize a deal event for the Deal Dates filter panel.
 * Returns: 'land_closing' | 'home_closing' | 'contract' | 'listed_delivery' | 'milestone' | null
 * null means the event is not a deal date (e.g. task, stage_change) — always shown.
 */
export function dealDateCategory(event) {
  const key = event._milestoneKey;
  const src = event.source_table;
  if (src === 'deals_close_date' || key === 'land_closed') return 'land_closing';
  if (key === 'home_closed') return 'home_closing';
  if (src === 'deals_contract_date') return 'contract';
  if (['home_listed', 'home_delivered', 'co_received', 'home_under_contract'].includes(key)) return 'listed_delivery';
  if (src === 'deal_milestones' || src === 'deals_close_date' || src === 'deals_contract_date') return 'milestone';
  return null;
}

export function eventTypeLabel(type) {
  return EVENT_TYPES.find(t => t.value === type)?.label
    || (type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : 'Event');
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function fetchDealEvents(dealId) {
  if (!supabase || !dealId) return [];
  const { data } = await supabase
    .from('deal_events')
    .select('*')
    .eq('deal_id', dealId)
    .is('deleted_at', null)
    .order('start_at', { ascending: true });
  return data || [];
}

export async function fetchOrgEvents(orgId, { from, to } = {}) {
  if (!supabase || !orgId) return [];
  let q = supabase
    .from('deal_events')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('start_at', { ascending: true });
  if (from) q = q.gte('start_at', from);
  if (to)   q = q.lte('start_at', to);
  const { data: events } = await q;
  if (!events?.length) return [];

  // Enrich milestone-sourced events with milestone_key, status, completed_at
  const msIds = events
    .filter(e => e.source_table === 'deal_milestones' && e.source_id)
    .map(e => e.source_id);

  let msMap = {};
  if (msIds.length > 0) {
    const { data: ms } = await supabase
      .from('deal_milestones')
      .select('id, milestone_key, status, completed_at')
      .in('id', msIds);
    (ms || []).forEach(m => { msMap[m.id] = m; });
  }

  const now = Date.now();
  return events.map(e => {
    const ms = msMap[e.source_id];
    const isCompleted = e.source_table === 'deal_milestones'
      ? (ms?.status === 'complete' || !!ms?.completed_at)
      : false;
    const isPast = new Date(e.start_at).getTime() < now;
    return {
      ...e,
      _milestoneKey:    ms?.milestone_key || null,
      _milestoneStatus: ms?.status || null,
      _isCompleted:     isCompleted,
      _isOverdue:       isPast && !isCompleted && e.source_table === 'deal_milestones',
    };
  });
}

export async function createDealEvent(orgId, dealId, userId, createdByName, fields) {
  if (!supabase) return { error: 'no supabase' };
  const color = EVENT_TYPE_COLORS[fields.event_type || 'manual'];
  const { data, error } = await supabase
    .from('deal_events')
    .insert({
      organization_id:    orgId,
      deal_id:            dealId,
      created_by_user_id: userId,
      created_by_name:    createdByName || null,
      title:              fields.title,
      description:        fields.description || null,
      event_type:         fields.event_type || 'manual',
      start_at:           fields.start_at,
      end_at:             fields.end_at || null,
      all_day:            fields.all_day || false,
      location:           fields.location || null,
      color,
    })
    .select()
    .single();
  return { data, error };
}

export async function updateDealEvent(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  if (patch.event_type) patch.color = EVENT_TYPE_COLORS[patch.event_type] || patch.color;
  const { data, error } = await supabase
    .from('deal_events')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteDealEvent(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase
    .from('deal_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  return { error };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtEventDate(startAt, endAt, allDay) {
  if (!startAt) return '';
  const s = new Date(startAt);
  const dateStr = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (allDay) return dateStr;
  const startTime = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (!endAt) return `${dateStr} · ${startTime}`;
  const e = new Date(endAt);
  const endTime = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${startTime} – ${endTime}`;
}
