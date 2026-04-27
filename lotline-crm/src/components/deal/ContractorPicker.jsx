/**
 * ContractorPicker — smart dropdown that:
 *   - Queries contacts filtered by contractor_type for the relevant pipeline stage
 *   - Shows selected contact inline with phone/email
 *   - Saves assignment to deal_stage_contacts (single source of truth)
 *   - "+ Add New Contact" opens a quick-add form with contractor_type pre-filled
 *
 * Used inside DueDiligence.jsx and Development.jsx pipeline cards.
 */
import { useState, useEffect, useRef } from 'react';
import { User, Phone, Mail, ChevronDown, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

// ── Quick-add modal ───────────────────────────────────────────────────────────
function QuickAddContact({ contractorType, orgId, onSaved, onClose }) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [company,   setCompany]   = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState(null);

  const save = async () => {
    if (!firstName.trim() && !company.trim()) {
      setErr('Enter a name or company'); return;
    }
    setSaving(true);
    try {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          organization_id: orgId,
          first_name:       firstName.trim(),
          last_name:        lastName.trim(),
          company:          company.trim() || null,
          phone:            phone.trim()   || null,
          email:            email.trim()   || null,
        })
        .select('id, first_name, last_name, company, phone, email')
        .single();
      if (error) throw error;
      // Tag with the specific contractor type so ContractorPicker can find this contact
      if (contractorType) {
        await supabase.from('contact_types')
          .insert({ contact_id: contact.id, type: contractorType })
          .catch(() => {});
      }
      onSaved(contact);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-80 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[14px] font-bold text-gray-800">New Contact</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={15} />
          </button>
        </div>
        {contractorType && (
          <p className="text-[11px] text-accent font-semibold mb-3 bg-accent/10 rounded-lg px-2 py-1.5">
            {contractorType}
          </p>
        )}
        {err && <p className="text-[11px] text-red-500 mb-2">{err}</p>}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="First name" className={inp} />
            <input value={lastName}  onChange={e => setLastName(e.target.value)}
              placeholder="Last name"  className={inp} />
          </div>
          <input value={company} onChange={e => setCompany(e.target.value)}
            placeholder="Company (optional)" className={inp} />
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone" className={inp} type="tel" />
          <input value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" className={inp} type="email" />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose}
            className="text-[12px] text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="text-[12px] text-white bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/90 font-semibold disabled:opacity-40">
            {saving ? 'Saving…' : 'Save Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main picker ───────────────────────────────────────────────────────────────
export default function ContractorPicker({ dealId, stageKey, contractorType, readOnly }) {
  const { activeOrgId } = useAuth();
  const [contacts,  setContacts]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [open,      setOpen]      = useState(false);
  const [search,    setSearch]    = useState('');
  const [showAdd,   setShowAdd]   = useState(false);
  const dropRef = useRef(null);

  // Load contacts whose contact_types include this contractorType
  useEffect(() => {
    if (!supabase || !activeOrgId || !contractorType) return;
    // Get contact IDs that have this type, then fetch those contacts
    supabase
      .from('contact_types')
      .select('contact_id')
      .eq('type', contractorType)
      .then(async ({ data: typeRows }) => {
        if (!typeRows?.length) { setContacts([]); return; }
        const ids = typeRows.map(r => r.contact_id);
        const { data } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, company, phone, email')
          .eq('organization_id', activeOrgId)
          .in('id', ids)
          .is('deleted_at', null)
          .order('first_name');
        setContacts(data || []);
      });
  }, [activeOrgId, contractorType]);

  // Load the currently assigned contact for this deal + stage
  useEffect(() => {
    if (!supabase || !dealId || !stageKey) return;
    supabase
      .from('deal_stage_contacts')
      .select('contact_id, contacts(id, first_name, last_name, company, phone, email, contractor_type)')
      .eq('deal_id', dealId)
      .eq('stage_key', stageKey)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.contacts) setSelected(data.contacts);
      });
  }, [dealId, stageKey]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (!dropRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const displayName = (c) => {
    const n = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    return n || c.company || 'Unknown';
  };

  const selectContact = async (contact) => {
    setSelected(contact);
    setOpen(false);
    setSearch('');
    if (!supabase || !activeOrgId) return;
    await supabase.from('deal_stage_contacts').upsert(
      { deal_id: dealId, organization_id: activeOrgId, stage_key: stageKey, contact_id: contact.id },
      { onConflict: 'deal_id,stage_key' }
    );
  };

  const clearContact = async (e) => {
    e.stopPropagation();
    setSelected(null);
    if (!supabase) return;
    await supabase.from('deal_stage_contacts')
      .delete()
      .eq('deal_id', dealId)
      .eq('stage_key', stageKey);
  };

  const handleNewContact = async (contact) => {
    setContacts(prev => [...prev, contact]);
    setShowAdd(false);
    await selectContact(contact);
  };

  const filtered = contacts.filter(c => {
    const name = `${c.first_name || ''} ${c.last_name || ''} ${c.company || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="relative" ref={dropRef} onClick={e => e.stopPropagation()}>
      {showAdd && (
        <QuickAddContact
          contractorType={contractorType}
          orgId={activeOrgId}
          onSaved={handleNewContact}
          onClose={() => setShowAdd(false)}
        />
      )}

      {selected ? (
        <div className="border border-blue-200 rounded-lg px-2 py-1.5 bg-blue-50">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <User size={9} className="text-blue-500 flex-shrink-0" />
              <span className="text-[10px] font-semibold text-blue-700 truncate">
                {displayName(selected)}
              </span>
            </div>
            {!readOnly && (
              <button onClick={clearContact}
                className="text-blue-300 hover:text-red-500 transition-colors flex-shrink-0">
                <X size={9} />
              </button>
            )}
          </div>
          {(selected.phone || selected.email) && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {selected.phone && (
                <a href={`tel:${selected.phone}`}
                  onClick={e => e.stopPropagation()}
                  className="text-[9px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                  <Phone size={8} />{selected.phone}
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`}
                  onClick={e => e.stopPropagation()}
                  className="text-[9px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 truncate max-w-full">
                  <Mail size={8} />{selected.email}
                </a>
              )}
            </div>
          )}
          {!readOnly && (
            <button onClick={() => setOpen(v => !v)}
              className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5 font-medium">
              Change
            </button>
          )}
        </div>
      ) : (
        <button
          disabled={readOnly}
          onClick={() => !readOnly && setOpen(v => !v)}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg px-2 py-1 w-full transition-colors disabled:opacity-50"
        >
          <ChevronDown size={9} />
          {contractorType ? `Add ${contractorType}` : 'Add Contractor'}
        </button>
      )}

      {open && !readOnly && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 w-56 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-accent"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[11px] text-gray-400 px-3 py-3 text-center">
                No {contractorType ? contractorType.toLowerCase() + 's' : 'contacts'} found
              </p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => selectContact(c)}
                  className="w-full flex items-start gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <div className="w-5 h-5 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={9} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{displayName(c)}</p>
                    {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-gray-100">
            <button
              onMouseDown={() => { setOpen(false); setShowAdd(true); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] text-accent hover:bg-accent/5 font-semibold"
            >
              <Plus size={11} />
              Add New Contact
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
