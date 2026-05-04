import { createNotification } from './notificationsData';

const PREFS_KEY  = 'lotline_notification_prefs';

export function getNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; }
}

export function setNotifPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function requestNotifPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

function fireBrowser(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

/**
 * Internal helper: write a notification to the DB (for all org members of
 * the relevant context) and optionally fire a browser native notification.
 * orgId / userId are optional — if absent the DB write is skipped.
 */
async function fire(title, body, { orgId, userId, type, entityType, entityId } = {}) {
  fireBrowser(title, body);
  if (orgId && userId) {
    await createNotification({ orgId, userId, type: type || 'general', title, body, entityType, entityId });
  }
}

/** Call when a deal moves to a different pipeline.
 *  Pass { orgId, userId } so the notification is stored in the DB.
 */
export function notifyPipelineChange(deal, newStage, { orgId, userId } = {}) {
  const prefs = getNotifPrefs();
  if (!prefs.pipelineMove) return;
  const oldPipeline = deal.pipeline === 'land-acquisition' ? 'Land Acquisition' : 'Deal Overview';
  const newPipeline = newStage === 'Contract Signed' ? 'Deal Overview' : 'Land Acquisition';
  if (oldPipeline === newPipeline) return;
  fire(
    `Deal moved to ${newPipeline}`,
    deal.address || 'Untitled deal',
    { orgId, userId, type: 'deal_pipeline', entityType: 'deal', entityId: String(deal.id) },
  );
}

/**
 * Call when a task is assigned to a team member.
 * Sends a DB notification to the assignee only (not the creator).
 *
 * @param {object} task         - the newly created task object
 * @param {string} assigneeId   - user_id of the person being assigned
 * @param {string} assigneeName - display name of the assignee
 * @param {string} dealAddress  - optional deal address for context
 * @param {object} opts         - { orgId }
 */
export async function notifyTaskAssigned(task, assigneeId, assigneeName, dealAddress, { orgId } = {}) {
  if (!orgId || !assigneeId) return;
  const titleText = task.title ? `"${task.title}"` : 'A task';
  const bodyText  = dealAddress ? `${titleText} on ${dealAddress}` : titleText;
  await fire(
    `New task assigned to you`,
    bodyText,
    { orgId, userId: assigneeId, type: 'task_assigned', entityType: 'task', entityId: String(task.id) },
  );
}

/** Call when a deal moves stages within Deal Overview.
 *  Pass { orgId, userId } so the notification is stored in the DB.
 */
export function notifyStageChange(deal, newStage, { orgId, userId } = {}) {
  const prefs = getNotifPrefs();
  if (!prefs.stageMove) return;
  const dealOverviewStages = new Set(['Contract Signed', 'Due Diligence', 'Development', 'Complete']);
  if (!dealOverviewStages.has(newStage)) return;
  fire(
    `Stage → ${newStage}`,
    deal.address || 'Untitled deal',
    { orgId, userId, type: 'deal_stage', entityType: 'deal', entityId: String(deal.id) },
  );
}
