/**
 * Right column of the HubSpot-style deal detail layout.
 * "Association" — loads real data for tasks, contacts, e-sign, capital stack, distributions.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, UserCircle, FileText, CheckSquare, Scale,
  TrendingDown, ChevronDown, ChevronRight, Plus,
  ExternalLink, Circle, CheckCircle2, Clock, AlertCircle,
  Mail, Phone, MapPin,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { fetchTasks } from '../../lib/tasksData';
import { fetchEnvelopes } from '../../lib/esignData';

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
export default function DealRightColumn({ deal, readOnly, onCreateTask }) {
  const navigate  = useNavigate();
  const { activeOrgId } = useAuth();

  const [tasks,       setTasks]       = useState([]);
  const [contacts,    setContacts]    = useState([]);
  const [envelopes,   setEnvelopes]   = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading,     setLoading]     = useState(true);

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
    ]).then(([t, c, e, a]) => {
      if (cancelled) return;
      setTasks(t);
      setContacts(c);
      setEnvelopes(e);
      setAllocations(a);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [deal?.id, activeOrgId]);

  const openTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
  const fmt = n => n == null ? '—' : `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Associations</p>
      </div>

      <div className="flex-1">

        {/* Property */}
        <Section icon={Home} title="Property" defaultOpen>
          {deal?.address
            ? (
              <div className="text-[12px] bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="font-semibold text-gray-800">{deal.address}</p>
                {deal.county && (
                  <p className="text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} />{deal.county}, {deal.state || deal.dealState}
                  </p>
                )}
                {deal.acreage && <p className="text-gray-400">{deal.acreage} acres · Parcel {deal.parcelId || 'N/A'}</p>}
              </div>
            )
            : <p className="text-[12px] text-gray-300 italic">No address set</p>
          }
        </Section>

        {/* Contacts */}
        <Section
          icon={UserCircle}
          title="Contacts"
          count={contacts.length}
          onAdd={!readOnly ? () => navigate('/contacts/new', { state: { dealId: deal.id } }) : undefined}
          addLabel="Link contact"
        >
          {contacts.length > 0
            ? contacts.map(c => {
                const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email;
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/contacts/${c.id}`)}
                    className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-gray-50 rounded-lg px-1 -mx-1 group transition-colors"
                  >
                    <Avatar name={name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-800 truncate group-hover:text-accent">{name}</p>
                      {c.title && <p className="text-[10px] text-gray-400 truncate">{c.title}{c.company ? ` · ${c.company}` : ''}</p>}
                    </div>
                    <ExternalLink size={11} className="text-gray-300 group-hover:text-accent flex-shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })
            : <p className="text-[12px] text-gray-300 italic">No contacts linked</p>
          }
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
            ? tasks.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center gap-2 py-1.5">
                <TaskStatusIcon status={t.status} />
                <span className={`text-[12px] flex-1 truncate ${t.status === 'done' ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                  {t.title}
                </span>
                {t.due_date && (
                  <span className={`text-[10px] flex-shrink-0 ${new Date(t.due_date) < new Date() && t.status !== 'done' ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                    {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))
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

        {/* E-Sign Envelopes */}
        <Section
          icon={FileText}
          title="E-Sign Envelopes"
          count={envelopes.length}
          onAdd={!readOnly ? () => navigate('/esign', { state: { dealId: deal.id } }) : undefined}
          addLabel="New envelope"
        >
          {envelopes.length > 0
            ? envelopes.map(e => (
              <button
                key={e.id}
                onClick={() => navigate(`/esign/${e.id}`)}
                className="flex items-center gap-2 w-full text-left py-1.5 hover:bg-gray-50 rounded-lg px-1 -mx-1 group transition-colors"
              >
                <FileText size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-[12px] text-gray-700 flex-1 truncate group-hover:text-accent">{e.name}</span>
                <EnvelopeStatusBadge status={e.pandadoc_status || e.status} />
              </button>
            ))
            : <p className="text-[12px] text-gray-300 italic">No envelopes</p>
          }
        </Section>

        {/* Capital Stack */}
        <Section
          icon={Scale}
          title="Capital Stack"
          count={allocations.length}
        >
          {allocations.length > 0
            ? allocations.map((a, i) => {
                const name = a.investors?.name || a.investor_name || 'Investor';
                return (
                  <div key={a.id || i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={name} size="sm" />
                      <span className="text-[12px] text-gray-700 truncate">{name}</span>
                    </div>
                    <span className="text-[12px] font-semibold text-gray-800 flex-shrink-0">{fmt(a.amount)}</span>
                  </div>
                );
              })
            : (
              <div>
                {deal?.investor && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[12px] text-gray-600">{deal.investor}</span>
                    {deal.investorCapitalContributed && (
                      <span className="text-[12px] font-semibold text-gray-800">{fmt(deal.investorCapitalContributed)}</span>
                    )}
                  </div>
                )}
                {!deal?.investor && <p className="text-[12px] text-gray-300 italic">No capital allocated</p>}
              </div>
            )
          }
        </Section>

        {/* Documents quick links */}
        <Section icon={FileText} title="Documents">
          <button
            onClick={() => navigate(`/deal/${deal.id}`, { state: { tab: 'dd' } })}
            className="text-[12px] text-accent hover:underline"
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
