/**
 * PushNotificationSettings.jsx
 * Phase 15: Settings section to manage push notification subscriptions.
 */
import { useState, useEffect } from 'react';
import { Bell, BellOff, Check, AlertCircle, Loader2, Smartphone } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  isPushSupported, getPermissionState, subscribeToPush,
  unsubscribeFromPush, isSubscribed,
} from '../../lib/pushData';

export default function PushNotificationSettings() {
  const { activeOrgId, profile } = useAuth();
  const [supported, setSupported]       = useState(false);
  const [permission, setPermission]     = useState('default');
  const [subscribed, setSubscribed]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [toggling, setToggling]         = useState(false);
  const [error, setError]               = useState(null);

  useEffect(() => {
    const init = async () => {
      setSupported(isPushSupported());
      setPermission(await getPermissionState());
      setSubscribed(await isSubscribed());
      setLoading(false);
    };
    init();
  }, []);

  const handleToggle = async () => {
    setError(null);
    setToggling(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush(profile?.id);
        setSubscribed(false);
      } else {
        await subscribeToPush(activeOrgId, profile?.id);
        setSubscribed(true);
        setPermission('granted');
      }
    } catch (e) {
      setError(e.message);
    }
    setToggling(false);
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-300" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Push Notifications</h3>
        <p className="text-xs text-gray-400">
          Get notified about new leads, task reminders, and deal updates — even when the app is in the background.
        </p>
      </div>

      {!supported && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
          <AlertCircle size={13} />
          Push notifications are not supported in this browser.
        </div>
      )}

      {supported && permission === 'denied' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600">
          <AlertCircle size={13} />
          Notifications are blocked. Open your browser settings to allow notifications for this site.
        </div>
      )}

      {supported && permission !== 'denied' && (
        <div className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${subscribed ? 'bg-green-50' : 'bg-gray-50'}`}>
              {subscribed ? <Bell size={16} className="text-green-500" /> : <BellOff size={16} className="text-gray-400" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {subscribed ? 'Push notifications enabled' : 'Push notifications disabled'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {subscribed ? 'You\'ll receive alerts for new leads, tasks, and deals' : 'Enable to receive real-time alerts'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              subscribed ? 'bg-green-400' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              subscribed ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-600">
          <AlertCircle size={13} />{error}
        </div>
      )}

      {/* Notification types info */}
      {subscribed && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What you'll be notified about</p>
          {[
            { icon: '📋', label: 'New lead form submissions' },
            { icon: '✅', label: 'Tasks due today' },
            { icon: '🏠', label: 'Deal stage changes' },
            { icon: '💬', label: 'New SMS messages' },
            { icon: '📅', label: 'Upcoming meeting reminders' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 py-1">
              <span className="text-sm">{icon}</span>
              <span className="text-xs text-gray-600">{label}</span>
              <Check size={11} className="text-green-400 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Install as app */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <Smartphone size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-700">Install as app</p>
          <p className="text-xs text-blue-500 mt-0.5">
            Add LotLine to your home screen for a native app experience. Look for "Add to Home Screen" in your browser menu.
          </p>
        </div>
      </div>
    </div>
  );
}
