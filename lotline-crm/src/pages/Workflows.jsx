/**
 * Workflows.jsx
 * Phase 11: Workflow / Automation list page.
 * Shows all org workflows with status, trigger, run count, and last run.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Pause, Trash2, Loader2, Zap, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchWorkflows, createWorkflow, updateWorkflow, deleteWorkflow,
  TRIGGER_TYPES, runWorkflow,
} from '../lib/workflowsData';

const STATUS_STYLES = {
  draft:   { cls: 'bg-gray-100 text-gray-600',   label: 'Draft' },
  active:  { cls: 'bg-green-50 text-green-700',   label: 'Active' },
  paused:  { cls: 'bg-amber-50 text-amber-700',   label: 'Paused' },
};

function timeAgo(iso) {
  if (!iso) return 'Never';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function NewWorkflowModal({ orgId, userId, onCreated, onClose }) {
  const [name,        setName]        = useState('');
  const [trigger,     setTrigger]     = useState('manual');
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await createWorkflow(orgId, userId, {
      name: name.trim(), description, trigger_type: trigger,
    });
    setSaving(false);
    if (!error && data) onCreated(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">New Workflow</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Workflow name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Welcome new leads"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Trigger</label>
            <select
              value={trigger}
              onChange={e => setTrigger(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {TRIGGER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description <span className="text-gray-300 font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this automation do?"
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!name.trim() || saving}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-40"
              style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Creating…' : 'Create Workflow'}
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

export default function Workflows() {
  const { activeOrgId, profile } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showNew,   setShowNew]   = useState(false);
  const [running,   setRunning]   = useState({}); // id → true

  useEffect(() => {
    if (!activeOrgId) return;
    fetchWorkflows(activeOrgId).then(d => { setWorkflows(d); setLoading(false); });
  }, [activeOrgId]);

  const handleCreated = (wf) => {
    setWorkflows(prev => [wf, ...prev]);
    setShowNew(false);
    navigate(`/workflows/${wf.id}`);
  };

  const toggleStatus = async (wf) => {
    if (!can('workflow.publish') && (wf.status === 'draft' || wf.status === 'paused')) return;
    const next = wf.status === 'active' ? 'paused' : 'active';
    await updateWorkflow(wf.id, { status: next });
    setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, status: next } : w));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workflow? All run history will also be deleted.')) return;
    await deleteWorkflow(id);
    setWorkflows(prev => prev.filter(w => w.id !== id));
  };

  const handleRun = async (wf) => {
    if (!can('workflow.run')) return;
    setRunning(r => ({ ...r, [wf.id]: true }));
    await runWorkflow(wf.id, 'manual', { manual: true }, { entity_type: null, entity_id: null });
    setRunning(r => ({ ...r, [wf.id]: false }));
    // Refresh run count
    fetchWorkflows(activeOrgId).then(setWorkflows);
  };

  const triggerLabel = (t) => TRIGGER_TYPES.find(x => x.value === t)?.label || t;
  const triggerIcon  = (t) => TRIGGER_TYPES.find(x => x.value === t)?.icon || '⚡';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Workflows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automate repetitive tasks and outreach</p>
        </div>
        {can('workflow.manage') && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl"
            style={{ backgroundColor: '#c9703a' }}
          >
            <Plus size={16} /> New Workflow
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
          <Zap size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-400">No workflows yet</p>
          <p className="text-sm text-gray-300 mt-1">Automate emails, tasks, tags and more — triggered by CRM events.</p>
          {can('workflow.manage') && (
            <button onClick={() => setShowNew(true)} className="mt-4 px-5 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#c9703a' }}>
              Create your first workflow
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map(wf => {
            const st = STATUS_STYLES[wf.status] || STATUS_STYLES.draft;
            return (
              <div
                key={wf.id}
                className="bg-white rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors group"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Status indicator */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wf.status === 'active' ? 'bg-green-400 animate-pulse' : wf.status === 'paused' ? 'bg-amber-400' : 'bg-gray-300'}`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/workflows/${wf.id}`)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{wf.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    {wf.description && <p className="text-xs text-gray-400 truncate mt-0.5">{wf.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">{triggerIcon(wf.trigger_type)} {triggerLabel(wf.trigger_type)}</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400">{wf.run_count} runs</span>
                      <span className="text-xs text-gray-300">•</span>
                      <span className="text-xs text-gray-400">Last run {timeAgo(wf.last_run_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {can('workflow.run') && wf.trigger_type === 'manual' && (
                      <button
                        onClick={() => handleRun(wf)}
                        disabled={running[wf.id]}
                        title="Run manually"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50"
                      >
                        {running[wf.id] ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                      </button>
                    )}
                    {can('workflow.publish') && (
                      <button
                        onClick={() => toggleStatus(wf)}
                        title={wf.status === 'active' ? 'Pause' : 'Activate'}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent transition-colors"
                      >
                        {wf.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                    )}
                    {can('workflow.manage') && (
                      <button
                        onClick={() => navigate(`/workflows/${wf.id}`)}
                        title="Edit"
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                      >
                        <ChevronRight size={15} />
                      </button>
                    )}
                    {can('workflow.manage') && (
                      <button
                        onClick={() => handleDelete(wf.id)}
                        title="Delete"
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewWorkflowModal
          orgId={activeOrgId}
          userId={profile?.id}
          onCreated={handleCreated}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
