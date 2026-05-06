import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building, MapPin, Tag, User,
  Edit2, Trash2, Check, X, Clock, Link, ExternalLink,
  DollarSign, Plus, CheckSquare, Circle, CircleDot, Ban, Send,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useDeals } from '../lib/DealsContext';
import {
  fetchContact, updateContact, deleteContact,
  CONTACT_TYPE_OPTIONS,
} from '../lib/contactsData';

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];
import { fetchTasks, updateTask, createTask, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '../lib/tasksData';
import { fetchEmailLogs } from '../lib/emailData';
import CreateTaskModal from '../components/Tasks/CreateTaskModal';
import ComposeEmailModal from '../components/Email/ComposeEmailModal';
import SmsThread from '../components/Sms/SmsThread';
import CallHistory from '../components/Voice/CallHistory';
import { supabase } from '../lib/supabase';
import { loadInvestors, saveInvestors } from '../lib/investorsStore';
import CustomFieldsSection from '../components/CustomFields/CustomFieldsSection';
import { isEnabled } from '../lib/featureFlags';


function initials(c) {
  return ((c?.first_name?.[0] || '') + (c?.last_name?.[0] || '')).toUpperCase() || (c?.email?.[0] || '?').toUpperCase();
}

function TypeBadge({ type }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 capitalize">
      {type}
    </span>
  );
}

