import { useState } from 'react';
import { X, User, Plus } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { createContact, LIFECYCLE_STAGES, CONTACT_TYPE_OPTIONS, LEAD_SOURCES } from '../../lib/contactsData';

export default function CreateContactModal({ onClose, onCreated }) {
  const { activeOrgId } = useAuth();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    company: '', title: '', lifecycle_stage: 'new',
    lead_source: '', notes: '',
  });
  const [types, setTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleType = (t) =>
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() && !form.email.trim()) {
      setError('First name or email is required');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: err } = await createContact({ orgId: activeOrgId, types, ...form });
    setSaving(false);
    if (err) { setError(err); return; }
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

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="jane@example.com" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="(555) 000-0000" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Company</label>
              <input value={form.company} onChange={e => set('company', e.target.value)}
                placeholder="Acme Corp" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Type(s)</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_TYPE_OPTIONS.map(t => (
                <button key={t} type="button" onClick={() => toggleType(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                    types.includes(t)
                      ? 'bg-accent text-white border-accent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-accent'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lifecycle stage</label>
              <select value={form.lifecycle_stage} onChange={e => set('lifecycle_stage', e.target.value)}
                className={inputClass}>
                {LIFECYCLE_STAGES.map(s => (
                  <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lead source</label>
              <select value={form.lead_source} onChange={e => set('lead_source', e.target.value)}
                className={inputClass}>
                <option value="">— Select —</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

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
