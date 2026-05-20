import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Briefcase, ChevronDown, ChevronUp, Mail, Phone, X, UserPlus, Landmark, Handshake, Clock, CheckCircle, AlertCircle, ExternalLink, Pencil, Trash2, CreditCard, Send, Check, Sun, Moon, LayoutDashboard, BarChart2 } from 'lucide-react';
import { INVESTORS, ALL_DEALS_TABLE } from '../data/investors';
import { loadInvestors, addInvestor as storeAddInvestor, updateInvestor as storeUpdateInvestor, deleteInvestor as storeDeleteInvestor } from '../lib/investorsStore';
import { useDeals } from '../lib/DealsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth, useImpersonation } from '../lib/AuthContext';
import { logImpersonationStart } from '../lib/investorPortalData';
import { useJv } from '../lib/JvContext';
import { fetchCommitmentSummaries, fetchInvestors } from '../lib/capitalStackData';
import { upsertPrimaryAllocation, findInvestorByName } from '../lib/dealAllocationsClient';
import { calcNetProfit } from '../data/deals';
import { supabase } from '../lib/supabase';
import { markPaymentPaid, formatPaymentType, STATUS_LABEL, STATUS_PILL, applyOverdue } from '../lib/paymentScheduleData';
import { fetchLendingRequests, fetchLendingPartnerships } from '../lib/lendingData';
import InvestorActionBar from '../components/investor-portal/InvestorActionBar.jsx';
import InvestorTable from '../components/investor-portal/InvestorTable.jsx';

function formatPhone(raw) {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
}

const INVESTOR_COLORS = {
  'Atium Build Group LLC': 'bg-blue-100 text-blue-700',
  'Louis Isom': 'bg-purple-100 text-purple-700',
  'Windstone': 'bg-teal-100 text-teal-700',
  'Blue Bay Capital': 'bg-orange-100 text-orange-700',
  'Cash': 'bg-green-100 text-green-700',
  'None': 'bg-gray-100 text-gray-500',
};

function LenderBadge({ name }) {
  const cls = INVESTOR_COLORS[name] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {name}
    </span>
  );
}

// ── Invite Button ────────────────────────────────────────────────────────────
const PORTAL_URL = 'https://lotline-crm.vercel.app/investor/signup';

