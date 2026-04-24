/**
 * ApiWebhooksSettings.jsx
 * Phase 10: Settings panel for managing API keys and webhook endpoints.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, Copy, Check, Eye, EyeOff, Zap, Key } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  fetchApiKeys, createApiKey, revokeApiKey,
  fetchWebhooks, createWebhook, updateWebhook, deleteWebhook,
  fetchDeliveries, WEBHOOK_EVENTS,
} from '../../lib/apiWebhooksData';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Copy">
      {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  );
}

// ── API Keys section ─────────────────────────────────────────────────────────

function ApiKeysSection({ orgId, userId, canAdmin }) {
  const [keys,      setKeys]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [name,      setName]      = useState('');
  const [scopes,    setScopes]    = useState(['read']);
  const [saving,    setSaving]    = useState(false);
  const [newKey,    setNewKey]    = useState(null); // { key, id } shown once

  useEffect(() => {
    if (!orgId) return;
    fetchApiKeys(orgId).then(d => { setKeys(d); setLoading(false); });
  }, [orgId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { key, data, error } = await createApiKey(orgId, userId, { name: name.trim(), scopes });
    setSaving(false);
    if (error || !data) return;
    setNewKey({ key, id: data.id, name: data.name });
    setKeys(prev => [data, ...prev]);
    setName('');
    setShowForm(false);
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this API key? Any integrations using it will stop working.')) return;
    await revokeApiKey(id);
    setKeys(prev => prev.filter(k => k.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Key size={14} /> API Keys</h3>
        {canAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/5 transition-colors">
            <Plus size={13} /> New Key
          </button>
        )}
      </div>

      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-green-700">Key created — copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
            <code className="text-xs text-gray-700 flex-1 break-all">{newKey.key}</code>
            <CopyButton text={newKey.key} />
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-green-600 hover:underline">Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700">New API Key</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Key name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Zapier Integration"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Scopes</label>
            <div className="flex gap-3">
              {['read', 'write'].map(s => (
                <label key={s} className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={e => setScopes(prev => e.target.checked ? [...prev, s] : prev.filter(x => x !== s))}
                    className="rounded border-gray-300 text-accent"
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!name.trim() || saving} className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40" style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Creating…' : 'Create Key'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
          <p className="text-sm text-gray-400">No API keys yet</p>
          <p className="text-xs text-gray-300 mt-1">Create a key to access the LotLine API from external tools.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{k.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{k.key_prefix}••••••••</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {k.scopes?.map(s => (
                  <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{s}</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">
                {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never used'}
              </p>
              {canAdmin && (
                <button onClick={() => handleRevoke(k.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhooks section ─────────────────────────────────────────────────────────

function WebhookRow({ wh, canAdmin, onDelete, onToggle }) {
  const [deleting,   setDeleting]   = useState(false);
  const [toggling,   setToggling]   = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [deliveries, setDeliveries] = useState(null);
  const [showLog,    setShowLog]    = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await updateWebhook(wh.id, { active: !wh.active });
    onToggle(wh.id, !wh.active);
    setToggling(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this webhook? Deliveries will also be removed.')) return;
    setDeleting(true);
    await deleteWebhook(wh.id);
    onDelete(wh.id);
  };

  const loadDeliveries = async () => {
    if (!showLog) {
      const d = await fetchDeliveries(wh.id);
      setDeliveries(d);
    }
    setShowLog(v => !v);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3 group">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${wh.active ? 'bg-green-400' : 'bg-gray-300'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{wh.url}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {wh.events?.map(ev => (
              <span key={ev} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{ev}</span>
            ))}
          </div>
          {wh.last_fired_at && (
            <p className="text-xs text-gray-400 mt-1">
              Last fired: {new Date(wh.last_fired_at).toLocaleString()} —{' '}
              <span className={wh.last_status >= 200 && wh.last_status < 300 ? 'text-green-500' : 'text-red-500'}>
                {wh.last_status}
              </span>
            </p>
          )}
        </div>
        {canAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={loadDeliveries} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100">Log</button>
            <button onClick={handleToggle} disabled={toggling} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100">
              {wh.active ? 'Disable' : 'Enable'}
            </button>
            <button onClick={handleDelete} disabled={deleting} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Secret row */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-50 bg-gray-50/50">
        <span className="text-xs text-gray-400">Secret:</span>
        <code className="text-xs text-gray-600 font-mono">{showSecret ? wh.secret : '••••••••••••••••'}</code>
        <button onClick={() => setShowSecret(v => !v)} className="text-gray-400 hover:text-gray-600">
          {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        <CopyButton text={wh.secret} />
      </div>

      {/* Delivery log */}
      {showLog && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto bg-gray-50/30">
          <p className="text-xs font-semibold text-gray-500">Recent Deliveries</p>
          {deliveries?.length === 0 && <p className="text-xs text-gray-300">No deliveries yet</p>}
          {deliveries?.map(d => (
            <div key={d.id} className="flex items-center gap-2 text-xs">
              <span className={`font-mono ${d.status_code >= 200 && d.status_code < 300 ? 'text-green-600' : 'text-red-500'}`}>{d.status_code || '—'}</span>
              <span className="text-gray-500 font-mono">{d.event}</span>
              <span className="text-gray-300">{new Date(d.fired_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhooksSection({ orgId, userId, canAdmin }) {
  const [webhooks,  setWebhooks]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [url,       setUrl]       = useState('');
  const [events,    setEvents]    = useState(['deal.created']);
  const [saving,    setSaving]    = useState(false);
  const [newSecret, setNewSecret] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    fetchWebhooks(orgId).then(d => { setWebhooks(d); setLoading(false); });
  }, [orgId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!url.trim() || events.length === 0) return;
    setSaving(true);
    const { secret, data, error } = await createWebhook(orgId, userId, { url: url.trim(), events });
    setSaving(false);
    if (error || !data) return;
    setNewSecret({ secret, id: data.id });
    setWebhooks(prev => [data, ...prev]);
    setUrl('');
    setEvents(['deal.created']);
    setShowForm(false);
  };

  const toggleEvent = (ev) =>
    setEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Zap size={14} /> Webhook Endpoints</h3>
        {canAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-accent border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent/5 transition-colors">
            <Plus size={13} /> Add Endpoint
          </button>
        )}
      </div>

      {newSecret && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-green-700">Webhook created — save the signing secret now</p>
          <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
            <code className="text-xs text-gray-700 flex-1 break-all font-mono">{newSecret.secret}</code>
            <CopyButton text={newSecret.secret} />
          </div>
          <button onClick={() => setNewSecret(null)} className="text-xs text-green-600 hover:underline">Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-700">New Webhook Endpoint</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Events to subscribe</label>
            <div className="grid grid-cols-2 gap-1.5">
              {WEBHOOK_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded border-gray-300 text-accent"
                  />
                  <span className="font-mono">{ev}</span>
                </label>
              ))}
            </div>
          </div>
          {events.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={12} /> Select at least one event
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={!url.trim() || events.length === 0 || saving} className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40" style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Creating…' : 'Create Webhook'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl">
          <p className="text-sm text-gray-400">No webhooks configured</p>
          <p className="text-xs text-gray-300 mt-1">Add an endpoint to receive real-time event notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(wh => (
            <WebhookRow
              key={wh.id}
              wh={wh}
              canAdmin={canAdmin}
              onDelete={id => setWebhooks(prev => prev.filter(w => w.id !== id))}
              onToggle={(id, active) => setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active } : w))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function ApiWebhooksSettings() {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const canAdmin = can('settings.manage');

  return (
    <div className="max-w-2xl space-y-8">
      {!canAdmin && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
          Only owners and admins can manage API keys and webhooks.
        </div>
      )}

      <ApiKeysSection  orgId={activeOrgId} userId={profile?.id} canAdmin={canAdmin} />
      <div className="border-t border-gray-100" />
      <WebhooksSection orgId={activeOrgId} userId={profile?.id} canAdmin={canAdmin} />
    </div>
  );
}
