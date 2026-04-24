/**
 * WorkflowBuilder.jsx
 * Phase 11: Visual workflow builder using @xyflow/react.
 * Features: drag-drop nodes, if/else branches, delay nodes,
 * step config panel, test-run with per-step output, run history.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save, Play, Pause, ChevronLeft, Plus, Loader2, X,
  CheckCircle2, AlertCircle, Clock, Zap, Settings,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchWorkflow, updateWorkflow, upsertWorkflowSteps,
  runWorkflow, fetchRuns, fetchRunDetail,
  TRIGGER_TYPES, STEP_TYPES,
} from '../lib/workflowsData';

// ── Custom node component ────────────────────────────────────────────────────

function WorkflowNode({ data, selected }) {
  const stepType = STEP_TYPES.find(s => s.value === data.type);
  const isTrigger = data.type === '__trigger__';

  return (
    <div
      className={`min-w-[180px] rounded-xl border-2 transition-all cursor-pointer shadow-sm ${
        selected ? 'border-accent shadow-lg shadow-accent/10' : 'border-gray-200 hover:border-gray-300'
      } ${isTrigger ? 'bg-orange-50' : 'bg-white'}`}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="text-lg flex-shrink-0">
          {isTrigger ? '⚡' : (stepType?.icon || '⚙')}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-700 truncate">
            {data.label || (isTrigger ? 'Trigger' : stepType?.label || data.type)}
          </p>
          {data.sublabel && (
            <p className="text-[10px] text-gray-400 truncate mt-0.5">{data.sublabel}</p>
          )}
        </div>
      </div>
      {data.type === 'branch' && (
        <div className="flex border-t border-gray-100">
          <div className="flex-1 text-center py-1 text-[10px] font-semibold text-green-600 border-r border-gray-100">YES</div>
          <div className="flex-1 text-center py-1 text-[10px] font-semibold text-red-500">NO</div>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { workflowNode: WorkflowNode };

// ── Step config panel ─────────────────────────────────────────────────────────

function StepConfigPanel({ node, onUpdate, onDelete, onClose }) {
  const stepType = STEP_TYPES.find(s => s.value === node.data.type);
  const [config, setConfig] = useState(node.data.config || {});
  const [label,  setLabel]  = useState(node.data.label || '');

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  const handleSave = () => {
    onUpdate(node.id, { config, label });
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">{node.data.type === '__trigger__' ? '⚡' : stepType?.icon}</span>
          <p className="text-sm font-semibold text-gray-700">
            {node.data.type === '__trigger__' ? 'Trigger' : stepType?.label}
          </p>
        </div>
        <div className="flex gap-1">
          {node.data.type !== '__trigger__' && (
            <button onClick={() => onDelete(node.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500">
              <X size={14} />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Label <span className="font-normal text-gray-300">(optional)</span></label>
          <input value={label} onChange={e => setLabel(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Describe this step…" />
        </div>

        {/* Type-specific fields */}
        {(node.data.type === 'send_email') && <>
          <ConfigField label="Subject" value={config.subject} onChange={v => set('subject', v)} placeholder="Subject line {{contact_name}}" />
          <ConfigTextarea label="Body" value={config.body} onChange={v => set('body', v)} placeholder="Hi {{contact_name}}, …" rows={4} />
        </>}

        {(node.data.type === 'send_sms') && <>
          <ConfigTextarea label="Message" value={config.message} onChange={v => set('message', v)} placeholder="Hi {{contact_name}}, …" rows={3} />
        </>}

        {(node.data.type === 'create_task') && <>
          <ConfigField label="Task title" value={config.title} onChange={v => set('title', v)} placeholder="Follow up with {{contact_name}}" />
          <ConfigField label="Due in (days)" type="number" value={config.due_in_days} onChange={v => set('due_in_days', v)} placeholder="3" />
          <ConfigSelect label="Priority" value={config.priority || 'medium'} onChange={v => set('priority', v)}
            options={[{v:'low',l:'Low'},{v:'medium',l:'Medium'},{v:'high',l:'High'}]} />
        </>}

        {(node.data.type === 'add_tag' || node.data.type === 'remove_tag') && <>
          <ConfigField label="Tag" value={config.tag} onChange={v => set('tag', v)} placeholder="hot-lead" />
        </>}

        {(node.data.type === 'wait') && <>
          <ConfigField label="Delay (minutes)" type="number" value={config.delay_minutes} onChange={v => set('delay_minutes', v)} placeholder="1440 (= 1 day)" />
        </>}

        {(node.data.type === 'webhook') && <>
          <ConfigField label="URL" value={config.url} onChange={v => set('url', v)} placeholder="https://…" />
          <ConfigSelect label="Method" value={config.method || 'POST'} onChange={v => set('method', v)}
            options={[{v:'POST',l:'POST'},{v:'GET',l:'GET'},{v:'PUT',l:'PUT'}]} />
        </>}

        {(node.data.type === 'assign_owner') && <>
          <ConfigField label="User ID" value={config.user_id} onChange={v => set('user_id', v)} placeholder="User UUID" />
        </>}

        {(node.data.type === 'update_field') && <>
          <ConfigField label="Field name" value={config.field} onChange={v => set('field', v)} placeholder="stage" />
          <ConfigField label="Value" value={config.value} onChange={v => set('value', v)} placeholder="Closed Won" />
        </>}

        {(node.data.type === 'branch') && <>
          <ConfigField label="Field" value={config.field} onChange={v => set('field', v)} placeholder="stage" />
          <ConfigSelect label="Operator" value={config.operator || 'eq'} onChange={v => set('operator', v)}
            options={[
              {v:'eq',l:'equals'},{v:'neq',l:'not equals'},
              {v:'contains',l:'contains'},{v:'gt',l:'greater than'},
              {v:'lt',l:'less than'},{v:'is_set',l:'is set'},
            ]} />
          {config.operator !== 'is_set' && (
            <ConfigField label="Value" value={config.value} onChange={v => set('value', v)} placeholder="New Lead" />
          )}
        </>}
      </div>

      <div className="p-4 border-t border-gray-100">
        <button onClick={handleSave} className="w-full py-2 text-sm font-semibold text-white rounded-xl" style={{ backgroundColor: '#c9703a' }}>
          Apply
        </button>
      </div>
    </div>
  );
}

