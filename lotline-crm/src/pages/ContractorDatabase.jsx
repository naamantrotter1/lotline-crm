import { useState } from 'react';
import { HardHat, Phone, Star, Plus, X } from 'lucide-react';

const TRADE_OPTIONS = [
  'Setup Crew', "Dealer's License", 'Septic Installation', 'Well Drilling',
  'Electrical', 'HVAC', 'Plumbing', 'Footers / Foundation', 'Land Clearing',
  'Driveway', 'Landscaping', 'Underpinning / Skirting', 'Decks', 'General Contractor', 'Other',
];

const DEFAULT_CONTRACTORS = [
  { id: 1, name: "Tony's Mobile Home Service", trade: 'Setup Crew', contact: 'Tony', phone: '', rating: 5, notes: 'Met week of Mar 30. Primary setup crew.', active: true },
  { id: 2, name: 'Bonnie (Dealer License)', trade: "Dealer's License", contact: 'Bonnie', phone: '', rating: 4, notes: 'Working on dealer license process.', active: true },
  { id: 3, name: 'TBD Septic', trade: 'Septic Installation', contact: '', phone: '', rating: null, notes: 'Need to source reliable septic contractors by county.', active: false },
  { id: 4, name: 'TBD Well', trade: 'Well Drilling', contact: '', phone: '', rating: null, notes: 'Need well drillers for NC markets.', active: false },
  { id: 5, name: 'TBD Electric', trade: 'Electrical', contact: '', phone: '', rating: null, notes: 'Need licensed electricians.', active: false },
];

const LS_KEY = 'lotline_contractors';

function loadContractors() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    return saved && saved.length ? saved : DEFAULT_CONTRACTORS;
  } catch { return DEFAULT_CONTRACTORS; }
}

function StarRating({ rating }) {
  if (!rating) return <span className="text-xs text-gray-400">Not rated</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={12} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
      ))}
    </div>
  );
}

function StarInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)}>
          <Star size={20} className={star <= (value || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'} />
        </button>
      ))}
      {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-400 hover:text-gray-600 ml-1">Clear</button>}
    </div>
  );
}

function AddContractorModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [trade, setTrade] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState(null);
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent';
  const labelCls = 'text-xs font-medium text-gray-500 mb-1 block';

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), trade, contact: contact.trim(), phone: phone.trim(), rating, notes: notes.trim(), active });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-sidebar">Add Contractor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Company or person name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Trade</label>
            <select value={trade} onChange={e => setTrade(e.target.value)} className={inputCls + ' bg-white'}>
              <option value="">Select trade...</option>
              {TRADE_OPTIONS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="First name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(000) 000-0000" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Rating</label>
            <StarInput value={rating} onChange={setRating} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this contractor..." rows={3} className={inputCls + ' resize-none'} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActive(a => !a)}
              className={`relative w-10 h-5 rounded-full transition-colors ${active ? 'bg-accent' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-600">{active ? 'Active' : 'Sourcing'}</span>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim()} className="flex-1 bg-accent text-white text-sm font-medium py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40">
            Save Contractor
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContractorDatabase() {
  const [contractors, setContractors] = useState(loadContractors);
  const [showModal, setShowModal] = useState(false);

  const handleSave = (newContractor) => {
    const updated = [...contractors, { ...newContractor, id: Date.now() }];
    setContractors(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sidebar rounded-lg">
            <HardHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sidebar">Contractor Database</h1>
            <p className="text-sm text-gray-500">Trusted contractors and service providers</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus size={15} />
          Add Contractor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {contractors.map((c) => (
          <div key={c.id} className="bg-card rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sidebar">{c.name}</h3>
                <p className="text-xs text-accent font-medium mt-0.5">{c.trade}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.active ? 'Active' : 'Sourcing'}
              </span>
            </div>

            {c.contact && (
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-sidebar text-white text-xs flex items-center justify-center font-bold">
                  {c.contact[0]}
                </div>
                <span className="text-sm text-gray-600">{c.contact}</span>
              </div>
            )}

            {c.phone && (
              <div className="flex items-center gap-1.5 mb-2">
                <Phone size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">{c.phone}</span>
              </div>
            )}

            <StarRating rating={c.rating} />

            {c.notes && (
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{c.notes}</p>
            )}
          </div>
        ))}

        <div
          onClick={() => setShowModal(true)}
          className="bg-white/60 rounded-xl border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white hover:border-accent/40 transition-colors min-h-36"
        >
          <Plus size={24} className="text-gray-300" />
          <p className="text-sm text-gray-400 font-medium">Add Contractor</p>
        </div>
      </div>

      {showModal && <AddContractorModal onClose={() => setShowModal(false)} onSave={handleSave} />}
    </div>
  );
}
