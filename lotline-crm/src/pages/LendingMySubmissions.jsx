/**
 * /lending/my-submissions
 *
 * Visible to non-hub subscriber orgs.  Combines:
 *   • Apply for Financing    — creates a lending_request
 *   • Submit a Deal for Review — creates a lending_partnership
 *   • Hub Submissions        — deals sent via SubmitForFundingButton (lending_submissions)
 *
 * Accepts location.state.prefillLoan / prefillPartner to open the relevant
 * form pre-filled when navigated from a deal detail page.
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  Landmark, Handshake, Clock, CheckCircle, XCircle,
  AlertCircle, MessageSquare, Send, X, ChevronRight,
  Inbox,
} from 'lucide-react';
import Button from '../components/UI/Button';
import {
  fetchLendingRequests,
  createLendingRequest,
  fetchLendingPartnerships,
  createLendingPartnership,
} from '../lib/lendingData';
import {
  fetchMySubmissions,
  withdrawSubmission,
  postMessage,
  fetchMessages,
  STATUS_LABELS,
} from '../lib/lendingSubmissionsData';

// ── Cost fields (mirrors Lending.jsx) ─────────────────────────────────────
const COST_FIELDS = [
  { key: 'land',         label: 'Land' },
  { key: 'mobileHome',   label: 'Manufactured Home' },
  { key: 'hudEngineer',  label: 'HUD Engineer' },
  { key: 'percTest',     label: 'Perc Test / Permit' },
  { key: 'survey',       label: 'Land Survey' },
  { key: 'footers',      label: 'Footers' },
  { key: 'setup',        label: 'Setup' },
  { key: 'clearLand',    label: 'Clear Land' },
  { key: 'water',        label: 'Water' },
  { key: 'septic',       label: 'Septic' },
  { key: 'electric',     label: 'Electric / Power Pole' },
  { key: 'hvac',         label: 'HVAC' },
  { key: 'underpinning', label: 'Skirting' },
  { key: 'decks',        label: 'Decks Installed' },
  { key: 'driveway',     label: 'Driveway' },
  { key: 'landscaping',  label: 'Landscaping / Final Grading' },
  { key: 'waterSewer',   label: 'Water / Sewer Hook Up' },
  { key: 'mailbox',      label: 'Mailbox' },
  { key: 'gutters',      label: 'Gutters' },
  { key: 'photos',       label: 'Professional Photos' },
  { key: 'mobileTax',    label: 'Mobile Home Tax' },
  { key: 'staging',      label: 'Staging' },
];
const EMPTY_COSTS = Object.fromEntries(COST_FIELDS.map(f => [f.key, '']));

const EMPTY_LOAN = {
  address: '', purchasePrice: '', loanAmount: '', loanType: 'Land + Home Package',
  propertyType: 'Manufactured Home', arv: '', creditScore: '700+',
  exitStrategy: 'Sell', notes: '', costs: EMPTY_COSTS, costsOpen: false,
};
const EMPTY_PARTNER = {
  address: '', propertyType: 'Manufactured', dealType: 'Land + Home Package',
  purchasePrice: '', repairCosts: '', arv: '', projectedProfit: '',
  needs: [], split: '', yourRole: 'Deal Finder', summary: '',
  dealFlyerName: '', supportingDocsName: '',
  costs: EMPTY_COSTS, costsOpen: false,
};

// ── Status badge configs ───────────────────────────────────────────────────
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
const HUB_STATUS = {
  submitted:    { bg: 'bg-blue-100',   text: 'text-blue-700',   icon: Clock },
  under_review: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
  approved:     { bg: 'bg-green-100',  text: 'text-green-700',  icon: CheckCircle },
  declined:     { bg: 'bg-red-100',    text: 'text-red-600',    icon: XCircle },
  withdrawn:    { bg: 'bg-gray-100',   text: 'text-gray-500',   icon: XCircle },
};

// ── Shared helpers ─────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';

function StatusBadge({ status, map }) {
  const cfg = map[status];
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} />{status}
    </span>
  );
}

function HubStatusBadge({ status }) {
  const cfg = HUB_STATUS[status] ?? HUB_STATUS.submitted;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} />{STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{hint && <span className="normal-case font-normal text-gray-400 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <p className="text-xs font-bold text-accent uppercase tracking-widest pt-1">{children}</p>
  );
}

// ── Drawer shell ──────────────────────────────────────────────────────────
function Drawer({ open, onClose, title, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 h-screen w-[520px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-sidebar truncate pr-4">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col flex-1 min-h-0">{children}</div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function LendingMySubmissions() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { activeOrgId, session } = useAuth();

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('loans');

  // ── Drawer state ─────────────────────────────────────────────────────────
  // null | 'financing' | 'partnership' | 'hubDetail'
  const [drawer, setDrawer] = useState(null);

  const closeDrawer = () => {
    setDrawer(null);
    setLoanConfirm(null);
    setPartnerConfirm(null);
  };

  // ── Financing form ────────────────────────────────────────────────────────
  const [loanForm,    setLoanForm]    = useState(EMPTY_LOAN);
  const [loanConfirm, setLoanConfirm] = useState(null);
  const [loanRequests, setLoanRequests] = useState([]);

  const totalCosts = COST_FIELDS.reduce((s, f) => s + (parseFloat(loanForm.costs?.[f.key]) || 0), 0);

  const handleLoanChange = (e) => {
    const { name, value } = e.target;
    setLoanForm(p => ({ ...p, [name]: value }));
  };
  const handleLoanCostChange = (key, value) => {
    setLoanForm(p => ({ ...p, costs: { ...p.costs, [key]: value } }));
  };
  const handleLoanSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await createLendingRequest(activeOrgId, loanForm);
    if (error) { alert('Submission failed: ' + (error.message || error)); return; }
    setLoanConfirm(data?.ref ?? 'submitted');
    setLoanRequests(prev => [data, ...prev]);
    setLoanForm(EMPTY_LOAN);
  };

  // ── Partnership form ──────────────────────────────────────────────────────
  const [partnerForm,    setPartnerForm]    = useState(EMPTY_PARTNER);
  const [partnerConfirm, setPartnerConfirm] = useState(null);
  const [partnerships,   setPartnerships]   = useState([]);

  const totalPartnerCosts = COST_FIELDS.reduce((s, f) => s + (parseFloat(partnerForm.costs?.[f.key]) || 0), 0);

  const handlePartnerChange = (e) => {
    const { name, value } = e.target;
    setPartnerForm(p => ({ ...p, [name]: value }));
  };
  const handlePartnerCostChange = (key, value) => {
    setPartnerForm(p => ({ ...p, costs: { ...p.costs, [key]: value } }));
  };
  const toggleNeed = (v) => {
    setPartnerForm(p => ({
      ...p,
      needs: p.needs.includes(v) ? p.needs.filter(n => n !== v) : [...p.needs, v],
    }));
  };
  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await createLendingPartnership(activeOrgId, partnerForm);
    if (error) { alert('Submission failed: ' + (error.message || error)); return; }
    setPartnerConfirm(data?.ref ?? 'submitted');
    setPartnerships(prev => [data, ...prev]);
    setPartnerForm(EMPTY_PARTNER);
  };

  // ── Hub submissions (lending_submissions table) ───────────────────────────
  const [hubSubmissions, setHubSubmissions] = useState([]);
  const [hubLoading,     setHubLoading]     = useState(true);
  const [selected,       setSelected]       = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [msgBody,        setMsgBody]        = useState('');
  const [msgSending,     setMsgSending]     = useState(false);
  const [withdrawing,    setWithdrawing]    = useState(false);

  const loadAll = useCallback(async () => {
    if (!activeOrgId) return;
    setHubLoading(true);
    const [reqs, parts, subs] = await Promise.all([
      fetchLendingRequests(activeOrgId),
      fetchLendingPartnerships(activeOrgId),
      fetchMySubmissions(activeOrgId),
    ]);
    setLoanRequests(reqs);
    setPartnerships(parts);
    setHubSubmissions(subs);
    setHubLoading(false);
  }, [activeOrgId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Pre-populate form if navigated from a deal detail page
  useEffect(() => {
    if (location.state?.prefillLoan) {
      setLoanForm({ ...EMPTY_LOAN, ...location.state.prefillLoan });
      setDrawer('financing');
      window.history.replaceState({}, '');
    } else if (location.state?.prefillPartner) {
      setPartnerForm({ ...EMPTY_PARTNER, ...location.state.prefillPartner });
      setDrawer('partnership');
      window.history.replaceState({}, '');
    }
  }, []);

  // ── Hub submission detail handlers ────────────────────────────────────────
  const openHubDetail = async (sub) => {
    setSelected(sub);
    setDrawer('hubDetail');
    const msgs = await fetchMessages(sub.id);
    setMessages(msgs);
  };

  const closeHubDetail = () => {
    setDrawer(null);
    setSelected(null);
    setMessages([]);
    setMsgBody('');
  };

  const handleSendMessage = async () => {
    if (!msgBody.trim() || !selected) return;
    setMsgSending(true);
    const { data, error } = await postMessage(
      selected.id, session?.user?.id, activeOrgId, msgBody, false,
    );
    setMsgSending(false);
    if (error) { alert('Could not send message.'); return; }
    setMessages(prev => [...prev, data]);
    setMsgBody('');
  };

  const handleWithdraw = async () => {
    if (!selected) return;
    if (!window.confirm('Withdraw this submission? This cannot be undone.')) return;
    setWithdrawing(true);
    const { data, error } = await withdrawSubmission(selected.id);
    setWithdrawing(false);
    if (error) { alert('Could not withdraw: ' + (error.message || error)); return; }
    setSelected(data);
    setHubSubmissions(prev => prev.map(s => s.id === data.id ? data : s));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-sidebar">My Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Submit deals to LotLine for financing or partnership review.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setLoanForm(EMPTY_LOAN); setLoanConfirm(null); setDrawer('financing'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a2332] text-white text-xs font-semibold rounded-xl hover:bg-[#1a2332]/90 transition-colors"
          >
            <Landmark size={13} className="text-accent flex-shrink-0" />
            Apply for Financing
          </button>
          <button
            type="button"
            onClick={() => { setPartnerForm(EMPTY_PARTNER); setPartnerConfirm(null); setDrawer('partnership'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-xs font-semibold rounded-xl hover:bg-accent/90 transition-colors"
          >
            <Handshake size={13} className="flex-shrink-0" />
            Submit a Deal for Review
          </button>
        </div>
      </div>

      {/* Tabs + table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {[
            { key: 'loans',        label: 'Loan Requests',         count: loanRequests.length },
            { key: 'partnerships', label: 'Partnership Submissions', count: partnerships.length },
            { key: 'hub',          label: 'Hub Submissions',        count: hubSubmissions.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
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

        {/* Loan requests */}
        {activeTab === 'loans' && (
          loanRequests.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">No loan requests yet</p>
              <button
                type="button"
                onClick={() => { setLoanForm(EMPTY_LOAN); setLoanConfirm(null); setDrawer('financing'); }}
                className="mt-3 text-sm text-accent font-semibold hover:underline"
              >
                Apply for Financing →
              </button>
            </div>
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
                      <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">${Number(r.loanAmount).toLocaleString()}</td>
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

        {/* Partnership submissions */}
        {activeTab === 'partnerships' && (
          partnerships.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">No partnership submissions yet</p>
              <button
                type="button"
                onClick={() => { setPartnerForm(EMPTY_PARTNER); setPartnerConfirm(null); setDrawer('partnership'); }}
                className="mt-3 text-sm text-accent font-semibold hover:underline"
              >
                Submit a Deal for Review →
              </button>
            </div>
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
                      <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">${Number(r.projectedProfit).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                      <td className="py-3 px-4 whitespace-nowrap"><StatusBadge status={r.status} map={PARTNER_STATUS} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Hub (lending_submissions) */}
        {activeTab === 'hub' && (
          hubLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
          ) : hubSubmissions.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">No hub submissions yet</p>
              <p className="text-xs text-gray-400 mt-1">Use the "Submit for Funding" button on any deal to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Ref #', 'Address', 'Loan Requested', 'Hub', 'Submitted', 'Status', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hubSubmissions.map(sub => (
                    <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-accent whitespace-nowrap">{sub.ref}</td>
                      <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">{sub.address || '—'}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-sidebar whitespace-nowrap">
                        {sub.loanAmountRequested ? `$${Number(sub.loanAmountRequested).toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">{sub.hubOrgName || '—'}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                        {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <HubStatusBadge status={sub.status} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openHubDetail(sub)}
                          className="text-xs text-accent font-semibold hover:underline flex items-center gap-1"
                        >
                          <MessageSquare size={12} /> View
                        </button>
                      </td>
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
          <form onSubmit={handleLoanSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
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
                    <option>Land + Home Package</option><option>Fix &amp; Flip</option><option>DSCR</option><option>Bridge Loan</option><option>Construction</option><option>Land Loan</option>
                  </select>
                </Field>
                <Field label="Property Type">
                  <select name="propertyType" value={loanForm.propertyType} onChange={handleLoanChange} className={inp}>
                    <option>Manufactured Home</option><option>Single Family</option><option>Multi-Family</option><option>Land</option><option>Commercial</option>
                  </select>
                </Field>
              </div>

              {loanForm.loanType === 'Land + Home Package' && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <button type="button"
                    onClick={() => setLoanForm(p => ({ ...p, costsOpen: !p.costsOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Property Costs
                      {totalCosts > 0 && <span className="ml-2 font-bold text-accent normal-case">— ${totalCosts.toLocaleString()}</span>}
                    </span>
                    <ChevronRight size={14} className={`text-gray-400 transition-transform ${loanForm.costsOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {loanForm.costsOpen && (
                    <div className="px-4 py-3 space-y-2 bg-white">
                      {COST_FIELDS.map(f => (
                        <div key={f.key} className="flex items-center justify-between gap-3">
                          <label className="text-xs text-gray-500 flex-1">{f.label}</label>
                          <div className="relative w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                            <input type="number" min="0" value={loanForm.costs?.[f.key] || ''}
                              onChange={e => handleLoanCostChange(f.key, e.target.value)}
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right" />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                        <span className="text-xs font-bold text-gray-600">Total</span>
                        <span className="text-xs font-bold text-sidebar">${totalCosts.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
          <form onSubmit={handlePartnerSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
              <SectionHeading>Deal Details</SectionHeading>

              <Field label="Property Address">
                <input name="address" required value={partnerForm.address} onChange={handlePartnerChange} className={inp} placeholder="123 Main St, City, NC 28000" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Property Type">
                  <select name="propertyType" value={partnerForm.propertyType} onChange={handlePartnerChange} className={inp}>
                    <option>Manufactured</option><option>Modular Home</option><option>Single Family</option><option>Multi-Family</option><option>Land</option><option>Commercial</option>
                  </select>
                </Field>
                <Field label="Deal Type">
                  <select name="dealType" value={partnerForm.dealType} onChange={handlePartnerChange} className={inp}>
                    <option>Land + Home Package</option><option>Wholesale</option><option>Fix &amp; Flip</option><option>Buy &amp; Hold</option><option>New Construction</option><option>Land Deal</option>
                  </select>
                </Field>
              </div>

              {partnerForm.dealType !== 'Land + Home Package' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Purchase Price ($)">
                    <input name="purchasePrice" type="number" min="0" value={partnerForm.purchasePrice} onChange={handlePartnerChange} className={inp} placeholder="0" />
                  </Field>
                  <Field label="Estimated Repair Costs ($)">
                    <input name="repairCosts" type="number" min="0" value={partnerForm.repairCosts} onChange={handlePartnerChange} className={inp} placeholder="0" />
                  </Field>
                </div>
              )}

              {partnerForm.dealType === 'Land + Home Package' && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <button type="button"
                    onClick={() => setPartnerForm(p => ({ ...p, costsOpen: !p.costsOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Build Costs
                      {totalPartnerCosts > 0 && <span className="ml-2 font-bold text-accent normal-case">— ${totalPartnerCosts.toLocaleString()}</span>}
                    </span>
                    <ChevronRight size={14} className={`text-gray-400 transition-transform ${partnerForm.costsOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {partnerForm.costsOpen && (
                    <div className="px-4 py-3 space-y-2 bg-white">
                      {COST_FIELDS.map(f => (
                        <div key={f.key} className="flex items-center justify-between gap-3">
                          <label className="text-xs text-gray-500 flex-1">{f.label}</label>
                          <div className="relative w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                            <input type="number" min="0" value={partnerForm.costs?.[f.key] || ''}
                              onChange={e => handlePartnerCostChange(f.key, e.target.value)}
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right" />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                        <span className="text-xs font-bold text-gray-600">Total Build Cost</span>
                        <span className="text-xs font-bold text-sidebar">${totalPartnerCosts.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="After Repair Value ($)">
                  <input name="arv" type="number" min="0" value={partnerForm.arv} onChange={handlePartnerChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Projected Profit ($)">
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
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button type="submit" className="w-full justify-center">
                <Send size={14} className="mr-1.5" /> Submit Deal for Review
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      {/* ── Hub Submission Detail Drawer ─────────────────────────────────── */}
      <Drawer
        open={drawer === 'hubDetail' && !!selected}
        onClose={closeHubDetail}
        title={selected ? `${selected.ref} — ${selected.address || 'No address'}` : ''}
      >
        {selected && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <HubStatusBadge status={selected.status} />
                {selected.hubOrgName && (
                  <span className="text-xs text-gray-500">Hub: <strong>{selected.hubOrgName}</strong></span>
                )}
              </div>

              {selected.decisionNote && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Decision Note from Hub</p>
                  <p className="text-sm text-gray-700">{selected.decisionNote}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-accent uppercase tracking-widest mb-3">Deal Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Address',       selected.address],
                    ['County',        selected.county],
                    ['State',         selected.state],
                    ['Acreage',       selected.acreage],
                    ['ARV',           selected.arv ? `$${Number(selected.arv).toLocaleString()}` : null],
                    ['Purchase Price', selected.purchasePrice ? `$${Number(selected.purchasePrice).toLocaleString()}` : null],
                    ['Loan Requested', selected.loanAmountRequested ? `$${Number(selected.loanAmountRequested).toLocaleString()}` : null],
                    ['Loan Type',     selected.loanType],
                    ['Exit Strategy', selected.exitStrategy],
                    ['Credit Score',  selected.creditScore],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
                      <p className="text-sm font-medium text-sidebar mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
                {selected.notes && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Notes</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{selected.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-accent uppercase tracking-widest mb-3">Messages</p>
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map(msg => (
                      <div key={msg.id} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sidebar text-xs">{msg.authorName}</span>
                          <span className="text-gray-400 text-xs ml-auto">{new Date(msg.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700 text-xs leading-relaxed">{msg.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {['submitted', 'under_review'].includes(selected.status) && (
                <button
                  type="button"
                  disabled={withdrawing}
                  onClick={handleWithdraw}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline disabled:opacity-50"
                >
                  {withdrawing ? 'Withdrawing…' : 'Withdraw this submission'}
                </button>
              )}
            </div>

            {!['withdrawn', 'declined'].includes(selected.status) && (
              <div className="px-6 py-4 border-t border-gray-100 space-y-3 flex-shrink-0">
                <textarea
                  rows={2}
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  placeholder="Send a message to the LotLine team…"
                  className={inp + ' resize-none text-sm'}
                />
                <Button onClick={handleSendMessage} disabled={msgSending || !msgBody.trim()}>
                  <Send size={13} className="mr-1" /> {msgSending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

    </div>
  );
}
