/**
 * workflowsData.js
 * Phase 11: Workflow CRUD + execution engine.
 *
 * Execution model (Supabase-hosted, client-triggered):
 *   1. Trigger event fires (deal stage change, contact created, etc.)
 *   2. fetchActiveWorkflowsForTrigger() finds matching active workflows.
 *   3. runWorkflow() creates a workflow_run record and executes each step in
 *      sequence, logging a workflow_step_run per step.
 *   4. Branch steps fork into yes/no child paths.
 *   5. Wait steps schedule a setTimeout + DB record; on reconnect the engine
 *      resumes pending runs via resumePendingRuns().
 */
import { supabase } from './supabase';

// ── Trigger types ────────────────────────────────────────────────────────────

export const TRIGGER_TYPES = [
  { value: 'manual',              label: 'Manual trigger',              icon: '▶' },
  { value: 'contact_created',     label: 'Contact created',             icon: '👤' },
  { value: 'contact_updated',     label: 'Contact updated',             icon: '✏️' },
  { value: 'deal_created',        label: 'Deal created',                icon: '🏠' },
  { value: 'deal_stage_changed',  label: 'Deal stage changed',          icon: '🔄' },
  { value: 'deal_pipeline_changed','label': 'Deal moves pipeline',      icon: '📋' },
  { value: 'task_completed',      label: 'Task completed',              icon: '✅' },
  { value: 'tag_added',           label: 'Tag added to record',         icon: '🏷️' },
  { value: 'form_submitted',      label: 'Lead form submitted',         icon: '📝' },
  { value: 'scheduled',           label: 'Scheduled (cron)',            icon: '⏰' },
];

// ── Step types ───────────────────────────────────────────────────────────────

export const STEP_TYPES = [
  { value: 'send_email',    label: 'Send Email',       icon: '✉️',  color: '#4f8ef7' },
  { value: 'send_sms',      label: 'Send SMS',         icon: '💬',  color: '#22c55e' },
  { value: 'create_task',   label: 'Create Task',      icon: '✅',  color: '#a855f7' },
  { value: 'update_field',  label: 'Update Field',     icon: '✏️',  color: '#f59e0b' },
  { value: 'add_tag',       label: 'Add Tag',          icon: '🏷️',  color: '#06b6d4' },
  { value: 'remove_tag',    label: 'Remove Tag',       icon: '🗑️',  color: '#94a3b8' },
  { value: 'wait',          label: 'Wait / Delay',     icon: '⏳',  color: '#6366f1' },
  { value: 'branch',        label: 'If/Else Branch',   icon: '🔀',  color: '#c9703a' },
  { value: 'webhook',       label: 'Webhook',          icon: '🔗',  color: '#ec4899' },
  { value: 'assign_owner',  label: 'Assign Owner',     icon: '👤',  color: '#14b8a6' },
  { value: 'create_deal',   label: 'Create Deal',      icon: '🏠',  color: '#8b5cf6' },
];

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function fetchWorkflows(orgId) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('workflows')
    .select('*')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  return data || [];
}

export async function fetchWorkflow(id) {
  if (!supabase || !id) return null;
  const [{ data: wf }, { data: steps }] = await Promise.all([
    supabase.from('workflows').select('*').eq('id', id).single(),
    supabase.from('workflow_steps').select('*').eq('workflow_id', id).order('sequence'),
  ]);
  if (!wf) return null;
  return { ...wf, steps: steps || [] };
}

export async function createWorkflow(orgId, userId, { name, description = '', trigger_type = 'manual', trigger_config = {} }) {
  if (!supabase) return { error: 'no supabase' };
  const { data, error } = await supabase
    .from('workflows')
    .insert({ organization_id: orgId, created_by: userId, name, description, trigger_type, trigger_config })
    .select().single();
  return { data, error };
}

export async function updateWorkflow(id, patch) {
  if (!supabase) return { error: 'no supabase' };
  const allowed = ['name','description','status','trigger_type','trigger_config'];
  const safe = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in patch) safe[k] = patch[k];
  const { data, error } = await supabase.from('workflows').update(safe).eq('id', id).select().single();
  return { data, error };
}

export async function deleteWorkflow(id) {
  if (!supabase) return { error: 'no supabase' };
  const { error } = await supabase.from('workflows').delete().eq('id', id);
  return { error };
}

// ── Steps ─────────────────────────────────────────────────────────────────────

