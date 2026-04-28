/**
 * notificationsData.js
 * Phase 4: Supabase-backed notifications data layer.
 * All functions are scoped by RLS to the authenticated user.
 */
import { supabase } from './supabase';

/** Fetch the latest notifications for the current user. */
export async function fetchNotifications({ limit = 50 } = {}) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchNotifications', error); return []; }
  return data || [];
}

/** Count unread notifications for the current user. */
export async function fetchUnreadCount() {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) return 0;
  return count ?? 0;
}

/** Mark a single notification as read. */
export async function markNotifRead(id) {
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

/** Mark all of the current user's notifications as read. */
export async function markAllNotifsRead() {
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('read', false);
}

/** Delete a single notification. */
export async function deleteNotif(id) {
  if (!supabase) return;
  await supabase.from('notifications').delete().eq('id', id);
}

/** Delete all of the current user's notifications. */
export async function clearAllNotifs() {
  if (!supabase) return;
  // RLS scopes this DELETE to the authenticated user's rows only
  await supabase.from('notifications').delete().gt('created_at', '1970-01-01T00:00:00Z');
}

/**
 * Insert a notification for a specific user.
 * Requires the caller to be an active member of orgId.
 */
export async function createNotification({
  orgId, userId, type, title, body,
  entityType, entityId,
  dealId, dealAddress, sourceUserId, sourceUserName, actionUrl,
}) {
  if (!supabase || !orgId || !userId) return;
  const { error } = await supabase.from('notifications').insert({
    organization_id:  orgId,
    user_id:          userId,
    type:             type || 'general',
    title,
    body:             body            || null,
    entity_type:      entityType      || null,
    entity_id:        entityId        || null,
    deal_id:          dealId          || null,
    deal_address:     dealAddress     || null,
    source_user_id:   sourceUserId    || null,
    source_user_name: sourceUserName  || null,
    action_url:       actionUrl       || null,
  });
  if (error) console.error('createNotification', error);
}

/** Fetch the current user's notification preferences from their profile. */
export async function fetchNotifPrefs(userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .single();
  return data?.notification_prefs || null;
}

/** Save notification preferences to the user's profile. */
export async function saveNotifPrefs(userId, prefs) {
  if (!supabase || !userId) return;
  await supabase.from('profiles').update({ notification_prefs: prefs }).eq('id', userId);
}

/**
 * Subscribe to realtime inserts on the notifications table filtered to
 * the current user. Returns the Supabase RealtimeChannel — call
 * channel.unsubscribe() to clean up.
 */
export function subscribeToNotifications(userId, onInsert) {
  if (!supabase || !userId) return null;
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
  return channel;
}
