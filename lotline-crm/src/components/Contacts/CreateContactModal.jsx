import { useState } from 'react';
import { X, User, Plus } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { createContact, CONTACT_TYPE_OPTIONS } from '../../lib/contactsData';
import { supabase } from '../../lib/supabase';

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

export default function CreateContactModal({ onClose, onCreated }) {
  const { activeOrgId } = useAuth();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    company: '', title: '', notes: '',
  });
  const [types, setTypes] = useState([]);
  const [states, setStates] = useState([]);
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addType = (t) => { if (t && !types.includes(t)) setTypes(prev => [...prev, t]); };
  const removeType = (t) => setTypes(prev => prev.filter(x => x !== t));

  const addState = (s) => { if (s && !states.includes(s)) setStates(prev => [...prev, s]); };
  const removeState = (s) => setStates(prev => prev.filter(x => x !== s));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() && !form.email.trim()) {
      setError('First name or email is required');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: err } = await createContact({
      orgId: activeOrgId, types, states_serviced: states, ...form,
    });
    setSaving(false);
    if (err) { setError(err); return; }

    // If contact type includes Investor, auto-create an investor record and link it
    if (types.includes('Investor') && data && supabase) {
      const investorName = [form.first_name, form.last_name].filter(Boolean).join(' ') || form.company || form.email || 'Unnamed';
      const { data: inv } = await supabase
        .from('investors')
        .insert({
          organization_id: activeOrgId,
          name: investorName,
          email: form.email || null,
          phone: form.phone || null,
          contact: form.company || null,
          contact_id: data.id,
        })
        .select('id')
        .single();
      if (!inv) console.warn('[CreateContactModal] investor insert failed');
    }

    onCreated(data);
  };

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User size={18} className="text-accent" />
            <h2 className="text-base font-bold text-gray-800">New Contact</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* First / Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">First name</label>
              <input value={form.first_name} onChange={e => set('first_name', e.target.value)}
                placeholder="Jane" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last name</label>
              <input value={form.last_name} onChange={e => set('last_name', e.target.value)}
                placeholder="Smith" className={inputClass} />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Company</label>
            <input value={form.company} onChange={e => set('company', e.target.value)}
              placeholder="Acme Corp" className={inputClass} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="jane@example.com" className={inputClass} />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="(555) 000-0000" className={inputClass} />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type</label>
            <select
              value=""
              onChange={e => {
                const val = e.target.value;
                e.target.value = '';
                if (val === '__custom__') { setShowCustomType(true); }
                else { addType(val); }
              }}
              className={inputClass}
            >
              <option value="">— Select a type —</option>
              {CONTACT_TYPE_OPTIONS.filter(t => !types.includes(t)).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__custom__">+ Add custom type…</option>
            </select>
            {types.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {types.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    {t}
                    <button type="button" onClick={() => removeType(t)} className="hover:text-red-500 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {showCustomType && (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  value={customTypeInput}
                  onChange={e => setCustomTypeInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customTypeInput.trim()) { addType(customTypeInput.trim()); setCustomTypeInput(''); setShowCustomType(false); }
                    }
                    if (e.key === 'Escape') { setShowCustomType(false); setCustomTypeInput(''); }
                  }}
                  placeholder="Custom type name"
                  className={inputClass + ' flex-1'}
                />
                <button
                  type="button"
                  onClick={() => { if (customTypeInput.trim()) { addType(customTypeInput.trim()); setCustomTypeInput(''); setShowCustomType(false); } }}
                  className="px-3 py-2 text-xs font-semibold text-white rounded-lg"
                  style={{ backgroundColor: '#c9703a' }}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* States serviced */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">States serviced</label>
            <select
              value=""
              onChange={e => { addState(e.target.value); e.target.value = ''; }}
              className={inputClass}
            >
              <option value="">— Select a state —</option>
              {US_STATES.filter(s => !states.includes(s)).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {states.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {states.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    {s}
                    <button type="button" onClick={() => removeState(s)} className="hover:text-red-500 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Initial notes…"
              className={inputClass + ' resize-none'} />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#c9703a' }}>
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : <Plus size={14} />}
            {saving ? 'Creating…' : 'Create Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
