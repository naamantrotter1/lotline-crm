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

export const EVENT_TYPES = [
  { value: 'meeting',    label: 'Meeting'          },
  { value: 'inspection', label: 'Inspection'       },
  { value: 'contractor', label: 'Contractor Visit' },
  { value: 'deadline',   label: 'Deadline'         },
  { value: 'milestone',  label: 'Milestone'        },
  { value: 'manual',     label: 'Other'            },
];

export function eventColor(event) {
  return event.color || EVENT_TYPE_COLORS[event.event_type] || '#8b5cf6';
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
  const { data } = await q;
  return data || [];
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
