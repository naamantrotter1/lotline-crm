import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, List, Columns, Phone, Mail,
  Tag, User, ChevronDown, X, MoreHorizontal, Trash2, Upload,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchContacts, deleteContact,
  LIFECYCLE_STAGES, CONTACT_TYPE_OPTIONS,
} from '../lib/contactsData';
import CreateContactModal from '../components/Contacts/CreateContactModal';
import ImportModal from '../components/Import/ImportModal';
import ComposeEmailModal from '../components/Email/ComposeEmailModal';

const LIFECYCLE_COLORS = {
  new:       'bg-blue-50 text-blue-700 border-blue-200',
  working:   'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-purple-50 text-purple-700 border-purple-200',
  customer:  'bg-green-50 text-green-700 border-green-200',
  dormant:   'bg-gray-100 text-gray-500 border-gray-200',
};

const KANBAN_COLORS = {
  new:       { bg: '#eff6ff', header: '#1d4ed8', light: '#dbeafe' },
  working:   { bg: '#fffbeb', header: '#d97706', light: '#fde68a' },
  qualified: { bg: '#faf5ff', header: '#7c3aed', light: '#ede9fe' },
  customer:  { bg: '#f0fdf4', header: '#16a34a', light: '#dcfce7' },
  dormant:   { bg: '#f9fafb', header: '#6b7280', light: '#f3f4f6' },
};

function TypeBadge({ type }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
      {type}
    </span>
  );
}

