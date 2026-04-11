import { useState } from 'react';
import {
  Landmark, Handshake, Clock, CheckCircle, XCircle,
  AlertCircle, MessageSquare, Send, X, ChevronRight,
} from 'lucide-react';
import Button from '../components/UI/Button';

// ── Storage ────────────────────────────────────────────────────────────────
const LOAN_KEY    = 'lending_requests';
const PARTNER_KEY = 'partnership_submissions';

// ── Dummy seed data ────────────────────────────────────────────────────────
const DUMMY_LOANS = [
  { ref: 'LND-4821', address: '142 Pinewood Dr, Hamlet, NC 28345',       loanAmount: 87000, loanType: 'Fix & Flip',  dateSubmitted: '2026-03-18', status: 'In Review' },
  { ref: 'LND-3607', address: '88 Oak Ridge Rd, Rockingham, NC 28379',   loanAmount: 52500, loanType: 'Bridge Loan', dateSubmitted: '2026-02-27', status: 'Approved'  },
  { ref: 'LND-3201', address: '305 Elm St, Laurinburg, NC 28352',         loanAmount: 34000, loanType: 'Land Loan',   dateSubmitted: '2026-01-14', status: 'Declined'  },
];
const DUMMY_PARTNERSHIPS = [
  { ref: 'PRT-7291', address: '417 Cedar Lane, Rockingham, NC 28379', dealType: 'Fix & Flip',  projectedProfit: 28000, dateSubmitted: '2026-03-22', status: 'Interested'   },
  { ref: 'PRT-6043', address: '92 Birch Ave, Hamlet, NC 28345',       dealType: 'Wholesale',   projectedProfit: 12500, dateSubmitted: '2026-02-11', status: 'In Discussion'},
  { ref: 'PRT-5187', address: '1024 Maple Dr, Laurinburg, NC 28352',  dealType: 'Land Deal',   projectedProfit: 45000, dateSubmitted: '2026-01-30', status: 'Pass'         },
];

// ── Empty forms ────────────────────────────────────────────────────────────
const EMPTY_LOAN = {
  address: '', purchasePrice: '', loanAmount: '', loanType: 'Fix & Flip',
  propertyType: 'Single Family', arv: '', creditScore: '700+',
  exitStrategy: 'Sell', notes: '',
};
const EMPTY_PARTNER = {
  address: '', propertyType: 'Manufactured Home', dealType: 'Land + Home Package',
  purchasePrice: '', repairCosts: '', arv: '', projectedProfit: '',
  needs: [], split: '', yourRole: 'Deal Finder', summary: '',
  dealFlyerName: '', supportingDocsName: '',
};

