import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Shield, Eye, Edit3, Loader, CheckCircle, AlertCircle, UserPlus, X, Briefcase, Trash2, Mail, PenLine, Link, DollarSign } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../lib/AuthContext';
import { INVESTORS } from '../data/investors';

// Isolated client used only for signing up new users — never touches the admin's session
const tempClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'lotline-admin-signup-tmp' } }
);

const ROLE_CONFIG = {
  admin:    { label: 'Admin',    color: 'bg-red-100 text-red-700',    icon: Shield,      desc: 'Full access + user management'              },
  editor:   { label: 'Editor',   color: 'bg-blue-100 text-blue-700',  icon: Edit3,       desc: 'View + edit deals'                          },
  viewer:   { label: 'Viewer',   color: 'bg-gray-100 text-gray-600',  icon: Eye,         desc: 'Read-only access'                           },
  agent:    { label: 'Agent',    color: 'bg-green-100 text-green-700',icon: Briefcase,   desc: 'Deal Overview + Sales; can move stages'     },
  investor: { label: 'Investor', color: 'bg-amber-100 text-amber-700',icon: DollarSign,  desc: 'Investor Portal only; sees their linked deals' },
};

const INVESTOR_NAMES = INVESTORS.filter(i => i.name !== 'Cash' && i.name !== 'None').map(i => i.name);

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [role,       setRole]       = useState('viewer');
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);

    const fullName = `${firstName.trim()} ${(lastName || '').trim()}`.trim();

    // Sign up via the isolated client — does NOT affect the admin's session
    const { data, error: signUpError } = await tempClient.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setError('User created but no ID returned. Try again.');
      setLoading(false);
      return;
    }

    // Wait for DB trigger to create the profile row
    await new Promise(r => setTimeout(r, 800));

    // Update profile using the main admin client (admin RLS policy allows updating any profile)
    const { error: profileError } = await supabase.from('profiles').update({
      first_name: firstName.trim(),
      last_name:  (lastName || '').trim(),
      name:       fullName,
      role:       role || 'viewer',
    }).eq('id', userId);

    if (profileError) {
      setError('User created but profile update failed: ' + profileError.message);
      setLoading(false);
      return;
    }

    onCreated({
      id:         userId,
      email:      email.trim(),
      name:       fullName,
      first_name: firstName.trim(),
      last_name:  (lastName || '').trim(),
      role:       role || 'viewer',
      created_at: new Date().toISOString(),
    });
    onClose();
    setLoading(false);
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-[#1a2332]">Create New User</h2>
            <p className="text-xs text-gray-400 mt-0.5">They can log in immediately with these credentials</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" required className={inputClass} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" className={inputClass} />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" required className={inputClass} />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Temporary Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
                className={`${inputClass} pr-11`}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPw ? 'Hide' : 'Show'}>
                {showPw ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Share this with the new user so they can sign in.</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white">
              <option value="viewer">Viewer — Read-only access</option>
              <option value="realtor">Realtor — Deal Overview + Sales; can move stages</option>
              <option value="user">User — View + edit deals</option>
              <option value="admin">Admin — Full access + user management</option>
              <option value="investor">Investor — Investor Portal only; sees their linked deals</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !firstName || !email || !password}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: loading || !firstName || !email || !password ? '#94a3b8' : '#c9703a' }}
          >
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LinkInvestorModal({ user, onClose, onSave }) {
  const current = INVESTOR_NAMES.find(n => n === user.company) || '';
  const [selected, setSelected] = useState(current);
  const [loading,  setLoading]  = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await onSave(user.id, selected);
    setLoading(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100">
              <Link size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1a2332]">Link to Investor</h2>
              <p className="text-xs text-gray-400 mt-0.5">{user.name || user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Investor Account</label>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
            >
              <option value="">— No investor linked —</option>
              {INVESTOR_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">This investor will only see deals they are funding.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: loading ? '#94a3b8' : '#c9703a' }}
          >
            {loading ? 'Saving…' : 'Save Link'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConfirmDeleteModal({ user, onClose, onConfirm, loading }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-red-100">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <h2 className="text-base font-bold text-[#1a2332]">Delete User</h2>
        </div>
        <p className="text-sm text-gray-600 mb-1">Are you sure you want to remove <strong>{user.name || user.email}</strong> from the system?</p>
        <p className="text-xs text-gray-400 mb-6">They will be removed from the user list but may still have a login account.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EditEmailModal({ user, onClose, onSave }) {
  const [email,   setEmail]   = useState(user.email || '');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await onSave(user.id, email.trim());
    setLoading(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <PenLine size={16} className="text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-[#1a2332]">Change Email</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              New Email for {user.name || user.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="new@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: loading || !email ? '#94a3b8' : '#c9703a' }}
          >
            {loading ? 'Saving…' : 'Save Email'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function UserManagement() {
  const { canAdmin } = usePermissions();
  const { profile: myProfile } = useAuth();
  const [users,         setUsers]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(null); // userId being saved
  const [toast,         setToast]         = useState(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [confirmDelete,    setConfirmDelete]    = useState(null); // user object
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [editEmailUser,    setEditEmailUser]    = useState(null); // user object
  const [resetLoading,     setResetLoading]     = useState(null); // userId
  const [linkInvestorUser, setLinkInvestorUser] = useState(null); // user object

  useEffect(() => {
    if (!canAdmin) return;
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setUsers(data || []);
        setLoading(false);
      });
  }, [canAdmin]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRoleChange = async (userId, newRole) => {
    setSaving(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) {
      showToast('Failed to update role: ' + error.message, 'error');
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast('Role updated successfully.');
    }
    setSaving(null);
  };

  const handleUserCreated = (newUser) => {
    setUsers(prev => [...prev, newUser]);
    showToast(`${newUser.name} has been added.`);
  };

  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', confirmDelete.id);
    if (error) {
      showToast('Failed to delete user: ' + error.message, 'error');
    } else {
      setUsers(prev => prev.filter(u => u.id !== confirmDelete.id));
      showToast(`${confirmDelete.name || confirmDelete.email} has been removed.`);
    }
    setDeleteLoading(false);
    setConfirmDelete(null);
  };

  const handleChangeEmail = async (userId, newEmail) => {
    const { error } = await supabase.from('profiles').update({ email: newEmail }).eq('id', userId);
    if (error) {
      showToast('Failed to update email: ' + error.message, 'error');
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, email: newEmail } : u));
      showToast('Email updated successfully.');
      setEditEmailUser(null);
    }
  };

  const handleLinkInvestor = async (userId, investorName) => {
    const { error } = await supabase.from('profiles').update({ company: investorName || null }).eq('id', userId);
    if (error) {
      showToast('Failed to link investor: ' + error.message, 'error');
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, company: investorName || null } : u));
      showToast(investorName ? `Linked to ${investorName}.` : 'Investor link removed.');
      setLinkInvestorUser(null);
    }
  };

  const handleSendPasswordReset = async (user) => {
    setResetLoading(user.id);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      showToast('Failed to send reset email: ' + error.message, 'error');
    } else {
      showToast(`Password reset email sent to ${user.email}.`);
    }
    setResetLoading(null);
  };

  if (!canAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Access Denied</p>
          <p className="text-sm text-gray-400 mt-1">Only admins can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={handleUserCreated}
        />
      )}
      {confirmDelete && (
        <ConfirmDeleteModal
          user={confirmDelete}
          loading={deleteLoading}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDeleteUser}
        />
      )}
      {editEmailUser && (
        <EditEmailModal
          user={editEmailUser}
          onClose={() => setEditEmailUser(null)}
          onSave={handleChangeEmail}
        />
      )}
      {linkInvestorUser && (
        <LinkInvestorModal
          user={linkInvestorUser}
          onClose={() => setLinkInvestorUser(null)}
          onSave={handleLinkInvestor}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#1a2332' }}>
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1a2332]">User Management</h1>
            <p className="text-sm text-gray-400">Manage team access and permissions</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: '#c9703a' }}
        >
          <UserPlus size={15} />
          Create User
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
            <div className={`p-2 rounded-lg ${cfg.color}`}>
              <cfg.icon size={14} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{cfg.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{cfg.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">
            {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">User</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Email</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Current Role</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Change Role</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Joined</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(user => {
                const isMe = user.id === myProfile?.id;
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                          {(user.name || user.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">
                            {user.name || '—'}
                            {isMe && <span className="ml-2 text-[10px] text-accent font-medium">(you)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{user.email}</td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      {isMe ? (
                        <span className="text-xs text-gray-400 italic">Cannot change own role</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            disabled={saving === user.id}
                            onChange={e => handleRoleChange(user.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white disabled:opacity-50"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="realtor">Realtor</option>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="investor">Investor</option>
                          </select>
                          {saving === user.id && <Loader size={12} className="animate-spin text-gray-400" />}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {isMe ? (
                        <span className="text-xs text-gray-300 italic">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Link to investor (investor-role users only) */}
                          {user.role === 'investor' && (
                            <button
                              title={user.company ? `Linked: ${user.company}` : 'Link to investor'}
                              onClick={() => setLinkInvestorUser(user)}
                              className={`p-1.5 rounded-lg transition-colors ${user.company ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                            >
                              <Link size={14} />
                            </button>
                          )}
                          {/* Send password reset */}
                          <button
                            title="Send password reset email"
                            disabled={resetLoading === user.id}
                            onClick={() => handleSendPasswordReset(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                          >
                            {resetLoading === user.id
                              ? <Loader size={14} className="animate-spin" />
                              : <Mail size={14} />}
                          </button>
                          {/* Change email */}
                          <button
                            title="Change email"
                            onClick={() => setEditEmailUser(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            <PenLine size={14} />
                          </button>
                          {/* Delete user */}
                          <button
                            title="Delete user"
                            onClick={() => setConfirmDelete(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 transition-all ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle size={15} />
            : <CheckCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