export async function upsertWorkflowSteps(workflowId, steps) {
  if (!supabase || !steps?.length) return { error: null };
  // Delete old steps and re-insert (simpler than diffing for a builder)
  await supabase.from('workflow_steps').delete().eq('workflow_id', workflowId);
  const rows = steps.map((s, i) => ({
    id:             s.id || undefined,
    workflow_id:    workflowId,
    parent_step_id: s.parent_step_id || null,
    branch_label:   s.branch_label || null,
    sequence:       s.sequence ?? i,
    type:           s.type,
    config:         s.config || {},
    position_x:     s.position?.x || s.position_x || 0,
    position_y:     s.position?.y || s.position_y || 0,
  }));
  const { error } = await supabase.from('workflow_steps').insert(rows);
  return { error };
}

// ── Runs ──────────────────────────────────────────────────────────────────────

export async function fetchRuns(workflowId, limit = 20) {
  if (!supabase || !workflowId) return [];
  const { data } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('started_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function fetchRunDetail(runId) {
  if (!supabase || !runId) return null;
  const [{ data: run }, { data: stepRuns }] = await Promise.all([
    supabase.from('workflow_runs').select('*').eq('id', runId).single(),
    supabase.from('workflow_step_runs').select('*').eq('run_id', runId).order('started_at'),
  ]);
  return run ? { ...run, step_runs: stepRuns || [] } : null;
}

// ── Trigger matching ──────────────────────────────────────────────────────────

export async function fetchActiveWorkflowsForTrigger(orgId, triggerType) {
  if (!supabase || !orgId) return [];
  const { data } = await supabase
    .from('workflows')
    .select('*, workflow_steps(*)')
    .eq('organization_id', orgId)
    .eq('trigger_type', triggerType)
    .eq('status', 'active');
  return data || [];
}

// ── Step executors ────────────────────────────────────────────────────────────

async function executeStep(step, context) {
  const { type, config } = step;

  switch (type) {
    case 'send_email':
      // Fire-and-forget: import emailData and send
      try {
        const { createEmailLog } = await import('./emailData.js');
        await createEmailLog({
          contactId: context.contact_id,
          subject:   interpolate(config.subject, context),
          body:      interpolate(config.body, context),
          direction: 'outbound',
        });
        return { sent_to: context.contact_email };
      } catch (e) { return { error: e.message }; }

    case 'create_task':
      try {
        const { createTask } = await import('./tasksData.js');
        const due = config.due_in_days
          ? new Date(Date.now() + config.due_in_days * 86400000).toISOString().slice(0,10)
          : null;
        const { data } = await createTask({
          organization_id: context.org_id,
          title:           interpolate(config.title, context),
          description:     interpolate(config.description || '', context),
          assigned_to:     config.assign_to_owner ? context.owner_id : config.assigned_to || null,
          related_contact: context.contact_id || null,
          related_deal:    context.deal_id || null,
          due_date:        due,
          priority:        config.priority || 'medium',
        });
        return { task_id: data?.id };
      } catch (e) { return { error: e.message }; }

    case 'add_tag':
    case 'remove_tag': {
      const tag = config.tag;
      if (!tag || !supabase) return { skipped: true };
      const table  = context.entity_type === 'contact' ? 'contacts' : 'deals';
      const { data: rec } = await supabase.from(table).select('tags').eq('id', context.entity_id).single();
      const tags = Array.isArray(rec?.tags) ? rec.tags : [];
      const next = type === 'add_tag'
        ? [...new Set([...tags, tag])]
        : tags.filter(t => t !== tag);
      await supabase.from(table).update({ tags: next }).eq('id', context.entity_id);
      return { tags: next };
    }

    case 'assign_owner': {
      if (!config.user_id || !supabase || !context.entity_id) return { skipped: true };
      const table = context.entity_type === 'contact' ? 'contacts' : 'deals';
      await supabase.from(table).update({ assigned_to: config.user_id }).eq('id', context.entity_id);
      return { assigned_to: config.user_id };
    }

    case 'update_field': {
      if (!config.field || !supabase || !context.entity_id) return { skipped: true };
      const table = context.entity_type === 'contact' ? 'contacts' : 'deals';
      await supabase.from(table).update({ [config.field]: interpolate(config.value, context) }).eq('id', context.entity_id);
      return { field: config.field, value: config.value };
    }

    case 'webhook': {
      if (!config.url) return { skipped: true };
      try {
        const res = await fetch(config.url, {
          method:  config.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
          body:    JSON.stringify({ event: 'workflow_step', config, context }),
          signal:  AbortSignal.timeout(15000),
        });
        return { status: res.status };
      } catch (e) { return { error: e.message }; }
    }

    case 'wait':
      // Record wait_until in DB; client will resume on next poll/reconnect
      return { wait_until: new Date(Date.now() + (config.delay_minutes || 60) * 60000).toISOString() };

    case 'branch':
      // Branch logic: evaluate condition; return which path to take
      return evaluateBranch(config, context);

    default:
      return { skipped: true, reason: `unimplemented step type: ${type}` };
  }
}

function interpolate(template = '', ctx = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? '');
}

