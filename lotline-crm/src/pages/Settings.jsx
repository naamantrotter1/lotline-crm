import { useState, useRef } from 'react';
import { Settings as SettingsIcon, CheckCircle, AlertCircle, Camera, Loader2, CreditCard } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { getNotifPrefs, setNotifPrefs, requestNotifPermission } from '../lib/notify';
import TeamSettings from '../components/settings/TeamSettings';

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-accent' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function NotificationsTab({ showToast }) {
  const prefs = getNotifPrefs();
  const [pipelineMove, setPipelineMove] = useState(prefs.pipelineMove || false);
  const [stageMove, setStageMove] = useState(prefs.stageMove || false);
  const [permissionStatus, setPermissionStatus] = useState(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const handleToggle = async (key, value, setter) => {
    if (value && permissionStatus !== 'granted') {
      const result = await requestNotifPermission();
      setPermissionStatus(result);
      if (result !== 'granted') {
        showToast('Please allow notifications in your browser to enable this.', 'error');
        return;
      }
    }
    setter(value);
    setNotifPrefs({ ...getNotifPrefs(), [key]: value });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-md space-y-1">
      <h3 className="font-semibold text-sidebar mb-1">Notification Preferences</h3>
      {permissionStatus === 'denied' && (
        <p className="text-xs text-red-500 mb-3">Notifications are blocked in your browser. Enable them in browser settings to use this feature.</p>
      )}
      {permissionStatus === 'unsupported' && (
        <p className="text-xs text-gray-400 mb-3">Your browser doesn't support notifications.</p>
      )}

      <div className="divide-y divide-gray-100">
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-sidebar">Deal moves pipelines</p>
            <p className="text-xs text-gray-400 mt-0.5">Notify when a deal moves from Land Acquisition to Deal Overview (or back)</p>
          </div>
          <Toggle
            checked={pipelineMove}
            onChange={() => handleToggle('pipelineMove', !pipelineMove, setPipelineMove)}
          />
        </div>
        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-sidebar">Deal moves stages in Deal Overview</p>
            <p className="text-xs text-gray-400 mt-0.5">Notify when a deal moves between Contract Signed, Due Diligence, Development, or Complete</p>
          </div>
          <Toggle
            checked={stageMove}
            onChange={() => handleToggle('stageMove', !stageMove, setStageMove)}
          />
        </div>
      </div>
    </div>
  );
}

function BillingTab() {
  const { profile, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  async function handleCancel() {
    setCancelling(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cancellation failed');
      await signOut();
    } catch (e) {
      setError(e.message);
      setCancelling(false);
      setConfirming(false);
    }
  }

  const planLabel = profile?.org?.plan
    ? profile.org.plan.charAt(0).toUpperCase() + profile.org.plan.slice(1)
    : 'Pro';

  return (
    <div className="max-w-md space-y-4">
      {/* Current plan card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <CreditCard size={18} className="text-accent" />
          </div>
          <div>
            <p className="font-semibold text-sidebar">Subscription</p>
            <p className="text-xs text-gray-400">Manage your plan</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">Current plan</span>
          <span className="text-sm font-semibold text-sidebar capitalize">{planLabel}</span>
        </div>
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <span className="text-sm text-gray-600">Status</span>
          <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">Active</span>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-red-100 p-6">
        <h3 className="font-semibold text-red-600 mb-1">Cancel Subscription</h3>
        <p className="text-sm text-gray-500 mb-4">
          Cancelling will permanently delete your account and all associated data. This cannot be undone.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-3">
            {error}
          </div>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
          >
            Cancel my subscription
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-red-700">Are you absolutely sure? Your account will be deleted immediately.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Keep my account
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState('profile');
  const { profile, updateProfile } = useAuth();

  // Profile tab state
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]     = useState('');
  const [phone,       setPhone]        = useState('');
  const [saving,      setSaving]       = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [toast,       setToast]        = useState(null);
  const fileInputRef = useRef(null);

  // Populate fields from profile when available
  useState(() => {
    if (profile) {
      setFirstName(profile.first_name || (profile.name?.split(' ')[0] ?? ''));
      setLastName(profile.last_name  || (profile.name?.split(' ').slice(1).join(' ') ?? ''));
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    setSaving(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error } = await updateProfile({
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      name:       fullName,
      phone:      phone.trim() || null,
    });
    if (error) {
      showToast('Failed to save: ' + (error.message || error), 'error');
    } else {
      showToast('Profile updated successfully.');
    }
    setSaving(false);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    setPhotoUploading(true);
    try {
      // Resize to 256×256 and convert to compressed JPEG data URL (no storage bucket needed)
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          // Crop to square from center
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
      const { error } = await updateProfile({ avatar_url: dataUrl });
      if (error) throw error;
      showToast('Photo updated.');
    } catch (err) {
      showToast('Upload failed: ' + (err.message || err), 'error');
    }
    setPhotoUploading(false);
    e.target.value = '';
  };

  const avatarUrl = profile?.avatar_url;
  const initials = firstName
    ? `${firstName[0]}${lastName?.[0] ?? ''}`.toUpperCase()
    : (profile?.name ?? '?')[0].toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-600 rounded-lg">
          <SettingsIcon size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Settings</h1>
          <p className="text-sm text-gray-500">Configure your CRM preferences</p>
        </div>
      </div>

      <div className="flex bg-card rounded-lg p-1 w-fit">
        {['profile', 'team', 'notifications', 'billing'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-md">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xl overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  : initials
                }
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center shadow-md hover:bg-accent/90 transition-colors disabled:opacity-50"
                title="Upload photo"
              >
                {photoUploading
                  ? <Loader2 size={12} className="text-white animate-spin" />
                  : <Camera size={12} className="text-white" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div>
              <p className="font-semibold text-[#1a2332]">{profile?.name || 'Your Name'}</p>
              <p className="text-xs text-gray-400">{profile?.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Click the camera icon to update photo</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="text"
                value={profile?.email ?? ''}
                disabled
                className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
            </div>

            <button
              type="submit"
              disabled={saving || !firstName.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: saving || !firstName.trim() ? '#94a3b8' : '#c9703a' }}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      )}

      {tab === 'team' && <TeamSettings />}

      {tab === 'notifications' && (
        <NotificationsTab showToast={showToast} />
      )}

      {tab === 'billing' && <BillingTab />}

      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