function InviteButton({ investor }) {
  const [sent, setSent] = useState(false);

  if (!investor.email) {
    return <span className="text-xs text-gray-300">No email</span>;
  }

  const signupUrl = `${PORTAL_URL}?email=${encodeURIComponent(investor.email)}`;
  const subject = encodeURIComponent(`You're invited to the LotLine Investor Portal`);
  const body = encodeURIComponent(
    `Hi ${investor.contact || investor.name},\n\n` +
    `You've been invited to access the LotLine Investor Portal, where you can view your active deals, track capital deployed, and monitor project progress in real time.\n\n` +
    `Click the link below to create your login and get started:\n` +
    `${signupUrl}\n\n` +
    `If you have any questions, feel free to reply to this email.\n\n` +
    `Best,\nThe LotLine Team`
  );

  function handleClick() {
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <a
      href={`mailto:${investor.email}?subject=${subject}&body=${body}`}
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors touch-manipulation ${
        sent
          ? 'bg-green-50 text-green-600 border border-green-200'
          : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'
      }`}
    >
      {sent ? <Check size={12} /> : <Send size={12} />}
      {sent ? 'Opened' : 'Send Invite'}
    </a>
  );
}

// Scrollable table wrapper for mobile
function TableScroll({ children }) {
  return <div className="overflow-x-auto -webkit-overflow-scrolling-touch">{children}</div>;
}

// ── Tab: All Deals ──────────────────────────────────────────────────────────
function AllDealsTab({ onDealClick }) {
  const { orgSlug } = useAuth();
  const { jvScope } = useJv();
  const staticDealsTable = (orgSlug === 'lotline-homes' && jvScope.mode === 'own_only') ? ALL_DEALS_TABLE : [];
  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs min-w-[680px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Address</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Pipeline</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Stage</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Lender / Capital</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Land Cost</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Construction</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Total Capital</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">ARV</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Close Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {staticDealsTable.map((deal, i) => (
              <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDealClick(deal)}>
                <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px]">{deal.address}</td>
                <td className="px-4 py-2.5 text-gray-600">{deal.pipeline}</td>
                <td className="px-4 py-2.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{deal.stage}</span>
                </td>
                <td className="px-4 py-2.5">
                  <LenderBadge name={deal.lender} />
                </td>
                <td className="px-4 py-2.5 text-right text-gray-600">${deal.landCost.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">${deal.construction.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-800">${deal.totalCapital.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">${deal.arv.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{deal.closeDate || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Investor Card (By Investor tab) ─────────────────────────────────────────
function InvestorCard({ investor, onDealClick, contextDeals = [] }) {
  const [expanded, setExpanded] = useState(false);
  const isCash = investor.name === 'Cash';
  const navigate = useNavigate();
  const { setImpersonating } = useImpersonation();

  const handleViewPortal = async () => {
    if (isCash) return;
    try {
      const { logId } = await logImpersonationStart(investor.id);
      setImpersonating({ investor, logId });
    } catch {
      setImpersonating({ investor });
    }
    navigate('/investor/home');
  };

  // Source of truth: deal_allocations only. A deal belongs to this investor
  // when at least one of its active (non-returned, amount > 0) allocations
  // points at investor.id. DealsContext merges allocations onto deal.allocations.
  const allInvestorDeals = contextDeals
    .filter(d => {
      if (d.isArchived) return false;
      return (d.allocations || []).some(a => a.investorId === investor.id);
    })
    .map(d => ({
      address: d.address,
      stage: d.stage,
      lender: investor.name,
      totalCapital: d.investorCapitalContributed != null ? Number(d.investorCapitalContributed) : d.totalActual != null ? Number(d.totalActual) : (d.land || 0) + (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0),
      landCost: d.land || 0,
      construction: d.totalActual != null ? Math.max(0, Number(d.totalActual) - (d.land || 0)) : (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0),
      arv: d.arv || 0,
      closeDate: d.closeDate || null,
    }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Users size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1a2332]">{investor.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">{isCash ? 'Cash Deals' : investor.name}</p>
                {!isCash && (
                  hasStandardTerms(investor) ? (
                    <span className="text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                      {termsBadgeText(investor)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-gray-400 italic">No terms set</span>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCash && <InviteButton investor={investor} />}
            <span className="bg-accent/10 text-accent text-xs font-bold px-2.5 py-1 rounded-full">
              {allInvestorDeals.length} {allInvestorDeals.length === 1 ? 'deal' : 'deals'}
            </span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">{isCash ? 'Total Build Cost' : 'Capital Invested'}</p>
            <p className="text-base font-bold text-[#1a2332]">${investor.capitalInvested.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-0.5">Total Returns</p>
            <p className="text-base font-bold text-gray-400">${investor.totalReturns.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-xs text-gray-400">ROI %</p>
            <p className="text-sm font-bold text-green-600">{investor.roiPct.toFixed(2)}%</p>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-400">ROI</p>
            <p className="text-sm font-bold text-blue-600">${investor.roiDollars.toLocaleString()}</p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <p className="text-xs text-gray-400">Ann. ROI</p>
            <p className="text-sm font-bold text-purple-600">{investor.avgAnnualizedRoi.toFixed(2)}%</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`grid gap-2 ${isCash ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors hover:bg-gray-50"
          >
            <span>View Deals</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {!isCash && (
            <button
              onClick={handleViewPortal}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-accent border border-accent/30 rounded-lg transition-colors hover:bg-accent/5"
            >
              <ExternalLink size={14} />
              <span>View Portal</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded deals */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {allInvestorDeals.map((deal, i) => (
            <div
              key={i}
              className="px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => onDealClick(deal)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{deal.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">{deal.stage}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Capital</p>
                  <p className="text-xs font-bold text-gray-800">${(deal.totalCapital || 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
                <span>Land: ${(deal.landCost || 0).toLocaleString()}</span>
                <span>Build: ${(deal.construction || 0).toLocaleString()}</span>
                <span>ARV: ${(deal.arv || 0).toLocaleString()}</span>
                {deal.closeDate && <span>Close: {deal.closeDate}</span>}
              </div>
            </div>
          ))}
          {allInvestorDeals.length === 0 && (
            <div className="px-5 py-4 text-xs text-gray-400 text-center">No deals assigned yet</div>
          )}
        </div>
      )}
    </div>
  );
}

const FINANCING_SCENARIOS_LIST = [
  { id: 'cash',                      label: 'Cash',                                        dbType: 'cash' },
  { id: 'hard-money-loan',           label: 'Hard Money Loan',                             dbType: 'hard_money_loan' },
  { id: 'hard-money-land-home',      label: 'Hard Money (Land + Home)',                    dbType: 'hard_money_land_home' },
  { id: 'hmcb',                      label: 'Hard Money – Construction Holdback',          dbType: 'hard_money_construction_holdback' },
  { id: 'loc',                       label: 'Line of Credit',                              dbType: 'line_of_credit' },
  { id: 'profit-split',              label: 'Profit Split',                                dbType: 'profit_split' },
  { id: 'committed-capital-partner', label: 'Committed Capital Partner (Multi-Deal)',      dbType: 'committed_capital_partner' },
  { id: 'pooled-loan',               label: 'Pooled Loan (Multi-Deal)',                    dbType: 'pooled_loan' },
];

// ── Assign Investor Modal ─────────────────────────────────────────────────────
function AssignFunderModal({ deal, investors, onAssign, onClose }) {
  const [mode, setMode] = useState('existing');
  const [selected, setSelected] = useState('');
  const [newName, setNewName] = useState('');

  // Financing scenario
  const [scenario, setScenario] = useState('');
  const [interestRate, setInterestRate] = useState(13);
  const [originationFeeType, setOriginationFeeType] = useState('percentage');
  const [originationFeePct, setOriginationFeePct] = useState(3);
  const [originationFeeFlat, setOriginationFeeFlat] = useState(0);
  const [servicingFeeType, setServicingFeeType] = useState('flat');
  const [servicingFeeFlat, setServicingFeeFlat] = useState(750);
  const [servicingFeePct, setServicingFeePct] = useState(0);
  const [balloonTerm, setBalloonTerm] = useState(12);
  const [holdPeriod, setHoldPeriod] = useState(6);
  const [monthlyHoldCost, setMonthlyHoldCost] = useState(250);
  const [profitSharePct, setProfitSharePct] = useState(0);
  const [capitalDeployedDate, setCapitalDeployedDate] = useState('');
  const [capitalReturnedDate, setCapitalReturnedDate] = useState('');
  const [ltcPct, setLtcPct] = useState(80);
  const [originationPoints, setOriginationPoints] = useState(0);
  const [creditLimit, setCreditLimit] = useState(0);
  const [drawPct, setDrawPct] = useState(100);
  const [annualFeePct, setAnnualFeePct] = useState(0);
  const [investorProfitSplitPct, setInvestorProfitSplitPct] = useState(50);
  // HMCB-specific
  const [hmcbPurchasePrice, setHmcbPurchasePrice] = useState(0);
  const [hmcbHoldbackAmount, setHmcbHoldbackAmount] = useState(0);
  const [hmcbTermMonths, setHmcbTermMonths] = useState(9);
  const [hmcbInterestRate, setHmcbInterestRate] = useState(13.5);
  const [hmcbOriginationFee, setHmcbOriginationFee] = useState(0);
  // CCP-specific
  const [ccpAllocationAmount, setCcpAllocationAmount] = useState(0);
  const [ccpPrefReturnPct, setCcpPrefReturnPct] = useState(0);
  const [ccpProfitSharePct, setCcpProfitSharePct] = useState(50);

  const existingInv = investors.find(i => i.name === selected);

  // Auto-set scenario when selecting an existing investor
  const handleSelectInvestor = (name) => {
    setSelected(name);
    const inv = investors.find(i => i.name === name);
    if (inv?.preferredFinancing) {
      const match = FINANCING_SCENARIOS_LIST.find(s => s.label === inv.preferredFinancing);
      if (match) setScenario(match.id);
    }
  };

  const funderName = mode === 'existing' ? selected : newName.trim();
  const canSubmit = !!funderName;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const terms = {
      scenario, interestRate, originationFeeType, originationFeePct, originationFeeFlat,
      servicingFeeType, servicingFeeFlat, servicingFeePct, balloonTerm, holdPeriod,
      monthlyHoldCost, profitSharePct, capitalDeployedDate, capitalReturnedDate,
      ltcPct, originationPoints, creditLimit, drawPct, annualFeePct, investorProfitSplitPct,
      // HMCB
      hmcb: { interestRate: hmcbInterestRate, termMonths: hmcbTermMonths, purchasePrice: hmcbPurchasePrice, holdbackAmount: hmcbHoldbackAmount, originationFee: hmcbOriginationFee, originationFeeMode: 'flat' },
      // CCP
      ccpAllocationAmount, ccpPrefReturnPct, ccpProfitSharePct,
    };
    onAssign({ funderName, terms, isNew: mode === 'new', newInvestor: mode === 'new' ? { name: funderName, standardTerms: '' } : null });
  };

  // Shared styles matching DealDetail
  const ni = 'w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30';
  const wi = 'w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30';
  const row = 'flex justify-between items-center py-1.5 border-b border-gray-50 text-xs last:border-0';
  const sec = 'bg-white rounded-xl border border-gray-100 px-4 py-3';
  const secTitle = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2';
  const toggleBtn = (active) => `px-2.5 py-1 text-xs transition-colors ${active ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Assign Investor</p>
            <p className="text-sm font-semibold text-gray-800 leading-snug">{deal.address}</p>
            <p className="text-xs text-gray-500 mt-0.5">Capital needed: <span className="font-semibold text-gray-700">${deal.totalCapital.toLocaleString()}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Mode toggle */}
          <div className="flex gap-2">
            {['existing', 'new'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${mode === m ? 'bg-accent text-white border-accent' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {m === 'existing' ? 'Existing Investor' : 'Add New Investor'}
              </button>
            ))}
          </div>

          {/* Investor selection */}
          {mode === 'existing' ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Investor</label>
              <select value={selected} onChange={e => handleSelectInvestor(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="">— Choose investor —</option>
                {investors.map(inv => <option key={inv.name} value={inv.name}>{inv.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Investor Name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. John Smith Capital"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          )}

          {/* Financing Scenario selector */}
          <div className={sec}>
            <p className={secTitle}>Financing Scenario</p>
            <select value={scenario} onChange={e => setScenario(e.target.value)}
              className="w-full text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30">
              <option value="">— Choose a scenario —</option>
              {FINANCING_SCENARIOS_LIST.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* ── Hard Money Loan ── */}
          {scenario === 'hard-money-loan' && (
            <div className={sec}>
              <p className={secTitle}>Loan Terms</p>
              <div className={row}><span className="text-gray-500">LTC % (Loan-to-Cost)</span><input type="number" value={ltcPct} onChange={e => setLtcPct(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Origination Points (%)</span><input type="number" value={originationPoints} onChange={e => setOriginationPoints(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Loan Term (months)</span><input type="number" value={balloonTerm} onChange={e => setBalloonTerm(+e.target.value||0)} className={ni} /></div>
            </div>
          )}

          {/* ── Hard Money (Land + Home) ── */}
          {scenario === 'hard-money-land-home' && (<>
            <div className={sec}>
              <p className={secTitle}>Interest</p>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value||0)} className={ni} /></div>
            </div>
            <div className={sec}>
              <div className="flex items-center justify-between mb-2">
                <p className={secTitle + ' mb-0'}>Origination Fee</p>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setOriginationFeeType('percentage')} className={toggleBtn(originationFeeType==='percentage')}>% of Total</button>
                  <button onClick={() => setOriginationFeeType('flat')} className={toggleBtn(originationFeeType==='flat')}>Flat $</button>
                </div>
              </div>
              {originationFeeType === 'percentage'
                ? <div className={row}><span className="text-gray-500">Fee Percentage (%)</span><input type="number" value={originationFeePct} onChange={e => setOriginationFeePct(+e.target.value||0)} className={ni} /></div>
                : <div className={row}><span className="text-gray-500">Flat Amount ($)</span><input type="number" value={originationFeeFlat} onChange={e => setOriginationFeeFlat(+e.target.value||0)} className={wi} /></div>
              }
            </div>
            <div className={sec}>
              <div className="flex items-center justify-between mb-2">
                <p className={secTitle + ' mb-0'}>Servicing Fee</p>
                <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                  <button onClick={() => setServicingFeeType('percentage')} className={toggleBtn(servicingFeeType==='percentage')}>% of Total</button>
                  <button onClick={() => setServicingFeeType('flat')} className={toggleBtn(servicingFeeType==='flat')}>Flat $</button>
                </div>
              </div>
              {servicingFeeType === 'percentage'
                ? <div className={row}><span className="text-gray-500">Fee Percentage (%)</span><input type="number" value={servicingFeePct} onChange={e => setServicingFeePct(+e.target.value||0)} className={ni} /></div>
                : <div className={row}><span className="text-gray-500">Flat Amount ($)</span><input type="number" value={servicingFeeFlat} onChange={e => setServicingFeeFlat(+e.target.value||0)} className={wi} /></div>
              }
            </div>
            <div className={sec}>
              <p className={secTitle}>Profit Share</p>
              <div className={row}><span className="text-gray-500">Profit Share (%)</span><input type="number" value={profitSharePct} onChange={e => setProfitSharePct(+e.target.value||0)} className={ni} /></div>
            </div>
            <div className={sec}>
              <p className={secTitle}>Terms & Hold Period</p>
              <div className={row}><span className="text-gray-500">Balloon Payment Term (months)</span><input type="number" value={balloonTerm} onChange={e => setBalloonTerm(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Hold Period (months)</span><input type="number" value={holdPeriod} onChange={e => setHoldPeriod(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Monthly Holding Costs ($)</span><input type="number" value={monthlyHoldCost} onChange={e => setMonthlyHoldCost(+e.target.value||0)} className={wi} /></div>
            </div>
            <div className={sec}>
              <p className={secTitle}>Capital Tracking</p>
              <div className={row}><span className="text-gray-500">Capital Deployed Date</span><input type="date" value={capitalDeployedDate} onChange={e => setCapitalDeployedDate(e.target.value)} className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" /></div>
              <div className={row}><span className="text-gray-500">Capital Returned Date</span><input type="date" value={capitalReturnedDate} onChange={e => setCapitalReturnedDate(e.target.value)} className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" /></div>
            </div>
          </>)}

          {/* ── Line of Credit ── */}
          {scenario === 'loc' && (
            <div className={sec}>
              <p className={secTitle}>Line of Credit Terms</p>
              <div className={row}><span className="text-gray-500">Credit Limit ($)</span><input type="number" value={creditLimit} onChange={e => setCreditLimit(+e.target.value||0)} className={wi} /></div>
              <div className={row}><span className="text-gray-500">Draw % (of Limit)</span><input type="number" value={drawPct} onChange={e => setDrawPct(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Annual Fee (%)</span><input type="number" value={annualFeePct} onChange={e => setAnnualFeePct(+e.target.value||0)} className={ni} /></div>
            </div>
          )}

          {/* ── Profit Split ── */}
          {scenario === 'profit-split' && (
            <div className={sec}>
              <p className={secTitle}>Profit Split</p>
              <div className={row}><span className="text-gray-500">Investor Profit Split (%)</span><input type="number" value={investorProfitSplitPct} onChange={e => setInvestorProfitSplitPct(+e.target.value||0)} className={ni} /></div>
            </div>
          )}

          {/* ── Hard Money – Construction Holdback ── */}
          {scenario === 'hmcb' && (
            <div className={sec}>
              <p className={secTitle}>Construction Holdback Loan</p>
              <div className={row}><span className="text-gray-500">Purchase Price ($)</span><input type="number" value={hmcbPurchasePrice} onChange={e => setHmcbPurchasePrice(+e.target.value||0)} className={wi} /></div>
              <div className={row}><span className="text-gray-500">Construction Holdback ($)</span><input type="number" value={hmcbHoldbackAmount} onChange={e => setHmcbHoldbackAmount(+e.target.value||0)} className={wi} /></div>
              <div className={row}><span className="text-gray-500">Annual Interest Rate (%)</span><input type="number" value={hmcbInterestRate} onChange={e => setHmcbInterestRate(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Loan Term (months)</span><input type="number" value={hmcbTermMonths} onChange={e => setHmcbTermMonths(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Origination Fee ($)</span><input type="number" value={hmcbOriginationFee} onChange={e => setHmcbOriginationFee(+e.target.value||0)} className={wi} /></div>
            </div>
          )}

          {/* ── Committed Capital Partner ── */}
          {scenario === 'committed-capital-partner' && (
            <div className={sec}>
              <p className={secTitle}>Committed Capital Partner</p>
              <div className={row}><span className="text-gray-500">Allocation Amount ($)</span><input type="number" value={ccpAllocationAmount} onChange={e => setCcpAllocationAmount(+e.target.value||0)} className={wi} /></div>
              <div className={row}><span className="text-gray-500">Preferred Return (%)</span><input type="number" value={ccpPrefReturnPct} onChange={e => setCcpPrefReturnPct(+e.target.value||0)} className={ni} /></div>
              <div className={row}><span className="text-gray-500">Profit Split (%)</span><input type="number" value={ccpProfitSharePct} onChange={e => setCcpProfitSharePct(+e.target.value||0)} className={ni} /></div>
            </div>
          )}

          {/* ── Pooled Loan ── */}
          {scenario === 'pooled-loan' && (
            <div className={sec}>
              <p className={secTitle}>Pooled Loan</p>
              <p className="text-xs text-gray-400 leading-snug">
                Pooled loan terms are managed in the Deal Detail → Financing tab. Assigning the investor here will set the scenario type — configure the loan pool from the deal directly.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <UserPlus size={12} /> Assign Investor
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Needs Funding ───────────────────────────────────────────────────────
function NeedsFundingTab({ onDealClick, orgId, orgSlug, investors: investorsProp }) {
  const { deals: contextDeals, saveDeal, setDeals } = useDeals();

  // A deal needs funding when it has zero active, amount>0 allocations to a
  // real (non-Cash) investor. Cash-only allocations still count as needing
  // funding since Cash means internal capital, not a third-party investor.
  const LAND_ACQ_STAGES = new Set(['New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract']);
  const liveUnfunded = contextDeals
    .filter(d => {
      if (d.isArchived || LAND_ACQ_STAGES.has(d.stage)) return false;
      const nonCashAllocs = (d.allocations || []).filter(a => a.investorName !== 'Cash');
      return nonCashAllocs.length === 0;
    })
    .map(d => {
      const totalCapital = d.totalActual != null ? Number(d.totalActual) : (d.land || 0) + (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0);
      return {
        address: d.address,
        pipeline: d.stage,
        stage: d.stage,
        lender: '',
        totalCapital,
        landCost: d.land || 0,
        construction: totalCapital - (d.land || 0),
        arv: d.arv || 0,
        closeDate: d.closeDate || null,
        _isLive: true,
      };
    });

  const [assignments, setAssignments] = useState({});
  const [extraInvestors, setExtraInvestors] = useState([]);
  const [modalDeal, setModalDeal] = useState(null);

  // Once assigned in this session, deal leaves the list immediately (the context
  // update is also pushed below, so the filter naturally excludes it next render).
  const deals = liveUnfunded.filter(d => !assignments[d.address]);
  const totalNeeded = deals.reduce((s, d) => s + (d.totalCapital || 0), 0);

  const baseInvestors = investorsProp ?? loadInvestors(orgId, orgSlug);
  const allInvestors = [
    ...baseInvestors.filter(i => i.name !== 'Cash' && i.name !== 'None'),
    ...extraInvestors.filter(e => !baseInvestors.find(i => i.name === e.name)),
  ];

  const handleAssign = ({ funderName, terms, isNew, newInvestor }) => {
    if (isNew && newInvestor) {
      setExtraInvestors(prev => [...prev, newInvestor]);
    }
    setAssignments(prev => ({ ...prev, [modalDeal.address]: { funder: funderName, terms } }));

    // Write investor + full financing data back to the deal
    const norm = a => (a || '').trim().toLowerCase();
    const matchedDeal = contextDeals.find(d => norm(d.address) === norm(modalDeal.address));
    if (matchedDeal) {
      const scenarioMeta = FINANCING_SCENARIOS_LIST.find(s => s.id === terms?.scenario);
      const newScenarioData = {
        interestRate:           terms.interestRate,
        originationFeeType:     terms.originationFeeType,
        originationFeePct:      terms.originationFeePct,
        originationFeeFlat:     terms.originationFeeFlat,
        servicingFeeType:       terms.servicingFeeType,
        servicingFeeFlat:       terms.servicingFeeFlat,
        servicingFeePct:        terms.servicingFeePct,
        balloonTerm:            terms.balloonTerm,
        holdPeriod:             terms.holdPeriod,
        monthlyHoldCost:        terms.monthlyHoldCost,
        profitSharePct:         terms.profitSharePct,
        ltcPct:                 terms.ltcPct,
        originationPoints:      terms.originationPoints,
        creditLimit:            terms.creditLimit,
        drawPct:                terms.drawPct,
        annualFeePct:           terms.annualFeePct,
        investorProfitSplitPct: terms.investorProfitSplitPct,
        hmcb:                   terms.hmcb,
        ccpAllocationAmount:    terms.ccpAllocationAmount,
        ccpPrefReturnPct:       terms.ccpPrefReturnPct,
        ccpProfitSharePct:      terms.ccpProfitSharePct,
      };
      // deals.investor is no longer written; the upsertPrimaryAllocation call
      // below is the only investor-assignment write path. Financing scenario
      // and capital dates still live on the deal row.
      const updatedDeal = {
        ...matchedDeal,
        financing:             scenarioMeta?.label || terms?.scenario || matchedDeal.financing,
        financingScenarioType: scenarioMeta?.dbType || null,
        capitalDeployedDate:   terms.capitalDeployedDate || matchedDeal.capitalDeployedDate || null,
        capitalReturnedDate:   terms.capitalReturnedDate || matchedDeal.capitalReturnedDate || null,
        scenarioData:          { ...(matchedDeal.scenarioData || {}), ...newScenarioData },
      };
      saveDeal(updatedDeal);
      setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d));

      // ── Phase 3: mirror this assignment into deal_allocations ────────────
      // Best-effort. Failures here don't block the saveDeal above.
      (async () => {
        try {
          const SPECIAL = new Set(['Cash', 'None', '']);
          if (SPECIAL.has(funderName.trim())) return;
          const inv = await findInvestorByName(funderName, matchedDeal.organization_id || orgId);
          if (!inv?.id) {
            console.warn('[NeedsFundingTab] no investor row for "%s"', funderName);
            return;
          }
          await upsertPrimaryAllocation({
            dealId:             matchedDeal.id,
            organizationId:     matchedDeal.organization_id || orgId,
            investorId:         inv.id,
            amount:             Number(matchedDeal.investorCapitalContributed) || Number(matchedDeal.totalActual) || 1,
            preferredReturnPct: terms.interestRate ?? null,
            profitSharePct:     terms.investorProfitSplitPct ?? terms.profitSharePct ?? null,
            sourceScenario:     scenarioMeta?.dbType ?? terms?.scenario ?? null,
            status:             'committed',
            notes:              'Assigned via Needs Funding modal on ' + new Date().toISOString().slice(0, 10),
          });
        } catch (err) {
          console.warn('[NeedsFundingTab] allocation mirror failed:', err?.message || err);
        }
      })();
    }

    setModalDeal(null);
  };

  return (
    <div>
      {/* Summary banner */}
      <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <DollarSign size={16} className="text-amber-500 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-bold">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span> need{deals.length === 1 ? 's' : ''} funding —{' '}
          <span className="font-bold">${totalNeeded.toLocaleString()}</span> total capital required
        </p>
      </div>

      {deals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
          All deals have a funder assigned.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Address</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Stage</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Total Capital</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">ARV</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deals.map((deal, i) => (
                <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDealClick(deal)}>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                    <div>{deal.address}</div>
                    <div className="text-gray-400 font-normal mt-0.5">{deal.pipeline}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{deal.stage}</span>
                  </td>
                  <td className="px-4 py-3">
                    {deal.lender === 'Cash'
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Cash</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">No Funder</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">${deal.totalCapital.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${deal.arv.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); setModalDeal(deal); }}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors whitespace-nowrap"
                    >
                      <UserPlus size={11} /> Assign Investor
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalDeal && (
        <AssignFunderModal
          deal={modalDeal}
          investors={allInvestors}
          onAssign={handleAssign}
          onClose={() => setModalDeal(null)}
        />
      )}
    </div>
  );
}

// ── Tab: By Investor ─────────────────────────────────────────────────────────
function ByInvestorTab({ onDealClick, linkedInvestor, investors, contextDeals }) {
  const navigate = useNavigate();
  const { setImpersonating } = useImpersonation();
  const [searchValue, setSearchValue] = useState('');
  const [sortValue, setSortValue] = useState(() => {
    try { return localStorage.getItem('byInvestorSort') || 'capital_desc'; } catch { return 'capital_desc'; }
  });

  // Persist sort preference so it survives a reload.
  useEffect(() => {
    try { localStorage.setItem('byInvestorSort', sortValue); } catch { /* ignore */ }
  }, [sortValue]);

  const displayInvestors = linkedInvestor
    ? investors.filter(inv => inv.name === linkedInvestor)
    : investors;

  if (linkedInvestor && displayInvestors.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-100 dark:border-white/8 p-10 text-center text-sm text-gray-400">
        No investor account found for &quot;{linkedInvestor}&quot;. Contact an admin to update your link.
      </div>
    );
  }

  // Filter for action-bar counter (search applied inside the table too,
  // but we need the count up front for the "X of Y" label).
  const q = searchValue.trim().toLowerCase();
  const filteredCount = q
    ? displayInvestors.filter(inv => {
        const name = String(inv.name || '').toLowerCase();
        const terms = String(termsBadgeText(inv) || '').toLowerCase();
        return name.includes(q) || terms.includes(q);
      }).length
    : displayInvestors.length;

  const handleViewPortal = async (investor) => {
    if (!investor || investor.name === 'Cash') return;
    try {
      const { logId } = await logImpersonationStart(investor.id);
      setImpersonating({ investor, logId });
    } catch {
      setImpersonating({ investor });
    }
    navigate('/investor/home');
  };

  return (
    <div>
      <InvestorActionBar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        sortValue={sortValue}
        onSortChange={setSortValue}
        totalCount={displayInvestors.length}
        filteredCount={filteredCount}
      />
      <InvestorTable
        investors={displayInvestors}
        contextDeals={contextDeals}
        searchValue={searchValue}
        sortValue={sortValue}
        onDealClick={onDealClick}
        onViewPortal={handleViewPortal}
        hasStandardTerms={hasStandardTerms}
        termsBadgeText={termsBadgeText}
      />
    </div>
  );
}

// ── Standard Terms ───────────────────────────────────────────────────────────
const SCENARIO_LABELS = {
  'hard-money-loan':           'Hard Money Loan',
  'hard-money-land-home':      'Hard Money (Land + Home)',
  'hmcb':                      'Hard Money – Construction Holdback',
  'loc':                       'Line of Credit',
  'profit-split':              'Profit Split',
  'committed-capital-partner': 'Committed Capital Partner',
};

const SCENARIO_SHORT = {
  'hard-money-loan':           'HML',
  'hard-money-land-home':      'HM L+H',
  'hmcb':                      'HMCB',
  'loc':                       'LoC',
  'profit-split':              'Profit Split',
  'committed-capital-partner': 'CCP',
};

const PAYMENT_DUE_DAYS = ['1st', '5th', '10th', '15th', '20th', '25th', 'same_as_closing'];

function hasStandardTerms(inv) {
  return Boolean(
    inv?.defaultScenarioType ||
    inv?.defaultInterestRate ||
    inv?.defaultHoldPeriodMonths ||
    inv?.defaultTermMonths ||
    inv?.defaultOriginationFeePct ||
    inv?.defaultDrawFee ||
    inv?.defaultServicingFee
  );
}

function termsBadgeText(inv) {
  if (!hasStandardTerms(inv)) return null;
  const parts = [];
  if (inv.defaultInterestRate != null) parts.push(`${inv.defaultInterestRate}%`);
  if (inv.defaultScenarioType) parts.push(SCENARIO_SHORT[inv.defaultScenarioType] || inv.defaultScenarioType);
  const months = inv.defaultTermMonths ?? inv.defaultHoldPeriodMonths;
  if (months) parts.push(`${months}mo`);
  return parts.join(' • ');
}

function StandardTermsSlideover({ investor, onClose, onSave }) {
  const [form, setForm] = useState({
    defaultScenarioType:       investor?.defaultScenarioType       || '',
    defaultInterestRate:       investor?.defaultInterestRate       ?? '',
    defaultHoldPeriodMonths:   investor?.defaultHoldPeriodMonths   ?? '',
    defaultTermMonths:         investor?.defaultTermMonths         ?? '',
    defaultOriginationFeePct:  investor?.defaultOriginationFeePct  ?? '',
    defaultOriginationFeeType: investor?.defaultOriginationFeeType || 'percentage',
    defaultOriginationFeeFlat: investor?.defaultOriginationFeeFlat ?? '',
    defaultDrawFee:            investor?.defaultDrawFee            ?? '',
    defaultServicingFee:       investor?.defaultServicingFee       ?? '',
    defaultExtensionAvailable: investor?.defaultExtensionAvailable ?? false,
    defaultExtensionMonths:    investor?.defaultExtensionMonths    ?? '',
    defaultExtensionFeePoints: investor?.defaultExtensionFeePoints ?? '',
    defaultPaymentDueDay:      investor?.defaultPaymentDueDay      || '',
    defaultPaymentTiming:      investor?.defaultPaymentTiming      || 'at_exit',
    defaultLtcPct:             investor?.defaultLtcPct             ?? '',
    defaultMaxLoanAmount:      investor?.defaultMaxLoanAmount      ?? '',
    defaultPosition:           investor?.defaultPosition           || '1st Position',
    defaultPreferredReturnPct: investor?.defaultPreferredReturnPct ?? '',
    defaultProfitSharePct:     investor?.defaultProfitSharePct     ?? '',
    termsNotes:                investor?.termsNotes                || '',
  });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

  const handleSave = async () => {
    setSaving(true);
    const patch = {
      defaultScenarioType:       form.defaultScenarioType || null,
      defaultInterestRate:       numOrNull(form.defaultInterestRate),
      defaultHoldPeriodMonths:   numOrNull(form.defaultHoldPeriodMonths),
      defaultTermMonths:         numOrNull(form.defaultTermMonths),
      defaultOriginationFeePct:  numOrNull(form.defaultOriginationFeePct),
      defaultOriginationFeeType: form.defaultOriginationFeeType || 'percentage',
      defaultOriginationFeeFlat: numOrNull(form.defaultOriginationFeeFlat),
      defaultDrawFee:            numOrNull(form.defaultDrawFee),
      defaultServicingFee:       numOrNull(form.defaultServicingFee),
      defaultExtensionAvailable: !!form.defaultExtensionAvailable,
      defaultExtensionMonths:    numOrNull(form.defaultExtensionMonths),
      defaultExtensionFeePoints: numOrNull(form.defaultExtensionFeePoints),
      defaultPaymentDueDay:      form.defaultPaymentDueDay || null,
      defaultPaymentTiming:      form.defaultPaymentTiming || 'at_exit',
      defaultLtcPct:             numOrNull(form.defaultLtcPct),
      defaultMaxLoanAmount:      numOrNull(form.defaultMaxLoanAmount),
      defaultPosition:           form.defaultPosition || '1st Position',
      defaultPreferredReturnPct: numOrNull(form.defaultPreferredReturnPct),
      defaultProfitSharePct:     numOrNull(form.defaultProfitSharePct),
      termsNotes:                form.termsNotes || '',
    };
    await onSave(patch);
    setSaving(false);
  };

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-white';
  const lbl = 'text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1 block';
  const section = 'text-[11px] uppercase tracking-wider text-gray-400 font-bold mt-4 mb-2';

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-[#1a2332]">Standard Terms — {investor?.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              These defaults auto-populate when this investor is selected in any deal's financing tab.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-3"><X size={18} /></button>
        </div>

        <div className="p-5 flex-1">
          <p className={section}>Default Scenario</p>
          <select
            className={inp}
            value={form.defaultScenarioType}
            onChange={e => update('defaultScenarioType', e.target.value)}
          >
            <option value="">— No default —</option>
            {Object.entries(SCENARIO_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          <p className={section}>Loan Terms</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Annual Interest Rate (%)</label>
              <input type="number" step="0.01" className={inp} value={form.defaultInterestRate}
                onChange={e => update('defaultInterestRate', e.target.value)} placeholder="13.5" />
            </div>
            <div>
              <label className={lbl}>Term Length (Months)</label>
              <input type="number" className={inp} value={form.defaultTermMonths}
                onChange={e => update('defaultTermMonths', e.target.value)} placeholder="9" />
            </div>
            <div>
              <label className={lbl}>Hold Period (Months)</label>
              <input type="number" className={inp} value={form.defaultHoldPeriodMonths}
                onChange={e => update('defaultHoldPeriodMonths', e.target.value)} placeholder="6" />
            </div>
            <div>
              <label className={lbl}>Position</label>
              <select className={inp} value={form.defaultPosition} onChange={e => update('defaultPosition', e.target.value)}>
                <option>1st Position</option>
                <option>2nd Position</option>
                <option>Pari-passu</option>
              </select>
            </div>
          </div>

          <p className={section}>Fees</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Origination Fee Type</label>
              <select className={inp} value={form.defaultOriginationFeeType}
                onChange={e => update('defaultOriginationFeeType', e.target.value)}>
                <option value="percentage">% of loan</option>
                <option value="flat">Flat $</option>
              </select>
            </div>
            {form.defaultOriginationFeeType === 'percentage' ? (
              <div>
                <label className={lbl}>Origination Fee (%)</label>
                <input type="number" step="0.01" className={inp} value={form.defaultOriginationFeePct}
                  onChange={e => update('defaultOriginationFeePct', e.target.value)} placeholder="2.75" />
              </div>
            ) : (
              <div>
                <label className={lbl}>Origination Fee ($)</label>
                <input type="number" step="0.01" className={inp} value={form.defaultOriginationFeeFlat}
                  onChange={e => update('defaultOriginationFeeFlat', e.target.value)} placeholder="2500" />
              </div>
            )}
            <div>
              <label className={lbl}>Draw Fee ($ per draw)</label>
              <input type="number" step="0.01" className={inp} value={form.defaultDrawFee}
                onChange={e => update('defaultDrawFee', e.target.value)} placeholder="115" />
            </div>
            <div>
              <label className={lbl}>Servicing Fee ($)</label>
              <input type="number" step="0.01" className={inp} value={form.defaultServicingFee}
                onChange={e => update('defaultServicingFee', e.target.value)} placeholder="400" />
            </div>
          </div>

          <p className={section}>Extension</p>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={!!form.defaultExtensionAvailable}
              onChange={e => update('defaultExtensionAvailable', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent/50" />
            <span className="text-sm text-gray-700">Extension available</span>
          </label>
          {form.defaultExtensionAvailable && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Extension Months</label>
                <input type="number" className={inp} value={form.defaultExtensionMonths}
                  onChange={e => update('defaultExtensionMonths', e.target.value)} placeholder="3" />
              </div>
              <div>
                <label className={lbl}>Extension Fee (points)</label>
                <input type="number" step="0.25" className={inp} value={form.defaultExtensionFeePoints}
                  onChange={e => update('defaultExtensionFeePoints', e.target.value)} placeholder="1" />
              </div>
            </div>
          )}

          <p className={section}>Payments & Limits</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Payment Due Day</label>
              <select className={inp} value={form.defaultPaymentDueDay}
                onChange={e => update('defaultPaymentDueDay', e.target.value)}>
                <option value="">— Not set —</option>
                {PAYMENT_DUE_DAYS.map(d => <option key={d} value={d}>{d === 'same_as_closing' ? 'Same as closing' : d + ' of month'}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Payment Timing</label>
              <select className={inp} value={form.defaultPaymentTiming}
                onChange={e => update('defaultPaymentTiming', e.target.value)}>
                <option value="at_exit">At exit</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label className={lbl}>LTC (%)</label>
              <input type="number" step="0.01" className={inp} value={form.defaultLtcPct}
                onChange={e => update('defaultLtcPct', e.target.value)} placeholder="80" />
            </div>
            <div>
              <label className={lbl}>Max Loan Amount ($)</label>
              <input type="number" className={inp} value={form.defaultMaxLoanAmount}
                onChange={e => update('defaultMaxLoanAmount', e.target.value)} placeholder="500000" />
            </div>
          </div>

          {(form.defaultScenarioType === 'profit-split' || form.defaultScenarioType === 'committed-capital-partner') && (
            <>
              <p className={section}>Profit / Pref</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Preferred Return (%)</label>
                  <input type="number" step="0.01" className={inp} value={form.defaultPreferredReturnPct}
                    onChange={e => update('defaultPreferredReturnPct', e.target.value)} placeholder="12" />
                </div>
                <div>
                  <label className={lbl}>Profit Share (%)</label>
                  <input type="number" step="0.01" className={inp} value={form.defaultProfitSharePct}
                    onChange={e => update('defaultProfitSharePct', e.target.value)} placeholder="50" />
                </div>
              </div>
            </>
          )}

          <p className={section}>Terms Notes (optional)</p>
          <textarea rows={4} className={inp} value={form.termsNotes}
            onChange={e => update('termsNotes', e.target.value)}
            placeholder="Anything else? E.g. Requires MCO, property inspection, insurance with lender as mortgagee, clear title."
          />
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-white sticky bottom-0">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="text-sm bg-accent text-white rounded-lg px-4 py-1.5 hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Standard Terms'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Directory ───────────────────────────────────────────────────────────
function EditInvestorModal({ investor, onClose, onSave }) {
  const [form, setForm] = useState({
    name:    investor?.name    || '',
    contact: investor?.contact || '',
    email:   investor?.email   || '',
    phone:   investor?.phone   || '',
    type:    investor?.type    || 'Private Lender',
    preferredFinancing: investor?.preferredFinancing || '',
    standardTerms:      investor?.standardTerms      || '',
    notes:   investor?.notes   || '',
  });
  const [saving, setSaving] = useState(false);
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30';
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Edit Investor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input className={inputCls} value={form.name} onChange={e => update('name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Contact</label>
              <input className={inputCls} value={form.contact} onChange={e => update('contact', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Type</label>
              <input className={inputCls} value={form.type} onChange={e => update('type', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={e => update('email', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <input className={inputCls} value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Preferred Financing</label>
            <input className={inputCls} value={form.preferredFinancing} onChange={e => update('preferredFinancing', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Standard Terms</label>
            <input className={inputCls} value={form.standardTerms} onChange={e => update('standardTerms', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <textarea rows={3} className={inputCls} value={form.notes} onChange={e => update('notes', e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="text-sm bg-accent text-white rounded-lg px-4 py-1.5 hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DirectoryTab({ investors, onUpdate, onDelete }) {
  // Show every investor in the org except the synthetic "Cash" placeholder.
  const contacts = investors.filter(i => i.name && i.name !== 'Cash');
  const [editing, setEditing] = useState(null);
  const [termsFor, setTermsFor] = useState(null);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Investor</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Contact</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Email</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Phone</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Deals</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Standard Terms</th>
            <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Portal Invite</th>
            <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {contacts.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-6 text-xs text-gray-400 text-center">No investors yet</td></tr>
          )}
          {contacts.map(inv => {
            const hasTerms = hasStandardTerms(inv);
            const badge = termsBadgeText(inv);
            return (
            <tr key={inv.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Users size={13} className="text-accent" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800">{inv.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-gray-700">{inv.contact || '—'}</td>
              <td className="px-4 py-3">
                {inv.email ? (
                  <a href={`mailto:${inv.email}`} className="text-xs text-accent hover:underline flex items-center gap-1">
                    <Mail size={11} /> {inv.email}
                  </a>
                ) : <span className="text-xs text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3">
                {inv.phone ? (
                  <a href={`tel:${inv.phone}`} className="text-xs text-gray-700 flex items-center gap-1 hover:text-accent">
                    <Phone size={11} /> {formatPhone(inv.phone)}
                  </a>
                ) : <span className="text-xs text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3">
                <span className="text-xs font-medium text-accent">{inv.activeDeals} {inv.activeDeals === 1 ? 'deal' : 'deals'}</span>
              </td>
              <td className="px-4 py-3">
                <InviteButton investor={inv} />
              </td>
              <td className="px-4 py-3">
                {hasTerms ? (
                  <button
                    onClick={() => setTermsFor(inv)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent hover:text-accent/80 bg-accent/10 hover:bg-accent/15 px-2 py-1 rounded-full transition-colors"
                    title="View standard terms"
                  >
                    <CheckCircle size={11} /> {badge}
                  </button>
                ) : (
                  <button
                    onClick={() => setTermsFor(inv)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-full transition-colors"
                    title="Set standard terms"
                  >
                    <AlertCircle size={11} /> Set Terms
                  </button>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => setEditing(inv)}
                  title="Edit investor"
                  className="text-gray-400 hover:text-accent transition-colors mr-2"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${inv.name}"?\n\nThis removes them from the directory and clears any deal references — cannot be undone.`)) {
                      onDelete?.(inv);
                    }
                  }}
                  title="Delete investor"
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {editing && (
        <EditInvestorModal
          investor={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await onUpdate?.(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
      {termsFor && (
        <StandardTermsSlideover
          investor={termsFor}
          onClose={() => setTermsFor(null)}
          onSave={async (patch) => {
            await onUpdate?.(termsFor.id, patch);
            setTermsFor(null);
          }}
        />
      )}
    </div>
  );
}

// ── Tab: Available Investments ───────────────────────────────────────────────
const LOAN_STATUS_COLORS = {
  'Pending Review': 'bg-yellow-100 text-yellow-700',
  'In Review':      'bg-blue-100 text-blue-700',
  'Approved':       'bg-green-100 text-green-700',
  'Declined':       'bg-red-100 text-red-700',
};
const PARTNER_STATUS_COLORS = {
  'Under Review':  'bg-yellow-100 text-yellow-700',
  'Interested':    'bg-blue-100 text-blue-700',
  'In Discussion': 'bg-green-100 text-green-700',
  'Pass':          'bg-red-100 text-red-700',
};

function AvailableInvestmentsTab({ onDealClick }) {
  const { activeOrgId } = useAuth();
  const [loanRequests, setLoanRequests] = useState([]);
  const [partnerships, setPartnerships] = useState([]);

  useEffect(() => {
    if (!activeOrgId) return;
    let cancelled = false;
    Promise.all([
      fetchLendingRequests(activeOrgId),
      fetchLendingPartnerships(activeOrgId),
    ]).then(([loans, parts]) => {
      if (cancelled) return;
      setLoanRequests(loans);
      setPartnerships(parts);
    });
    return () => { cancelled = true; };
  }, [activeOrgId]);

  const hasAny = loanRequests.length > 0 || partnerships.length > 0;

  if (!hasAny) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Landmark size={22} className="text-accent" />
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">No available investments yet</p>
        <p className="text-xs text-gray-400">Deals submitted for financing or partnership will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financing Requests */}
      {loanRequests.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Landmark size={15} className="text-accent" />
            <h3 className="text-sm font-bold text-[#1a2332]">Financing Requests</h3>
            <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded-full">{loanRequests.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ref #', 'Address', 'Loan Amount', 'Loan Type', 'Date Submitted', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loanRequests.map(r => (
                  <tr key={r.ref} onClick={() => onDealClick({ address: r.address })} className="hover:bg-gray-50/60 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{r.address}</td>
                    <td className="px-4 py-3 font-semibold text-[#1a2332] whitespace-nowrap">${(r.loanAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.loanType}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${LOAN_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Partnership Submissions */}
      {partnerships.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Handshake size={15} className="text-accent" />
            <h3 className="text-sm font-bold text-[#1a2332]">Partnership Submissions</h3>
            <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-0.5 rounded-full">{partnerships.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Ref #', 'Address', 'Deal Type', 'Projected Profit', 'Date Submitted', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {partnerships.map(r => (
                  <tr key={r.ref} onClick={() => onDealClick({ address: r.address })} className="hover:bg-gray-50/60 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-accent whitespace-nowrap">{r.ref}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{r.address}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.dealType}</td>
                    <td className="px-4 py-3 font-semibold text-[#1a2332] whitespace-nowrap">${(r.projectedProfit || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.dateSubmitted}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${PARTNER_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Payments (admin — all upcoming payments across all investors) ────────
const PAYMENT_FILTERS = ['upcoming', 'overdue', 'all', 'paid'];
const PAYMENT_FILTER_LABEL = { upcoming: 'Upcoming', overdue: 'Overdue', all: 'All', paid: 'Paid' };

function RecordPaymentModal({ row, onClose, onSaved }) {
  const [amount, setAmount]   = useState(String(row.amount ?? ''));
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [wireRef, setWireRef] = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    const { error } = await markPaymentPaid({
      scheduleRow: row,
      paidAmount: Number(amount),
      paidDate: date,
      wireRef: wireRef || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) { setErr(String(error?.message || error)); return; }
    onSaved?.();
  };

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-gray-50';

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{row.investors?.name || 'Investor'} — {row.deals?.address || row.deal_id}</p>
            <p className="text-xs text-gray-500">{formatPaymentType(row.payment_type)} #{row.payment_number || 1} · Due {row.due_date}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount Paid</label>
            <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date Paid</label>
            <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Wire / Ref # (optional)</label>
            <input className={inputCls} value={wireRef} onChange={e => setWireRef(e.target.value)} placeholder="Wire reference" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <textarea rows={2} className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes…" />
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5">Cancel</button>
          <button onClick={handleSave} disabled={saving || !amount || !date}
            className="text-sm bg-accent text-white rounded-lg px-4 py-1.5 hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PaymentsAdminTab({ orgId }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('upcoming');
  const [markRow, setMarkRow]   = useState(null);

  const loadRows = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('investor_payment_schedule')
      .select('*, deals(address), investors(name)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true });
    if (!error) setRows(applyOverdue(data || []));
    setLoading(false);
  };

  useEffect(() => { loadRows(); }, [orgId]);

  const filtered = useMemo(() => {
    if (filter === 'upcoming') return rows.filter(r => r.status === 'scheduled');
    if (filter === 'overdue')  return rows.filter(r => r.status === 'overdue');
    if (filter === 'paid')     return rows.filter(r => r.status === 'paid');
    return rows;
  }, [rows, filter]);

  const totalOwed = useMemo(
    () => rows.filter(r => r.status === 'scheduled' || r.status === 'overdue').reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [rows]
  );
  const totalOverdue = useMemo(
    () => rows.filter(r => r.status === 'overdue').reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [rows]
  );
  const nextDue = rows.find(r => r.status === 'scheduled' || r.status === 'overdue');
  const fmt = n => `$${Math.round(n ?? 0).toLocaleString()}`;
  const fmtDate = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  if (loading) {
    return <div className="text-xs text-gray-400 text-center py-10">Loading payment schedule…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Next Payment Due', value: nextDue ? fmt(nextDue.amount) : '—', sub: nextDue ? fmtDate(nextDue.due_date) : 'No upcoming', accent: 'text-accent' },
          { label: 'Total Outstanding', value: fmt(totalOwed), sub: `${rows.filter(r => r.status === 'scheduled' || r.status === 'overdue').length} payments`, accent: 'text-blue-600' },
          { label: 'Overdue', value: fmt(totalOverdue), sub: `${rows.filter(r => r.status === 'overdue').length} payments`, accent: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s.accent}`}>{s.label}</p>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Overdue banner */}
      {rows.filter(r => r.status === 'overdue').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{rows.filter(r => r.status === 'overdue').length} overdue payment{rows.filter(r => r.status === 'overdue').length === 1 ? '' : 's'}</strong> totaling {fmt(totalOverdue)}.
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 px-4 pt-3">
          {PAYMENT_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 pb-2.5 text-xs font-medium border-b-2 transition-colors mr-3 ${
                filter === f ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {PAYMENT_FILTER_LABEL[f]}
              <span className="ml-1 text-[10px] font-bold opacity-70">
                ({f === 'upcoming' ? rows.filter(r => r.status === 'scheduled').length
                  : f === 'overdue' ? rows.filter(r => r.status === 'overdue').length
                  : f === 'paid'   ? rows.filter(r => r.status === 'paid').length
                  : rows.length})
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            <CreditCard size={28} className="mx-auto text-gray-300 mb-2" />
            No {filter === 'all' ? '' : filter} payments.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Investor</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Deal</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">Due Date</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.investors?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{r.deals?.address || r.deal_id}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatPaymentType(r.payment_type)}
                    {r.payment_number ? <span className="text-gray-400"> #{r.payment_number}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    ${Number(r.status === 'paid' ? (r.paid_amount ?? r.amount) : r.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[r.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(r.status === 'scheduled' || r.status === 'overdue') && (
                      <button
                        onClick={() => setMarkRow(r)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors whitespace-nowrap"
                      >
                        <CheckCircle size={11} /> Record Payment
                      </button>
                    )}
                    {r.status === 'paid' && r.paid_date && (
                      <span className="text-xs text-gray-400">Paid {fmtDate(r.paid_date)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {markRow && (
        <RecordPaymentModal
          row={markRow}
          onClose={() => setMarkRow(null)}
          onSaved={() => { setMarkRow(null); loadRows(); }}
        />
      )}
    </div>
  );
}

// ── Tab: Commitments (headroom overview) ─────────────────────────────────────
function CommitmentsTab() {
  const { activeOrgId } = useAuth();
  const { jvScopeOrgIds } = useJv();
  const scopeIds = jvScopeOrgIds?.length > 0 ? jvScopeOrgIds : (activeOrgId ? [activeOrgId] : []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchCommitmentSummaries(scopeIds).then(data => {
      setRows(data ?? []);
      setLoading(false);
    });
  }, [JSON.stringify(scopeIds)]);

  const fmt = v => v == null ? '—' : `$${Number(v).toLocaleString()}`;

  // Group by investor
  const byInvestor = rows.reduce((acc, r) => {
    (acc[r.investor_name] = acc[r.investor_name] || []).push(r);
    return acc;
  }, {});

  if (loading) {
    return <div className="text-xs text-gray-400 text-center py-10">Loading commitments…</div>;
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
        <p className="text-sm font-semibold text-gray-700 mb-1">No commitments found</p>
        <p className="text-xs text-gray-400">Run migration 008 to populate commitment data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(byInvestor).map(([investorName, commitments]) => {
        const totalCommitted = commitments.reduce((s, c) => s + Number(c.committed_amount ?? 0), 0);
        const totalDeployed = commitments.reduce((s, c) => s + Number(c.total_allocated ?? 0), 0);
        const totalHeadroom = commitments.reduce((s, c) => s + Number(c.remaining_headroom ?? 0), 0);
        const anyOver = commitments.some(c => Number(c.remaining_headroom ?? 0) < 0);

        return (
          <div key={investorName} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Investor header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                  <Users size={12} className="text-accent" />
                </div>
                <span className="text-sm font-semibold text-[#1a2332]">{investorName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Committed: <span className="font-semibold text-gray-800">{fmt(totalCommitted)}</span></span>
                <span>Deployed: <span className="font-semibold text-gray-800">{fmt(totalDeployed)}</span></span>
                <span className={anyOver ? 'text-red-600 font-semibold' : 'text-gray-800 font-semibold'}>
                  Headroom: {fmt(totalHeadroom)}
                </span>
                {anyOver && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Over limit</span>
                )}
              </div>
            </div>

            {/* Commitment rows */}
            <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="text-left px-5 py-2 text-gray-400 font-medium">Commitment</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Type</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Committed</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Deployed</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Remaining</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commitments.map(c => {
                  const headroom = c.remaining_headroom;
                  const isOver = headroom != null && Number(headroom) < 0;
                  return (
                    <tr key={c.commitment_id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 font-medium text-gray-800">{c.commitment_name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          c.commitment_type === 'legacy'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-50 text-blue-600'
                        }`}>
                          {c.commitment_type ?? 'active'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(c.committed_amount)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(c.total_allocated)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${isOver ? 'text-red-600' : 'text-green-700'}`}>
                        {headroom == null ? '∞' : fmt(headroom)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          c.commitment_status === 'active'       ? 'bg-green-100 text-green-700' :
                          c.commitment_status === 'fully_deployed' ? 'bg-gray-100 text-gray-500' :
                          c.commitment_status === 'expired'     ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {c.commitment_status ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Investor Portal ──────────────────────────────────────────────────────
export default function InvestorPortal() {
  const { deals: customDeals } = useDeals();
  const navigate = useNavigate();
  const { isInvestor } = usePermissions();
  const { profile, activeOrgId, orgSlug } = useAuth();
  const { jvScopeOrgIds, jvScope } = useJv();
  // For investor-role users, their linked investor name is stored in profile.company
  const linkedInvestor = isInvestor ? (profile?.company || null) : null;

  const scopeIds = jvScopeOrgIds?.length > 0 ? jvScopeOrgIds : (activeOrgId ? [activeOrgId] : []);

  const [isDark, setIsDark] = useState(() => localStorage.getItem('investor-portal-theme') === 'dark');
  const toggleTheme = () => setIsDark(v => {
    const next = !v;
    localStorage.setItem('investor-portal-theme', next ? 'dark' : 'light');
    return next;
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['all-deals', 'needs-funding', 'by-investor', 'payments', 'commitments', 'directory', 'available-investments'];
  const activeTab = VALID_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'by-investor';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
  const [investors, setInvestors] = useState(() => loadInvestors(activeOrgId, orgSlug));

  // Always fetch investors from Supabase as the source of truth — that way an
  // investor added on any device by any org member shows up here.
  // Cached stats (capital, ROI, deal mappings) come from localStorage so we
  // don't lose pre-computed numbers that aren't stored on the DB row yet.
  useEffect(() => {
    // Use jvScopeOrgIds (already resolved by JvContext) directly — avoids a bug
    // where a stale jvScope.includeOwn=false from the DB would wipe own-org investors
    // even for non-JV-hub orgs where own-org investors must always be shown.
    const allOrgIds = scopeIds.filter(Boolean);

    if (allOrgIds.length === 0) {
      setInvestors([]);
      return;
    }

    // Stats cache (computed locally from deal data) — merged onto DB rows by name.
    const includesOwn = allOrgIds.includes(activeOrgId);
    const cached = includesOwn ? loadInvestors(activeOrgId, orgSlug) : [];
    const cachedByName = Object.fromEntries(cached.map(i => [i.name, i]));

    fetchInvestors(allOrgIds).then(rows => {
      const merged = rows.map(r => {
        const c = cachedByName[r.name] || {};
        return {
          id: r.id,
          name: r.name,
          contact: r.contact || '',
          email: r.email || '',
          phone: r.phone || '',
          type: r.type || 'Private Lender',
          preferredFinancing: r.preferred_financing || '',
          standardTerms: r.standard_terms || '',
          notes: r.notes || '',
          // Structured standard terms (auto-populate deal Financing tab)
          defaultScenarioType:       r.default_scenario_type        ?? null,
          defaultInterestRate:       r.default_interest_rate        ?? null,
          defaultHoldPeriodMonths:   r.default_hold_period_months   ?? null,
          defaultTermMonths:         r.default_term_months          ?? null,
          defaultOriginationFeePct:  r.default_origination_fee_pct  ?? null,
          defaultOriginationFeeType: r.default_origination_fee_type ?? 'percentage',
          defaultOriginationFeeFlat: r.default_origination_fee_flat ?? null,
          defaultPosition:           r.default_position             ?? '1st Position',
          defaultPreferredReturnPct: r.default_preferred_return_pct ?? null,
          defaultProfitSharePct:     r.default_profit_share_pct     ?? null,
          defaultPaymentTiming:      r.default_payment_timing       ?? 'at_exit',
          defaultPaymentDueDay:      r.default_payment_due_day      ?? null,
          defaultDrawFee:            r.default_draw_fee             ?? null,
          defaultServicingFee:       r.default_servicing_fee        ?? null,
          defaultLtcPct:             r.default_ltc_pct              ?? null,
          defaultMaxLoanAmount:      r.default_max_loan_amount      ?? null,
          defaultExtensionAvailable: r.default_extension_available  ?? false,
          defaultExtensionMonths:    r.default_extension_months     ?? null,
          defaultExtensionFeePoints: r.default_extension_fee_points ?? null,
          termsNotes:                r.terms_notes                  ?? '',
          activeDeals:      c.activeDeals      ?? 0,
          capitalInvested:  c.capitalInvested  ?? 0,
          totalReturns:     c.totalReturns     ?? 0,
          roiPct:           c.roiPct           ?? 0,
          roiDollars:       c.roiDollars       ?? 0,
          avgAnnualizedRoi: c.avgAnnualizedRoi ?? 0,
          deals:            c.deals            || [],
        };
      });
      // Include any local-only investors not yet pushed to Supabase (offline adds).
      const dbNames = new Set(rows.map(r => r.name));
      const localOnly = cached.filter(c => !dbNames.has(c.name));
      setInvestors([...merged, ...localOnly]);
    }).catch(err => {
      console.warn('Failed to fetch investors from Supabase, falling back to cache', err);
      setInvestors(cached);
    });
  }, [JSON.stringify(scopeIds), activeOrgId, orgSlug]);

  // Directory tab actions — edit/delete update both Supabase and the local list
  // optimistically, and the delete path also clears any deal.investor refs.
  const handleUpdateInvestor = async (id, patch) => {
    setInvestors(prev => prev.map(i => String(i.id) === String(id) ? { ...i, ...patch } : i));
    await storeUpdateInvestor(id, patch, activeOrgId);
  };
  const handleDeleteInvestor = async (inv) => {
    setInvestors(prev => prev.filter(i => String(i.id) !== String(inv.id)));
    await storeDeleteInvestor(inv, activeOrgId);
  };
  const findDealId = (address) => {
    const norm = a => a.trim().toLowerCase();
    const match = customDeals.find(d => norm(d.address || '') === norm(address));
    return match?.id ?? null;
  };

  const handleDealClick = (deal) => {
    const id = findDealId(deal.address);
    if (id) navigate(`/deal/${id}`, { state: { from: 'investor-portal' } });
  };

  // Derive all investor stats from live deal_allocations. A deal is matched
  // to this investor when at least one active (non-returned, amount > 0)
  // allocation points at inv.id.
  const enrichedInvestors = useMemo(() => investors.map(inv => {
    const matchedDeals = customDeals.filter(d => {
      if (d.isArchived) return false;
      return (d.allocations || []).some(a => a.investorId === inv.id);
    });
    const capitalInvested = matchedDeals.reduce((sum, d) => {
      const cap = d.investorCapitalContributed != null
        ? Number(d.investorCapitalContributed)
        : d.totalActual != null
          ? Number(d.totalActual)
          : (d.land || 0) + (d.mobileHome || 0) + (d.permits || 0) + (d.sitework || 0) + (d.utilities || 0) + (d.other || 0);
      return sum + cap;
    }, 0);

    // ── ROI computed live from each matched deal ─────────────────────────────
    // roiDollars = sum of projected net profit (after financing) across deals
    // roiPct     = roiDollars / capitalInvested * 100
    // avgAnnualizedRoi = average per-deal annualized ROI weighted by capital
    const roiDollars = matchedDeals.reduce((sum, d) => sum + (Number(calcNetProfit(d)) || 0), 0);
    const roiPct = capitalInvested > 0 ? (roiDollars / capitalInvested) * 100 : 0;
    const annualized = matchedDeals.reduce((acc, d) => {
      const months = Number(d.holdPeriod ?? d.holdingMonths ?? d.scenarioData?.holdPeriod ?? 0);
      if (months <= 0) return acc;
      const cap = d.investorCapitalContributed != null
        ? Number(d.investorCapitalContributed)
        : d.totalActual != null ? Number(d.totalActual) : 0;
      const profit = Number(calcNetProfit(d)) || 0;
      const dealRoiPct = cap > 0 ? (profit / cap) * 100 : 0;
      const dealAnnRoi = dealRoiPct * (12 / months);
      return { sum: acc.sum + dealAnnRoi * cap, weight: acc.weight + cap };
    }, { sum: 0, weight: 0 });
    const avgAnnualizedRoi = annualized.weight > 0 ? annualized.sum / annualized.weight : 0;

    return {
      ...inv,
      activeDeals: matchedDeals.length,
      capitalInvested,
      roiDollars,
      roiPct,
      avgAnnualizedRoi,
      // totalReturns stays whatever the investor record stored — that's
      // distributions paid, which is independent of these projections.
    };
  }), [investors, customDeals]);

  const totalCapital = enrichedInvestors.reduce((s, i) => s + i.capitalInvested, 0);
  const totalDeals = enrichedInvestors.reduce((s, i) => s + i.activeDeals, 0);
  const totalROI = enrichedInvestors.reduce((s, i) => s + i.roiDollars, 0);
  // Capital-weighted average ROI %.
  const weightedRoiPct = totalCapital > 0
    ? enrichedInvestors.reduce((s, i) => s + (Number(i.roiPct) || 0) * (Number(i.capitalInvested) || 0), 0) / totalCapital
    : 0;

  const TABS = isInvestor
    ? [{ key: 'by-investor', label: 'My Deals', icon: Briefcase }]
    : [
        { key: 'all-deals',            label: 'All Deals',            icon: LayoutDashboard },
        { key: 'needs-funding',        label: 'Needs Funding',        icon: DollarSign      },
        { key: 'by-investor',          label: 'By Investor',          icon: Users           },
        { key: 'payments',             label: 'Payments',             icon: CreditCard      },
        { key: 'commitments',          label: 'Commitments',          icon: Handshake       },
        { key: 'directory',            label: 'Directory',            icon: Landmark        },
        { key: 'available-investments',label: 'Available Investments', icon: TrendingUp      },
      ];

  return (
    <div className={isDark ? 'dark' : ''}>
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f5f3ee] dark:bg-[#0f1117] text-gray-900 dark:text-white">

      {/* ── Sidebar (desktop only) ─────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 bg-[#161b22] border-r border-white/10">
        {/* Branding */}
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-1">Investor Portal</p>
          <p className="text-sm font-bold text-white leading-snug">Capital Management</p>
          {isInvestor && linkedInvestor && (
            <p className="text-xs text-accent mt-1 truncate">{linkedInvestor}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === key
                  ? 'bg-accent/15 text-accent'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          <Link
            to="/investor/home"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink size={16} /> Investor View
          </Link>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/10">
          <div>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest leading-none mb-0.5">Investor Portal</p>
            <p className="text-sm font-bold text-white leading-tight">
              {TABS.find(t => t.key === activeTab)?.label ?? 'Portal'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors touch-manipulation"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 w-full max-w-[1600px]">

          {/* Page heading — desktop only */}
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {TABS.find(t => t.key === activeTab)?.label ?? 'Investor Portal'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isInvestor
                ? linkedInvestor ? `Viewing deals for ${linkedInvestor}` : 'Your account has not been linked to an investor yet'
                : 'Manage capital sources and investor relationships'}
            </p>
          </div>

          {/* Summary stats — operator only */}
          {!isInvestor && activeTab !== 'available-investments' && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
              {[
                { label: 'Active Investors',       value: enrichedInvestors.filter(i => i.name !== 'Cash').length, icon: Users,      color: 'text-accent'      },
                { label: 'Capital Deployed',        value: `$${totalCapital.toLocaleString()}`,                    icon: DollarSign,  color: 'text-green-400'  },
                { label: 'Deals Funded',            value: totalDeals,                                              icon: Briefcase,   color: 'text-blue-400'   },
                { label: 'Projected ROI',           value: `$${totalROI.toLocaleString()}`,                         icon: BarChart2,   color: 'text-purple-400' },
                { label: 'Avg ROI %',               value: `${weightedRoiPct.toFixed(2)}%`,                         icon: TrendingUp,  color: 'text-rose-400'   },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 p-4 md:p-5">
                  <div className={`flex items-center gap-1.5 mb-1.5 md:mb-2 ${color}`}>
                    <Icon size={14} />
                    <span className="text-[11px] md:text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight">{label}</span>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tab content */}
          {activeTab === 'all-deals'             && <AllDealsTab onDealClick={handleDealClick} />}
          {activeTab === 'needs-funding'         && <NeedsFundingTab onDealClick={handleDealClick} orgId={activeOrgId} orgSlug={orgSlug} investors={enrichedInvestors} />}
          {activeTab === 'by-investor'           && <ByInvestorTab onDealClick={handleDealClick} linkedInvestor={linkedInvestor} investors={enrichedInvestors} contextDeals={customDeals} />}
          {activeTab === 'payments'              && <PaymentsAdminTab orgId={activeOrgId} />}
          {activeTab === 'commitments'           && <CommitmentsTab />}
          {activeTab === 'directory'             && <DirectoryTab investors={enrichedInvestors} onUpdate={handleUpdateInvestor} onDelete={handleDeleteInvestor} />}
          {activeTab === 'available-investments' && <AvailableInvestmentsTab onDealClick={handleDealClick} />}

        </div>
      </main>

      {/* ── Mobile bottom nav ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#161b22] border-t border-white/10">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 flex flex-col items-center justify-center gap-0.5 py-3 px-2 min-w-[60px] transition-colors touch-manipulation ${
                activeTab === key ? 'text-accent' : 'text-gray-500 active:text-gray-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-[9px] font-medium leading-tight text-center w-full truncate px-1">
                {label.split(' ')[0]}
              </span>
            </button>
          ))}
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </nav>

    </div>
    </div>
  );
}
