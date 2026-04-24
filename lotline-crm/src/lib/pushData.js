/**
 * pushData.js
 * Phase 15: Web Push / VAPID subscription management.
 *
 * Push flow:
 *   1. User visits Settings → Notifications → "Enable Push"
 *   2. Browser requests notification permission
 *   3. serviceWorker.ready → pushManager.subscribe() with VAPID public key
 *   4. Subscription stored in push_subscriptions table
 *   5. Server-side events trigger edge function `push-send`
 *      which reads subscriptions and POSTs to browser push service
 *
 * VAPID keys:
 *   Generate with: npx web-push generate-vapid-keys
 *   Set VITE_VAPID_PUBLIC_KEY in .env
 *   Set VAPID_PRIVATE_KEY + VAPID_SUBJECT in Supabase Edge Function secrets
 */
import { supabase } from './supabase';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Subscribe to push notifications.
 * Returns subscription object or throws if denied/unsupported.
 */
export async function subscribeToPush(orgId, userId) {
  if (!isPushSupported()) throw new Error('Push not supported');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) throw new Error('VAPID_PUBLIC_KEY not set in env');

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const json = sub.toJSON();

  // Store in Supabase
  if (supabase) {
    await supabase.from('push_subscriptions').upsert({
      organization_id: orgId,
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth:   json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: 'user_id,endpoint' });
  }

  return sub;
}

/**
 * Unsubscribe from push and remove from DB.
 */
export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    if (supabase) {
      await supabase.from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint);
    }
  }
}

/**
 * Check if current browser is subscribed.
 */
export async function isSubscribed() {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/**
 * Send a push notification (client-triggered via edge function).
 * For server-triggered pushes, call the edge function from other edge functions.
 */
export async function sendPushToUser(targetUserId, { title, body, url = '/', icon = '/icons/icon-192.png' }) {
  if (!supabase) return;
  await supabase.functions.invoke('push-send', {
    body: { userId: targetUserId, notification: { title, body, url, icon } },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// ── Notification types ────────────────────────────────────────────────────────

export const PUSH_TEMPLATES = {
  new_lead:         (data) => ({ title: 'New Lead', body: `${data.name} just submitted a lead form`, url: `/contacts/${data.id}` }),
  task_due:         (data) => ({ title: 'Task Due Today', body: data.title, url: '/tasks' }),
  deal_stage:       (data) => ({ title: 'Deal Updated', body: `${data.address} moved to ${data.stage}`, url: `/deal/${data.id}` }),
  new_sms:          (data) => ({ title: 'New SMS', body: `${data.from}: ${data.body.slice(0, 60)}`, url: '/sms' }),
  meeting_reminder: (data) => ({ title: 'Meeting in 15 min', body: data.title, url: '/calendar' }),
};
