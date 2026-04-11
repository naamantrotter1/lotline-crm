import { useState } from 'react';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Send } from 'lucide-react';
import Button from '../components/UI/Button';

const STORAGE_KEY = 'lending_requests';

const DUMMY_REQUESTS = [
  {
    ref: 'LND-4821',
    address: '142 Pinewood Dr, Hamlet, NC 28345',
    loanAmount: 87000,
    loanType: 'Fix & Flip',
    dateSubmitted: '2026-03-18',
    status: 'In Review',
  },
  {
    ref: 'LND-3607',
    address: '88 Oak Ridge Rd, Rockingham, NC 28379',
    loanAmount: 52500,
    loanType: 'Bridge Loan',
    dateSubmitted: '2026-02-27',
    status: 'Approved',
  },
  {
    ref: 'LND-3201',
    address: '305 Elm St, Laurinburg, NC 28352',
    loanAmount: 34000,
    loanType: 'Land Loan',
    dateSubmitted: '2026-01-14',
    status: 'Declined',
  },
];

const EMPTY_FORM = {
  address: '',
  purchasePrice: '',
  loanAmount: '',
  loanType: 'Fix & Flip',
  propertyType: 'Single Family',
  arv: '',
  creditScore: '700+',
  exitStrategy: 'Sell',
  notes: '',
};

const STATUS_STYLES = {
  'Pending Review': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  'In Review':      { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: AlertCircle },
  'Approved':       { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  'Declined':       { bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES['Pending Review'];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <Icon size={11} />
      {status}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

export default function Lending() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [requests, setRequests] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DUMMY_REQUESTS;
    } catch {
      return DUMMY_REQUESTS;
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    const ref = 'LND-' + Math.floor(1000 + Math.random() * 9000);
    const newRequest = {
      ref,
      address: form.address,
      loanAmount: parseInt(form.loanAmount) || 0,
      loanType: form.loanType,
      dateSubmitted: new Date().toISOString().split('T')[0],
      status: 'Pending Review',
    };

    const submission = { ref, ...form, dateSubmitted: newRequest.dateSubmitted };
    console.log('💰 New Loan Request:', submission);

    const updated = [newRequest, ...requests];
    setRequests(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setConfirmation(ref);
    setForm(EMPTY_FORM);
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Lending</h1>
        <p className="text-sm text-gray-500 mt-1">Request financing for your deals and track loan submissions.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── REQUEST FORM ── */}
        <div className="xl:col-span-2 bg-card rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileText size={14} className="text-accent" />
              </div>
              <h2 className="text-base font-semibold text-sidebar">Request Financing</h2>
            </div>
          </div>

          {confirmation && (
            <div className="mx-6 mt-5 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Request submitted!</p>
                <p className="text-xs text-green-700 mt-0.5">Reference number: <span className="font-bold">{confirmation}</span>. We'll be in touch shortly.</p>
              </div>
              <button onClick={() => setConfirmation(null)} className="ml-auto text-green-500 hover:text-green-700 text-lg leading-none">&times;</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <Field label="Deal / Property Address">
              <input
                name="address" required value={form.address} onChange={handleChange}
                className={inputCls} placeholder="123 Main St, City, NC 28000"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchase Price ($)">
                <input
                  name="purchasePrice" type="number" min="0" value={form.purchasePrice} onChange={handleChange}
                  className={inputCls} placeholder="0"
                />
              </Field>
              <Field label="Loan Amount Requested ($)">
                <input
                  name="loanAmount" type="number" min="0" required value={form.loanAmount} onChange={handleChange}
                  className={inputCls} placeholder="0"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Loan Type">
                <select name="loanType" value={form.loanType} onChange={handleChange} className={inputCls}>
                  <option>Fix &amp; Flip</option>
                  <option>DSCR</option>
                  <option>Bridge Loan</option>
                  <option>Construction</option>
                  <option>Land Loan</option>
                </select>
              </Field>
              <Field label="Property Type">
                <select name="propertyType" value={form.propertyType} onChange={handleChange} className={inputCls}>
                  <option>Single Family</option>
                  <option>Multi-Family</option>
                  <option>Mobile Home</option>
                  <option>Land</option>
                  <option>Commercial</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Estimated ARV ($)">
                <input
                  name="arv" type="number" min="0" value={form.arv} onChange={handleChange}
                  className={inputCls} placeholder="0"
                />
              </Field>
              <Field label="Credit Score Range">
                <select name="creditScore" value={form.creditScore} onChange={handleChange} className={inputCls}>
                  <option>700+</option>
                  <option>650–699</option>
                  <option>600–649</option>
                  <option>Below 600</option>
                </select>
              </Field>
            </div>

            <Field label="Exit Strategy">
              <select name="exitStrategy" value={form.exitStrategy} onChange={handleChange} className={inputCls}>
                <option>Sell</option>
                <option>Rent</option>
                <option>Refinance</option>
              </select>
            </Field>

            <Field label="Additional Notes (optional)">
              <textarea
                name="notes" value={form.notes} onChange={handleChange}
                rows={3} className={inputCls + ' resize-none'}
                placeholder="Any context that may help us process your request..."
              />
            </Field>

            <Button type="submit" disabled={submitting} className="w-full justify-center mt-1">
              <Send size={14} className="mr-1.5" />
              {submitting ? 'Submitting…' : 'Submit Loan Request'}
            </Button>
          </form>
        </div>

        {/* ── LOAN REQUESTS TABLE ── */}
        <div className="xl:col-span-3 bg-card rounded-xl shadow-sm border border-gray-100 overflow-hidden self-start">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileText size={14} className="text-accent" />
              </div>
              <h2 className="text-base font-semibold text-sidebar">My Loan Requests</h2>
            </div>
            <span className="text-xs text-gray-400">{requests.length} total</span>
          </div>

          {requests.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No loan requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Reference #', 'Address', 'Loan Amount', 'Loan Type', 'Date Submitted', 'Status'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.ref} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">{r.address}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">
                        ${r.loanAmount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">{r.loanType}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
