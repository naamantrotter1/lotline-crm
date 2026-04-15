import { useState, useEffect } from 'react';
import { Users, Shield, Eye, Edit3, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../lib/AuthContext';

const ROLE_CONFIG = {
  admin:  { label: 'Admin',  color: 'bg-red-100 text-red-700',    icon: Shield,  desc: 'Full access + user management' },
  editor: { label: 'Editor', color: 'bg-blue-100 text-blue-700',  icon: Edit3,   desc: 'View + edit deals'              },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-600',  icon: Eye,     desc: 'Read-only access'               },
};

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
}

export default function UserManagement() {
  const { canAdmin } = usePermissions();
  const { profile: myProfile } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null); // userId being saved
  const [toast,   setToast]   = useState(null);

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: '#1a2332' }}>
          <Users size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1a2332]">User Management</h1>
          <p className="text-sm text-gray-400">Manage team access and permissions</p>
        </div>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-3">
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
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </h2>
          <p className="text-xs text-gray-400">New users can be invited via the Supabase dashboard</p>
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
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                          {saving === user.id && <Loader size={12} className="animate-spin text-gray-400" />}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
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
