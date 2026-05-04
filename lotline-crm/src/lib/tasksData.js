import { supabase } from './supabase';

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'];
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const PRIORITY_COLORS = {
  low:    'bg-gray-100 text-gray-500',
  medium: 'bg-blue-50 text-blue-600',
  high:   'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
};

export const STATUS_COLORS = {
  todo:        'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-50 text-blue-600',
  done:        'bg-green-50 text-green-600',
  cancelled:   'bg-gray-100 text-gray-400',
};

export const STATUS_LABELS = {
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
  cancelled:   'Cancelled',
};

/** Fetch all non-deleted tasks for the caller's org(s). */
export async function fetchTasks({ contactId, dealId, status, assignedTo } = {}) {
  if (!supabase) return [];
  let q = supabase
    .from('tasks')
    .select('*')
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (contactId)  q = q.eq('contact_id', contactId);
  if (dealId)     q = q.eq('deal_id', dealId);
  if (status)     q = q.eq('status', status);
  if (assignedTo) q = q.eq('assigned_to', assignedTo);

  const { data, error } = await q;
  if (error) { console.error('fetchTasks', error); return []; }
  return data || [];
}

/** Create a task. Returns { data, error }. */
export async function createTask(orgId, userId, fields) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: orgId,
      created_by:      userId,
      title:           fields.title,
      description:     fields.description || null,
      status:          fields.status    || 'todo',
      priority:        fields.priority  || 'medium',
      due_date:        fields.due_date  || null,
      assigned_to:     fields.assigned_to || null,
      contact_id:      fields.contact_id  || null,
      deal_id:         fields.deal_id     || null,
    })
    .select()
    .single();
  return { data, error };
}

/** Update a task by id. Returns { data, error }. */
export async function updateTask(id, fields) {
  if (!supabase) return { error: 'no supabase' };
  const allowed = ['title','description','status','priority','due_date','assigned_to','contact_id','deal_id'];
  const patch = {};
  for (const k of allowed) if (k in fields) patch[k] = fields[k];
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

/** Soft-delete a task. */
export async function deleteTask(id) {
  if (!supabase) return { error: 'no supabase' };
  return supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id);
}

/**
 * Log a task event to activity_notes so it appears in the deal Activity tab.
 * note_type: 'task' | 'task_complete' | 'task_update'
 *
 * Falls back to a minimal insert (without note_type/author_name) when migration
 * 057 hasn't been applied to the database yet — so tasks always appear in the
 * feed regardless of schema state.
 */
export async function logTaskActivity({ orgId, dealId, authorId, authorName, noteType, body }) {
  if (!supabase || !dealId) return;

  // Try full insert with note_type + author_name (requires migration 057)
  const { error } = await supabase.from('activity_notes').insert({
    organization_id:    orgId,
    deal_id:            dealId,
    author_id:          authorId,
    author_name:        authorName || null,
    note_type:          noteType,
    body,
    mentioned_user_ids: [],
  });

  if (error) {
    // Migration 057 likely not applied — fall back to base columns only
    console.warn('logTaskActivity: full insert failed, falling back:', error.message);
    await supabase.from('activity_notes').insert({
      organization_id:    orgId,
      deal_id:            dealId,
      author_id:          authorId,
      body,
      mentioned_user_ids: [],
    }).catch(e => console.warn('logTaskActivity fallback failed:', e.message));
  }
}
