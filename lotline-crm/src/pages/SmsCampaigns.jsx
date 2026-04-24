/**
 * SmsCampaigns.jsx
 * Phase 12: SMS campaign list + create/launch modal.
 * TCPA: opt-out footer appended, quiet-hours override disabled for campaigns,
 *       contacts list checked for opted-out numbers before sending.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Plus, Loader2, Megaphone, Trash2,
  Users, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchCampaigns, createCampaign, deleteCampaign, launchCampaign,
  fetchTemplates, CAMPAIGN_STATUS,
} from '../lib/smsData';
import { supabase } from '../lib/supabase';

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── New campaign modal ─────────────────────────────────────────────────────────
function NewCampaignModal({ orgId, userId, templates, onCreated, onClose }) {
  const [name, setName]               = useState('');
  const [body, setBody]               = useState('');
  const [templateId, setTemplateId]   = useState('');
  const [includeFooter, setFooter]    = useState(true);
  const [saving, setSaving]           = useState(false);
  const bodyLimit = 160 - (includeFooter ? '\n\nReply STOP to opt out.'.length : 0);

  const applyTemplate = (tid) => {
    setTemplateId(tid);
    if (tid) {
      const t = templates.find(t => t.id === tid);
      if (t) setBody(t.body);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setSaving(true);
    const { data, error } = await createCampaign(orgId, userId, {
      name: name.trim(), body: body.trim(),
      templateId: templateId || null,
      includeOptOutFooter: includeFooter,
    });
    setSaving(false);
    if (!error && data) onCreated(data);
  };

  const preview = body + (includeFooter ? '\n\nReply STOP to opt out.' : '');
  const charCount = preview.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">New SMS Campaign</h2>
          <p className="text-xs text-gray-400 mt-0.5">Broadcast a text message to a group of contacts.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Campaign name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. Fall Special Offer"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>

          {/* Template */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Use template <span className="text-gray-300 font-normal">(optional)</span></label>
              <select value={templateId} onChange={e => applyTemplate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">— Start from scratch —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Message body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</label>
              <span className={`text-[11px] ${charCount > 160 ? 'text-red-500' : 'text-gray-300'}`}>
                {charCount}/160 chars{charCount > 160 ? ' (multiple SMS)' : ''}
              </span>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} required rows={4}
              placeholder="Your message here… Use {{first_name}}, {{last_name}} for personalization."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          </div>

          {/* TCPA footer toggle */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <input type="checkbox" id="footer" checked={includeFooter} onChange={e => setFooter(e.target.checked)}
              className="mt-0.5 rounded border-amber-300 text-amber-500 focus:ring-amber-300" />
            <label htmlFor="footer" className="text-xs text-amber-700 cursor-pointer">
              <span className="font-semibold">Append TCPA opt-out footer</span> — Adds "Reply STOP to opt out."
              to every message. <strong>Required by US law for marketing SMS.</strong>
            </label>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Preview</label>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
              {preview || <span className="text-gray-300 italic">Your message will appear here…</span>}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!name.trim() || !body.trim() || saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Creating…' : 'Create Campaign'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Launch confirmation ────────────────────────────────────────────────────────
function LaunchModal({ campaign, orgId, onLaunched, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState(null);

  useEffect(() => {
    if (!supabase || !orgId) return;
    supabase.from('contacts').select('id, first_name, last_name, phone')
      .eq('organization_id', orgId)
      .not('phone', 'is', null)
      .then(({ data }) => { setContacts(data || []); setLoading(false); });
  }, [orgId]);

  const handleLaunch = async () => {
    setRunning(true);
    const res = await launchCampaign(orgId, campaign.id, contacts);
    setRunning(false);
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={!running ? onClose : undefined}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] p-6" onClick={e => e.stopPropagation()}>
        {result ? (
          <>
            <div className="text-center mb-5">
              <CheckCircle2 size={36} className="text-green-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-gray-800">Campaign sent!</h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[['Sent', result.sent, 'text-green-600'], ['Failed', result.failed, 'text-red-500'], ['Opted Out', result.optedOut, 'text-amber-500']].map(([l, v, cls]) => (
                <div key={l} className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className={`text-xl font-bold ${cls}`}>{v}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
            <button onClick={onLaunched} className="w-full py-2.5 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#c9703a' }}>Done</button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Launch "{campaign.name}"?</h2>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  This will send to <strong>{contacts.length}</strong> contacts with a phone number.
                  Opted-out numbers will be skipped automatically.
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 mb-4 flex items-start gap-2">
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  By launching you confirm this campaign complies with TCPA and CAN-SPAM regulations.
                  Only send to contacts who have opted in or have an existing business relationship.
                </div>
                <div className="flex gap-2">
                  <button onClick={handleLaunch} disabled={running}
                    className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: '#c9703a' }}>
                    {running ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />Sending…</span> : `Send to ${contacts.length} contacts`}
                  </button>
                  <button onClick={onClose} disabled={running}
                    className="flex-1 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SmsCampaigns() {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [campaigns, setCampaigns]   = useState([]);
  const [templates, setTemplates]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showNew, setShowNew]       = useState(false);
  const [launching, setLaunching]   = useState(null); // campaign to launch

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    Promise.all([fetchCampaigns(activeOrgId), fetchTemplates(activeOrgId)]).then(([c, t]) => {
      setCampaigns(c); setTemplates(t); setLoading(false);
    });
  }, [activeOrgId]);

  const handleCreated = (c) => {
    setCampaigns(prev => [c, ...prev]);
    setShowNew(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    await deleteCampaign(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const handleLaunched = () => {
    setLaunching(null);
    fetchCampaigns(activeOrgId).then(setCampaigns);
  };

  const canManage = can('sms.manage');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button onClick={() => navigate('/sms')} className="text-xs text-accent hover:underline">← Inbox</button>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">SMS Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Broadcast text messages to groups of contacts</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl"
            style={{ backgroundColor: '#c9703a' }}>
            <Plus size={16} /> New Campaign
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
          <Megaphone size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-400">No campaigns yet</p>
          <p className="text-sm text-gray-300 mt-1">Create a campaign to broadcast SMS to multiple contacts at once.</p>
          {canManage && (
            <button onClick={() => setShowNew(true)} className="mt-4 px-5 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#c9703a' }}>
              Create your first campaign
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          {campaigns.map(c => {
            const st = CAMPAIGN_STATUS[c.status] || CAMPAIGN_STATUS.draft;
            return (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 group hover:bg-gray-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Megaphone size={16} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{c.body}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-gray-400"><Users size={11} />{c.recipient_count} recipients</span>
                    {c.sent_count > 0 && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 size={11} />{c.sent_count} sent</span>}
                    {c.failed_count > 0 && <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={11} />{c.failed_count} failed</span>}
                    <span className="text-xs text-gray-300">{timeAgo(c.sent_at || c.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canManage && c.status === 'draft' && (
                    <button onClick={() => setLaunching(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
                      style={{ backgroundColor: '#c9703a' }}>
                      <Send size={11} /> Launch
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewCampaignModal
          orgId={activeOrgId} userId={profile?.id} templates={templates}
          onCreated={handleCreated} onClose={() => setShowNew(false)}
        />
      )}

      {launching && (
        <LaunchModal
          campaign={launching} orgId={activeOrgId}
          onLaunched={handleLaunched} onClose={() => setLaunching(null)}
        />
      )}
    </div>
  );
}
