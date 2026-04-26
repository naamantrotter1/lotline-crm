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
  originationFee: 0,
  brokerFee: 0,
  underwritingFee: 0,
  appraisalFee: 0,
  attDocPrepFee: 0,
  servicingFee: 0,
  drawFee: 115,
  interestBasis: 'full', // 'full' | 'funded'
};

const DEFAULT_CHECKLIST = [
  'Fully executed purchase agreement',
  'Detailed construction / rehab budget',
  'Property inspection by lender or rep',
  'Insurance with lender listed as mortgagee',
  'Clear title',
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
export default function HMCBPanel({ dealId, data, onChange, readOnly = false }) {
  const d = { ...HMCB_DEFAULTS, ...data };

  const set = (field, value) => {
    if (readOnly) return;
    onChange({ ...d, [field]: value });
  };

  // ── Derived calculations ───────────────────────────────────────────────────
  const totalLoan       = d.purchasePrice + d.holdbackAmount;
  const fundedAtClosing = d.fundedAtClosing || d.purchasePrice;
  const basisAmount     = d.interestBasis === 'full' ? totalLoan : fundedAtClosing;
  const monthlyAuto     = basisAmount * (d.interestRate / 100) / 12;
  const monthly         = d.monthlyPaymentOverride || monthlyAuto;
  const totalInterestFullTerm = monthly * d.termMonths;
  const totalInterestExtended = d.extensionAvailable
    ? monthly * (d.termMonths + (d.extensionMonths * d.numExtensions))
    : null;

  const totalFees = (d.originationFee || 0) + (d.brokerFee || 0) + (d.underwritingFee || 0)
    + (d.appraisalFee || 0) + (d.attDocPrepFee || 0) + (d.servicingFee || 0);
  const cashToClose = fundedAtClosing - (d.purchasePrice) + totalFees;  // typically just fees since purchase is funded

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
      const seeds = DEFAULT_CHECKLIST.map((label, i) => ({
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

  // ── Guarantors helpers ─────────────────────────────────────────────────────
  const setGuarantor = (i, val) => {
    const next = [...(d.guarantors || [])];
    next[i] = val;
    set('guarantors', next);
  };
  const addGuarantor    = () => set('guarantors', [...(d.guarantors || []), '']);
  const removeGuarantor = (i) => set('guarantors', (d.guarantors || []).filter((_, idx) => idx !== i));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Summary card */}
      <HMCBSummaryCard data={d} draws={draws} />

      {/* ── Lender Information ── */}
      <SectionCard title="Lender Information">
        <Row>
          <div>
            {label('Lender Name')}
            <input className={inp} value={d.lenderName} onChange={e => set('lenderName', e.target.value)} placeholder="Low Tide Private Lending" disabled={readOnly} />
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
      </SectionCard>

      {/* ── Loan Terms ── */}
      <SectionCard title="Loan Terms">
        <Row>
          <div>
            {label('Loan Type Label')}
            <input className={inp} value={d.loanTypeLabel} onChange={e => set('loanTypeLabel', e.target.value)} placeholder="9 Month Manufactured (New) Loan" disabled={readOnly} />
          </div>
          <div>
            {label('Annual Interest Rate (%)')}
            <input type="number" step="0.01" className={inp} value={d.interestRate} onChange={e => set('interestRate', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <Row>
          <div>
            {label('Term Length (months)')}
            <input type="number" className={inp} value={d.termMonths} onChange={e => set('termMonths', parseInt(e.target.value) || 0)} disabled={readOnly} />
          </div>
          <div>
            {label('Monthly Payment (override)')}
            <input type="number" step="0.01" className={inp} value={d.monthlyPaymentOverride ?? ''} onChange={e => set('monthlyPaymentOverride', e.target.value ? parseFloat(e.target.value) : null)} placeholder={`Auto: ${fmt$(monthlyAuto)}`} disabled={readOnly} />
          </div>
        </Row>
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
              <input type="number" className={inp} value={d.extensionMonths} onChange={e => set('extensionMonths', parseInt(e.target.value) || 0)} disabled={readOnly} />
            </div>
            <div>
              {label('Extension Fee (points)')}
              <input type="number" step="0.25" className={inp} value={d.extensionFeePoints} onChange={e => set('extensionFeePoints', parseFloat(e.target.value) || 0)} disabled={readOnly} />
            </div>
            <div>
              {label('Number of Extensions')}
              <input type="number" className={inp} value={d.numExtensions} onChange={e => set('numExtensions', parseInt(e.target.value) || 1)} disabled={readOnly} />
            </div>
          </Row>
        )}
      </SectionCard>

      {/* ── Loan Amounts ── */}
      <SectionCard title="Loan Amounts">
        <Row>
          <div>
            {label('Purchase Price ($)')}
            <input type="number" className={inp} value={d.purchasePrice} onChange={e => { const v = parseFloat(e.target.value) || 0; set('purchasePrice', v); if (!d.fundedAtClosing || d.fundedAtClosing === d.purchasePrice) set('fundedAtClosing', v); }} disabled={readOnly} />
          </div>
          <div>
            {label('Construction Holdback ($)')}
            <input type="number" className={inp} value={d.holdbackAmount} onChange={e => set('holdbackAmount', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <Row>
          <div>
            {label('Total Loan Amount (auto)')}
            <div className="px-3 py-1.5 text-sm font-semibold text-sidebar bg-gray-100 rounded-lg border border-gray-200">{fmt$(totalLoan)}</div>
          </div>
          <div>
            {label('Amount Funded at Closing ($)')}
            <input type="number" className={inp} value={d.fundedAtClosing} onChange={e => set('fundedAtClosing', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Holdback Remaining:</span>
          <span className={`text-sm font-bold ${holdbackRemaining >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt$(holdbackRemaining)}</span>
          <span className="text-xs text-gray-400">(based on paid draws)</span>
        </div>
      </SectionCard>

      {/* ── Fees & Closing Costs ── */}
      <SectionCard title="Fees & Closing Costs">
        <Row>
          <div>
            {label('Origination Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.originationFee} onChange={e => set('originationFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
            {totalLoan > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{((d.originationFee / totalLoan) * 100).toFixed(3)}% of total loan</p>}
          </div>
          <div>
            {label('Broker Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.brokerFee} onChange={e => set('brokerFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <Row>
          <div>
            {label('Underwriting / Admin Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.underwritingFee} onChange={e => set('underwritingFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
          <div>
            {label('Appraisal Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.appraisalFee} onChange={e => set('appraisalFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <Row>
          <div>
            {label('Attorney Document Prep ($)')}
            <input type="number" step="0.01" className={inp} value={d.attDocPrepFee} onChange={e => set('attDocPrepFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
          <div>
            {label('Servicing Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.servicingFee} onChange={e => set('servicingFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
        </Row>
        <Row>
          <div>
            {label('Per-Draw Fee ($)')}
            <input type="number" step="0.01" className={inp} value={d.drawFee} onChange={e => set('drawFee', parseFloat(e.target.value) || 0)} disabled={readOnly} />
          </div>
          <div>
            {label('Total Closing Costs (auto)')}
            <div className="px-3 py-1.5 text-sm font-semibold text-sidebar bg-gray-100 rounded-lg border border-gray-200">{fmt$(totalFees)}</div>
          </div>
        </Row>

        {/* Cash to close breakdown */}
        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1.5 text-xs">
          <p className="font-semibold text-gray-600 uppercase tracking-wide text-[10px] mb-2">Estimated Cash to Close</p>
          <div className="flex justify-between text-gray-500">
            <span>Purchase Price</span>
            <span>{fmt$(d.purchasePrice)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Less: Amount Funded at Closing</span>
            <span className="text-green-600">({fmt$(fundedAtClosing)})</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Plus: Closing Costs</span>
            <span>{fmt$(totalFees)}</span>
          </div>
          <div className="flex justify-between font-bold text-sidebar border-t border-gray-200 pt-1.5 mt-1">
            <span>Estimated Cash to Close</span>
            <span className="text-accent">{fmt$(Math.max(0, d.purchasePrice - fundedAtClosing + totalFees))}</span>
          </div>
          <p className="text-[10px] text-gray-400 pt-1">Does not include taxes, insurance premiums, or prorations.</p>
        </div>
      </SectionCard>

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
            <span className="font-semibold">{fmt$(monthly)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Total Interest — Full Term ({d.termMonths} mo)</span>
            <span className="font-semibold">{fmt$(totalInterestFullTerm)}</span>
          </div>
          {totalInterestExtended !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Interest — Extended ({d.termMonths + d.extensionMonths * d.numExtensions} mo)</span>
              <span className="font-semibold">{fmt$(totalInterestExtended)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs border-t border-white/20 pt-2 mt-1">
            <span className="text-gray-400">Total Cost (interest + fees)</span>
            <span className="font-bold text-accent">{fmt$(totalInterestFullTerm + totalFees)}</span>
          </div>
          {d.extensionAvailable && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">If Extended (interest + fees + ext. fee)</span>
              <span className="font-semibold text-yellow-400">{fmt$(totalInterestExtended + totalFees + totalLoan * (d.extensionFeePoints / 100))}</span>
            </div>
          )}
        </div>
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
          {!readOnly && (
            <button
              onClick={() => setAddingDraw(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
            >
              <Plus size={12} /> Add Draw
            </button>
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
