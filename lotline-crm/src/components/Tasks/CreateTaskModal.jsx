import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createTask, TASK_PRIORITIES } from '../../lib/tasksData';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function CreateTaskModal({ onClose, onCreated, defaultContactId, defaultDealId }) {
  const { activeOrgId, profile } = useAuth();
  const [form, setForm] = useState({
    title:           '',
    description:     '',
    priority:        'medium',
    due_date:        '',
    contact_id:      defaultContactId || '',
    deal_id:         defaultDealId    || '',
    assigned_to:     '',
    assigned_to_name: '',
  });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [members,  setMembers]  = useState([]);
  const sessionRef = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Load team members for the Assign To dropdown
  useEffect(() => {
    if (!activeOrgId || !supabase) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      sessionRef.current = session;
      const token = session?.access_token;

      if (token) {
        try {
          const res = await fetch('/api/team/members', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { members: raw } = await res.json();
            const list = (raw || [])
              .filter(m => m.status === 'active')
              .map(m => ({
                id:   m.user_id,
                name: m.profiles?.name
                      || [m.profiles?.first_name, m.profiles?.last_name].filter(Boolean).join(' ')
                      || m.profiles?.email?.split('@')[0]
                      || 'Team member',
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            setMembers(list);
            return;
          }
        } catch {
          // fall through
        }
      }

      // Supabase fallback
      const { data: mems } = await supabase
        .from('memberships')
        .select('user_id, role')
        .eq('organization_id', activeOrgId)
        .eq('status', 'active');

      if (!mems?.length) return;
      const ids = mems.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name')
        .in('id', ids);

      setMembers(
        (profiles || [])
          .map(p => ({
            id:   p.id,
            name: p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Team member',
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    })();
  }, [activeOrgId]);

  const handleAssign = (userId) => {
    if (!userId) {
      set('assigned_to', '');
      set('assigned_to_name', '');
    } else {
      const m = members.find(m => m.id === userId);
      setForm(p => ({ ...p, assigned_to: userId, assigned_to_name: m?.name || '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError('');
    const { data, error: err } = await createTask(activeOrgId, profile?.id, {
      ...form,
      due_date:   form.due_date   || null,
      contact_id: form.contact_id || null,
      deal_id:    form.deal_id    || null,
      assigned_to: form.assigned_to || null,
    });
    setSaving(false);
    if (err) { setError(err.message || 'Failed to create task.'); return; }
    onCreated?.(data, form.assigned_to_name || null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">New Task</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              autoFocus
              placeholder="Task title…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Optional details…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Assign To</label>
            <div className="flex items-center gap-2">
              {form.assigned_to && (
                <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-[11px] font-bold text-accent flex-shrink-0">
                  {getInitials(form.assigned_to_name)}
                </div>
              )}
              <select
                value={form.assigned_to}
                onChange={e => handleAssign(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white capitalize"
              >
                {TASK_PRIORITIES.map(p => (
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#c9703a' }}>
              {saving ? 'Creating…' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
