import { useState, useEffect, useCallback } from 'react';
import {
  FileSignature, Plus, RefreshCw, Link2, Link2Off, ExternalLink,
  Send, CheckCircle2, XCircle, Clock, FileText, Users, AlertCircle,
  Loader2, Bell, Trash2
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchEnvelopes, fetchEsignConnection, fetchEsignTemplates,
  syncEsignTemplates, sendEnvelope, voidEnvelope, sendReminder,
  disconnectEsign, getPandaDocAuthUrl, exchangePandaDocCode,
  ENVELOPE_STATUS, envelopeStatusBadge,
} from '../lib/esignData';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const { label, color } = envelopeStatusBadge(status);
  const cls = {
    gray:   'bg-gray-100 text-gray-600',
    blue:   'bg-blue-100 text-blue-700',
    amber:  'bg-amber-100 text-amber-700',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
  }[color] ?? 'bg-gray-100 text-gray-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

// ── Send modal (5-step) ────────────────────────────────────────────────────────

function SendModal({ templates, onClose, onSent }) {
  const [step, setStep] = useState(1);  // 1=template, 2=recipients, 3=tokens, 4=review, 5=sending
  const [templateId, setTemplateId] = useState('');
  const [docName, setDocName]       = useState('');
  const [recipients, setRecipients] = useState([{ email: '', firstName: '', lastName: '', role: '' }]);
  const [tokens, setTokens]         = useState([]);
  const [error, setError]           = useState('');
  const [sending, setSending]       = useState(false);

  const selectedTemplate = templates.find(t => t.id === templateId);

  // When template changes, pre-populate role and token fields from schema
  useEffect(() => {
    if (!selectedTemplate) return;
    const roles  = selectedTemplate.roles  ?? [];
    const toks   = selectedTemplate.tokens ?? [];
    setRecipients(
      roles.length
        ? roles.map(r => ({ email: '', firstName: '', lastName: '', role: r.role }))
        : [{ email: '', firstName: '', lastName: '', role: '' }]
    );
    setTokens(toks.map(t => ({ name: t.name, value: '' })));
  }, [templateId]);

  function addRecipient() {
    setRecipients(r => [...r, { email: '', firstName: '', lastName: '', role: '' }]);
  }

  function removeRecipient(i) {
    setRecipients(r => r.filter((_, idx) => idx !== i));
  }

  function updateRecipient(i, field, value) {
    setRecipients(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  function updateToken(i, value) {
    setTokens(t => t.map((tok, idx) => idx === i ? { ...tok, value } : tok));
  }

  async function handleSend() {
    setError('');
    setSending(true);
    try {
      await sendEnvelope({
        templateId,
        name: docName,
        recipients,
        tokens: tokens.filter(t => t.value.trim()),
      });
      onSent?.();
      onClose();
    } catch (e) {
      setError(e.message);
      setSending(false);
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Send for Signature</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: Template + Name */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inputCls}>
                  <option value="">Select a template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
                <input
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder="e.g. Purchase Agreement — Smith"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {/* Step 2: Recipients */}
          {step === 2 && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Recipients</label>
              {recipients.map((r, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">{r.role || `Recipient ${i + 1}`}</span>
                    {recipients.length > 1 && !selectedTemplate?.roles?.length && (
                      <button onClick={() => removeRecipient(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={r.firstName} onChange={e => updateRecipient(i, 'firstName', e.target.value)}
                      placeholder="First name" className={inputCls} />
                    <input value={r.lastName} onChange={e => updateRecipient(i, 'lastName', e.target.value)}
                      placeholder="Last name" className={inputCls} />
                  </div>
                  <input value={r.email} onChange={e => updateRecipient(i, 'email', e.target.value)}
                    placeholder="Email address" type="email" className={inputCls} />
                  {!selectedTemplate?.roles?.length && (
                    <input value={r.role} onChange={e => updateRecipient(i, 'role', e.target.value)}
                      placeholder="Role (e.g. Signer, Buyer)" className={inputCls} />
                  )}
                </div>
              ))}
              {!selectedTemplate?.roles?.length && (
                <button onClick={addRecipient} className="text-sm text-accent hover:underline flex items-center gap-1">
                  <Plus size={14} /> Add recipient
                </button>
              )}
              {tokens.length > 0 && (
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Fill in Fields</label>
                  {tokens.map((t, i) => (
                    <div key={i}>
                      <label className="block text-xs text-gray-500 mb-1">{t.name}</label>
                      <input value={t.value} onChange={e => updateToken(i, e.target.value)}
                        placeholder={t.name} className={inputCls} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">{docName}</p>
                <p className="text-xs text-gray-500">Template: {selectedTemplate?.name}</p>
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-600 mb-1">Recipients:</p>
                  {recipients.map((r, i) => (
                    <p key={i} className="text-xs text-gray-500">
                      {r.firstName} {r.lastName} &lt;{r.email}&gt;{r.role ? ` — ${r.role}` : ''}
                    </p>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500">The document will be sent immediately via PandaDoc.</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100">
          <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="text-sm text-gray-500 hover:text-gray-700">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => { setError(''); setStep(s => s + 1); }}
              disabled={step === 1 ? !templateId || !docName.trim() : recipients.some(r => !r.email.trim())}
              className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-accent/90 disabled:opacity-40"
            >
              Next →
            </button>
          ) : (
            <button onClick={handleSend} disabled={sending}
              className="bg-accent text-white text-sm px-4 py-2 rounded-lg hover:bg-accent/90 disabled:opacity-40 flex items-center gap-2">
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending…' : 'Send Document'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Void confirmation dialog ─────────────────────────────────────────────────

function VoidConfirm({ onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Void this document?</h3>
        <p className="text-sm text-gray-500 mb-5">This will cancel the document in PandaDoc and cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-40 flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Void Document
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ESign() {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const orgId = profile?.active_organization_id;

  const [connection, setConnection] = useState(null);
  const [templates, setTemplates]   = useState([]);
  const [envelopes, setEnvelopes]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showSend, setShowSend]     = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);  // envelopeId to void
  const [voiding, setVoiding]       = useState(false);
  const [reminding, setReminding]   = useState(null);  // envelopeId being reminded

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [conn, envs, tmpls] = await Promise.all([
        fetchEsignConnection(orgId),
        fetchEnvelopes(orgId),
        fetchEsignTemplates(orgId),
      ]);
      setConnection(conn);
      setEnvelopes(envs);
      setTemplates(tmpls);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Handle OAuth callback: /esign?code=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || connection !== null) return;
    // Exchange code for tokens
    (async () => {
      try {
        await exchangePandaDocCode(code);
        // Clean up URL
        window.history.replaceState({}, '', '/esign');
        await load();
      } catch (e) {
        console.error('PandaDoc OAuth exchange failed:', e);
      }
    })();
  }, []);  // run once on mount

  async function handleConnect() {
    setConnecting(true);
    try {
      const url = await getPandaDocAuthUrl();
      window.location.href = url;
    } catch (e) {
      console.error('PandaDoc connect error:', e);
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect PandaDoc? Existing envelopes will remain.')) return;
    await disconnectEsign();
    setConnection(null);
    setTemplates([]);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await syncEsignTemplates();
      const tmpls = await fetchEsignTemplates(orgId);
      setTemplates(tmpls);
    } finally {
      setSyncing(false);
    }
  }

  async function handleVoidConfirm() {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await voidEnvelope(voidTarget);
      setEnvelopes(e => e.map(env => env.id === voidTarget ? { ...env, status: 'voided' } : env));
      setVoidTarget(null);
    } finally {
      setVoiding(false);
    }
  }

  async function handleRemind(envelopeId) {
    setReminding(envelopeId);
    try {
      await sendReminder(envelopeId);
    } finally {
      setReminding(null);
    }
  }

  const recipientStatusColor = (s) => ({
    signed:   'text-green-600',
    declined: 'text-red-500',
    viewed:   'text-amber-600',
    sent:     'text-blue-500',
  }[s] ?? 'text-gray-400');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSignature size={24} className="text-accent" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">E-Sign</h1>
            <p className="text-sm text-gray-500">Send and track PandaDoc documents</p>
          </div>
        </div>
        {connection && can('esign.send') && (
          <button onClick={() => setShowSend(true)}
            className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-sm hover:bg-accent/90">
            <Plus size={16} /> Send Document
          </button>
        )}
      </div>

      {/* Connection banner */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${connection ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
        {connection ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Link2 size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">PandaDoc connected</p>
                <p className="text-xs text-green-600">{connection.auth_method === 'api_key' ? 'API key' : 'OAuth'} · {templates.length} template{templates.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {can('esign.template_manage') && (
                <button onClick={handleSync} disabled={syncing}
                  className="flex items-center gap-1.5 text-sm text-green-700 border border-green-300 bg-white px-3 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50">
                  {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Sync Templates
                </button>
              )}
              {can('esign.provider_connect') && (
                <button onClick={handleDisconnect}
                  className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  <Link2Off size={13} /> Disconnect
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <FileSignature size={16} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">PandaDoc not connected</p>
                <p className="text-xs text-gray-500">Connect to send and track e-signature documents</p>
              </div>
            </div>
            {can('esign.provider_connect') && (
              <button onClick={handleConnect} disabled={connecting}
                className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-xl text-sm hover:bg-accent/90 disabled:opacity-50">
                {connecting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Connect PandaDoc
              </button>
            )}
          </>
        )}
      </div>

      {/* Envelope list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText size={16} /> Documents
          </h2>
          <span className="text-xs text-gray-400">{envelopes.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : envelopes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <FileSignature size={32} />
            <p className="text-sm">No documents yet</p>
            {connection && can('esign.send') && (
              <button onClick={() => setShowSend(true)} className="text-xs text-accent hover:underline mt-1">
                Send your first document
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {envelopes.map(env => {
              const canVoid = ['sent', 'partially_signed', 'draft'].includes(env.status) && can('esign.void_envelope');
              const canRemind = ['sent', 'partially_signed'].includes(env.status) && can('esign.send');
              return (
                <li key={env.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText size={18} className="text-gray-300 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-gray-900 truncate">{env.name}</p>
                        <StatusBadge status={env.status} />
                      </div>
                      {env.esign_templates?.name && (
                        <p className="text-xs text-gray-400 mt-0.5">{env.esign_templates.name}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(env.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {env.esign_recipients?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <Users size={11} className="text-gray-300" />
                          {env.esign_recipients.map(r => (
                            <span key={r.id} className={`text-xs ${recipientStatusColor(r.status)}`}>
                              {r.name || r.email}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {env.pandadoc_doc_id && (
                      <a href={`https://app.pandadoc.com/document/${env.pandadoc_doc_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 p-1 rounded" title="Open in PandaDoc">
                        <ExternalLink size={15} />
                      </a>
                    )}
                    {canRemind && (
                      <button onClick={() => handleRemind(env.id)} disabled={reminding === env.id}
                        className="text-gray-400 hover:text-blue-500 p-1 rounded disabled:opacity-40" title="Send reminder">
                        {reminding === env.id ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
                      </button>
                    )}
                    {canVoid && (
                      <button onClick={() => setVoidTarget(env.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded" title="Void document">
                        <XCircle size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showSend && (
        <SendModal
          templates={templates}
          onClose={() => setShowSend(false)}
          onSent={load}
        />
      )}

      {voidTarget && (
        <VoidConfirm
          onConfirm={handleVoidConfirm}
          onCancel={() => setVoidTarget(null)}
          loading={voiding}
        />
      )}
    </div>
  );
}