// ── Badge configs ──────────────────────────────────────────────────────────
const LOAN_STATUS = {
  'Pending Review': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  'In Review':      { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: AlertCircle },
  'Approved':       { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  'Declined':       { bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
};
const PARTNER_STATUS = {
  'Under Review':  { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
  'Interested':    { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: AlertCircle },
  'In Discussion': { bg: 'bg-green-100',  text: 'text-green-700',  icon: MessageSquare },
  'Pass':          { bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
};

// ── Sub-components ─────────────────────────────────────────────────────────
function StatusBadge({ status, map }) {
  const s = (map || LOAN_STATUS)[status] || Object.values(map || LOAN_STATUS)[0];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <Icon size={11} />{status}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}{hint && <span className="normal-case font-normal ml-1 text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <span className="text-xs font-bold text-accent uppercase tracking-widest">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

// ── Drawer shell ───────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-full w-[520px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-sidebar">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Lending() {
  const [drawer, setDrawer]       = useState(null); // 'financing' | 'partnership'
  const [activeTab, setActiveTab] = useState('loans');

  // Loan request state
  const [loanForm, setLoanForm]     = useState(EMPTY_LOAN);
  const [loanConfirm, setLoanConfirm] = useState(null);
  const [loanRequests, setLoanRequests] = useState(() => {
    try { const s = localStorage.getItem(LOAN_KEY); return s ? JSON.parse(s) : DUMMY_LOANS; }
    catch { return DUMMY_LOANS; }
  });

  // Partnership state
  const [partnerForm, setPartnerForm]       = useState(EMPTY_PARTNER);
  const [partnerConfirm, setPartnerConfirm] = useState(null);
  const [partnerships, setPartnerships]     = useState(() => {
    try { const s = localStorage.getItem(PARTNER_KEY); return s ? JSON.parse(s) : DUMMY_PARTNERSHIPS; }
    catch { return DUMMY_PARTNERSHIPS; }
  });

  // ── Loan form handlers ───────────────────────────────────────────────────
  const handleLoanChange = (e) => {
    const { name, value } = e.target;
    setLoanForm(p => ({ ...p, [name]: value }));
  };

  const handleLoanSubmit = (e) => {
    e.preventDefault();
    const ref = 'LND-' + Math.floor(1000 + Math.random() * 9000);
    const row = { ref, address: loanForm.address, loanAmount: parseInt(loanForm.loanAmount) || 0, loanType: loanForm.loanType, dateSubmitted: new Date().toISOString().split('T')[0], status: 'Pending Review' };
    console.log('💰 Loan Request:', { ref, ...loanForm, dateSubmitted: row.dateSubmitted });
    const updated = [row, ...loanRequests];
    setLoanRequests(updated);
    localStorage.setItem(LOAN_KEY, JSON.stringify(updated));
    setLoanConfirm(ref);
    setLoanForm(EMPTY_LOAN);
  };

  // ── Partnership form handlers ────────────────────────────────────────────
  const handlePartnerChange = (e) => {
    const { name, value } = e.target;
    setPartnerForm(prev => {
      const next = { ...prev, [name]: value };
      if (['arv', 'purchasePrice', 'repairCosts'].includes(name)) {
        const arv = parseFloat(name === 'arv' ? value : next.arv) || 0;
        const pp  = parseFloat(name === 'purchasePrice' ? value : next.purchasePrice) || 0;
        const rc  = parseFloat(name === 'repairCosts' ? value : next.repairCosts) || 0;
        next.projectedProfit = arv > 0 || pp > 0 ? String(Math.max(0, arv - pp - rc)) : next.projectedProfit;
      }
      return next;
    });
  };

  const toggleNeed = (val) => {
    setPartnerForm(p => ({
      ...p,
      needs: p.needs.includes(val) ? p.needs.filter(n => n !== val) : [...p.needs, val],
    }));
  };

  const handleFileChange = (field) => (e) => {
    const name = e.target.files?.[0]?.name || '';
    setPartnerForm(p => ({ ...p, [field]: name }));
  };

  const handlePartnerSubmit = (e) => {
    e.preventDefault();
    const ref = 'PRT-' + Math.floor(1000 + Math.random() * 9000);
    const row = { ref, address: partnerForm.address, dealType: partnerForm.dealType, projectedProfit: parseInt(partnerForm.projectedProfit) || 0, dateSubmitted: new Date().toISOString().split('T')[0], status: 'Under Review' };
    console.log('🤝 Partnership Submission:', { ref, ...partnerForm, dateSubmitted: row.dateSubmitted });
    const updated = [row, ...partnerships];
    setPartnerships(updated);
    localStorage.setItem(PARTNER_KEY, JSON.stringify(updated));
    setPartnerConfirm(ref);
    setPartnerForm(EMPTY_PARTNER);
  };

  const closeDrawer = () => {
    setDrawer(null);
    setLoanConfirm(null);
    setPartnerConfirm(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Capital &amp; Partnerships</h1>
        <p className="text-sm text-gray-500 mt-1">Access financing for your deals or partner with LotLine on opportunities.</p>
      </div>

      {/* Option cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1 — Financing */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <Landmark size={22} className="text-accent" />
          </div>
          <div>
            <h3 className="text-base font-bold text-sidebar mb-1">Request Financing</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Submit a loan request and get connected with our lending partners.</p>
          </div>
          <Button onClick={() => { setLoanConfirm(null); setDrawer('financing'); }} className="mt-auto self-start">
            Apply for Financing <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>

        {/* Card 2 — Partner */}
        <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <Handshake size={22} className="text-accent" />
          </div>
          <div>
            <h3 className="text-base font-bold text-sidebar mb-1">Partner With Us</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Bring us a deal and let's work it together. Submit your deal details and we'll review it.</p>
          </div>
          <Button onClick={() => { setPartnerConfirm(null); setDrawer('partnership'); }} className="mt-auto self-start">
            Submit a Deal for Review <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>
      </div>

      {/* Submission history */}
      <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { key: 'loans',        label: 'My Loan Requests',         count: loanRequests.length },
            { key: 'partnerships', label: 'My Partnership Submissions', count: partnerships.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === t.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === t.key ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-gray-500'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Loan requests table */}
        {activeTab === 'loans' && (
          loanRequests.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No loan requests yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Reference #', 'Address', 'Loan Amount', 'Loan Type', 'Date Submitted', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loanRequests.map(r => (
                    <tr key={r.ref} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">{r.address}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">${r.loanAmount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">{r.loanType}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                      <td className="py-3 px-4 whitespace-nowrap"><StatusBadge status={r.status} map={LOAN_STATUS} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Partnership submissions table */}
        {activeTab === 'partnerships' && (
          partnerships.length === 0 ? (
            <div className="py-14 text-center text-gray-400 text-sm">No partnership submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Reference #', 'Address', 'Deal Type', 'Projected Profit', 'Date Submitted', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {partnerships.map(r => (
                    <tr key={r.ref} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">{r.address}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">{r.dealType}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">${r.projectedProfit.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                      <td className="py-3 px-4 whitespace-nowrap"><StatusBadge status={r.status} map={PARTNER_STATUS} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Financing Drawer ─────────────────────────────────────────────── */}
      <Drawer open={drawer === 'financing'} onClose={closeDrawer} title="Request Financing">
        {loanConfirm ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-sidebar">Request Submitted!</p>
              <p className="text-sm text-gray-500 mt-1">Reference number: <span className="font-bold text-accent">{loanConfirm}</span></p>
              <p className="text-sm text-gray-500 mt-2">We'll review your request and be in touch shortly.</p>
            </div>
            <Button onClick={closeDrawer} className="mt-2">Close</Button>
          </div>
        ) : (
          <form onSubmit={handleLoanSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <Field label="Deal / Property Address">
                <input name="address" required value={loanForm.address} onChange={handleLoanChange} className={inp} placeholder="123 Main St, City, NC 28000" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Purchase Price ($)">
                  <input name="purchasePrice" type="number" min="0" value={loanForm.purchasePrice} onChange={handleLoanChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Loan Amount ($)">
                  <input name="loanAmount" type="number" min="0" required value={loanForm.loanAmount} onChange={handleLoanChange} className={inp} placeholder="0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Loan Type">
                  <select name="loanType" value={loanForm.loanType} onChange={handleLoanChange} className={inp}>
                    <option>Fix &amp; Flip</option><option>DSCR</option><option>Bridge Loan</option><option>Construction</option><option>Land Loan</option>
                  </select>
                </Field>
                <Field label="Property Type">
                  <select name="propertyType" value={loanForm.propertyType} onChange={handleLoanChange} className={inp}>
                    <option>Single Family</option><option>Multi-Family</option><option>Mobile Home</option><option>Land</option><option>Commercial</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estimated ARV ($)">
                  <input name="arv" type="number" min="0" value={loanForm.arv} onChange={handleLoanChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Credit Score Range">
                  <select name="creditScore" value={loanForm.creditScore} onChange={handleLoanChange} className={inp}>
                    <option>700+</option><option>650–699</option><option>600–649</option><option>Below 600</option>
                  </select>
                </Field>
              </div>
              <Field label="Exit Strategy">
                <select name="exitStrategy" value={loanForm.exitStrategy} onChange={handleLoanChange} className={inp}>
                  <option>Sell</option><option>Rent</option><option>Refinance</option>
                </select>
              </Field>
              <Field label="Additional Notes" hint="optional">
                <textarea name="notes" value={loanForm.notes} onChange={handleLoanChange} rows={3} className={inp + ' resize-none'} placeholder="Any context that may help us process your request..." />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button type="submit" className="w-full justify-center">
                <Send size={14} className="mr-1.5" /> Submit Loan Request
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      {/* ── Partnership Drawer ───────────────────────────────────────────── */}
      <Drawer open={drawer === 'partnership'} onClose={closeDrawer} title="Submit a Deal for Review">
        {partnerConfirm ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <Handshake size={28} className="text-accent" />
            </div>
            <div>
              <p className="text-lg font-bold text-sidebar">Deal Submitted!</p>
              <p className="text-sm text-gray-500 mt-1">Reference number: <span className="font-bold text-accent">{partnerConfirm}</span></p>
              <p className="text-sm text-gray-500 mt-2">We'll review your deal and reach out within <strong>2 business days</strong>.</p>
            </div>
            <Button onClick={closeDrawer} className="mt-2">Close</Button>
          </div>
        ) : (
          <form onSubmit={handlePartnerSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              <SectionHeading>Deal Details</SectionHeading>

              <Field label="Property Address">
                <input name="address" required value={partnerForm.address} onChange={handlePartnerChange} className={inp} placeholder="123 Main St, City, NC 28000" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Property Type">
                  <select name="propertyType" value={partnerForm.propertyType} onChange={handlePartnerChange} className={inp}>
                    <option>Manufactured Home</option><option>Modular Home</option><option>Single Family</option><option>Multi-Family</option><option>Land</option><option>Commercial</option>
                  </select>
                </Field>
                <Field label="Deal Type">
                  <select name="dealType" value={partnerForm.dealType} onChange={handlePartnerChange} className={inp}>
                    <option>Land + Home Package</option><option>Wholesale</option><option>Fix &amp; Flip</option><option>Buy &amp; Hold</option><option>New Construction</option><option>Land Deal</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Purchase Price ($)">
                  <input name="purchasePrice" type="number" min="0" value={partnerForm.purchasePrice} onChange={handlePartnerChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Estimated Repair Costs ($)">
                  <input name="repairCosts" type="number" min="0" value={partnerForm.repairCosts} onChange={handlePartnerChange} className={inp} placeholder="0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="After Repair Value ($)">
                  <input name="arv" type="number" min="0" value={partnerForm.arv} onChange={handlePartnerChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Projected Profit ($)" hint="auto-calculated">
                  <input name="projectedProfit" type="number" min="0" value={partnerForm.projectedProfit} onChange={handlePartnerChange} className={inp + ' font-semibold text-accent'} placeholder="0" />
                </Field>
              </div>

              <SectionHeading>Partnership Ask</SectionHeading>

              <Field label="What do you need from LotLine?">
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Capital', 'Expertise', 'Connections', 'Co-Ownership', 'Other'].map(v => (
                    <label key={v} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors ${partnerForm.needs.includes(v) ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="checkbox" checked={partnerForm.needs.includes(v)} onChange={() => toggleNeed(v)} className="accent-[#f97316] w-3.5 h-3.5" />
                      {v}
                    </label>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Proposed Split % for LotLine">
                  <input name="split" type="number" min="0" max="100" value={partnerForm.split} onChange={handlePartnerChange} className={inp} placeholder="e.g. 30" />
                </Field>
                <Field label="Your Role on the Deal">
                  <select name="yourRole" value={partnerForm.yourRole} onChange={handlePartnerChange} className={inp}>
                    <option>Deal Finder</option><option>Contractor</option><option>Property Manager</option><option>Equity Partner</option><option>Other</option>
                  </select>
                </Field>
              </div>

              <Field label="Deal Summary">
                <textarea name="summary" value={partnerForm.summary} onChange={handlePartnerChange} rows={4} className={inp + ' resize-none'} placeholder="Describe the opportunity, the neighborhood, why it's a good deal..." />
              </Field>

              <SectionHeading>Documents</SectionHeading>

              <Field label="Deal Flyer or Photos" hint="images & PDFs">
                <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                  <span className="text-xs text-gray-400 font-medium">{partnerForm.dealFlyerName || 'Click to choose file...'}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange('dealFlyerName')} />
                </label>
              </Field>

              <Field label="Supporting Documents" hint="comps, inspection report, etc.">
                <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                  <span className="text-xs text-gray-400 font-medium">{partnerForm.supportingDocsName || 'Click to choose file...'}</span>
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileChange('supportingDocsName')} />
                </label>
              </Field>

            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button type="submit" className="w-full justify-center">
                <Send size={14} className="mr-1.5" /> Send to LotLine for Review
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}
