import { useState } from 'react';
import {
  User, Mail, Phone, Lock, Bell, Building2,
  CheckCircle2, AlertCircle, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useOutletContext } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon size={15} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function Toast({ message, type }) {
  if (!message) return null;
  const isErr = type === 'error';
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
      isErr
        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
        : 'bg-green-500/10 border border-green-500/20 text-green-400'
    }`}>
      {isErr ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
      {message}
    </div>
  );
}

export default function InvestorAccount() {
  const { profile, updateProfile } = useAuth();
  const { investor } = useOutletContext();

  // Profile edit
  const [phone, setPhone]           = useState(profile?.phone ?? '');
  const [saving, setSaving]         = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);

  // Password change
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwMsg,      setPwMsg]      = useState(null);
  const [pwErr,      setPwErr]      = useState(null);

  // Notifications
  const NOTIF_OPTIONS = ['Email', 'SMS', 'Both', 'None'];
  const [notifPref, setNotifPref]   = useState(profile?.notification_preference ?? 'Email');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg]     = useState(null);

  const displayName = profile?.name ?? investor?.name ?? '—';
  const email       = profile?.email ?? '—';

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    setProfileErr(null);
    const { error } = await updateProfile({ phone });
    setSaving(false);
    if (error) {
      setProfileErr('Failed to save changes.');
    } else {
      setProfileMsg('Profile updated.');
      setTimeout(() => setProfileMsg(null), 3000);
    }
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    setPwErr(null);
    if (!newPw) { setPwErr('Enter a new password.'); return; }
    if (newPw.length < 8) { setPwErr('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      setPwErr(error.message ?? 'Password update failed.');
    } else {
      setPwMsg('Password updated successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwMsg(null), 4000);
    }
  };

  const handleSaveNotif = async () => {
    setNotifSaving(true);
    const { error } = await updateProfile({ notification_preference: notifPref });
    setNotifSaving(false);
    if (!error) {
      setNotifMsg('Preference saved.');
      setTimeout(() => setNotifMsg(null), 3000);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your profile and preferences</p>
      </div>

      {/* Profile info */}
      <Section title="Profile">
        <Field label="Full Name" value={displayName} icon={User} />
        <Field label="Email" value={email} icon={Mail} />
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 ml-6">
          Name and email are managed by your LotLine administrator.
        </p>

        {/* Phone — editable */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Phone Number
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {profileMsg && <p className="text-xs text-green-500 mt-2">{profileMsg}</p>}
          {profileErr && <p className="text-xs text-red-400 mt-2">{profileErr}</p>}
        </div>
      </Section>

      {/* Investor record */}
      {investor && (
        <Section title="Investor Details">
          <Field label="Investor Name"      value={investor.name}               icon={Building2} />
          <Field label="Investor Type"      value={investor.type}               icon={User}      />
          <Field label="Preferred Financing" value={investor.preferredFinancing} icon={Building2} />
          <Field label="Standard Terms"     value={investor.standardTerms}      icon={Building2} />
          {investor.notes && (
            <div className="mt-3 px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{investor.notes}</p>
            </div>
          )}
        </Section>
      )}

      {/* Notifications */}
      <Section title="Notifications">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Choose how you'd like to be notified about deal updates and distributions.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {NOTIF_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setNotifPref(opt)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                notifPref === opt
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-accent/30'
              }`}
            >
              <Bell size={13} />
              {opt}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSaveNotif}
            disabled={notifSaving}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {notifSaving ? 'Saving…' : 'Save Preference'}
          </button>
          {notifMsg && <p className="text-xs text-green-500">{notifMsg}</p>}
        </div>
      </Section>

      {/* Bank info */}
      <Section title="Distribution Banking">
        <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-lg">
          <Building2 size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Bank account on file
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              To update your distribution banking details, contact your LotLine administrator.
              Bank information is managed securely on your behalf.
            </p>
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title="Security">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-3 pr-10 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-accent/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Confirm New Password
            </label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          {pwMsg && <Toast message={pwMsg} type="success" />}
          {pwErr && <Toast message={pwErr} type="error" />}
          <button
            onClick={handleChangePassword}
            disabled={pwSaving || !newPw}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 dark:bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-white/15 disabled:opacity-40 transition-colors"
          >
            <Lock size={13} />
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </Section>
    </div>
  );
}
