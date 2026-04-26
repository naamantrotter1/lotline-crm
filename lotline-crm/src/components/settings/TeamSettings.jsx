import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, UserPlus, X, CheckCircle, AlertCircle, Loader2,
  Mail, Copy, RotateCcw, Slash, Crown, Shield, Edit3, Eye, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { PLAN_SEAT_LIMITS, seatLimitMessage } from '../../lib/permissions';

/* ── Role config ── */
const ORG_ROLE_CONFIG = {
  owner:    { label: 'Owner',    color: 'bg-amber-100 text-amber-700',  icon: Crown  },
  admin:    { label: 'Admin',    color: 'bg-red-100 text-red-700',      icon: Shield },
  operator: { label: 'Operator', color: 'bg-blue-100 text-blue-700',    icon: Edit3  },
  viewer:   { label: 'Viewer',   color: 'bg-gray-100 text-gray-600',    icon: Eye    },
};

function RoleBadge({ role }) {
  const cfg = ORG_ROLE_CONFIG[role] || ORG_ROLE_CONFIG.viewer;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, avatarUrl, size = 8 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 overflow-hidden`}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

/* ── Invite modal ── */
function InviteModal({ onClose, onInvited, orgPlan, orgSeatLimit, currentSeats }) {
  const { session } = useAuth();
  const [email,  setEmail]  = useState('');
  const [role,   setRole]   = useState('operator');
  const [loading, setLoading] = useState(false);
  const [error,  setError]  = useState('');
  const [result, setResult] = useState(null); // { inviteUrl }

  const atLimit = orgPlan === 'starter' || (orgPlan !== 'scale' && currentSeats >= (orgSeatLimit ?? PLAN_SEAT_LIMITS[orgPlan] ?? 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = (await import('../../lib/supabase').then(m => m.supabase.auth.getSession()))
        .data.session?.access_token;
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Failed to send invite');
      setResult({ inviteUrl: json.inviteUrl });
      onInvited();
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-sidebar">Invite Teammate</h2>
            <p className="text-xs text-gray-400 mt-0.5">They'll receive a link to join your workspace</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {result ? (
          /* Success state: show invite link */
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700">Invitation created! Share this link:</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.inviteUrl}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs bg-gray-50 text-gray-600 font-mono truncate"
              />
              <button
                onClick={() => navigator.clipboard.writeText(result.inviteUrl)}
                title="Copy link"
                className="flex-shrink-0 p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <Copy size={14} className="text-gray-600" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#c8613a' }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {atLimit && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 space-y-2">
                <p>{seatLimitMessage(orgPlan, currentSeats, orgSeatLimit)}</p>
                {orgPlan === 'starter' && (
                  <a
                    href="/cart?plan=pro"
                    className="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
                    style={{ textDecoration: 'none' }}
                  >
                    Upgrade to Pro
                  </a>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
                disabled={atLimit && orgPlan === 'starter'}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                disabled={atLimit && orgPlan === 'starter'}
                className={inputClass}
              >
                <option value="admin">Admin — full data access + team management</option>
                <option value="operator">Operator — create/edit deals & investor data</option>
                <option value="viewer">Viewer — read-only across all data</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Owners are assigned automatically and cannot be invited.</p>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={loading || !email || (atLimit && orgPlan === 'starter')}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#c8613a' }}
            >
              {loading ? 'Creating invite…' : 'Create invitation link'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ── Role change dropdown cell ── */
function RoleCell({ member, myId, myRole, onChangeRole, saving }) {
  const isMe     = member.profiles?.id === myId || member.user_id === myId;
  const isOwner  = member.role === 'owner';
  const canChange = !isMe && !isOwner && (myRole === 'owner' || myRole === 'admin');

  if (!canChange) {
    return (
      <div className="flex items-center gap-2">
        <RoleBadge role={member.role} />
        {isMe && <span className="text-xs text-gray-400">(you)</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={member.role}
        disabled={saving}
        onChange={e => onChangeRole(member.id, e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white disabled:opacity-50"
      >
        <option value="admin">Admin</option>
        <option value="operator">Operator</option>
        <option value="viewer">Viewer</option>
      </select>
      {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
    </div>
  );
}

/* ── Seat usage bar ── */
function SeatBar({ used, limit, plan }) {
  if (plan === 'scale') return null;
  const pct  = Math.min(100, (used / (limit || 1)) * 100);
  const full  = used >= limit;
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-600">Seats used</span>
          <span className={`text-xs font-bold ${full ? 'text-red-500' : 'text-gray-700'}`}>{used} / {limit}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${full ? 'bg-red-400' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${plan === 'pro' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
        {plan}
      </span>
    </div>
  );
}

/* ── Main component ── */
export default function TeamSettings() {
  const { session, profile, orgRole, orgPlan, orgSeatLimit, can } = useAuth();
  const canManage = can('team.invite');

  const [members,     setMembers]     = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showInvite,  setShowInvite]  = useState(false);
  const [saving,      setSaving]      = useState(null); // memberId being updated
  const [toast,       setToast]       = useState(null);
  const [editingName, setEditingName] = useState(null); // { memberId, firstName, lastName }
  const editingNameRef = useRef(null); // mirrors editingName to avoid stale closures

  const myId = profile?.id || session?.user?.id;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sess } = await import('../../lib/supabase').then(m => m.supabase.auth.getSession());
      const token = sess?.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/team/members', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      setMembers(json.members || []);
      setInvitations(json.invitations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const callTeamApi = async (path, method, body) => {
    const { data: sess } = await import('../../lib/supabase').then(m => m.supabase.auth.getSession());
    const token = sess?.session?.access_token;
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  };

  const handleChangeRole = async (memberId, newRole) => {
    setSaving(memberId);
    try {
      await callTeamApi('/api/team/update-member', 'PATCH', { memberId, role: newRole });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      showToast('Role updated.');
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(null);
  };

  const handleDisableMember = async (member) => {
    const newStatus = member.status === 'active' ? 'disabled' : 'active';
    setSaving(member.id);
    try {
      await callTeamApi('/api/team/update-member', 'PATCH', { memberId: member.id, status: newStatus });
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: newStatus } : m));
      showToast(newStatus === 'disabled' ? 'Member disabled.' : 'Member re-enabled.');
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(null);
  };

  const handleResendInvite = async (inv) => {
    setSaving(inv.id);
    try {
      const json = await callTeamApi('/api/team/resend-invite', 'POST', { invitationId: inv.id });
      showToast('Invite link refreshed — copy it from the list.');
      // Update local invite with new token
      setInvitations(prev => prev.map(i => i.id === inv.id ? { ...i, ...json.invitation, _newUrl: json.inviteUrl } : i));
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(null);
  };

  const handleCancelInvite = async (inv) => {
    setSaving(inv.id);
    try {
      await callTeamApi('/api/team/cancel-invite', 'POST', { invitationId: inv.id });
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
      showToast('Invitation canceled.');
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(null);
  };

  const handleSaveName = useCallback(async () => {
    const current = editingNameRef.current;
    if (!current) return;
    editingNameRef.current = null;   // prevent double-save
    setEditingName(null);

    const { memberId, firstName, lastName } = current;
    if (!firstName.trim() && !lastName.trim()) return; // nothing to save

    setSaving(memberId);
    try {
      await callTeamApi('/api/team/update-member', 'PATCH', { memberId, firstName: firstName.trim(), lastName: lastName.trim() });
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      setMembers(prev => prev.map(m => m.id === memberId ? {
        ...m,
        profiles: { ...m.profiles, first_name: firstName.trim(), last_name: lastName.trim(), name: fullName },
      } : m));
      showToast('Name updated.');
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(null);
  }, [callTeamApi, showToast]);

  const totalSeats = members.filter(m => m.status === 'active').length + invitations.length;
  const seatLimit  = orgSeatLimit ?? PLAN_SEAT_LIMITS[orgPlan] ?? 1;

  if (!can('team.view')) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Shield size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">Access restricted</p>
          <p className="text-sm text-gray-400 mt-1">Only owners and admins can view team settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={fetchTeam}
          orgPlan={orgPlan}
          orgSeatLimit={seatLimit}
          currentSeats={totalSeats}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sidebar">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sidebar">Team</h2>
            <p className="text-xs text-gray-400">Manage who has access to your workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTeam}
            title="Refresh"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          {canManage && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#c8613a' }}
            >
              <UserPlus size={15} />
              Invite
            </button>
          )}
        </div>
      </div>

      {/* Seat bar */}
      {orgPlan && (
        <SeatBar used={totalSeats} limit={seatLimit} plan={orgPlan} />
      )}

      {/* Members table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Members {loading ? '' : `(${members.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : members.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No members yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Member</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Role</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Status</th>
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Joined</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(member => {
                const isMe  = member.user_id === myId || member.profiles?.id === myId;
                // For the current user, prefer live auth context profile over stale API data
                const apiProf = member.profiles || {};
                const prof = isMe ? {
                  ...apiProf,
                  name:       profile?.name       || apiProf.name,
                  first_name: profile?.first_name || apiProf.first_name,
                  last_name:  profile?.last_name  || apiProf.last_name,
                  email:      profile?.email      || apiProf.email,
                  avatar_url: profile?.avatar_url || apiProf.avatar_url,
                } : apiProf;
                return (
                  <tr key={member.id} className={`hover:bg-gray-50/50 transition-colors ${member.status === 'disabled' ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={prof.name || prof.first_name} avatarUrl={prof.avatar_url} />
                        {editingName?.memberId === member.id ? (
                          <div
                            className="flex items-center gap-1.5"
                            onBlur={e => {
                              if (!e.currentTarget.contains(e.relatedTarget)) {
                                handleSaveName();
                              }
                            }}
                          >
                            <input
                              autoFocus
                              value={editingName.firstName}
                              onChange={e => {
                                const val = e.target.value;
                                setEditingName(n => { const next = { ...n, firstName: val }; editingNameRef.current = next; return next; });
                              }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { editingNameRef.current = null; setEditingName(null); } }}
                              placeholder="First"
                              className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                            <input
                              value={editingName.lastName}
                              onChange={e => {
                                const val = e.target.value;
                                setEditingName(n => { const next = { ...n, lastName: val }; editingNameRef.current = next; return next; });
                              }}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { editingNameRef.current = null; setEditingName(null); } }}
                              placeholder="Last"
                              className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                            {saving === member.id && <Loader2 size={12} className="animate-spin text-accent flex-shrink-0" />}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <div
                              className={canManage && !isMe ? 'cursor-pointer' : ''}
                              onClick={canManage && !isMe ? () => { const nameParts = (prof.name || '').trim().split(/\s+/); const v = { memberId: member.id, firstName: prof.first_name || nameParts[0] || '', lastName: prof.last_name || nameParts.slice(1).join(' ') || '' }; editingNameRef.current = v; setEditingName(v); } : undefined}
                            >
                              <p className="text-xs font-semibold text-gray-800">
                                {prof.name || [prof.first_name, prof.last_name].filter(Boolean).join(' ') || prof.email || '—'}
                                {isMe && <span className="ml-1.5 text-[10px] text-accent">(you)</span>}
                              </p>
                              <p className="text-xs text-gray-400">{prof.email}</p>
                            </div>
                            {canManage && !isMe && (
                              <button
                                title="Edit name"
                                onClick={() => { const nameParts = (prof.name || '').trim().split(/\s+/); const v = { memberId: member.id, firstName: prof.first_name || nameParts[0] || '', lastName: prof.last_name || nameParts.slice(1).join(' ') || '' }; editingNameRef.current = v; setEditingName(v); }}
                                className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500 hover:bg-gray-100 transition-all flex-shrink-0"
                              >
                                <Edit3 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleCell
                        member={member}
                        myId={myId}
                        myRole={orgRole}
                        onChangeRole={handleChangeRole}
                        saving={saving === member.id}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        {!isMe && member.role !== 'owner' && (
                          <button
                            title={member.status === 'active' ? 'Disable member' : 'Re-enable member'}
                            disabled={saving === member.id}
                            onClick={() => handleDisableMember(member)}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                              member.status === 'active'
                                ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {saving === member.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : member.status === 'active'
                                ? <Slash size={13} />
                                : <CheckCircle size={13} />
                            }
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending invitations */}
      {(invitations.length > 0 || canManage) && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Pending Invitations {loading ? '' : `(${invitations.length})`}
            </h3>
          </div>

          {invitations.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No pending invitations.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Email</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Role</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Expires</th>
                  {canManage && <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invitations.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Mail size={11} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{inv.email}</p>
                          {inv._newUrl && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]">{inv._newUrl}</p>
                              <button
                                onClick={() => navigator.clipboard.writeText(inv._newUrl)}
                                className="text-accent hover:text-accent/80"
                                title="Copy link"
                              >
                                <Copy size={9} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><RoleBadge role={inv.role} /></td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Refresh link"
                            disabled={saving === inv.id}
                            onClick={() => handleResendInvite(inv)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                          >
                            {saving === inv.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <RotateCcw size={13} />}
                          </button>
                          <button
                            title="Cancel invitation"
                            disabled={saving === inv.id}
                            onClick={() => handleCancelInvite(inv)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Role legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(ORG_ROLE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-start gap-2.5">
            <div className={`p-1.5 rounded-lg ${cfg.color}`}><cfg.icon size={13} /></div>
            <div>
              <p className="text-xs font-semibold text-gray-800">{cfg.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                {key === 'owner'    && 'Full access incl. billing & org settings'}
                {key === 'admin'    && 'Full data + team management'}
                {key === 'operator' && 'Create/edit deals & investor data'}
                {key === 'viewer'   && 'Read-only across all data'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Toast */}
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