function ConfigField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
    </div>
  );
}
function ConfigTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows}
        placeholder={placeholder} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
    </div>
  );
}
function ConfigSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ── Add-step menu ─────────────────────────────────────────────────────────────

function AddStepMenu({ onAdd, onClose }) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-64 p-2" onClick={e => e.stopPropagation()}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">Add Step</p>
      {STEP_TYPES.map(t => (
        <button key={t.value} onClick={() => { onAdd(t.value); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left">
          <span>{t.icon}</span>
          <span className="font-medium">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Run history panel ─────────────────────────────────────────────────────────

function RunHistoryPanel({ workflowId, onClose }) {
  const [runs,       setRuns]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState(null);
  const [runDetail,  setRunDetail]  = useState(null);

  useEffect(() => {
    fetchRuns(workflowId).then(d => { setRuns(d); setLoading(false); });
  }, [workflowId]);

  const loadDetail = async (id) => {
    setSelected(id);
    const d = await fetchRunDetail(id);
    setRunDetail(d);
  };

  const statusIcon = (s) => ({
    completed: <CheckCircle2 size={13} className="text-green-500" />,
    failed:    <AlertCircle  size={13} className="text-red-500"   />,
    running:   <Loader2      size={13} className="animate-spin text-blue-500" />,
    cancelled: <X            size={13} className="text-gray-400"  />,
  }[s] || null);

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-80 flex flex-col max-h-[80vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">Run History</p>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No runs yet</p>
        ) : runs.map(run => (
          <div key={run.id}>
            <button
              onClick={() => loadDetail(run.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${selected === run.id ? 'bg-gray-50' : ''}`}
            >
              {statusIcon(run.status)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{run.trigger_event}</p>
                <p className="text-[10px] text-gray-400">{new Date(run.started_at).toLocaleString()}</p>
              </div>
            </button>
            {selected === run.id && runDetail && (
              <div className="px-4 pb-3 space-y-1.5 bg-gray-50/50">
                {runDetail.step_runs?.map((sr, i) => (
                  <div key={sr.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5">{statusIcon(sr.status)}</span>
                    <div>
                      <p className="font-medium text-gray-600">Step {i + 1}: {sr.status}</p>
                      {sr.output && <pre className="text-[10px] text-gray-400 font-mono mt-0.5 whitespace-pre-wrap">{JSON.stringify(sr.output, null, 2)}</pre>}
                      {sr.error && <p className="text-red-500 text-[10px] mt-0.5">{sr.error}</p>}
                    </div>
                  </div>
                ))}
                {run.error && <p className="text-xs text-red-500 mt-1">{run.error}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepsToFlow(steps, triggerType) {
  const nodes = [];
  const edges = [];
  let yOffset = 0;

  // Trigger node
  const triggerInfo = TRIGGER_TYPES.find(t => t.value === triggerType);
  nodes.push({
    id:   '__trigger__',
    type: 'workflowNode',
    position: { x: 200, y: 0 },
    data: { type: '__trigger__', label: triggerInfo?.label || 'Trigger', config: {} },
  });
  yOffset = 120;

  let lastId = '__trigger__';
  for (const s of steps) {
    const stepType = STEP_TYPES.find(t => t.value === s.type);
    nodes.push({
      id:       s.id,
      type:     'workflowNode',
      position: s.position_x !== undefined ? { x: s.position_x, y: s.position_y } : { x: 200, y: yOffset },
      data:     {
        type:     s.type,
        label:    s.config?.label || stepType?.label || s.type,
        sublabel: configSublabel(s),
        config:   s.config || {},
        parent_step_id: s.parent_step_id,
        branch_label:   s.branch_label,
      },
    });

    const sourceId = s.parent_step_id || lastId;
    edges.push({
      id:         `e-${sourceId}-${s.id}`,
      source:     sourceId,
      target:     s.id,
      label:      s.branch_label || undefined,
      labelStyle: { fontSize: 10, fill: s.branch_label === 'yes' ? '#22c55e' : s.branch_label === 'no' ? '#ef4444' : '#6b7280' },
      markerEnd:  { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#d1d5db' },
      style:      { stroke: '#d1d5db', strokeWidth: 1.5 },
    });

    yOffset += 120;
    if (!s.parent_step_id) lastId = s.id;
  }

  return { nodes, edges };
}

function configSublabel(step) {
  const c = step.config || {};
  switch (step.type) {
    case 'send_email':   return c.subject ? `"${c.subject}"` : null;
    case 'send_sms':     return c.message ? c.message.slice(0, 40) : null;
    case 'create_task':  return c.title || null;
    case 'add_tag':
    case 'remove_tag':   return c.tag ? `#${c.tag}` : null;
    case 'wait':         return c.delay_minutes ? `${c.delay_minutes}m` : null;
    case 'branch':       return c.field ? `${c.field} ${c.operator} ${c.value || ''}` : null;
    case 'webhook':      return c.url || null;
    default:             return null;
  }
}

function flowToSteps(nodes, edges) {
  return nodes
    .filter(n => n.id !== '__trigger__')
    .map((n, i) => {
      const incomingEdge = edges.find(e => e.target === n.id);
      const parentId = incomingEdge?.source === '__trigger__' ? null : incomingEdge?.source;
      return {
        id:             n.id,
        type:           n.data.type,
        config:         n.data.config || {},
        sequence:       i,
        parent_step_id: parentId || null,
        branch_label:   incomingEdge?.label || null,
        position_x:     n.position.x,
        position_y:     n.position.y,
      };
    });
}

let nodeIdCounter = 1000;
function newNodeId() { return `step-${++nodeIdCounter}`; }

// ── Main builder ──────────────────────────────────────────────────────────────

export default function WorkflowBuilder() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { can }      = usePermissions();
  const [workflow,   setWorkflow]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [running,    setRunning]    = useState(false);
  const [nodes,      setNodes,      onNodesChange] = useNodesState([]);
  const [edges,      setEdges,      onEdgesChange] = useEdgesState([]);
  const [selNode,    setSelNode]    = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toast,      setToast]     = useState(null);
  const addMenuRef = useRef(null);

  useEffect(() => {
    fetchWorkflow(id).then(wf => {
      if (!wf) { navigate('/workflows'); return; }
      setWorkflow(wf);
      const { nodes: n, edges: e } = stepsToFlow(wf.steps || [], wf.trigger_type);
      setNodes(n);
      setEdges(e);
      setLoading(false);
    });
  }, [id]);

  const onConnect = useCallback((params) =>
    setEdges(eds => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#d1d5db' }, style: { stroke: '#d1d5db', strokeWidth: 1.5 } }, eds)),
  []);

  const onNodeClick = useCallback((_, node) => setSelNode(node), []);

  const handleSave = async () => {
    if (!can('workflow.manage')) return;
    setSaving(true);
    const steps = flowToSteps(nodes, edges);
    await upsertWorkflowSteps(id, steps);
    showToast('Saved');
    setSaving(false);
  };

  const handleRun = async () => {
    if (!can('workflow.run')) return;
    setRunning(true);
    const { status } = await runWorkflow(id, 'manual', { manual: true }, {});
    setRunning(false);
    showToast(status === 'completed' ? 'Run completed' : 'Run failed', status === 'completed' ? 'success' : 'error');
  };

  const handleToggleStatus = async () => {
    if (!can('workflow.publish')) return;
    const next = workflow.status === 'active' ? 'paused' : 'active';
    const { data } = await updateWorkflow(id, { status: next });
    if (data) setWorkflow(data);
  };

  const handleAddStep = (type) => {
    const newId = newNodeId();
    const stepType = STEP_TYPES.find(s => s.value === type);
    const lastNode = nodes[nodes.length - 1];
    const pos = lastNode
      ? { x: lastNode.position.x, y: lastNode.position.y + 120 }
      : { x: 200, y: 120 };

    setNodes(prev => [...prev, {
      id:   newId,
      type: 'workflowNode',
      position: pos,
      data: { type, label: stepType?.label || type, config: {} },
    }]);

    // Auto-connect from last node
    const lastId = lastNode?.id || '__trigger__';
    setEdges(prev => [...prev, {
      id:        `e-${lastId}-${newId}`,
      source:    lastId,
      target:    newId,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#d1d5db' },
      style:     { stroke: '#d1d5db', strokeWidth: 1.5 },
    }]);
  };

  const handleUpdateNode = (nodeId, patch) => {
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n;
      const stepType = STEP_TYPES.find(s => s.value === n.data.type);
      return {
        ...n,
        data: {
          ...n.data,
          ...patch,
          label:    patch.label || n.data.label,
          sublabel: configSublabel({ type: n.data.type, config: patch.config || n.data.config }),
        },
      };
    }));
    setSelNode(null);
  };

  const handleDeleteNode = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelNode(null);
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={24} className="animate-spin text-gray-300" />
    </div>
  );

  const statusColor = { draft: '#94a3b8', active: '#22c55e', paused: '#f59e0b' }[workflow?.status] || '#94a3b8';

  return (
    <div className="flex flex-col h-full -m-4 md:-m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap gap-y-2">
        <button onClick={() => navigate('/workflows')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-gray-800 truncate">{workflow?.name}</h1>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
            <span className="text-xs text-gray-400 capitalize">{workflow?.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHistory(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${showHistory ? 'border-accent text-accent bg-accent/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Clock size={13} /> History
          </button>

          {can('workflow.publish') && (
            <button
              onClick={handleToggleStatus}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                workflow?.status === 'active'
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {workflow?.status === 'active' ? <><span>⏸</span> Pause</> : <><span>▶</span> Activate</>}
            </button>
          )}

          {can('workflow.run') && (
            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Test Run
            </button>
          )}

          {can('workflow.manage') && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ backgroundColor: '#c9703a' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={() => { setSelNode(null); setShowAddMenu(false); }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
          <MiniMap nodeColor="#c9703a" style={{ background: '#f9fafb' }} />

          {/* Add step button */}
          {can('workflow.manage') && (
            <Panel position="bottom-center">
              <div className="relative" ref={addMenuRef}>
                <button
                  onClick={() => setShowAddMenu(v => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg"
                  style={{ backgroundColor: '#c9703a' }}
                >
                  <Plus size={15} /> Add Step
                </button>
                {showAddMenu && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10">
                    <AddStepMenu onAdd={handleAddStep} onClose={() => setShowAddMenu(false)} />
                  </div>
                )}
              </div>
            </Panel>
          )}
        </ReactFlow>

        {/* Config panel overlay */}
        {selNode && (
          <div className="absolute top-4 right-4 z-10">
            <StepConfigPanel
              node={selNode}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              onClose={() => setSelNode(null)}
            />
          </div>
        )}

        {/* Run history overlay */}
        {showHistory && (
          <div className="absolute top-4 left-4 z-10">
            <RunHistoryPanel workflowId={id} onClose={() => setShowHistory(false)} />
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