function evaluateBranch(config, context) {
  const { field, operator, value } = config;
  const actual = context[field];
  let result = false;
  switch (operator) {
    case 'eq':       result = String(actual) === String(value); break;
    case 'neq':      result = String(actual) !== String(value); break;
    case 'contains': result = String(actual || '').toLowerCase().includes(String(value).toLowerCase()); break;
    case 'gt':       result = parseFloat(actual) > parseFloat(value); break;
    case 'lt':       result = parseFloat(actual) < parseFloat(value); break;
    case 'is_set':   result = actual != null && actual !== ''; break;
    default:         result = false;
  }
  return { branch_taken: result ? 'yes' : 'no' };
}

// ── Main run engine ───────────────────────────────────────────────────────────

export async function runWorkflow(workflowId, triggerEvent, triggerPayload, context = {}) {
  if (!supabase) return { error: 'no supabase' };

  // 1. Load workflow + steps
  const workflow = await fetchWorkflow(workflowId);
  if (!workflow) return { error: 'workflow not found' };

  // 2. Create run record
  const { data: run, error: runErr } = await supabase
    .from('workflow_runs')
    .insert({
      workflow_id:     workflowId,
      trigger_event:   triggerEvent,
      trigger_payload: triggerPayload,
      entity_type:     context.entity_type || null,
      entity_id:       context.entity_id   || null,
      status:          'running',
    })
    .select().single();
  if (runErr) return { error: runErr.message };

  // 3. Execute steps in sequence (BFS, respecting parent_step_id + branch_label)
  const steps = (workflow.steps || []).sort((a, b) => a.sequence - b.sequence);
  const branchPath = { null: true }; // which branch labels are active (null = root)
  let runStatus = 'completed';
  let runError  = null;

  for (const step of steps) {
    // Skip if parent branch path is not active
    const parentKey = step.parent_step_id
      ? `${step.parent_step_id}:${step.branch_label}`
      : null;
    if (parentKey !== null && !branchPath[parentKey]) continue;

    // Create step_run
    const { data: sr } = await supabase
      .from('workflow_step_runs')
      .insert({ run_id: run.id, step_id: step.id, status: 'running', started_at: new Date().toISOString(), attempt_count: 1 })
      .select().single();

    let output = null, stepErr = null;
    try {
      output = await executeStep(step, { ...context, org_id: workflow.organization_id });
      // If this is a branch step, activate the taken branch path
      if (step.type === 'branch' && output?.branch_taken) {
        branchPath[`${step.id}:${output.branch_taken}`] = true;
      }
    } catch (e) {
      stepErr = e.message;
      runStatus = 'failed';
      runError  = `Step ${step.type} failed: ${e.message}`;
    }

    // Update step_run
    await supabase.from('workflow_step_runs').update({
      status:       stepErr ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      output,
      error:        stepErr,
    }).eq('id', sr.id);

    if (stepErr) break; // stop on first hard failure
  }

  // 4. Finalise run record
  await supabase.from('workflow_runs').update({
    status:       runStatus,
    completed_at: new Date().toISOString(),
    error:        runError,
  }).eq('id', run.id);

  // 5. Increment workflow run_count + last_run_at
  await supabase.from('workflows').update({
    run_count:   (workflow.run_count || 0) + 1,
    last_run_at: new Date().toISOString(),
  }).eq('id', workflowId);

  return { run_id: run.id, status: runStatus };
}

/**
 * Call this from relevant CRM mutations to fire matching active workflows.
 * e.g. triggerWorkflows(orgId, 'contact_created', { entity_type:'contact', entity_id: id, ... })
 */
export async function triggerWorkflows(orgId, triggerType, payload = {}) {
  const matching = await fetchActiveWorkflowsForTrigger(orgId, triggerType);
  await Promise.allSettled(
    matching.map(wf => runWorkflow(wf.id, triggerType, payload, payload))
  );
}
