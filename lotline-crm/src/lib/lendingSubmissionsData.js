/**
 * Cross-org lending-submission data access.
 *
 * Tables live in migration 134_lotline_lending_hub.sql.
 *
 * Submitter workflow
 *   submitDeal()          — org submits a deal to a hub
 *   withdrawSubmission()  — submitter cancels before a decision
 *   fetchMySubmissions()  — submitter lists their own submissions
 *
 * Hub workflow
 *   fetchIncomingSubmissions()   — hub lists all submissions sent to it
 *   updateSubmissionStatus()     — hub advances status (under_review → approved/declined)
 *   postMessage()                — either side posts a thread message
 *   fetchMessages()              — either side reads the thread
 */
import { supabase } from './supabase';

// ── Status constants ─────────────────────────────────────────────────────────

export const SUBMISSION_STATUS = {
  SUBMITTED:    'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED:     'approved',
  DECLINED:     'declined',
  WITHDRAWN:    'withdrawn',
};

export const STATUS_LABELS = {
  submitted:    'Submitted',
  under_review: 'Under Review',
  approved:     'Approved',
  declined:     'Declined',
  withdrawn:    'Withdrawn',
};

// ── Row → JS mappers ─────────────────────────────────────────────────────────

function rowToSubmission(row) {
  return {
    id:                  row.id,
    hubOrgId:            row.hub_org_id,
    submitterOrgId:      row.submitter_org_id,
    dealId:              row.deal_id,
    // snapshot
    address:             row.address,
    county:              row.county,
    state:               row.state,
    acreage:             row.acreage,
    arv:                 row.arv,
    purchasePrice:       row.purchase_price,
    loanAmountRequested: row.loan_amount_requested,
    loanType:            row.loan_type,
    exitStrategy:        row.exit_strategy,
    creditScore:         row.credit_score,
    notes:               row.notes,
    costs:               row.costs || {},
    // status
    status:              row.status,
    decisionNote:        row.decision_note,
    decidedAt:           row.decided_at,
    decidedByUserId:     row.decided_by_user_id,
    // identity
    ref:                 row.ref,
    submittedByUserId:   row.submitted_by_user_id,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
    // joined data (optional, present when fetched with select expansion)
    submitterOrgName:    row.submitter_org?.name ?? null,
    hubOrgName:          row.hub_org?.name ?? null,
  };
}

function rowToMessage(row) {
  return {
    id:           row.id,
    submissionId: row.submission_id,
    authorId:     row.author_id,
    authorOrgId:  row.author_org_id,
    body:         row.body,
    isInternal:   row.is_internal,
    createdAt:    row.created_at,
    authorName:   row.author?.first_name
      ? `${row.author.first_name} ${row.author.last_name || ''}`.trim()
      : (row.author?.email ?? 'Unknown'),
  };
}

// ── Hub query ─────────────────────────────────────────────────────────────────

/**
 * Fetch all submissions sent to hubOrgId, newest first.
 * Includes the submitter org name for display.
 */
export async function fetchIncomingSubmissions(hubOrgId) {
  if (!supabase || !hubOrgId) return [];
  const { data, error } = await supabase
    .from('lending_submissions')
    .select('*, submitter_org:organizations!lending_submissions_submitter_org_id_fkey(name)')
    .eq('hub_org_id', hubOrgId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[lendingSubmissions] fetchIncomingSubmissions error:', error.message);
    return [];
  }
  return (data || []).map(rowToSubmission);
}

/**
 * Hub: advance status (and optionally add a decision note).
 */
export async function updateSubmissionStatus(submissionId, status, { decisionNote, decidedByUserId } = {}) {
  if (!supabase || !submissionId) return { error: 'missing args' };
  const updates = { status };
  if (decisionNote !== undefined) updates.decision_note = decisionNote;
  if (status === 'approved' || status === 'declined') {
    updates.decided_at = new Date().toISOString();
    if (decidedByUserId) updates.decided_by_user_id = decidedByUserId;
  }
  const { data, error } = await supabase
    .from('lending_submissions')
    .update(updates)
    .eq('id', submissionId)
    .select('*')
    .single();
  if (error) return { error };
  return { data: rowToSubmission(data) };
}

