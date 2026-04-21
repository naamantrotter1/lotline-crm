import { useState, useRef } from 'react';
import { Settings as SettingsIcon, CheckCircle, AlertCircle, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import UserManagement from './UserManagement';

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
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB.', 'error');
      return;
    }
    setPhotoUploading(true);
    try {
      const userId = profile?.id;
      const ext = file.name.split('.').pop();
      const path = `avatars/${userId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(path);
      const { error: updateError } = await updateProfile({ avatar_url: publicUrl });
      if (updateError) throw updateError;
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
        {['profile', 'team', 'notifications'].map((t) => (
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

      {tab === 'team' && <UserManagement />}

      {tab === 'notifications' && (
        <div className="bg-card rounded-xl shadow-sm p-6 max-w-2xl">
          <h3 className="font-semibold text-sidebar mb-4">Notification Preferences</h3>
          <p className="text-sm text-gray-500">Notification settings coming soon.</p>
        </div>
      )}

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
