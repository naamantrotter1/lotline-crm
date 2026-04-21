const PREFS_KEY = 'lotline_notification_prefs';

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

function fire(title, body) {
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