// ── Submitter queries ─────────────────────────────────────────────────────────

/**
 * Fetch all submissions made by submitterOrgId, newest first.
 */
export async function fetchMySubmissions(submitterOrgId) {
  if (!supabase || !submitterOrgId) return [];
  const { data, error } = await supabase
    .from('lending_submissions')
    .select('*, hub_org:organizations!lending_submissions_hub_org_id_fkey(name)')
    .eq('submitter_org_id', submitterOrgId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[lendingSubmissions] fetchMySubmissions error:', error.message);
    return [];
  }
  return (data || []).map(rowToSubmission);
}

/**
 * Fetch the active lending hub org (first org where is_lending_hub = true).
 * Returns { id, name, slug } or null.
 */
export async function fetchLendingHub() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('is_lending_hub', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[lendingSubmissions] fetchLendingHub error:', error.message);
    return null;
  }
  return data;
}

/**
 * Submit a deal packet to the lending hub.
 *
 * @param {string}  hubOrgId        — target hub org
 * @param {string}  submitterOrgId  — calling org
 * @param {string}  userId          — authenticated user
 * @param {object}  payload         — { deal, address, county, state, ... }
 */
export async function submitDeal(hubOrgId, submitterOrgId, userId, payload = {}) {
  if (!supabase || !hubOrgId || !submitterOrgId || !userId) {
    return { error: 'missing required args' };
  }
  const ref = 'LS-' + Math.floor(1000 + Math.random() * 9000) + '-' + Date.now().toString(36).toUpperCase();
  const row = {
    hub_org_id:            hubOrgId,
    submitter_org_id:      submitterOrgId,
    deal_id:               payload.dealId || null,
    address:               payload.address || '',
    county:                payload.county  || null,
    state:                 payload.state   || null,
    acreage:               payload.acreage ? Number(payload.acreage) : null,
    arv:                   payload.arv     ? Number(payload.arv)     : null,
    purchase_price:        payload.purchasePrice    ? Number(payload.purchasePrice)    : null,
    loan_amount_requested: payload.loanAmountRequested ? Number(payload.loanAmountRequested) : null,
    loan_type:             payload.loanType        || null,
    exit_strategy:         payload.exitStrategy    || null,
    credit_score:          payload.creditScore     || null,
    notes:                 payload.notes           || null,
    costs:                 payload.costs           || {},
    status:                'submitted',
    ref,
    submitted_by_user_id:  userId,
  };
  const { data, error } = await supabase
    .from('lending_submissions')
    .insert(row)
    .select('*')
    .single();
  if (error) return { error };
  return { data: rowToSubmission(data) };
}

/**
 * Submitter withdraws a pending submission.
 */
export async function withdrawSubmission(submissionId) {
  if (!supabase || !submissionId) return { error: 'missing args' };
  const { data, error } = await supabase
    .from('lending_submissions')
    .update({ status: 'withdrawn' })
    .eq('id', submissionId)
    .in('status', ['submitted', 'under_review']) // can only withdraw before decision
    .select('*')
    .single();
  if (error) return { error };
  if (!data) return { error: 'Submission not found or already decided' };
  return { data: rowToSubmission(data) };
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(submissionId) {
  if (!supabase || !submissionId) return [];
  const { data, error } = await supabase
    .from('lending_submission_messages')
    .select('*, author:profiles!lending_submission_messages_author_id_fkey(first_name, last_name, email)')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[lendingSubmissions] fetchMessages error:', error.message);
    return [];
  }
  return (data || []).map(rowToMessage);
}

export async function postMessage(submissionId, authorId, authorOrgId, body, isInternal = false) {
  if (!supabase || !submissionId || !authorId || !body?.trim()) {
    return { error: 'missing required args' };
  }
  const { data, error } = await supabase
    .from('lending_submission_messages')
    .insert({
      submission_id:  submissionId,
      author_id:      authorId,
      author_org_id:  authorOrgId,
      body:           body.trim(),
      is_internal:    isInternal,
    })
    .select('*, author:profiles!lending_submission_messages_author_id_fkey(first_name, last_name, email)')
    .single();
  if (error) return { error };
  return { data: rowToMessage(data) };
}
