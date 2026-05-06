import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { CheckSquare, Plus, Check, Trash2, Circle, CircleDot, Ban, AlertCircle, Calendar, User } from 'lucide-react';
import {
  fetchTasks, updateTask, deleteTask,
  TASK_STATUSES, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS,
} from '../lib/tasksData';
import CreateTaskModal from '../components/Tasks/CreateTaskModal';
import { usePermissions } from '../hooks/usePermissions';

const PRIORITY_BADGE = {
  low:    'Low',
  medium: 'Med',
  high:   'High',
  urgent: 'Urgent',
};

const STATUS_ICON = {
  todo:        Circle,
  in_progress: CircleDot,
  done:        Check,
  cancelled:   Ban,
};

function dueDateLabel(d) {
  if (!d) return null;
  const today  = new Date(); today.setHours(0,0,0,0);
  const due    = new Date(d + 'T00:00:00');
  const diff   = Math.round((due - today) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: 'text-red-500' };
  if (diff === 0) return { label: 'Due today',    color: 'text-orange-500' };
  if (diff === 1) return { label: 'Due tomorrow', color: 'text-amber-500' };
  return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-gray-400' };
}

function TaskRow({ task, onStatusChange, onDelete, canEdit }) {
  const StatusIcon = STATUS_ICON[task.status] || Circle;
  const due = dueDateLabel(task.due_date);
  const isDone = task.status === 'done';

  const cycleStatus = () => {
    if (!canEdit) return;
    const next = { todo: 'in_progress', in_progress: 'done', done: 'todo', cancelled: 'todo' };
    onStatusChange(task.id, next[task.status] || 'todo');
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 group transition-colors ${isDone ? 'opacity-50' : ''}`}>
      <button
        onClick={cycleStatus}
        disabled={!canEdit}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          isDone ? 'bg-green-500 border-green-500 text-white' :
          task.status === 'in_progress' ? 'border-blue-400 text-blue-400' :
          task.status === 'cancelled' ? 'border-gray-300 text-gray-300' :
          'border-gray-300 hover:border-accent text-gray-300'
        } ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
        title={canEdit ? 'Click to advance status' : undefined}
      >
        <StatusIcon size={10} />
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-gray-800 truncate ${isDone ? 'line-through' : ''}`}>{task.title}</p>
        {task.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Priority */}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORITY_COLORS[task.priority]}`}>
          {PRIORITY_BADGE[task.priority]}
        </span>

        {/* Due date */}
        {due && (
          <span className={`text-xs flex items-center gap-1 ${due.color}`}>
            <Calendar size={11} />{due.label}
          </span>
        )}

        {/* Status badge */}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>

        {/* Delete */}
        {canEdit && (
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { can } = usePermissions();
  const canEdit = can('contact.create'); // reuse operator+ permission

  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  // Keyboard shortcut T
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'T' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShowCreate(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchTasks({
      status:   filterStatus   || undefined,
    });
    setTasks(data);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  // Real-time: re-fetch whenever any task changes so all users stay in sync
  const instanceId = useRef(Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel(`tasks-page-${instanceId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        load();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load]);

  const handleStatusChange = async (id, status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    await updateTask(id, { status });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    await deleteTask(id);
  };

  // Client-side priority filter
  const visible = filterPriority
    ? tasks.filter(t => t.priority === filterPriority)
    : tasks;

  const counts = TASK_STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckSquare size={20} className="text-accent" />
          <div>
            <h1 className="text-lg font-bold text-gray-800">Tasks</h1>
            <p className="text-xs text-gray-400">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
            style={{ backgroundColor: '#c9703a' }}
            title="New Task (T)"
          >
            <Plus size={15} />
            New Task
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6">
        {TASK_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
              filterStatus === s ? 'bg-accent/10 text-accent' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              s === 'todo' ? 'bg-gray-300' :
              s === 'in_progress' ? 'bg-blue-400' :
              s === 'done' ? 'bg-green-400' : 'bg-gray-200'
            }`} />
            {STATUS_LABELS[s]}
            <span className="ml-0.5 font-bold">{counts[s]}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Priority:</span>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none capitalize"
          >
            <option value="">All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckSquare size={40} className="text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">No tasks yet</p>
            {canEdit && (
              <button onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 text-sm font-semibold text-white rounded-xl"
                style={{ backgroundColor: '#c9703a' }}>
                Create your first task
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {visible.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={(t) => { setShowCreate(false); setTasks(prev => [t, ...prev]); }}
        />
      )}
    </div>
  );
}
