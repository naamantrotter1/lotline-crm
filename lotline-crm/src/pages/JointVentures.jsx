/**
 * JointVentures settings page — /settings/joint-ventures
 *
 * Hub view (LotLine Homes):  propose, manage permissions, suspend, terminate
 * Partner view:              accept/decline pending proposals, view active/terminated
 */
import { useState, useEffect } from 'react';
import {
  Building2, Plus, CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronRight, Loader2, Search, X, RefreshCw, Shield, Activity,
  AlertCircle, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useJv } from '../lib/JvContext';
import { useAuth } from '../lib/AuthContext';

// ─── helpers ────────────────────────────────────────────────────────────────

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token}` };
}

async function apiPost(path, body) {
  const h = await authHeader();
  const res = await fetch(path, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `${res.status}`);
  return json;
}

async function apiPatch(path, body) {
  const h = await authHeader();
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `${res.status}`);
  return json;
}

function statusBadge(status) {
  const cfg = {
    active:    { label: 'Active',    cls: 'bg-green-50 text-green-700 border-green-100' },
    proposed:  { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-100' },
    suspended: { label: 'Suspended', cls: 'bg-orange-50 text-orange-700 border-orange-100' },
    terminated:{ label: 'Terminated',cls: 'bg-red-50 text-red-600 border-red-100' },
  }[status] || { label: status, cls: 'bg-gray-50 text-gray-500 border-gray-100' };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PERM_LABELS = {
  'deal.view':      { label: 'View deals',     desc: 'See deals in combined views' },
  'deal.edit':      { label: 'Edit deals',     desc: 'Modify deal records (hub only)' },
  'investor.view':  { label: 'View investors', desc: 'See investor profiles' },
  'investor.edit':  { label: 'Edit investors', desc: 'Modify investor records (hub only)' },
  'document.view':  { label: 'View documents', desc: 'Access deal documents' },
};

// ─── sub-components ──────────────────────────────────────────────────────────

function PermissionsEditor({ jv, onSaved }) {
  const [perms, setPerms] = useState(() => ({ ...jv.permissions_on_partner }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (key) => setPerms(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      await apiPatch('/api/jv/update-permissions', {
        jvId: jv.id,
        permissionsOnPartner: perms,
      });
      onSaved(perms);
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Hub access to partner data
      </h4>
      <div className="space-y-2.5">
        {Object.entries(PERM_LABELS).map(([key, { label, desc }]) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer group">
            <button
              type="button"
              role="switch"
              aria-checked={!!perms[key]}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                perms[key] ? 'bg-accent' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                perms[key] ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
          </label>
        ))}
      </div>
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
      >
        {saving && <Loader2 size={13} className="animate-spin" />}
        Save permissions
      </button>
    </div>
  );
}

function ReasonModal({ title, placeholder, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
        <textarea
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
          rows={3}
          placeholder={placeholder}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function JvCard({ jv, isHub, onRefresh, showToast }) {
  const [expanded, setExpanded]     = useState(false);
  const [modal, setModal]           = useState(null); // 'suspend'|'terminate'
  const [actioning, setActioning]   = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving]     = useState(false);
  const [localPerms, setLocalPerms] = useState(jv.permissions_on_partner || {});

  const partnerName = jv.partner_org?.name || jv.host_org?.name || 'Partner';
  const isPartner   = !isHub;

  const action = async (endpoint, reason) => {
    setActioning(true);
    try {
      await apiPost(`/api/jv/${endpoint}`, { jvId: jv.id, reason });
      showToast(`Partnership ${endpoint}d.`);
      setModal(null);
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setActioning(false);
  };

  const remove = async () => {
    setRemoving(true);
    try {
      const h = await authHeader();
      const res = await fetch('/api/jv/remove', {
        method: 'DELETE',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jv_id: jv.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `${res.status}`);
      showToast(`${partnerName} removed.`);
      onRefresh();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setRemoving(false);
    setConfirmRemove(false);
  };

  return (
    <>
      {modal && (
        <ReasonModal
          title={modal === 'suspend' ? 'Suspend partnership' : 'Terminate partnership'}
          placeholder={modal === 'suspend' ? 'Reason for suspension…' : 'Reason for termination…'}
          onConfirm={(reason) => action(modal, reason)}
          onClose={() => setModal(null)}
          loading={actioning}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{partnerName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {jv.status === 'active'
                  ? `Active since ${fmtDate(jv.accepted_at)}`
                  : jv.status === 'proposed'
                  ? `Proposed ${fmtDate(jv.proposed_at)}`
                  : `${jv.status.charAt(0).toUpperCase() + jv.status.slice(1)} ${fmtDate(jv.terminated_at || jv.updated_at)}`}
              </p>
            </div>
            {statusBadge(jv.status)}
            <ChevronRight
              size={16}
              className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>

          {/* Remove button — hub only */}
          {isHub && (
            <div className="pr-4 flex-shrink-0">
              {confirmRemove ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Remove?</span>
                  <button
                    onClick={remove}
                    disabled={removing}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {removing ? <Loader2 size={12} className="animate-spin" /> : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmRemove(true); }}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  title="Remove partner"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expanded body */}
        {expanded && (
          <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">

            {/* Accept / Decline — partner view of incoming proposal */}
            {jv.status === 'proposed' && isPartner && (
              <div className="flex gap-3">
                <button
                  onClick={() => action('accept', '')}
                  disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actioning ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={14} />}
                  Accept partnership
                </button>
                <button
                  onClick={() => action('decline', '')}
                  disabled={actioning}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircle size={14} />
                  Decline
                </button>
              </div>
            )}

            {/* Awaiting — hub view of outgoing proposal */}
            {jv.status === 'proposed' && isHub && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <Clock size={14} className="flex-shrink-0" />
                Awaiting acceptance from {partnerName}
              </div>
            )}

            {/* Permissions editor — hub only, active JVs */}
            {jv.status === 'active' && isHub && (
              <PermissionsEditor
                jv={{ ...jv, permissions_on_partner: localPerms }}
                onSaved={(p) => { setLocalPerms(p); showToast('Permissions saved.'); }}
              />
            )}

            {/* Termination note */}
            {jv.terminated_reason && (
              <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                <span className="font-semibold">Reason: </span>{jv.terminated_reason}
              </div>
            )}

            {/* Suspend / Terminate actions — active/suspended JVs */}
            {(jv.status === 'active' || jv.status === 'suspended') && (
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                {jv.status === 'active' && (
                  <button
                    onClick={() => setModal('suspend')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
                  >
                    <AlertTriangle size={12} />
                    Suspend
                  </button>
                )}
                <button
                  onClick={() => setModal('terminate')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <XCircle size={12} />
                  Terminate
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Propose modal ───────────────────────────────────────────────────────────

function ProposeModal({ onClose, onProposed }) {
  const [query,    setQuery]    = useState('');
  const [allOrgs,  setAllOrgs]  = useState([]);
  const [selected, setSelected] = useState(null);
  const [message,  setMessage]  = useState('');
  const [loading,  setLoading]  = useState(true);
  const [proposing, setProposing] = useState(false);
  const [err, setErr]             = useState('');

  // Load all eligible orgs on mount
  useEffect(() => {
    (async () => {
      try {
        const h = await authHeader();
        const res = await fetch('/api/jv/search-orgs', { headers: h });
        const json = await res.json();
        setAllOrgs(json.orgs || []);
      } catch { setAllOrgs([]); }
      setLoading(false);
    })();
  }, []);

  // Client-side filter
  const q = query.trim().toLowerCase();
  const results = q.length === 0
    ? allOrgs
    : allOrgs.filter(o => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));

  const propose = async () => {
    if (!selected) return;
    setProposing(true);
    setErr('');
    try {
      await apiPost('/api/jv/propose', {
        partnerOrgId: selected.id,
        notes: message.trim() || undefined,
      });
      onProposed();
    } catch (e) {
      setErr(e.message);
    }
    setProposing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Add JV Partner</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Search */}
          {!selected ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Select a subscriber org
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter by name…"
                  className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
              </div>

              <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden shadow-sm max-h-64 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={18} className="animate-spin text-gray-300" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {allOrgs.length === 0 ? 'No eligible subscriber orgs found' : 'No orgs match your filter'}
                  </p>
                ) : (
                  results.map(org => (
                    <button
                      key={org.id}
                      onClick={() => setSelected(org)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                        {org.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{org.name}</p>
                        <p className="text-xs text-gray-400">{org.slug}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Selected org */}
              <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                  {selected.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{selected.name}</p>
                  <p className="text-xs text-gray-400">{selected.slug}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>

              {/* Optional message */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Message to partner (optional)
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Briefly describe the purpose of this joint venture…"
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>

              {err && <p className="text-xs text-red-500">{err}</p>}

              <button
                onClick={propose}
                disabled={proposing}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {proposing && <Loader2 size={14} className="animate-spin" />}
                Add partner
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Activity feed ───────────────────────────────────────────────────────────

function ActivityFeed() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const h = await authHeader();
      const res = await fetch(`/api/jv/activity-feed?type=${filter}`, { headers: h });
      const json = await res.json();
      setLogs(json.logs || []);
    } catch { setLogs([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['all', 'i_on_partner', 'partner_on_me'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === f ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'All activity' : f === 'i_on_partner' ? 'My access to partner' : 'Partner access to my data'}
          </button>
        ))}
        <button onClick={load} className="ml-auto text-gray-400 hover:text-gray-600" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">No activity yet</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {logs.map((log, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield size={12} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{log.actor_name || 'Unknown'}</span>
                  {' '}({log.acting_org_name || 'Unknown org'})
                  {' — '}{log.action_type.replace(/_/g, ' ')}
                </p>
                {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">
                {new Date(log.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function JointVentures() {
  const { isJvHub, refreshJvs } = useJv();

  const [allJvs,      setAllJvs]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showPropose, setShowPropose] = useState(false);
  const [toast,       setToast]       = useState(null);

  const showToastFn = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadJvs = async () => {
    setLoading(true);
    try {
      const h = await authHeader();
      const res = await fetch('/api/jv/list', { headers: h });
      const json = await res.json();
      setAllJvs(json.jvs || []);
    } catch { setAllJvs([]); }
    setLoading(false);
  };

  useEffect(() => { loadJvs(); }, []);

  const refresh = () => { loadJvs(); refreshJvs(); };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Building2 size={20} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sidebar">Joint Ventures</h1>
            <p className="text-sm text-gray-500">
              {isJvHub
                ? 'Manage your JV partner data access and permissions'
                : 'View joint venture agreements with LotLine Homes'}
            </p>
          </div>
        </div>
        {isJvHub && (
          <button
            onClick={() => setShowPropose(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            <Plus size={15} />
            Add partner
          </button>
        )}
      </div>

      {/* Info banner for non-hub */}
      {!isJvHub && (
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <AlertCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Joint ventures are initiated by LotLine Homes. When a partnership is active, they may
            view your deals and investor data per the agreed permissions.
          </p>
        </div>
      )}

      {/* Partner list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : allJvs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No partners yet</p>
          {isJvHub && (
            <button
              onClick={() => setShowPropose(true)}
              className="mt-4 text-sm font-semibold text-accent hover:underline"
            >
              Add your first partner
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {allJvs.map(jv => (
            <JvCard
              key={jv.id}
              jv={jv}
              isHub={isJvHub}
              onRefresh={refresh}
              showToast={showToastFn}
            />
          ))}
        </div>
      )}

      {/* Add partner modal */}
      {showPropose && (
        <ProposeModal
          onClose={() => setShowPropose(false)}
          onProposed={() => {
            setShowPropose(false);
            showToastFn('Partner added successfully!');
            refresh();
          }}
        />
      )}

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
