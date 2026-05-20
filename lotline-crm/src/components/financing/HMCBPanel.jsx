/**
 * HMCBPanel — Hard Money Construction Holdback financing scenario panel.
 *
 * Props:
 *   dealId   — deal ID (string)
 *   data     — loan config object (from deal.scenarioData.hmcb)
 *   onChange — (newData) => void — called whenever any field changes; parent saves to DB
 *   readOnly — boolean
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Check, AlertCircle,
  Building2, User, DollarSign, Calendar, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PaymentDueDayPicker from './PaymentDueDayPicker';

// ── Defaults ──────────────────────────────────────────────────────────────────
export const HMCB_DEFAULTS = {
  lenderName: '',
  lenderContact: '',
  loanNumber: '',
  guarantors: [],
  loanTypeLabel: '',
  interestRate: 13.5,
  monthlyPaymentOverride: null,
  termMonths: 9,
  extensionAvailable: false,
  extensionFeePoints: 1,
  extensionMonths: 3,
  numExtensions: 1,
  purchasePrice: 0,
  holdbackAmount: 0,
  fundedAtClosing: 0,
  ltvCapPct: 60,
  ltcCapPct: 80,
  loanBasisType: 'all_in',      // 'land' | 'land_home' | 'all_in'
  totalLoanAmountOverride: null,
  originationFee: 0,
  originationFeeMode: 'flat', // 'flat' | 'pct'
  originationRolled: false,   // true = rolled into loan; false = cash at closing
  brokerFee: 0,
  brokerFeeMode: 'flat', // 'flat' | 'pct'
  underwritingFee: 0,
  appraisalFee: 0,
  legalFee: 0,               // always upfront; displayed separately
  attDocPrepFee: 0,
  servicingFee: 0,
  drawFee: 115,
  interestBasis: 'full', // 'full' | 'funded'
  loanBasisFlags: { land: false, home: false, allIn: true },
};

export const DEFAULT_CHECKLIST = [
  { label: 'Fully executed purchase agreement',              auto_trigger: null },
  { label: 'Detailed construction / rehab budget',           auto_trigger: null },
  { label: 'Property inspection by lender or authorized rep', auto_trigger: null },
  { label: 'Hazard / Builder\'s risk insurance (lender named as mortgagee)', auto_trigger: null },
  { label: 'Clear title commitment / title search',          auto_trigger: null },
  { label: 'Deed of trust / mortgage recorded at closing',   auto_trigger: null },
  { label: 'Personal guarantee signed by all borrowers',     auto_trigger: null },
  { label: 'Assignment of leases and rents (if applicable)', auto_trigger: null },
  { label: 'Draw fee schedule confirmed and first draw fee collected', auto_trigger: null },
];

export const LENDER_PROTECTION_DEFAULTS = [
  { item_key: 'personal_guarantee',  label: 'Personal Guarantee',                sort_order: 0, auto_trigger: null },
  { item_key: 'title_insurance',     label: 'Title Insurance (Lender\'s Policy)', sort_order: 1, auto_trigger: null },
  { item_key: 'builders_risk_ins',   label: 'Hazard / Builder\'s Risk Insurance', sort_order: 2, auto_trigger: null },
  { item_key: 'deed_of_trust',       label: 'Deed of Trust / Mortgage Recorded',  sort_order: 3, auto_trigger: null },
  { item_key: 'assignment_rents',    label: 'Assignment of Leases & Rents',        sort_order: 4, auto_trigger: null },
  { item_key: 'mso_assignment',      label: 'MSO Assignment',                      sort_order: 5, auto_trigger: 'draw2_paid' },
];

// ── Style helpers ─────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';
const label = (text) => <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{text}</p>;
const fmt$ = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function SectionCard({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Row({ children, cols = 2 }) {
  return (
    <div className={`grid grid-cols-${cols} gap-x-4 gap-y-3`}>
      {children}
    </div>
  );
}

// ── Summary Card (compact view) ───────────────────────────────────────────────
export function HMCBSummaryCard({ data, draws = [] }) {
  const d = { ...HMCB_DEFAULTS, ...data };
  const totalLoan = d.purchasePrice + d.holdbackAmount;
  const paidDraws = draws.filter(dr => dr.status === 'paid');
  const holdbackUsed = paidDraws.reduce((s, dr) => s + (dr.amount_requested || 0), 0);
  const holdbackRemaining = d.holdbackAmount - holdbackUsed;
  const monthly = totalLoan * (d.interestRate / 100) / 12;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
          <Building2 size={13} className="text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-bold text-sidebar">{d.lenderName || 'Hard Money – Construction Holdback'}</p>
          {d.lenderContact && <p className="text-[10px] text-gray-400">{d.lenderContact}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
        <div className="bg-white rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-gray-400">Total Loan</p>
          <p className="text-sm font-bold text-sidebar">{fmt$(totalLoan)}</p>
        </div>
        <div className="bg-white rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-gray-400">Funded at Close</p>
          <p className="text-sm font-bold text-sidebar">{fmt$(d.fundedAtClosing || d.purchasePrice)}</p>
        </div>
        <div className="bg-white rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-gray-400">Holdback Remaining</p>
          <p className={`text-sm font-bold ${holdbackRemaining > 0 ? 'text-green-600' : 'text-gray-400'}`}>{fmt$(holdbackRemaining)}</p>
        </div>
        <div className="bg-white rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-gray-400">Monthly Payment</p>
          <p className="text-sm font-bold text-sidebar">{fmt$(d.monthlyPaymentOverride || monthly)}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
        <span>{d.interestRate}% / yr</span>
        <span>·</span>
        <span>{d.termMonths} mo{d.extensionAvailable ? ` + ${d.numExtensions} ext.` : ''}</span>
        {d.loanTypeLabel && <><span>·</span><span>{d.loanTypeLabel}</span></>}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
// Inline copies of getEstimatedHoldMonths + formatHoldPeriod so HMCBPanel can
// compute partial-month hold periods without a cross-file import. Mirrors
// DealDetail.jsx — fractional months based on a 30-day month.
function getEstimatedHoldMonths(deployedDate, saleDate, fallbackMonths) {
  if (!deployedDate || !saleDate) return fallbackMonths;
  const d = new Date(deployedDate), s = new Date(saleDate);
  if (Number.isNaN(d.getTime()) || Number.isNaN(s.getTime())) return fallbackMonths;
  const days = Math.round((s.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return Math.max(1 / 30, (fallbackMonths || 0));
  return days / 30;
}

function formatHoldPeriod(months) {
  if (!Number.isFinite(months) || months <= 0) return '0 days';
  const totalDays = Math.round(months * 30);
  const whole = Math.floor(totalDays / 30);
  const rem = totalDays - whole * 30;
  if (whole === 0) return `${rem} day${rem === 1 ? '' : 's'}`;
  if (rem === 0)   return `${whole} month${whole === 1 ? '' : 's'}`;
  return `${whole} month${whole === 1 ? '' : 's'} ${rem} day${rem === 1 ? '' : 's'}`;
}

export default function HMCBPanel({ dealId, data, onChange, readOnly = false, investorList = [], onAddInvestor, capitalDeployedDate, estimatedSaleDate, paymentDueDay, onPaymentDueDayChange, firstPaymentDate, onFirstPaymentDateChange, homeCost = 0, allInCost = 0, arv = 0 }) {
  const d = { ...HMCB_DEFAULTS, ...data };

  const set = (field, value) => {
    if (readOnly) return;
    onChange({ ...d, [field]: value });
  };

  // ── Loan basis flags (what components are included in the loan) ────────────
  const flags    = { ...HMCB_DEFAULTS.loanBasisFlags, ...(d.loanBasisFlags || {}) };
  const landVal  = d.purchasePrice || 0;
  const homeVal  = homeCost || 0;
  const allInVal = landVal + homeVal;
  const loanBase = (flags.land ? landVal : 0) + (flags.home ? homeVal : 0) + (flags.allIn ? allInVal : 0);

  // ── Derived calculations ───────────────────────────────────────────────────
  const totalLoan       = loanBase + d.holdbackAmount;
  const fundedAtClosing = d.fundedAtClosing || d.purchasePrice;
  const basisAmount     = d.interestBasis === 'full' ? totalLoan : fundedAtClosing;

  // Fees (computed before monthly so rolled origination can adjust interest basis)
  const effectiveOriginationFee = d.originationFeeMode === 'pct'
    ? (d.originationFee / 100) * totalLoan
    : (d.originationFee || 0);
  const effectiveBrokerFee = d.brokerFeeMode === 'pct'
    ? (d.brokerFee / 100) * totalLoan
    : (d.brokerFee || 0);
  // When origination is rolled into loan, add to loan basis for interest calc
  const rolledOriginationAdj    = d.originationRolled ? effectiveOriginationFee : 0;
  const effectiveLoanForInterest = basisAmount + rolledOriginationAdj;
  const monthlyAutoBase   = effectiveLoanForInterest * (d.interestRate / 100) / 12;
  const monthly           = d.monthlyPaymentOverride || monthlyAutoBase;
  const totalInterestFullTerm = monthly * d.termMonths;
  const totalInterestExtended = d.extensionAvailable
    ? monthly * (d.termMonths + (d.extensionMonths * d.numExtensions))
    : null;
  // Estimated hold (deployed → sale) drives the primary interest number;
  // the full-term value stays visible as a secondary gray row.
  const estHold = getEstimatedHoldMonths(capitalDeployedDate, estimatedSaleDate, d.termMonths);
  const totalInterestEstimated = monthly * estHold;
  // Use a small epsilon when comparing fractional months to the integer term
  const showEst = !!(capitalDeployedDate && estimatedSaleDate) && Math.abs(estHold - d.termMonths) > 0.01;
  const totalFees = (d.originationRolled ? 0 : effectiveOriginationFee)
    + effectiveBrokerFee + (d.underwritingFee || 0)
    + (d.appraisalFee || 0) + (d.attDocPrepFee || 0) + (d.servicingFee || 0)
    + (d.legalFee || 0);
  const cashToClose = fundedAtClosing - (d.purchasePrice) + totalFees;  // typically just fees since purchase is funded

  // LTV
  const ltvCapPct = d.ltvCapPct ?? 60;
  const maxLoanByLtv = arv > 0 ? arv * (ltvCapPct / 100) : 0;
  const currentLtvPct = arv > 0 ? (totalLoan / arv) * 100 : null;
  const withinLtv = maxLoanByLtv > 0 && totalLoan <= maxLoanByLtv;

  // Auto first payment date: 1st of month following capital deployed date
  const autoFirstPaymentDate = (() => {
    if (!capitalDeployedDate) return null;
    const dep = new Date(capitalDeployedDate + 'T12:00:00');
    if (Number.isNaN(dep.getTime())) return null;
    const y = dep.getMonth() === 11 ? dep.getFullYear() + 1 : dep.getFullYear();
    const m = dep.getMonth() === 11 ? 1 : dep.getMonth() + 2;
    return `${y}-${String(m).padStart(2, '0')}-01`;
  })();

  // ── Loan Calculator state ─────────────────────────────────────────────────
  const [loanCalcOpen, setLoanCalcOpen] = useState(true);
  const [appliedKey, setAppliedKey]     = useState(null);

  const applyLoanAmount = (amount, key) => {
    if (readOnly) return;
    set('totalLoanAmountOverride', amount);
    setAppliedKey(key);
    setTimeout(() => setAppliedKey(null), 1500);
  };

  // ── Draws state ───────────────────────────────────────────────────────────
  const [draws, setDraws] = useState([]);
  const [drawsLoading, setDrawsLoading] = useState(true);
  const [addingDraw, setAddingDraw] = useState(false);
  const [newDraw, setNewDraw] = useState({ date_requested: '', amount_requested: '', notes: '' });

  const loadDraws = useCallback(async () => {
    if (!supabase || !dealId) return;
    const { data: rows } = await supabase
      .from('hmcb_draws')
      .select('*')
      .eq('deal_id', dealId)
      .order('draw_number');
    setDraws(rows || []);
    setDrawsLoading(false);
  }, [dealId]);

  useEffect(() => { loadDraws(); }, [loadDraws]);

  const handleAddDraw = async () => {
    if (!supabase || !dealId) return;
    const nextNum = draws.length > 0 ? Math.max(...draws.map(dr => dr.draw_number)) + 1 : 1;
    const { error } = await supabase.from('hmcb_draws').insert({
      deal_id: dealId,
      draw_number: nextNum,
      date_requested: newDraw.date_requested || null,
      amount_requested: parseFloat(newDraw.amount_requested) || 0,
      status: 'pending',
      draw_fee: d.drawFee || 115,
      notes: newDraw.notes || null,
    });
    if (!error) {
      setNewDraw({ date_requested: '', amount_requested: '', notes: '' });
      setAddingDraw(false);
      loadDraws();
    }
  };

  const updateDraw = async (id, fields) => {
    if (!supabase) return;
    await supabase.from('hmcb_draws').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    loadDraws();
  };

  const deleteDraw = async (id) => {
    if (!supabase) return;
    if (!confirm('Remove this draw?')) return;
    await supabase.from('hmcb_draws').delete().eq('id', id);
    loadDraws();
  };

  const totalRequested = draws.reduce((s, dr) => s + (dr.amount_requested || 0), 0);
  const totalPaid      = draws.filter(dr => dr.status === 'paid').reduce((s, dr) => s + (dr.amount_requested || 0), 0);
  const holdbackRemaining = d.holdbackAmount - totalPaid;

  // ── Checklist state ───────────────────────────────────────────────────────
  const [checklist, setChecklist] = useState([]);
  const [checklistLoaded, setChecklistLoaded] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState('');

  const loadChecklist = useCallback(async () => {
    if (!supabase || !dealId) return;
    const { data: rows } = await supabase
      .from('hmcb_checklist_items')
      .select('*')
      .eq('deal_id', dealId)
      .order('sort_order');

    if (!rows || rows.length === 0) {
      // Seed defaults on first load
      const seeds = DEFAULT_CHECKLIST.map(({ label }, i) => ({
        deal_id: dealId, label, checked: false, is_custom: false, sort_order: i,
      }));
      await supabase.from('hmcb_checklist_items').insert(seeds);
      const { data: seeded } = await supabase.from('hmcb_checklist_items').select('*').eq('deal_id', dealId).order('sort_order');
      setChecklist(seeded || []);
    } else {
      setChecklist(rows);
    }
    setChecklistLoaded(true);
  }, [dealId]);

  useEffect(() => {
    if (checklistOpen && !checklistLoaded) loadChecklist();
  }, [checklistOpen, checklistLoaded, loadChecklist]);

  const toggleCheckItem = async (item) => {
    if (!supabase) return;
    const newVal = !item.checked;
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, checked: newVal } : c));
    await supabase.from('hmcb_checklist_items').update({ checked: newVal, updated_at: new Date().toISOString() }).eq('id', item.id);
  };

  const addCheckItem = async () => {
    if (!supabase || !newCheckItem.trim()) return;
    const maxOrder = checklist.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const { data: row } = await supabase.from('hmcb_checklist_items').insert({
      deal_id: dealId, label: newCheckItem.trim(), checked: false, is_custom: true, sort_order: maxOrder + 1,
    }).select().single();
    if (row) setChecklist(prev => [...prev, row]);
    setNewCheckItem('');
  };

  const deleteCheckItem = async (id) => {
    if (!supabase) return;
    setChecklist(prev => prev.filter(c => c.id !== id));
    await supabase.from('hmcb_checklist_items').delete().eq('id', id);
  };

  const checkedCount  = checklist.filter(c => c.checked).length;
  const totalCount    = checklist.length;

  // ── Lender Protections state ──────────────────────────────────────────────
  const [protections, setProtections] = useState([]);
  const [protectionsLoaded, setProtectionsLoaded] = useState(false);

  const loadProtections = useCallback(async () => {
    if (!supabase || !dealId) return;
    const { data: rows } = await supabase
      .from('deal_lender_protections')
      .select('*')
      .eq('deal_id', dealId)
      .order('sort_order');

    if (!rows || rows.length === 0) {
      // Seed defaults
      const seeds = LENDER_PROTECTION_DEFAULTS.map(item => ({
        deal_id: dealId,
        item_key: item.item_key,
        label: item.label,
        status: 'pending',
        sort_order: item.sort_order,
        auto_trigger: item.auto_trigger,
      }));
      await supabase.from('deal_lender_protections').insert(seeds);
      const { data: seeded } = await supabase.from('deal_lender_protections').select('*').eq('deal_id', dealId).order('sort_order');
      setProtections(seeded || []);
    } else {
      setProtections(rows);
    }
    setProtectionsLoaded(true);
  }, [dealId]);

  useEffect(() => { if (dealId) loadProtections(); }, [loadProtections]);

  const updateProtection = async (id, status) => {
    if (!supabase) return;
    setProtections(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    await supabase.from('deal_lender_protections').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  };

  // Auto-trigger: mark MSO as 'active' when Draw #2 is paid
  useEffect(() => {
    if (!protectionsLoaded) return;
    const draw2Paid = draws.some(dr => dr.draw_number === 2 && dr.status === 'paid');
    if (!draw2Paid) return;
    const mso = protections.find(p => p.item_key === 'mso_assignment' && p.status === 'pending');
    if (mso) updateProtection(mso.id, 'active');
  }, [draws, protectionsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guarantors helpers ─────────────────────────────────────────────────────
  const setGuarantor = (i, val) => {
    const next = [...(d.guarantors || [])];
    next[i] = val;
    set('guarantors', next);
  };
  const addGuarantor    = () => set('guarantors', [...(d.guarantors || []), '']);
  const removeGuarantor = (i) => set('guarantors', (d.guarantors || []).filter((_, idx) => idx !== i));

  // ── Advanced section toggle ────────────────────────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Summary card */}
      <HMCBSummaryCard data={d} draws={draws} />

      {/* ── Lender / Investor ── */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Lender / Investor</span>
          {!readOnly && onAddInvestor && (
            <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-semibold">
              + Add New Investor
            </button>
          )}
        </div>
        <select
          className={inp}
          value={d.lenderName}
          onChange={e => set('lenderName', e.target.value)}
          disabled={readOnly}
        >
          <option value="">— No Investor —</option>
          {d.lenderName && !investorList.find(i => i.name === d.lenderName) && (
            <option value={d.lenderName}>{d.lenderName}</option>
          )}
          {(investorList || []).map(inv => (
            <option key={inv.id} value={inv.name}>{inv.name}</option>
          ))}
        </select>
      </div>

      {/* ── Primary: Loan Terms ── */}
      <SectionCard title="Loan Terms">
        <Row>
          <div>
            {label('Annual Interest Rate (%)')}
            <input type="number" step="0.01" className={inp} value={d.interestRate || ''} onChange={e => set('interestRate', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
          <div>
            {label('Term Length (months)')}
            <input type="number" className={inp} value={d.termMonths || ''} onChange={e => set('termMonths', parseInt(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <PaymentDueDayPicker
          value={paymentDueDay}
          onChange={onPaymentDueDayChange}
          capitalDeployedDate={capitalDeployedDate}
          firstPaymentDate={firstPaymentDate}
          onFirstPaymentDateChange={onFirstPaymentDateChange}
          readOnly={readOnly}
        />
        {/* IO payment start hint: 1st of following month */}
        {autoFirstPaymentDate && !firstPaymentDate && !paymentDueDay && (
          <div className="flex items-center gap-1.5 mt-1">
            <Calendar size={11} className="text-accent flex-shrink-0" />
            <p className="text-[11px] text-accent">
              First IO payment due: <strong>{new Date(autoFirstPaymentDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
              <span className="text-gray-400 ml-1">(1st of following month)</span>
            </p>
          </div>
        )}
        {/* Extension */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => !readOnly && set('extensionAvailable', !d.extensionAvailable)}
            className="flex items-center gap-2 text-sm text-gray-600"
          >
            {d.extensionAvailable
              ? <ToggleRight size={22} className="text-accent" />
              : <ToggleLeft size={22} className="text-gray-300" />}
            Extension available
          </button>
        </div>
        {d.extensionAvailable && (
          <Row cols={3}>
            <div>
              {label('Extension (months)')}
              <input type="number" className={inp} value={d.extensionMonths || ''} onChange={e => set('extensionMonths', parseInt(e.target.value) || 0)} disabled={readOnly} />
            </div>
            <div>
              {label('Extension Fee (points)')}
              <input type="number" step="0.25" className={inp} value={d.extensionFeePoints || ''} onChange={e => set('extensionFeePoints', parseFloat(e.target.value) || 0)} disabled={readOnly} />
            </div>
            <div>
              {label('Number of Extensions')}
              <input type="number" className={inp} value={d.numExtensions || ''} onChange={e => set('numExtensions', parseInt(e.target.value) || 1)} disabled={readOnly} />
            </div>
          </Row>
        )}
      </SectionCard>

      {/* ── Primary: Loan Amounts ── */}
      <SectionCard title="Loan Amounts">
        <Row>
          <div>
            {label('Purchase Price')}
            <input
              type="text"
              inputMode="numeric"
              className={inp}
              value={d.purchasePrice ? `$${Number(d.purchasePrice).toLocaleString()}` : ''}
              onChange={e => {
                if (readOnly) return;
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                const v = parseFloat(raw) || 0;
                // Auto-mirror Funded at Closing only when it was tracking purchasePrice (or unset).
                // Both updates must go in a single onChange call: two sequential `set()` calls
                // would close over the same stale `d`, and the second would clobber the first.
                const shouldMirror = !d.fundedAtClosing || d.fundedAtClosing === d.purchasePrice;
                onChange({ ...d, purchasePrice: v, ...(shouldMirror ? { fundedAtClosing: v } : {}) });
              }}
              placeholder="$0"
              disabled={readOnly}
            />
          </div>
          <div>
            {label('Construction Holdback')}
            <input
              type="text"
              inputMode="numeric"
              className={inp}
              value={d.holdbackAmount ? `$${Number(d.holdbackAmount).toLocaleString()}` : ''}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                set('holdbackAmount', parseFloat(raw) || 0);
              }}
              placeholder="$0"
              disabled={readOnly}
            />
          </div>
        </Row>
        {/* ── Unified Loan Calculator ── */}
        <div className="border-t border-gray-100 pt-3 mt-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Loan Calculator</p>
            <button type="button" onClick={() => setLoanCalcOpen(v => !v)} className="text-gray-400 hover:text-gray-600 transition-colors">
              {loanCalcOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          {loanCalcOpen && (
            <div className="space-y-4">
              {/* Loan Basis */}
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Loan Basis</p>
                <p className="text-[11px] text-gray-400 mb-2">What is the loan amount based on?</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'land',      lbl: 'Land Only',   amount: landVal },
                    { key: 'land_home', lbl: 'Land + Home', amount: landVal + homeVal },
                    { key: 'all_in',    lbl: 'All-In Cost', amount: allInCost || (landVal + homeVal) },
                  ].map(({ key, lbl, amount }) => {
                    const sel = (d.loanBasisType ?? 'all_in') === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={readOnly}
                        onClick={() => set('loanBasisType', key)}
                        className={`flex flex-col items-start px-3 py-2 rounded-lg border-2 text-left transition-all ${
                          sel ? 'border-accent bg-accent/5 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          {sel && <Check size={10} className="text-accent flex-shrink-0" />}
                          <span className={`text-[11px] font-semibold ${sel ? 'text-accent' : 'text-gray-600'}`}>{lbl}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">${Math.round(amount).toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lender Caps */}
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-2">Lender Caps</p>
                <div className="space-y-2">
                  {/* LTV row */}
                  {(() => {
                    const maxLtv = arv > 0 && ltvCapPct ? Math.round(arv * (ltvCapPct / 100)) : null;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-8 text-xs font-semibold text-gray-500">LTV</span>
                        <input
                          type="number" min="1" max="100" step="1"
                          value={ltvCapPct ?? ''}
                          onChange={e => set('ltvCapPct', e.target.value === '' ? null : parseFloat(e.target.value))}
                          disabled={readOnly}
                          className="w-14 text-center px-1.5 py-1 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                        <span className="text-[11px] text-gray-400">% of ARV</span>
                        {arv > 0 && <span className="text-[11px] text-gray-400">(${arv.toLocaleString()})</span>}
                        {maxLtv !== null ? (
                          <>
                            <span className="text-gray-300">→</span>
                            <span className="text-sm font-semibold text-sidebar">${maxLtv.toLocaleString()}</span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => applyLoanAmount(maxLtv, 'ltv')}
                                title={`Set loan to $${maxLtv.toLocaleString()}`}
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                                  appliedKey === 'ltv' ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent hover:bg-accent/20'
                                }`}
                              >
                                {appliedKey === 'ltv' ? 'Applied ✓' : '↓ Apply'}
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Set ARV to calculate</span>
                        )}
                      </div>
                    );
                  })()}
                  {/* LTC row */}
                  {(() => {
                    const basisMap = { land: landVal, land_home: landVal + homeVal, all_in: allInCost || (landVal + homeVal) };
                    const costBasis = basisMap[d.loanBasisType ?? 'all_in'] || 0;
                    const ltcPct    = d.ltcCapPct ?? 80;
                    const maxLtc    = costBasis > 0 && ltcPct ? Math.round(costBasis * (ltcPct / 100)) : null;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-8 text-xs font-semibold text-gray-500">LTC</span>
                        <input
                          type="number" min="1" max="100" step="1"
                          value={ltcPct ?? ''}
                          onChange={e => set('ltcCapPct', e.target.value === '' ? null : parseFloat(e.target.value))}
                          disabled={readOnly}
                          className="w-14 text-center px-1.5 py-1 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                        <span className="text-[11px] text-gray-400">% of Cost</span>
                        {costBasis > 0 && <span className="text-[11px] text-gray-400">(${Math.round(costBasis).toLocaleString()})</span>}
                        {maxLtc !== null ? (
                          <>
                            <span className="text-gray-300">→</span>
                            <span className="text-sm font-semibold text-sidebar">${maxLtc.toLocaleString()}</span>
                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => applyLoanAmount(maxLtc, 'ltc')}
                                title={`Set loan to $${maxLtc.toLocaleString()}`}
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                                  appliedKey === 'ltc' ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent hover:bg-accent/20'
                                }`}
                              >
                                {appliedKey === 'ltc' ? 'Applied ✓' : '↓ Apply'}
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Select basis above</span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Recommended banner — only when both caps are set */}
                {(() => {
                  const basisMap = { land: landVal, land_home: landVal + homeVal, all_in: allInCost || (landVal + homeVal) };
                  const costBasis = basisMap[d.loanBasisType ?? 'all_in'] || 0;
                  const maxLtv = arv > 0 && ltvCapPct ? Math.round(arv * (ltvCapPct / 100)) : null;
                  const ltcPct = d.ltcCapPct ?? 80;
                  const maxLtc = costBasis > 0 && ltcPct ? Math.round(costBasis * (ltcPct / 100)) : null;
                  if (!maxLtv || !maxLtc) return null;
                  const rec = Math.min(maxLtv, maxLtc);
                  return (
                    <div className="mt-2 flex items-center justify-between px-3 py-2 bg-accent/5 border border-accent/20 rounded-lg">
                      <span className="text-xs text-accent font-medium">
                        ★ Recommended: lower of LTV/LTC → <span className="font-bold">${rec.toLocaleString()}</span>
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => applyLoanAmount(rec, 'rec')}
                          title={`Set loan to $${rec.toLocaleString()}`}
                          className={`ml-3 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                            appliedKey === 'rec' ? 'bg-green-100 text-green-700' : 'bg-accent/10 text-accent hover:bg-accent/20'
                          }`}
                        >
                          {appliedKey === 'rec' ? 'Applied ✓' : '↓ Apply'}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Total Loan Amount */}
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">Total Loan Amount</p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={(() => { const v = d.totalLoanAmountOverride ?? totalLoan; return v ? `$${Math.round(v).toLocaleString()}` : ''; })()}
                  onChange={e => {
                    if (readOnly) return;
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    set('totalLoanAmountOverride', raw === '' ? null : Number(raw));
                  }}
                  onFocus={e => e.target.select()}
                  placeholder="$0"
                  disabled={readOnly}
                  className={`w-full px-3 py-2 text-lg font-bold border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors ${
                    appliedKey !== null ? 'border-green-400 bg-green-50' : 'border-gray-200'
                  }`}
                />
                {/* Status chips */}
                {(() => {
                  const loanAmt = d.totalLoanAmountOverride ?? totalLoan;
                  if (!loanAmt) return null;
                  const basisMap = { land: landVal, land_home: landVal + homeVal, all_in: allInCost || (landVal + homeVal) };
                  const costBasis = basisMap[d.loanBasisType ?? 'all_in'] || 0;
                  const maxLtv = arv > 0 && ltvCapPct ? arv * (ltvCapPct / 100) : null;
                  const ltcPct = d.ltcCapPct ?? 80;
                  const maxLtc = costBasis > 0 && ltcPct ? costBasis * (ltcPct / 100) : null;
                  const chips = [];
                  if (maxLtv !== null) {
                    const ok = loanAmt <= maxLtv;
                    chips.push(
                      <span key="ltv" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {ok ? <Check size={9} /> : <AlertCircle size={9} />}
                        {ok ? 'Within LTV cap' : `Exceeds LTV by $${Math.round(loanAmt - maxLtv).toLocaleString()}`}
                      </span>
                    );
                  }
                  if (maxLtc !== null) {
                    const ok = loanAmt <= maxLtc;
                    chips.push(
                      <span key="ltc" className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ok ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {ok ? <Check size={9} /> : <AlertCircle size={9} />}
                        {ok ? 'Within LTC cap' : `Exceeds LTC by $${Math.round(loanAmt - maxLtc).toLocaleString()}`}
                      </span>
                    );
                  }
                  return chips.length > 0 ? <div className="flex gap-2 flex-wrap mt-2">{chips}</div> : null;
                })()}
              </div>
            </div>
          )}
        </div>

        <Row>
          <div>
            {label('Amount Funded at Closing')}
            <input
              type="text"
              inputMode="numeric"
              className={inp}
              value={d.fundedAtClosing ? `$${Number(d.fundedAtClosing).toLocaleString()}` : ''}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                set('fundedAtClosing', parseFloat(raw) || 0);
              }}
              placeholder="$0"
              disabled={readOnly}
            />
          </div>
          <div />
        </Row>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Holdback Remaining:</span>
          <span className={`text-sm font-bold ${holdbackRemaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt$(holdbackRemaining)}</span>
          <span className="text-xs text-gray-400">(based on paid draws)</span>
        </div>
      </SectionCard>

      {/* ── Primary: Key Fees ── */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fees</p>
        <Row>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Origination Fee</p>
              {!readOnly && (
                <div className="inline-flex rounded border border-gray-200 overflow-hidden text-[10px] font-semibold">
                  <button type="button" onClick={() => set('originationFeeMode', 'flat')} className={`px-1.5 py-0.5 transition-colors ${d.originationFeeMode !== 'pct' ? 'bg-accent text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>$</button>
                  <button type="button" onClick={() => set('originationFeeMode', 'pct')} className={`px-1.5 py-0.5 transition-colors ${d.originationFeeMode === 'pct' ? 'bg-accent text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>%</button>
                </div>
              )}
            </div>
            <input type="number" step="0.01" className={inp} value={d.originationFee || ''} onChange={e => set('originationFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
            {totalLoan > 0 && (
              d.originationFeeMode === 'pct'
                ? <p className="text-[10px] text-gray-400 mt-0.5">= {fmt$(effectiveOriginationFee)}</p>
                : <p className="text-[10px] text-gray-400 mt-0.5">{totalLoan > 0 ? ((effectiveOriginationFee / totalLoan) * 100).toFixed(3) : '0.000'}% of total loan</p>
            )}
            {/* Origination payment method toggle */}
            {!readOnly && effectiveOriginationFee > 0 && (
              <div className="mt-1.5 inline-flex rounded border border-gray-200 overflow-hidden text-[10px] font-semibold">
                <button type="button" onClick={() => set('originationRolled', false)} className={`px-2 py-0.5 transition-colors ${!d.originationRolled ? 'bg-accent text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>Cash at Closing</button>
                <button type="button" onClick={() => set('originationRolled', true)} className={`px-2 py-0.5 transition-colors ${d.originationRolled ? 'bg-accent text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>Rolled into Loan</button>
              </div>
            )}
            {d.originationRolled && effectiveOriginationFee > 0 && (
              <p className="text-[10px] text-blue-500 mt-0.5">Rolled into loan — adds to interest basis</p>
            )}
          </div>
          <div>
            {label('Per-Draw Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.drawFee || ''} onChange={e => set('drawFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Total Closing Costs</span>
          <span className="text-sm font-bold text-accent">{fmt$(totalFees)}</span>
        </div>

        {/* Advanced toggle */}
        <div className="mt-3 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-accent font-medium transition-colors"
          >
            {showAdvanced ? '− Hide advanced details' : '+ Show advanced details'}
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3">
              {/* Advanced fee fields */}
              <Row>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Broker Fee</p>
                    {!readOnly && (
                      <div className="inline-flex rounded border border-gray-200 overflow-hidden text-[10px] font-semibold">
                        <button type="button" onClick={() => set('brokerFeeMode', 'flat')} className={`px-1.5 py-0.5 transition-colors ${d.brokerFeeMode !== 'pct' ? 'bg-accent text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>$</button>
                        <button type="button" onClick={() => set('brokerFeeMode', 'pct')} className={`px-1.5 py-0.5 transition-colors ${d.brokerFeeMode === 'pct' ? 'bg-accent text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>%</button>
                      </div>
                    )}
                  </div>
                  <input type="number" step="0.01" className={inp} value={d.brokerFee || ''} onChange={e => set('brokerFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
                  {d.brokerFeeMode === 'pct' && totalLoan > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">= {fmt$(effectiveBrokerFee)}</p>
                  )}
                </div>
                <div>
                  {label('Underwriting / Admin Fee ($)')}
                  <input type="number" step="0.01" className={inp} value={d.underwritingFee || ''} onChange={e => set('underwritingFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
                </div>
              </Row>
              <Row>
                <div>
                  {label('Appraisal Fee ($)')}
                  <input type="number" step="0.01" className={inp} value={d.appraisalFee || ''} onChange={e => set('appraisalFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
                </div>
                <div>
                  {label('Attorney Document Prep ($)')}
                  <input type="number" step="0.01" className={inp} value={d.attDocPrepFee || ''} onChange={e => set('attDocPrepFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
                </div>
              </Row>
              <Row>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Legal Fee ($)</p>
                    <span className="text-[9px] text-gray-400 font-medium uppercase">Upfront only</span>
                  </div>
                  <input type="number" step="0.01" className={inp} value={d.legalFee || ''} onChange={e => set('legalFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
                  <p className="text-[10px] text-gray-400 mt-0.5">Paid upfront — not rolled into loan</p>
                </div>
                <div>
                  {label('Servicing Fee ($)')}
                  <input type="number" step="0.01" className={inp} value={d.servicingFee || ''} onChange={e => set('servicingFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
                </div>
              </Row>
              <Row>
                <div>
                  {label('Monthly Payment (override)')}
                  <input type="number" step="0.01" className={inp} value={d.monthlyPaymentOverride ?? ''} onChange={e => set('monthlyPaymentOverride', e.target.value ? parseFloat(e.target.value) : null)} placeholder={`Auto: ${fmt$(monthlyAutoBase)}`} disabled={readOnly} />
                </div>
                <div />
              </Row>

              {/* Advanced identification fields */}
              <Row>
                <div>
                  {label('Loan Type Label')}
                  <input className={inp} value={d.loanTypeLabel} onChange={e => set('loanTypeLabel', e.target.value)} placeholder="9 Month Manufactured (New) Loan" disabled={readOnly} />
                </div>
                <div>
                  {label('Loan Number (optional)')}
                  <input className={inp} value={d.loanNumber} onChange={e => set('loanNumber', e.target.value)} placeholder="LN-XXXX" disabled={readOnly} />
                </div>
              </Row>
              <div>
                {label('Lender Contact / Servicing Address')}
                <input className={inp} value={d.lenderContact} onChange={e => set('lenderContact', e.target.value)} placeholder="123 Main St, City, NC" disabled={readOnly} />
              </div>
              {/* Guarantors */}
              <div>
                {label('Guarantors')}
                <div className="space-y-1.5">
                  {(d.guarantors || []).map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inp}
                        value={g}
                        onChange={e => setGuarantor(i, e.target.value)}
                        placeholder={`Guarantor ${i + 1}`}
                        disabled={readOnly}
                      />
                      {!readOnly && (
                        <button onClick={() => removeGuarantor(i)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button onClick={addGuarantor} className="flex items-center gap-1 text-xs text-accent hover:underline">
                      <Plus size={12} /> Add guarantor
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── Interest Calculation ── */}
      <SectionCard title="Interest Calculation">
        {/* Interest basis toggle */}
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs text-gray-500">Interest accrues on:</span>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => !readOnly && set('interestBasis', 'full')}
              className={`px-3 py-1 transition-colors ${d.interestBasis === 'full' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              Full loan amount
            </button>
            <button
              type="button"
              onClick={() => !readOnly && set('interestBasis', 'funded')}
              className={`px-3 py-1 transition-colors ${d.interestBasis === 'funded' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              Funded amount only
            </button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">
          {d.interestBasis === 'full'
            ? `Interest on full loan amount: ${fmt$(totalLoan)}`
            : `Interest on funded at closing only: ${fmt$(fundedAtClosing)}`}
        </p>

        <div className="rounded-lg bg-[#1a2332] text-white p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Monthly Interest Payment</span>
            <span className="text-gray-400">{fmt$(monthly)}</span>
          </div>
          {showEst && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Interest — Est. Hold ({formatHoldPeriod(estHold)})</span>
              <span className="text-gray-400">{fmt$(totalInterestEstimated)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Interest — Full Term ({d.termMonths} mo)</span>
            <span className="text-gray-400">{fmt$(totalInterestFullTerm)}</span>
          </div>
          {totalInterestExtended !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Interest — Extended ({d.termMonths + d.extensionMonths * d.numExtensions} mo)</span>
              <span className="text-gray-400">{fmt$(totalInterestExtended)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs border-t border-white/20 pt-2 mt-1">
            <span className="text-gray-400">{showEst ? `Est. Total Cost (${formatHoldPeriod(estHold)} + fees)` : 'Total Cost (interest + fees)'}</span>
            <span className="font-bold text-accent">{fmt$((showEst ? totalInterestEstimated : totalInterestFullTerm) + totalFees)}</span>
          </div>
          {showEst && (
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">Full Term Total ({d.termMonths} mo + fees)</span>
              <span className="text-gray-400">{fmt$(totalInterestFullTerm + totalFees)}</span>
            </div>
          )}
          {d.extensionAvailable && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">If Extended (interest + fees + ext. fee)</span>
              <span className="text-gray-400">{fmt$(totalInterestExtended + totalFees + totalLoan * (d.extensionFeePoints / 100))}</span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Lender Protections ── */}
      <SectionCard title="Lender Protections" defaultOpen={false}>
        {!protectionsLoaded ? (
          <div className="py-3 text-center"><div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-1.5">
            {protections.map(item => {
              const statusCfg = {
                pending:  { dot: 'bg-gray-300',        label: 'Pending',  btn: 'text-gray-400 hover:text-accent' },
                active:   { dot: 'bg-amber-400',       label: 'Active',   btn: 'text-amber-500 hover:text-amber-600' },
                complete: { dot: 'bg-emerald-500',     label: 'Complete', btn: 'text-emerald-600 hover:text-emerald-700' },
              }[item.status] || { dot: 'bg-gray-300', label: item.status, btn: '' };
              return (
                <div key={item.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 group">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-tight">{item.label}</p>
                    {item.auto_trigger === 'draw2_paid' && (
                      <p className="text-[10px] text-gray-400">Auto-activates when Draw #2 is paid</p>
                    )}
                  </div>
                  {!readOnly && (
                    <select
                      value={item.status}
                      onChange={e => updateProtection(item.id, e.target.value)}
                      className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-accent/30"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="complete">Complete</option>
                    </select>
                  )}
                  {readOnly && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.status === 'complete' ? 'bg-emerald-100 text-emerald-600' :
                      item.status === 'active' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>{statusCfg.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Draw Schedule ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Draw Schedule</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {draws.length} draws · {fmt$(totalRequested)} requested · {fmt$(totalPaid)} paid · {fmt$(holdbackRemaining)} remaining
            </p>
          </div>
          {!readOnly && !addingDraw && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setNewDraw({ date_requested: '', amount_requested: String(d.purchasePrice || ''), notes: 'Draw #1 – Initial Funding' }); setAddingDraw(true); }}
                className="px-2.5 py-1.5 rounded-lg border border-accent text-accent text-[11px] font-semibold hover:bg-accent/5 transition-colors"
              >
                Draw #1
              </button>
              <button
                onClick={() => { setNewDraw({ date_requested: '', amount_requested: String(d.holdbackAmount || ''), notes: 'Draw #2 – Construction Release' }); setAddingDraw(true); }}
                className="px-2.5 py-1.5 rounded-lg border border-accent text-accent text-[11px] font-semibold hover:bg-accent/5 transition-colors"
              >
                Draw #2
              </button>
              <button
                onClick={() => { setNewDraw({ date_requested: '', amount_requested: '', notes: '' }); setAddingDraw(true); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-white text-[11px] font-semibold hover:bg-accent/90 transition-colors"
              >
                <Plus size={11} /> Custom
              </button>
            </div>
          )}
        </div>

        {/* Add draw form */}
        {addingDraw && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 space-y-2">
            <p className="text-xs font-semibold text-gray-600">New Draw Request</p>
            <Row cols={3}>
              <div>
                {label('Date Requested')}
                <input type="date" className={inp} value={newDraw.date_requested} onChange={e => setNewDraw(p => ({ ...p, date_requested: e.target.value }))} />
              </div>
              <div>
                {label('Amount Requested ($)')}
                <input type="number" className={inp} value={newDraw.amount_requested} onChange={e => setNewDraw(p => ({ ...p, amount_requested: e.target.value }))} placeholder="0" />
              </div>
              <div>
                {label('Notes (optional)')}
                <input className={inp} value={newDraw.notes} onChange={e => setNewDraw(p => ({ ...p, notes: e.target.value }))} placeholder="Description..." />
              </div>
            </Row>
            <div className="flex gap-2">
              <button onClick={handleAddDraw} className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90">Save Draw</button>
              <button onClick={() => setAddingDraw(false)} className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        )}

        {/* Draws table */}
        {drawsLoading ? (
          <div className="py-6 text-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : draws.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">No draws yet. Click "Add Draw" to log the first draw request.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#', 'Date Req.', 'Amount', 'Status', 'Date Paid', 'Draw Fee', 'Notes', ''].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draws.map(dr => (
                  <tr key={dr.id} className="border-b border-gray-50 hover:bg-gray-50/50 group">
                    <td className="py-2 px-3 text-xs text-gray-500">{dr.draw_number}</td>
                    <td className="py-2 px-3 text-xs text-gray-600">{dr.date_requested || '—'}</td>
                    <td className="py-2 px-3 text-xs font-semibold text-sidebar">{fmt$(dr.amount_requested)}</td>
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          dr.status === 'paid' ? 'bg-green-100 text-green-600' :
                          dr.status === 'approved' ? 'bg-blue-100 text-blue-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>{dr.status}</span>
                      ) : (
                        <select
                          value={dr.status}
                          onChange={e => updateDraw(dr.id, { status: e.target.value, date_paid: e.target.value === 'paid' ? (dr.date_paid || new Date().toISOString().slice(0,10)) : dr.date_paid })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-accent/30"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="paid">Paid</option>
                        </select>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {readOnly ? (
                        <span className="text-xs text-gray-500">{dr.date_paid || '—'}</span>
                      ) : (
                        <input type="date" value={dr.date_paid || ''} onChange={e => updateDraw(dr.id, { date_paid: e.target.value || null })}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-accent/30" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-500">{fmt$(dr.draw_fee)}</td>
                    <td className="py-2 px-3 text-xs text-gray-400 max-w-[120px] truncate">{dr.notes || '—'}</td>
                    <td className="py-2 px-3">
                      {!readOnly && (
                        <button onClick={() => deleteDraw(dr.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded transition-all">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="py-2 px-3 text-[10px] font-bold text-gray-600 uppercase">Totals</td>
                  <td className="py-2 px-3 text-xs font-bold text-sidebar">{fmt$(totalRequested)}</td>
                  <td colSpan={2} className="py-2 px-3 text-[10px] text-gray-400">Paid: {fmt$(totalPaid)}</td>
                  <td className="py-2 px-3 text-xs text-gray-500">{fmt$(draws.reduce((s,dr)=>s+(dr.draw_fee||0),0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Required Before Closing Checklist ── */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          type="button"
          onClick={() => setChecklistOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Required Before Closing</p>
            {checklistLoaded && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${checkedCount === totalCount && totalCount > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                {checkedCount}/{totalCount}
              </span>
            )}
          </div>
          {checklistOpen ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
        </button>

        {checklistOpen && (
          <div className="px-4 pb-4">
            {!checklistLoaded ? (
              <div className="py-4 text-center"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : (
              <div className="space-y-1.5">
                {checklist.map(item => (
                  <label key={item.id} className={`flex items-start gap-2.5 py-2 px-2 rounded-lg cursor-pointer transition-colors ${item.checked ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                    <button
                      type="button"
                      onClick={() => toggleCheckItem(item)}
                      disabled={readOnly}
                      className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                        item.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white hover:border-accent'
                      }`}
                    >
                      {item.checked && <Check size={10} className="text-white" />}
                    </button>
                    <span className={`text-sm flex-1 leading-tight ${item.checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                      {item.label}
                    </span>
                    {!readOnly && item.is_custom && (
                      <button onClick={() => deleteCheckItem(item.id)} className="p-1 text-gray-200 hover:text-red-400 rounded transition-colors flex-shrink-0">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </label>
                ))}

                {!readOnly && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mt-2">
                    <input
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                      placeholder="Add custom requirement..."
                      value={newCheckItem}
                      onChange={e => setNewCheckItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); }}}
                    />
                    <button
                      onClick={addCheckItem}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 flex-shrink-0"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
