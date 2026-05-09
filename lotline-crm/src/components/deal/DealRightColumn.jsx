/**
 * Right column of the HubSpot-style deal detail layout.
 * "Association" — loads real data for tasks, contacts, e-sign, capital stack, distributions.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCircle, FileText, CheckSquare, Scale,
  TrendingDown, ChevronDown, ChevronRight, Plus,
  ExternalLink, Circle, CheckCircle2, Clock, AlertCircle,
  Mail, Phone, MapPin, Upload, Trash2, Download, Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { fetchTasks, deleteTask } from '../../lib/tasksData';
import { fetchEnvelopes } from '../../lib/esignData';
import ImportantDates from './ImportantDates';
import { KeyContacts } from './DealLeftColumn';

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ icon: Icon, title, count, defaultOpen = false, children, onAdd, addLabel = 'Add' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center px-4 py-2.5">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Icon size={13} className="text-gray-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{title}</span>
          {count != null && count > 0 && (
            <span className="text-[10px] font-bold text-white bg-accent rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {count}
            </span>
          )}
          <span className="ml-auto">
            {open
              ? <ChevronDown size={13} className="text-gray-300" />
              : <ChevronRight size={13} className="text-gray-300" />
            }
          </span>
        </button>
        {onAdd && (
          <button
            onClick={e => { e.stopPropagation(); onAdd(); }}
            title={addLabel}
            className="ml-2 p-1 text-gray-400 hover:text-accent hover:bg-accent/5 rounded transition-colors flex-shrink-0"
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Task status icon ──────────────────────────────────────────────────────────
function TaskStatusIcon({ status }) {
  if (status === 'done')        return <CheckCircle2 size={13} className="text-green-500" />;
  if (status === 'in_progress') return <Clock size={13} className="text-blue-500" />;
  if (status === 'cancelled')   return <Circle size={13} className="text-gray-300" />;
  return <Circle size={13} className="text-gray-400" />;
}

// ── E-sign status badge ───────────────────────────────────────────────────────
function EnvelopeStatusBadge({ status }) {
  const cfg = {
    completed: 'bg-green-50 text-green-700',
    sent:      'bg-blue-50 text-blue-700',
    viewed:    'bg-indigo-50 text-indigo-700',
    voided:    'bg-red-50 text-red-500',
    draft:     'bg-gray-100 text-gray-500',
  }[status] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0 ${cfg}`}>
      {status}
    </span>
  );
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function Avatar({ name, size = 'sm' }) {
  const initials = (name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <div className={`${sz} rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 font-bold text-accent`}>
      {initials}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const DOC_CATEGORIES = ['Construction Permit', 'Contract', 'Environmental Permit', 'Financing', 'GIS Map', 'Inspection', 'Order Forms', 'Photos', 'Plat Map', 'Soil Report', 'Survey', 'Title Report', 'Zoning Verification', 'Other'];
const STORAGE_BUCKET = 'deal-documents';

export default function DealRightColumn({ deal, readOnly, onCreateTask }) {
  const navigate  = useNavigate();
  const { activeOrgId } = useAuth();

  const [tasks,       setTasks]       = useState([]);
  const [contacts,    setContacts]    = useState([]);
  const [envelopes,   setEnvelopes]   = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const [assigneeProfiles, setAssigneeProfiles] = useState({});
  const [documents,    setDocuments]    = useState([]);
  const [docCategory,  setDocCategory]  = useState('Other');
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!deal?.id) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      // Tasks linked to this deal
      fetchTasks({ dealId: deal.id }).catch(() => []),

      // Contacts linked to this deal (via deal_contacts join or deal_id on contacts)
      supabase
        ? supabase
            .from('contacts')
            .select('id, first_name, last_name, email, phone, title, company')
            .eq('deal_id', deal.id)
            .limit(20)
            .then(({ data }) => data || [])
        : Promise.resolve([]),

      // E-sign envelopes
      activeOrgId
        ? fetchEnvelopes(activeOrgId, { dealId: deal.id }).catch(() => [])
        : Promise.resolve([]),

      // Capital stack allocations
      supabase
        ? supabase
            .from('deal_allocations')
            .select('*, investors(name)')
            .eq('deal_id', deal.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => data || [])
        : Promise.resolve([]),

      // Deal documents
      supabase
        ? supabase
            .from('deal_documents')
            .select('*')
            .eq('deal_id', deal.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => data || [])
        : Promise.resolve([]),
    ]).then(([t, c, e, a, docs]) => {
      if (cancelled) return;
      setTasks(t);
      // Resolve assignee names from profiles
      const assigneeIds = [...new Set(t.filter(task => task.assigned_to).map(task => task.assigned_to))];
      if (assigneeIds.length > 0 && supabase) {
        supabase
          .from('profiles')
          .select('id, name, first_name, last_name')
          .in('id', assigneeIds)
          .then(({ data: profiles }) => {
            if (profiles) {
              setAssigneeProfiles(Object.fromEntries(
                profiles.map(p => [p.id, p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '?'])
              ));
            }
          });
      }
      setContacts(c);
      setEnvelopes(e);
      setAllocations(a);
      setDocuments(docs);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [deal?.id, activeOrgId]);

  // Realtime: sync task deletes/updates from other views (e.g. Tasks overview)
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const ch = supabase
      .channel(`deal-tasks-${deal.id}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'tasks',
        filter: `deal_id=eq.${deal.id}`,
      }, (payload) => {
        if (payload.new?.deleted_at) {
          // Soft-deleted elsewhere — remove from sidebar
          setTasks(prev => prev.filter(t => t.id !== payload.new.id));
        } else {
          // Status or other field changed
          setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [deal?.id]);

  const handleDeleteTask = async (id) => {
    // Optimistic remove
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));

    // Try soft-delete first (preferred — preserves audit trail). RLS-denied
    // updates return { data: [], error: null }, so we have to check row count.
    const { data: softData, error: softErr } = await deleteTask(id);
    const softSucceeded = !softErr && Array.isArray(softData) && softData.length > 0;
    console.log('[deleteTask] soft', { id, softSucceeded, softData, softErr });

    if (softSucceeded) return;

    // Soft-delete didn't update any row → fall back to hard-delete.
    // We .select() so we can detect RLS-denied deletes (which return empty arrays).
    const { data: hardData, error: hardErr } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .select();
    const hardSucceeded = !hardErr && Array.isArray(hardData) && hardData.length > 0;
    console.log('[deleteTask] hard', { id, hardSucceeded, hardData, hardErr });

    if (!hardSucceeded) {
      console.error('handleDeleteTask: both soft and hard delete affected 0 rows', {
        softErr, softData, hardErr, hardData,
      });
      setTasks(prevTasks);
      alert(
        'Could not delete task. ' +
        (hardErr?.message || softErr?.message || 'The database rejected the delete (likely an RLS policy on the tasks table — only the task creator or an admin may delete it).')
      );
    }
  };

  const openTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const fmt = n => n == null ? '—' : `$${Math.round(n).toLocaleString()}`;

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    setDocUploading(true);
    const path = `${deal.id}/${Date.now()}_${file.name}`;
    const { error: storageErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file);
    if (!storageErr) {
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const { data: newDoc } = await supabase
        .from('deal_documents')
        .insert({ deal_id: deal.id, organization_id: activeOrgId, name: file.name, category: docCategory, storage_path: path, url: publicUrl, size: file.size })
        .select('*')
        .single();
      if (newDoc) setDocuments(prev => [newDoc, ...prev]);

      // Log to activity feed — body is a single clickable chip showing the
      // category; clicking opens the document. Filename is preserved in the
      // anchor's title attribute via the renderer if needed downstream.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const linkBody = publicUrl
          ? `[${docCategory}](${publicUrl})`
          : `${docCategory}: ${file.name}`;
        await supabase.from('activity_notes').insert({
          organization_id: activeOrgId,
          deal_id:         deal.id,
          author_id:       session.user.id,
          note_type:       'document_upload',
          body:            linkBody,
        });
      }
    }
    setDocUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDocDelete = async (doc) => {
    if (!supabase) return;
    await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
    await supabase.from('deal_documents').delete().eq('id', doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  };

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Associations</p>
      </div>

      <div className="flex-1">

        {/* Key Contacts */}
        <Section icon={Users} title="Key Contacts">
          <KeyContacts deal={deal} />
        </Section>

        {/* Tasks */}
        <Section
          icon={CheckSquare}
          title="Tasks"
          count={openTasks.length}
          defaultOpen={openTasks.length > 0}
          onAdd={!readOnly ? onCreateTask : undefined}
          addLabel="Add task"
        >
          {tasks.length > 0
            ? tasks.slice(0, 8).map(t => {
                const assigneeName = t.assigned_to ? (assigneeProfiles[t.assigned_to] || null) : null;
                return (
                  <div key={t.id} className="flex items-center gap-2 py-1.5 group">
                    <TaskStatusIcon status={t.status} />
                    <span className={`text-[12px] flex-1 truncate ${t.status === 'done' ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                      {t.title}
                    </span>
                    {t.due_date && (
                      <span className={`text-[10px] flex-shrink-0 ${new Date(t.due_date) < new Date() && t.status !== 'done' ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {/* Assignee avatar */}
                    {assigneeName ? (
                      <div
                        title={`Assigned to ${assigneeName}`}
                        className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center text-[9px] font-bold text-accent flex-shrink-0 cursor-default"
                      >
                        {assigneeName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <div
                        title="Unassigned"
                        className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-[9px] text-gray-300 flex-shrink-0 cursor-default"
                      >
                        +
                      </div>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                        title="Delete task"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })
            : <p className="text-[12px] text-gray-300 italic">No tasks yet</p>
          }
          {tasks.length > 8 && (
            <button
              onClick={() => navigate('/tasks', { state: { dealId: deal.id } })}
              className="text-[11px] text-accent font-medium mt-1"
            >
              View all {tasks.length} tasks →
            </button>
          )}
        </Section>

        {/* Important Dates */}
        <Section
          icon={Calendar}
          title="Important Dates"
        >
          <ImportantDates deal={deal} readOnly={readOnly} />
        </Section>

        {/* Documents */}
        <Section
          icon={FileText}
          title="Documents"
          count={documents.length}
          defaultOpen={documents.length > 0}
        >
          {!readOnly && (
            <div className="flex items-center gap-2 mb-3">
              <select
                value={docCategory}
                onChange={e => setDocCategory(e.target.value)}
                className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/40 flex-1 min-w-0"
              >
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={docUploading}
                className="flex items-center gap-1 text-[11px] font-semibold text-white bg-accent px-2.5 py-1 rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Upload size={11} />
                {docUploading ? 'Uploading…' : 'Upload'}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleDocUpload} />
            </div>
          )}
          {documents.length > 0
            ? documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 py-1.5 group">
                <FileText size={12} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-gray-700 truncate leading-tight">{doc.name}</p>
                  <span className="text-[10px] text-gray-400">{doc.category}</span>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-gray-300 hover:text-accent transition-colors flex-shrink-0"
                  title="Download"
                >
                  <Download size={11} />
                </a>
                {!readOnly && (
                  <button
                    onClick={() => handleDocDelete(doc)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))
            : <p className="text-[12px] text-gray-300 italic">No documents uploaded</p>
          }
          <button
            onClick={() => navigate(`/deal/${deal.id}`, { state: { tab: 'dd' } })}
            className="text-[11px] text-accent hover:underline mt-2 block"
          >
            View DD documents →
          </button>
        </Section>

      </div>

      {loading && (
        <div className="absolute bottom-3 right-3">
          <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