function LifecycleBadge({ stage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${LIFECYCLE_COLORS[stage] || LIFECYCLE_COLORS.new}`}>
      {stage}
    </span>
  );
}

function initials(c) {
  const f = c.first_name?.[0] || '';
  const l = c.last_name?.[0] || '';
  return (f + l).toUpperCase() || (c.email?.[0] || '?').toUpperCase();
}

// ── Contact Row (Table View) ──────────────────────────────────────────────────
function ContactRow({ contact, onDelete, canDelete, onEmail }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <tr
      className="hover:bg-gray-50 cursor-pointer group transition-colors"
      onClick={() => navigate(`/contacts/${contact.id}`)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials(contact)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{contact.fullName}</p>
            {contact.title && <p className="text-xs text-gray-400">{contact.title}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {contact.types.slice(0, 3).map(t => <TypeBadge key={t} type={t} />)}
          {contact.types.length > 3 && <span className="text-[10px] text-gray-400">+{contact.types.length - 3}</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{contact.company || '—'}</td>
      <td className="px-4 py-3">
        {contact.email ? (
          <button onClick={e => { e.stopPropagation(); onEmail(contact); }}
            className="text-sm text-accent hover:underline flex items-center gap-1">
            <Mail size={12} />{contact.email}
          </button>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-3">
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()}
            className="text-sm text-gray-600 flex items-center gap-1 hover:text-accent">
            <Phone size={12} />{contact.phone}
          </a>
        ) : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        {canDelete && (
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-opacity">
              <MoreHorizontal size={14} className="text-gray-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-20 py-1">
                <button
                  onClick={() => { setMenuOpen(false); onDelete(contact.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} />Delete
                </button>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ contact, onClick }) {
  return (
    <div onClick={() => onClick(contact.id)}
      className="bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          {initials(contact)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{contact.fullName}</p>
          {contact.company && <p className="text-xs text-gray-400 truncate">{contact.company}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {contact.types.slice(0, 2).map(t => <TypeBadge key={t} type={t} />)}
      </div>
      {contact.email && (
        <p className="text-xs text-gray-400 truncate flex items-center gap-1">
          <Mail size={10} />{contact.email}
        </p>
      )}
      {contact.phone && (
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <Phone size={10} />{contact.phone}
        </p>
      )}
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ stage, contacts, onCardClick }) {
  const c = KANBAN_COLORS[stage];
  return (
    <div className="flex-1 min-w-[220px] max-w-xs" style={{ backgroundColor: c.bg }}>
      <div className="rounded-t-xl px-3 py-2 flex items-center justify-between" style={{ backgroundColor: c.light }}>
        <span className="text-xs font-semibold capitalize" style={{ color: c.header }}>{stage}</span>
        <span className="text-xs font-bold rounded-full px-2 py-0.5 text-white text-[10px]"
          style={{ backgroundColor: c.header }}>{contacts.length}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {contacts.map(c => <KanbanCard key={c.id} contact={c} onClick={onCardClick} />)}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Contacts() {
  const { activeOrgId } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [contacts, setContacts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState('table'); // 'table' | 'kanban'
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [emailContact, setEmailContact] = useState(null);

  const canCreate = can('contact.create');
  const canDelete = can('contact.delete');

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    const rows = await fetchContacts(activeOrgId);
    setContacts(rows);
    setLoading(false);
  }, [activeOrgId]);

  useEffect(() => { load(); }, [load]);

  // Global keyboard shortcut: C → create contact (when not in an input)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'c' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) && !e.metaKey && !e.ctrlKey) {
        if (canCreate) setShowCreate(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canCreate]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact? This cannot be undone.')) return;
    await deleteContact(id);
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleCreated = (newContact) => {
    setContacts(prev => [newContact, ...prev]);
    setShowCreate(false);
    navigate(`/contacts/${newContact.id}`);
  };

  // Apply client-side filters
  const filtered = contacts.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.fullName.toLowerCase().includes(q) &&
          !(c.email || '').toLowerCase().includes(q) &&
          !(c.company || '').toLowerCase().includes(q) &&
          !(c.phone || '').includes(q)) return false;
    }
    if (filterType && !c.types.includes(filterType)) return false;
    if (filterStage && c.lifecycle_stage !== filterStage) return false;
    return true;
  });

  const byStage = LIFECYCLE_STAGES.reduce((acc, s) => {
    acc[s] = filtered.filter(c => c.lifecycle_stage === s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={22} className="text-accent" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">Contacts</h1>
              <p className="text-xs text-gray-400">{contacts.length} total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggles */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setView('table')}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'table' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                <List size={13} />Table
              </button>
              <button onClick={() => setView('kanban')}
                className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Columns size={13} />Kanban
              </button>
            </div>
            {canCreate && (
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Upload size={14} />Import
              </button>
            )}
            {canCreate && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg"
                style={{ backgroundColor: '#c9703a' }}>
                <Plus size={15} />New Contact
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">All types</option>
            {CONTACT_TYPE_OPTIONS.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>

          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">All stages</option>
            {LIFECYCLE_STAGES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>

          {(filterType || filterStage) && (
            <button onClick={() => { setFilterType(''); setFilterStage(''); }}
              className="text-xs text-accent hover:underline flex items-center gap-1">
              <X size={12} />Clear
            </button>
          )}

          <span className="text-xs text-gray-400 ml-auto">{filtered.length} contacts</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Users size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No contacts found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || filterType || filterStage
                ? 'Try adjusting your filters'
                : 'Create your first contact to get started'}
            </p>
            {canCreate && !search && !filterType && !filterStage && (
              <button onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg"
                style={{ backgroundColor: '#c9703a' }}>
                <Plus size={14} />New Contact
              </button>
            )}
          </div>
        ) : view === 'table' ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold">Company</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold">Email</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold">Phone</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <ContactRow key={c.id} contact={c} onDelete={handleDelete} canDelete={canDelete} onEmail={setEmailContact} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Kanban view */
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {LIFECYCLE_STAGES.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                contacts={byStage[stage]}
                onCardClick={id => navigate(`/contacts/${id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {emailContact && (
        <ComposeEmailModal
          contact={emailContact}
          onClose={() => setEmailContact(null)}
          onSent={() => setEmailContact(null)}
        />
      )}

      {showCreate && (
        <CreateContactModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {showImport && (
        <ImportModal
          defaultEntityType="contacts"
          onClose={() => setShowImport(false)}
          onDone={load}
        />
      )}
    </div>
  );
}
