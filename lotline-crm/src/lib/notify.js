const PREFS_KEY  = 'lotline_notification_prefs';
const STORE_KEY  = 'lotline_notifications';
const MAX_STORED = 50;

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

// ── Stored notifications (shown in the bell dropdown) ──────────────────────

export function getStoredNotifs() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}

export function markAllNotifsRead() {
  const notifs = getStoredNotifs().map(n => ({ ...n, read: true }));
  localStorage.setItem(STORE_KEY, JSON.stringify(notifs));
  window.dispatchEvent(new Event('lotline_notifs_updated'));
}

export function clearAllNotifs() {
  localStorage.setItem(STORE_KEY, '[]');
  window.dispatchEvent(new Event('lotline_notifs_updated'));
}

function storeNotif(title, body) {
  const notifs = getStoredNotifs();
  notifs.unshift({ id: Date.now(), title, body, timestamp: new Date().toISOString(), read: false });
  localStorage.setItem(STORE_KEY, JSON.stringify(notifs.slice(0, MAX_STORED)));
  window.dispatchEvent(new Event('lotline_notifs_updated'));
}

function fire(title, body) {
  storeNotif(title, body);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

/** Call when a deal moves to a different pipeline */
export function notifyPipelineChange(deal, newStage) {
  const prefs = getNotifPrefs();
  if (!prefs.pipelineMove) return;
  const oldPipeline = deal.pipeline === 'land-acquisition' ? 'Land Acquisition' : 'Deal Overview';
  const newPipeline = newStage === 'Contract Signed' ? 'Deal Overview' : 'Land Acquisition';
  if (oldPipeline === newPipeline) return;
  fire(
    `Deal moved to ${newPipeline}`,
    deal.address || 'Untitled deal',
  );
}

/** Call when a deal moves stages within Deal Overview */
export function notifyStageChange(deal, newStage) {
  const prefs = getNotifPrefs();
  if (!prefs.stageMove) return;
  const dealOverviewStages = new Set(['Contract Signed', 'Due Diligence', 'Development', 'Complete']);
  if (!dealOverviewStages.has(newStage)) return;
  fire(
    `Stage → ${newStage}`,
    deal.address || 'Untitled deal',
  );
}