// ── Inline edit field ─────────────────────────────────────────────────────────
function EditableField({ label, value, onSave, type = 'text', children }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const save = async () => {
    await onSave(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
            className="flex-1 border border-accent rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button onClick={save} className="p-1.5 rounded-lg bg-accent text-white hover:bg-accent/90"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={12} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {children || <span className="text-sm text-gray-700">{value || <span className="text-gray-300 italic">—</span>}</span>}
        <button onClick={() => { setDraft(value || ''); setEditing(true); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 text-gray-400 transition-opacity">
          <Edit2 size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Deal chip linked to contact ───────────────────────────────────────────────
function DealChip({ contactId, deal, role, onUnlink }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-accent/30 cursor-pointer group"
      onClick={() => navigate(`/deal/${deal.id}`)}>
      <div>
        <p className="text-sm font-medium text-gray-800 truncate">{deal.address}</p>
        <p className="text-xs text-gray-400 capitalize">{role} · {deal.stage}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); onUnlink(); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
        <X size={12} />
      </button>
    </div>
  );
}

// ── Timeline entry ────────────────────────────────────────────────────────────
function TimelineEntry({ icon: Icon, color, title, sub, time }) {
  return (
    <div className="flex gap-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
        <Icon size={13} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{title}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
        <p className="text-xs text-gray-300 mt-0.5">{time}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId, orgSlug } = useAuth();
  const { can } = usePermissions();
  const { deals: allDeals } = useDeals();

  const [contact, setContact]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [linkedDeals, setLinkedDeals] = useState([]);
  const [editTypes, setEditTypes]   = useState(false);
  const [draftTypes, setDraftTypes] = useState([]);
  const [savingTypes, setSavingTypes] = useState(false);
  const [tasks, setTasks]           = useState([]);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [emailLogs, setEmailLogs]   = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [investorRecord, setInvestorRecord] = useState(null);

  const canEdit   = can('contact.update');
  const canDelete = can('contact.delete');

  useEffect(() => {
    setLoading(true);
    fetchContact(id).then(c => {
      if (!c) { navigate('/contacts'); return; }
      setContact(c);
      setDraftTypes(c.types || []);
      // Resolve linked deal objects
      const linked = (c.linkedDeals || []).map(ld => {
        const deal = allDeals.find(d => d.id === ld.deal_id);
        return deal ? { ...deal, role: ld.role } : null;
      }).filter(Boolean);
      setLinkedDeals(linked);
      if (c.types?.includes('Investor')) {
        supabase.from('investors')
          .select('id, name, type, preferred_financing, standard_terms, notes')
          .eq('contact_id', id)
          .maybeSingle()
          .then(({ data }) => setInvestorRecord(data));
      }
      setLoading(false);
    });
    fetchTasks({ contactId: id }).then(setTasks);
    fetchEmailLogs({ contactId: id }).then(setEmailLogs);
  }, [id]);

  const save = async (fields) => {
    const result = await updateContact(id, fields);
    if (result?.data) setContact(result.data);
  };

  const saveTypes = async () => {
    setSavingTypes(true);
    await save({ types: draftTypes });
    setSavingTypes(false);
    setEditTypes(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${contact?.fullName}? This cannot be undone.`)) return;
    const result = await deleteContact(id);
    if (result?.error) {
      alert(`Could not delete contact: ${result.error}`);
      return;
    }
    // If this contact was an Investor, remove them from the localStorage investor list
    if (contact?.types?.includes('Investor') && activeOrgId) {
      const investorName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.company || '';
      const all = loadInvestors(activeOrgId, orgSlug);
      const filtered = all.filter(inv => inv.name !== investorName);
      if (filtered.length !== all.length) saveInvestors(filtered, activeOrgId);
    }
    navigate('/contacts', { state: { deletedId: id } });
  };

  const handleUnlinkDeal = async (dealId, role) => {
    if (!supabase) return;
    await supabase.from('contact_deals')
      .delete()
      .eq('contact_id', id)
      .eq('deal_id', dealId)
      .eq('role', role);
    setLinkedDeals(prev => prev.filter(d => !(d.id === dealId && d.role === role)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#f5f3ee' }}>
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!contact) return null;

  const emailTimeline = emailLogs.map(e => ({
    icon: Mail,
    color: e.status === 'sent' ? 'bg-blue-500' : 'bg-red-400',
    title: `Email: ${e.subject}`,
    sub: `To: ${e.to_email}${e.status === 'failed' ? ' · Failed' : ''}`,
    time: new Date(e.sent_at).toLocaleString(),
  }));

  const timeline = [
    { icon: User, color: 'bg-accent', title: 'Contact created', sub: null, time: new Date(contact.created_at).toLocaleString() },
    ...(contact.last_contacted_at ? [{ icon: Clock, color: 'bg-green-500', title: 'Last contacted', sub: null, time: new Date(contact.last_contacted_at).toLocaleString() }] : []),
    ...emailTimeline,
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#f5f3ee' }}>
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/contacts')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800 truncate">{contact.fullName}</h1>
          {contact.company && <p className="text-xs text-gray-400">{contact.title ? `${contact.title} · ` : ''}{contact.company}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {contact.email && can('contact.update') && (
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors"
              style={{ backgroundColor: '#c9703a' }}
              title="Send email"
            >
              <Send size={12} />Send Email
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex-1 overflow-hidden flex gap-4 p-6">

        {/* LEFT — Profile */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* Avatar + name card */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">
              {initials(contact)}
            </div>
            <p className="text-base font-bold text-gray-800 mb-1">{contact.fullName}</p>
            {contact.title && <p className="text-xs text-gray-500 mt-0.5">{contact.title}</p>}
            {contact.company && <p className="text-xs text-gray-400">{contact.company}</p>}
            <div className="flex flex-wrap justify-center gap-1 mt-3">
              {contact.types.map(t => <TypeBadge key={t} type={t} />)}
              {canEdit && (
                <button onClick={() => setEditTypes(true)}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-accent border border-accent/30 hover:bg-accent/5 transition-colors">
                  <Edit2 size={9} className="mr-1" />Edit
                </button>
              )}
            </div>
          </div>

          {/* Edit types panel */}
          {editTypes && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Contact Types</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {CONTACT_TYPE_OPTIONS.map(t => (
                  <button key={t} type="button"
                    onClick={() => setDraftTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                      draftTypes.includes(t) ? 'bg-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200 hover:border-accent'
                    }`}>{t}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveTypes} disabled={savingTypes}
                  className="flex-1 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: '#c9703a' }}>
                  {savingTypes ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditTypes(false); setDraftTypes(contact.types); }}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contact Info</p>

            <EditableField label="First Name" value={contact.first_name} onSave={v => save({ first_name: v })} />
            <EditableField label="Last Name" value={contact.last_name} onSave={v => save({ last_name: v })} />

            <EditableField label="Email" value={contact.email} onSave={v => save({ email: v })} type="email">
              {contact.email && (
                <button onClick={() => setShowCompose(true)} className="text-sm text-accent hover:underline flex items-center gap-1">
                  <Mail size={12} />{contact.email}
                </button>
              )}
            </EditableField>

            <EditableField label="Phone" value={contact.phone} onSave={v => save({ phone: v })} type="tel">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="text-sm text-gray-700 flex items-center gap-1 hover:text-accent">
                  <Phone size={12} />{contact.phone}
                </a>
              )}
            </EditableField>

            <EditableField label="Company" value={contact.company} onSave={v => save({ company: v })}>
              {contact.company && <span className="text-sm text-gray-700 flex items-center gap-1"><Building size={12} className="text-gray-400" />{contact.company}</span>}
            </EditableField>

            <EditableField label="Title" value={contact.title} onSave={v => save({ title: v })} />

            <EditableField label="Address" value={contact.address} onSave={v => save({ address: v })}>
              {contact.address && <span className="text-sm text-gray-700 flex items-center gap-1"><MapPin size={12} className="text-gray-400" />{contact.address}</span>}
            </EditableField>

            {/* States serviced — inside Contact Info card */}
            {(() => {
              const serviced = Array.isArray(contact.states_serviced)
                ? contact.states_serviced.filter(s => typeof s === 'string')
                : [];
              return (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">States Serviced</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {serviced.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                        {s}
                        {canEdit && (
                          <button
                            onClick={async () => {
                              const updated = serviced.filter(x => x !== s);
                              setContact(c => ({ ...c, states_serviced: updated }));
                              await save({ states_serviced: updated });
                            }}
                            className="hover:text-red-500 ml-0.5"
                          >
                            <X size={9} />
                          </button>
                        )}
                      </span>
                    ))}
                    {serviced.length === 0 && <span className="text-xs text-gray-300 italic">No states added</span>}
                  </div>
                  {canEdit && (
                    <select
                      defaultValue=""
                      onChange={async e => {
                        const s = e.target.value;
                        if (!s || serviced.includes(s)) return;
                        const updated = [...serviced, s];
                        setContact(c => ({ ...c, states_serviced: updated }));
                        await save({ states_serviced: updated });
                        e.target.value = '';
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white text-gray-600"
                    >
                      <option value="">+ Add state…</option>
                      {US_STATES.filter(s => !serviced.includes(s)).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Tags */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {(contact.tags || []).map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-100">
                  <Tag size={9} />{tag}
                </span>
              ))}
              {(contact.tags || []).length === 0 && <span className="text-xs text-gray-300 italic">No tags</span>}
            </div>
          </div>

          {/* Custom Fields */}
          <CustomFieldsSection
            orgId={activeOrgId}
            entityType="contact"
            values={contact.custom_fields || {}}
            onSave={save}
            canEdit={canEdit}
          />
        </div>

        {/* CENTER — Timeline / Notes */}
        <div className="flex-1 min-w-0 space-y-4 overflow-y-auto">
          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Notes</p>
            {canEdit ? (
              <NotesEditor value={contact.notes || ''} onSave={v => save({ notes: v })} />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {contact.notes || <span className="text-gray-300 italic">No notes yet</span>}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Activity Timeline</p>
            <div className="space-y-4">
              {timeline.map((entry, i) => <TimelineEntry key={i} {...entry} />)}
            </div>
            {timeline.length === 0 && <p className="text-xs text-gray-300 italic">No activity yet</p>}
          </div>
        </div>

        {/* RIGHT — Related */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* Related Deals */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Related Deals</p>
              <span className="text-xs font-bold text-gray-500">{linkedDeals.length}</span>
            </div>
            <div className="space-y-2">
              {linkedDeals.map(d => (
                <DealChip
                  key={`${d.id}-${d.role}`}
                  contactId={id}
                  deal={d}
                  role={d.role}
                  onUnlink={() => handleUnlinkDeal(d.id, d.role)}
                />
              ))}
              {linkedDeals.length === 0 && (
                <p className="text-xs text-gray-300 italic py-2">No linked deals</p>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Tasks</p>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-gray-500">{tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length}</span>
                {canEdit && (
                  <button onClick={() => setShowCreateTask(true)}
                    className="ml-1 p-1 rounded hover:bg-accent/10 text-gray-400 hover:text-accent transition-colors">
                    <Plus size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              {tasks.slice(0, 8).map(t => {
                const StatusIcon = t.status === 'done' ? Check : t.status === 'in_progress' ? CircleDot : t.status === 'cancelled' ? Ban : Circle;
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!canEdit) return;
                        const next = t.status === 'done' ? 'todo' : t.status === 'todo' ? 'in_progress' : t.status === 'in_progress' ? 'done' : 'todo';
                        setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
                        await updateTask(t.id, { status: next });
                      }}
                      className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        t.status === 'done' ? 'bg-green-500 border-green-500 text-white' :
                        t.status === 'in_progress' ? 'border-blue-400 text-blue-400' : 'border-gray-300 text-gray-300'
                      } ${canEdit ? 'cursor-pointer hover:border-accent' : 'cursor-default'}`}
                    >
                      <StatusIcon size={8} />
                    </button>
                    <p className={`text-xs text-gray-700 truncate flex-1 ${t.status === 'done' ? 'line-through text-gray-300' : ''}`}>{t.title}</p>
                    {t.due_date && <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                  </div>
                );
              })}
              {tasks.length === 0 && <p className="text-xs text-gray-300 italic py-1">No tasks</p>}
              {tasks.length > 8 && <p className="text-xs text-gray-400 mt-1">+{tasks.length - 8} more</p>}
            </div>
          </div>

          {/* Call History */}
          {isEnabled('VOICE') && (contact.phone || contact.secondary_phone) && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <CallHistory
                contactId={id}
                contactPhone={contact.phone || contact.secondary_phone}
                contactName={contact.fullName}
              />
            </div>
          )}

          {/* SMS Thread */}
          {isEnabled('SMS') && (contact.phone || contact.secondary_phone) && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">SMS</p>
              <SmsThread
                contactId={id}
                contactPhone={contact.phone || contact.secondary_phone}
                contactName={contact.fullName}
              />
            </div>
          )}

          {/* Investor Profile — only for Investor-typed contacts */}
          {contact.types?.includes('Investor') && (
            <InvestorSummaryCard investor={investorRecord} />
          )}

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 text-xs text-gray-400">
            <p className="font-semibold text-gray-500 uppercase tracking-widest">Record Info</p>
            <div><span className="font-medium text-gray-500">Created</span><br />{new Date(contact.created_at).toLocaleString()}</div>
            <div><span className="font-medium text-gray-500">Updated</span><br />{new Date(contact.updated_at).toLocaleString()}</div>
            <div><span className="font-medium text-gray-500">Contact ID</span><br /><span className="font-mono text-[10px] break-all">{contact.id}</span></div>
          </div>
        </div>
      </div>
    </div>
    {showCreateTask && (
      <CreateTaskModal
        defaultContactId={id}
        onClose={() => setShowCreateTask(false)}
        onCreated={(t) => { setShowCreateTask(false); setTasks(prev => [t, ...prev]); }}
      />
    )}
    {showCompose && (
      <ComposeEmailModal
        contact={contact}
        onClose={() => setShowCompose(false)}
        onSent={(log) => {
          if (log) setEmailLogs(prev => [log, ...prev]);
        }}
      />
    )}
    </>
  );
}

// ── Investor Summary Card ─────────────────────────────────────────────────────
function InvestorSummaryCard({ investor }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-xl border border-blue-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Investor Profile</p>
        <button
          onClick={() => navigate('/investors')}
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          View Portal <ExternalLink size={11} />
        </button>
      </div>
      {investor ? (
        <div className="space-y-2">
          {investor.type && (
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Type</p>
              <p className="text-sm text-gray-700">{investor.type}</p>
            </div>
          )}
          {investor.preferred_financing && (
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Preferred Financing</p>
              <p className="text-sm text-gray-700">{investor.preferred_financing}</p>
            </div>
          )}
          {investor.standard_terms && (
            <div>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Standard Terms</p>
              <p className="text-xs text-gray-600 leading-relaxed">{investor.standard_terms}</p>
            </div>
          )}
          {!investor.type && !investor.preferred_financing && !investor.standard_terms && (
            <p className="text-xs text-gray-300 italic">No investor details yet — edit in Investor Portal</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Not yet linked to an investor record</p>
      )}
    </div>
  );
}

// ── Notes inline editor ───────────────────────────────────────────────────────
function NotesEditor({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="group cursor-pointer" onClick={() => setEditing(true)}>
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed min-h-[2rem]">
          {value || <span className="text-gray-300 italic">Click to add notes…</span>}
        </p>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={6}
        autoFocus
        className="w-full border border-accent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
      />
      <div className="flex gap-2 mt-2">
        <button onClick={save} disabled={saving}
          className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#c9703a' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => { setDraft(value); setEditing(false); }}
          className="px-4 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
}
