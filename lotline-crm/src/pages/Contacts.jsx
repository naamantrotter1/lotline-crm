import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Plus, Search, Phone, Mail,
  Tag, User, ChevronDown, X, MoreHorizontal, Trash2,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import {
  fetchContacts, deleteContact, updateContact,
  LIFECYCLE_STAGES, CONTACT_TYPE_OPTIONS,
} from '../lib/contactsData';
import CreateContactModal from '../components/Contacts/CreateContactModal';
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
function ContactRow({ contact, onDelete, canDelete, onEmail, onTypeChange }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const typeBtnRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!typeOpen) return;
    function handleClick(e) {
      if (
        typeBtnRef.current && !typeBtnRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setTypeOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [typeOpen]);

  const openTypePicker = () => {
    if (typeBtnRef.current) {
      const rect = typeBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setTypeOpen(v => !v);
  };

  const toggleType = (t) => {
    const next = contact.types.includes(t)
      ? contact.types.filter(x => x !== t)
      : [...contact.types, t];
    onTypeChange(contact.id, next);
  };

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
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <button
          ref={typeBtnRef}
          onClick={openTypePicker}
          className="flex flex-wrap gap-1 min-w-[60px] text-left"
        >
          {contact.types.length > 0 ? (
            <>
              {contact.types.slice(0, 3).map(t => <TypeBadge key={t} type={t} />)}
              {contact.types.length > 3 && <span className="text-[10px] text-gray-400">+{contact.types.length - 3}</span>}
            </>
          ) : (
            <span className="text-[11px] text-gray-300 hover:text-accent transition-colors">+ Add type</span>
          )}
        </button>
        {typeOpen && (
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
            className="bg-white border border-gray-200 rounded-xl shadow-lg w-52 py-1 max-h-64 overflow-y-auto"
          >
            {CONTACT_TYPE_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 capitalize"
              >
                <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${contact.types.includes(t) ? 'bg-accent border-accent' : 'border-gray-300'}`}>
                  {contact.types.includes(t) && <span className="text-white text-[8px]">✓</span>}
                </span>
                {t}
              </button>
            ))}
          </div>
        )}
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
// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Contacts() {
  const { activeOrgId } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const [contacts, setContacts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
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

  // Real-time: re-fetch when any contact changes so all users stay in sync
  const contactsChannelId = useRef(Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!supabase || !activeOrgId) return;
    const ch = supabase
      .channel(`contacts-list-${contactsChannelId.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        load();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeOrgId, load]);

  // If navigated here after a delete, immediately remove the contact from state
  useEffect(() => {
    const deletedId = location.state?.deletedId;
    if (deletedId) {
      setContacts(prev => prev.filter(c => c.id !== deletedId));
      // Clear the state so it doesn't re-apply on future renders
      window.history.replaceState({}, '');
    }
  }, [location.state?.deletedId]);

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
    const result = await deleteContact(id);
    if (result?.error) { alert(`Could not delete: ${result.error}`); return; }
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleTypeChange = async (contactId, newTypes) => {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, types: newTypes } : c));
    await updateContact(contactId, { types: newTypes });
  };

  const handleCreated = (newContact) => {
    setContacts(prev => [newContact, ...prev]);
    setShowCreate(false);
    navigate(`/contacts/${newContact.id}`);
  };

  // Apply client-side filters, sorted A–Z by name
  const filtered = contacts
    .filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.fullName.toLowerCase().includes(q) &&
            !(c.email || '').toLowerCase().includes(q) &&
            !(c.company || '').toLowerCase().includes(q) &&
            !(c.phone || '').includes(q)) return false;
      }
      if (filterType && !c.types.includes(filterType)) return false;
      return true;
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

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

          {filterType && (
            <button onClick={() => setFilterType('')}
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
              {search || filterType
                ? 'Try adjusting your filters'
                : 'Create your first contact to get started'}
            </p>
            {canCreate && !search && !filterType && (
              <button onClick={() => setShowCreate(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-lg"
                style={{ backgroundColor: '#c9703a' }}>
                <Plus size={14} />New Contact
              </button>
            )}
          </div>
        ) : (
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
                  <ContactRow key={c.id} contact={c} onDelete={handleDelete} canDelete={canDelete} onEmail={setEmailContact} onTypeChange={handleTypeChange} />
                ))}
              </tbody>
            </table>
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
    </div>
  );
}
