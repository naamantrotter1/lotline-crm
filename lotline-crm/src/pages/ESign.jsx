/**
 * ESign.jsx
 * Phase 16: E-sign management — envelope list, send modal, template sync.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FileSignature, Plus, RefreshCw, Link2, Link2Off, ExternalLink,
  Send, CheckCircle2, XCircle, Clock, FileText, Users, AlertCircle,
  ChevronDown, Loader2,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  fetchEnvelopes, fetchEsignConnection, fetchEsignTemplates,
  syncEsignTemplates, sendEnvelope, voidEnvelope, refreshEnvelopeStatus,
  disconnectEsign, getPandaDocAuthUrl, exchangePandaDocCode,
  ENVELOPE_STATUS, envelopeStatusBadge,
} from '../lib/esignData';

const COLOR_MAP = {
  gray:   'bg-gray-100 text-gray-600',
  blue:   'bg-blue-100 text-blue-600',
  amber:  'bg-amber-100 text-amber-700',
  green:  'bg-green-100 text-green-600',
  red:    'bg-red-100 text-red-600',
  orange: 'bg-orange-100 text-orange-600',
};

function StatusBadge({ status }) {
  const { label, color } = envelopeStatusBadge(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLOR_MAP[color] ?? COLOR_MAP.gray}`}>
      {label}
    </span>
  );
}

// ── Send Envelope Modal ────────────────────────────────────────────────────

function SendModal({ templates, onClose, onSent, orgId, userId }) {
  const [step, setStep] = useState(1); // 1=details, 2=recipients
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [recipients, setRecipients] = useState([{ name: '', email: '', role: 'signer' }]);
  const [fieldsData, setFieldsData] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const selectedTemplate = templates.find(t => t.id === templateId);

  const addRecipient = () => setRecipients(r => [...r, { name: '', email: '', role: 'signer' }]);
  const removeRecipient = (i) => setRecipients(r => r.filter((_, idx) => idx !== i));
  const updateRecipient = (i, field, value) => {
    setRecipients(r => r.map((rec, idx) => idx === i ? { ...rec, [field]: value } : rec));
  };

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      await sendEnvelope({
        orgId, userId,
        templateId: selectedTemplate?.id ?? null,
        pandadocTemplateId: selectedTemplate?.pandadoc_template_id ?? null,
        name,
        recipients: recipients.filter(r => r.name && r.email),
        fieldsData,
      });
      onSent();
    } catch (e) {
      setError(e.message);
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Send Document for Signature</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Template</label>
                <select
                  value={templateId}
                  onChange={e => setTemplateId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">Select a template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Document Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Purchase Agreement — 123 Main St"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!name}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                Next: Add Recipients
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-3">
                {recipients.map((r, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        value={r.name}
                        onChange={e => updateRecipient(i, 'name', e.target.value)}
                        placeholder="Full name"
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                      <input
                        value={r.email}
                        onChange={e => updateRecipient(i, 'email', e.target.value)}
                        placeholder="email@example.com"
                        type="email"
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                      />
                    </div>
                    {recipients.length > 1 && (
                      <button onClick={() => removeRecipient(i)} className="text-gray-300 hover:text-red-400 mt-2">×</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addRecipient} className="text-xs text-accent font-medium hover:underline">
                + Add another recipient
              </button>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600">
                  <AlertCircle size={12} />{error}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Back
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || recipients.every(r => !r.name || !r.email)}
                  className="flex-1 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send for Signature</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ESign() {
  const { activeOrgId, profile } = useAuth();
  const [connection, setConnection]   = useState(null);
  const [templates, setTemplates]     = useState([]);
  const [envelopes, setEnvelopes]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [showSend, setShowSend]       = useState(false);
  const [refreshing, setRefreshing]   = useState({});

  const load = useCallback(async () => {
    if (!activeOrgId || !profile?.id) return;
    setLoading(true);
    const [conn, envs, tmpls] = await Promise.all([
      fetchEsignConnection(activeOrgId, profile.id),
      fetchEnvelopes(activeOrgId),
      fetchEsignTemplates(activeOrgId),
    ]);
    setConnection(conn);
    setEnvelopes(envs);
    setTemplates(tmpls);
    setLoading(false);
  }, [activeOrgId, profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Handle OAuth redirect from PandaDoc
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'pandadoc' && activeOrgId && profile?.id) {
      const redirect = `${window.location.origin}/esign`;
      window.history.replaceState({}, '', '/esign');
      exchangePandaDocCode(code, redirect, activeOrgId, profile.id)
        .then(() => load())
        .catch(console.error);
    }
  }, [activeOrgId, profile?.id, load]);

  const handleConnect = () => {
    const redirect = `${window.location.origin}/esign`;
    window.location.href = getPandaDocAuthUrl(redirect) + '&state=pandadoc';
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    await disconnectEsign(connection.id);
    setConnection(null);
    setTemplates([]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncEsignTemplates(activeOrgId, profile?.id);
      const tmpls = await fetchEsignTemplates(activeOrgId);
      setTemplates(tmpls);
    } catch { /* ignore */ }
    setSyncing(false);
  };

  const handleRefreshStatus = async (envelopeId) => {
    setRefreshing(r => ({ ...r, [envelopeId]: true }));
    try {
      await refreshEnvelopeStatus(envelopeId, activeOrgId, profile?.id);
      const envs = await fetchEnvelopes(activeOrgId);
      setEnvelopes(envs);
    } catch { /* ignore */ }
    setRefreshing(r => ({ ...r, [envelopeId]: false }));
  };

  const handleVoid = async (envelopeId) => {
    await voidEnvelope(envelopeId);
    setEnvelopes(e => e.map(env => env.id === envelopeId ? { ...env, status: 'voided' } : env));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">E-Sign</h1>
            <p className="text-sm text-gray-400 mt-0.5">Send documents for digital signature via PandaDoc</p>
          </div>
          {connection && (
            <button
              onClick={() => setShowSend(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90"
            >
              <Plus size={15} /> Send Document
            </button>
          )}
        </div>

        {/* Connection banner */}
        {!connection ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <FileSignature size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Connect PandaDoc</p>
                <p className="text-xs text-gray-400 mt-0.5">Send, track, and store signed documents</p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600"
            >
              <Link2 size={14} /> Connect
            </button>
          </div>
        ) : (
          <div className="bg-green-50 rounded-2xl border border-green-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-800">PandaDoc connected</p>
                {connection.connected_email && (
                  <p className="text-xs text-green-600 mt-0.5">{connection.connected_email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                Sync Templates ({templates.length})
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
              >
                <Link2Off size={12} /> Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Envelope list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
            <span className="text-xs text-gray-400">{envelopes.length} total</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : envelopes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileSignature size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No documents yet</p>
              <p className="text-xs mt-1">Connect PandaDoc and send your first document</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {envelopes.map(env => (
                <div key={env.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{env.name}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <StatusBadge status={env.status} />
                          {env.esign_templates?.name && (
                            <span className="text-xs text-gray-400">{env.esign_templates.name}</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(env.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Recipients */}
                        {env.esign_recipients?.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Users size={11} className="text-gray-300" />
                            {env.esign_recipients.map(r => (
                              <span key={r.id} className="text-xs text-gray-500">
                                {r.name}
                                <span className={`ml-1 text-xs font-medium ${
                                  r.status === 'signed' ? 'text-green-500' :
                                  r.status === 'declined' ? 'text-red-500' :
                                  r.status === 'viewed' ? 'text-amber-500' : 'text-gray-400'
                                }`}>({r.status})</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {env.pandadoc_view_url && (
                        <a
                          href={env.pandadoc_view_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open in PandaDoc"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {['sent', 'partially_signed'].includes(env.status) && (
                        <button
                          onClick={() => handleRefreshStatus(env.id)}
                          disabled={refreshing[env.id]}
                          className="p-1.5 text-gray-400 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Refresh status"
                        >
                          <RefreshCw size={14} className={refreshing[env.id] ? 'animate-spin' : ''} />
                        </button>
                      )}
                      {['sent', 'partially_signed', 'draft'].includes(env.status) && (
                        <button
                          onClick={() => handleVoid(env.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Void document"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSend && (
        <SendModal
          templates={templates}
          orgId={activeOrgId}
          userId={profile?.id}
          onClose={() => setShowSend(false)}
          onSent={() => { setShowSend(false); load(); }}
        />
      )}
    </div>
  );
}
