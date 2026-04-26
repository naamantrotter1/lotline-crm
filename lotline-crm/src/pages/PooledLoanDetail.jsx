import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, Percent, Calendar, Building2,
  Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp,
  TrendingUp, Layers, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  fetchPooledLoan, updatePooledLoan, upsertAllocation, removeAllocation,
  monthlyInterest, annualInterest, totalAllocated, buildPaymentSchedule,
} from '../lib/pooledLoanData';
import { supabase } from '../lib/supabase';

const fmt$ = (n) => n == null ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => n == null ? '—' : `${Number(n).toFixed(2)}%`;
const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50';

function StatCard({ icon: Icon, label, value, sub, color = 'accent' }) {
  const colorMap = {
    accent: 'bg-accent/10 text-accent',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  return (
    <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-sidebar leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EditableField({ label, value, type = 'text', onChange, prefix, suffix, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
            <input
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              autoFocus
              className={`${inp} ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-8' : ''}`}
            />
            {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
          </div>
          <button onClick={commit} className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200"><Check size={14} /></button>
          <button onClick={cancel} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={14} /></button>
        </div>
      ) : (
        <div
          onClick={() => { setDraft(value ?? ''); setEditing(true); }}
          className="group flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm text-sidebar flex-1">
            {prefix && <span className="text-gray-400 mr-0.5">{prefix}</span>}
            {value || <span className="text-gray-300 italic">click to edit</span>}
            {suffix && <span className="text-gray-400 ml-0.5">{suffix}</span>}
          </span>
          <Edit2 size={12} className="text-gray-300 group-hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      )}
    </div>
  );
}

export default function PooledLoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrgId } = useAuth();

  const [loan, setLoan] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Deal search for adding allocations
  const [dealSearch, setDealSearch] = useState('');
  const [dealResults, setDealResults] = useState([]);
  const [addingDeal, setAddingDeal] = useState(false);
  const [newAllocAmount, setNewAllocAmount] = useState('');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [saving, setSaving] = useState(false);

  // Payment schedule toggle
  const [showSchedule, setShowSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchPooledLoan(id);
    if (!data) { setError('Loan not found'); setLoading(false); return; }
    setLoan(data);
    setAllocations(data.allocations || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Search deals in Supabase
  useEffect(() => {
    if (!dealSearch.trim() || !activeOrgId) { setDealResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, address, stage, county')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .ilike('address', `%${dealSearch}%`)
        .limit(8);
      setDealResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [dealSearch, activeOrgId]);

  const handleFieldSave = async (field, value) => {
    const parsed = ['total_pool', 'interest_rate', 'term_months', 'profit_participation_pct'].includes(field)
      ? parseFloat(value) || 0
      : value;
    setLoan(prev => ({ ...prev, [field]: parsed }));
    await updatePooledLoan(id, { [field]: parsed });
  };

  const handleAddAllocation = async () => {
    if (!selectedDeal || !newAllocAmount) return;
    setSaving(true);
    const amount = parseFloat(newAllocAmount) || 0;
    await upsertAllocation(id, selectedDeal.id, amount, { draw_date: new Date().toISOString().slice(0, 10) });
    setAddingDeal(false);
    setSelectedDeal(null);
    setNewAllocAmount('');
    setDealSearch('');
    await load();
    setSaving(false);
  };

  const handleRemoveAllocation = async (dealId) => {
    if (!confirm('Remove this deal from the pooled loan?')) return;
    await removeAllocation(id, dealId);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="py-20 text-center text-gray-400">
        <AlertCircle size={32} className="mx-auto mb-3 text-gray-300" />
        <p>{error || 'Loan not found'}</p>
        <button onClick={() => navigate('/lending')} className="mt-4 text-sm text-accent hover:underline">
          Back to Capital &amp; Partnerships
        </button>
      </div>
    );
  }

  const monthly = monthlyInterest(loan);
  const annual = annualInterest(loan);
  const totalAlloc = totalAllocated(allocations);
  const schedule = buildPaymentSchedule(loan);
  const interestRatePct = (loan.interest_rate || 0) * 100;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/lending')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-sidebar transition-colors"
        >
          <ArrowLeft size={15} /> Capital &amp; Partnerships
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium">{loan.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Layers size={22} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sidebar">{loan.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loan.lender_name || 'No lender set'}{loan.lender_contact_name ? ` · ${loan.lender_contact_name}` : ''}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 flex-shrink-0">
          Pooled Loan
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Total Pool" value={fmt$(loan.total_pool)} sub="Full commitment" color="accent" />
        <StatCard icon={Percent} label="Annual Rate" value={fmtPct(interestRatePct)} sub={`${fmt$(annual)}/yr`} color="orange" />
        <StatCard icon={DollarSign} label="Monthly Interest" value={fmt$(monthly)} sub="On full pool" color="blue" />
        <StatCard icon={TrendingUp} label="Profit Participation" value={fmtPct(loan.profit_participation_pct)} sub="Per deal" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Loan details */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-bold text-sidebar">Loan Details</h2>

            <EditableField
              label="Loan Name"
              value={loan.name}
              onChange={v => handleFieldSave('name', v)}
            />
            <EditableField
              label="Lender / Investor"
              value={loan.lender_name}
              onChange={v => handleFieldSave('lender_name', v)}
            />
            <EditableField
              label="Contact Name"
              value={loan.lender_contact_name}
              onChange={v => handleFieldSave('lender_contact_name', v)}
            />
            <EditableField
              label="Contact Email"
              value={loan.lender_contact_email}
              onChange={v => handleFieldSave('lender_contact_email', v)}
            />
            <EditableField
              label="Contact Phone"
              value={loan.lender_contact_phone}
              onChange={v => handleFieldSave('lender_contact_phone', v)}
            />
            <EditableField
              label="Total Pool ($)"
              value={loan.total_pool}
              type="number"
              prefix="$"
              onChange={v => handleFieldSave('total_pool', v)}
            />
            <EditableField
              label="Annual Interest Rate"
              value={interestRatePct}
              type="number"
              suffix="%"
              onChange={v => handleFieldSave('interest_rate', parseFloat(v) / 100 || 0)}
            />
            <EditableField
              label="Term (months)"
              value={loan.term_months}
              type="number"
              onChange={v => handleFieldSave('term_months', v)}
            />
            <EditableField
              label="Start Date"
              value={loan.start_date}
              type="date"
              onChange={v => handleFieldSave('start_date', v)}
            />
            <EditableField
              label="Maturity Date"
              value={loan.maturity_date}
              type="date"
              onChange={v => handleFieldSave('maturity_date', v)}
            />
            <EditableField
              label="Profit Participation (%)"
              value={loan.profit_participation_pct}
              type="number"
              suffix="%"
              onChange={v => handleFieldSave('profit_participation_pct', v)}
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
              <textarea
                rows={3}
                defaultValue={loan.notes || ''}
                onBlur={e => handleFieldSave('notes', e.target.value)}
                className={`${inp} resize-none`}
                placeholder="Loan notes..."
              />
            </div>
          </div>

          {/* Payment schedule toggle */}
          {schedule.length > 0 && (
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowSchedule(s => !s)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-bold text-sidebar flex items-center gap-2">
                  <Calendar size={15} className="text-gray-400" />
                  Payment Schedule
                  <span className="ml-1 text-xs font-normal text-gray-400">({schedule.length} months)</span>
                </span>
                {showSchedule ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
              </button>
              {showSchedule && (
                <div className="border-t border-gray-100 overflow-y-auto max-h-80">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="py-2 px-4 text-left font-semibold text-gray-500">#</th>
                        <th className="py-2 px-4 text-left font-semibold text-gray-500">Month</th>
                        <th className="py-2 px-4 text-right font-semibold text-gray-500">Interest Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map(row => (
                        <tr key={row.month} className="border-t border-gray-50 hover:bg-gray-50/50">
                          <td className="py-2 px-4 text-gray-400">{row.month}</td>
                          <td className="py-2 px-4 text-gray-600">{row.date}</td>
                          <td className="py-2 px-4 text-right font-semibold text-sidebar">{fmt$(row.interest)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={2} className="py-2 px-4 text-xs font-bold text-gray-600">Total</td>
                        <td className="py-2 px-4 text-right text-xs font-bold text-sidebar">{fmt$(monthly * schedule.length)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Deal allocations */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-bold text-sidebar">Deal Allocations</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {allocations.length} deals · {fmt$(totalAlloc)} drawn · {fmt$(loan.total_pool - totalAlloc)} available
                </p>
              </div>
              <button
                onClick={() => setAddingDeal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors"
              >
                <Plus size={13} /> Add Deal
              </button>
            </div>

            {/* Add deal form */}
            {addingDeal && (
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
                <p className="text-xs font-semibold text-gray-600">Link a deal to this loan</p>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by address..."
                    value={dealSearch}
                    onChange={e => { setDealSearch(e.target.value); setSelectedDeal(null); }}
                    className={inp}
                  />
                  {dealResults.length > 0 && !selectedDeal && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                      {dealResults.map(d => (
                        <button
                          key={d.id}
                          onClick={() => { setSelectedDeal(d); setDealSearch(d.address); setDealResults([]); }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="font-medium text-sidebar">{d.address}</span>
                          <span className="ml-2 text-xs text-gray-400">{d.county} · {d.stage}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedDeal && (
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Allocated amount"
                        value={newAllocAmount}
                        onChange={e => setNewAllocAmount(e.target.value)}
                        className={`${inp} pl-6`}
                      />
                    </div>
                    <button
                      onClick={handleAddAllocation}
                      disabled={saving || !newAllocAmount}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setAddingDeal(false); setSelectedDeal(null); setDealSearch(''); setNewAllocAmount(''); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Allocations table */}
            {allocations.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                <Layers size={28} className="mx-auto mb-2 text-gray-300" />
                No deals linked yet. Click "Add Deal" to link deals to this loan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Deal</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Allocated</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">% of Pool</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Monthly Interest</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Profit Participation</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map(alloc => {
                      const pct = totalAlloc > 0 ? (alloc.allocated_amount / totalAlloc) * 100 : 0;
                      const attrInterest = totalAlloc > 0 ? (alloc.allocated_amount / totalAlloc) * monthly : 0;
                      return (
                        <tr key={alloc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                          <td className="py-3 px-4">
                            <Link
                              to={`/deal/${alloc.deal_id}`}
                              className="text-sm font-medium text-accent hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {alloc.deal_address || alloc.deal_id}
                            </Link>
                            {alloc.draw_date && (
                              <p className="text-xs text-gray-400 mt-0.5">Draw: {alloc.draw_date}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-semibold text-sidebar">
                            {fmt$(alloc.allocated_amount)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs text-gray-500">{pct.toFixed(1)}%</span>
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-700">
                            {fmt$(attrInterest)}
                          </td>
                          <td className="py-3 px-4 text-right text-xs text-gray-500">
                            {fmtPct(loan.profit_participation_pct)} of net
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveAllocation(alloc.deal_id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="py-3 px-4 text-xs font-bold text-gray-600">
                        Total · {allocations.length} deals
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-bold text-sidebar">{fmt$(totalAlloc)}</td>
                      <td className="py-3 px-4 text-right text-xs text-gray-400">
                        {loan.total_pool > 0 ? `${((totalAlloc / loan.total_pool) * 100).toFixed(1)}% drawn` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-bold text-sidebar">{fmt$(monthly)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Pool utilization bar */}
          {loan.total_pool > 0 && (
            <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-sidebar">Pool Utilization</h3>
                <span className="text-xs text-gray-400">
                  {fmt$(totalAlloc)} of {fmt$(loan.total_pool)} drawn
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (totalAlloc / loan.total_pool) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {((totalAlloc / loan.total_pool) * 100).toFixed(1)}% utilized
                </span>
                <span className="text-xs font-semibold text-green-600">
                  {fmt$(loan.total_pool - totalAlloc)} available
                </span>
              </div>
            </div>
          )}

          {/* Interest summary card */}
          <div className="bg-card rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-sidebar mb-4">Interest Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-400 mb-1">Monthly (full pool)</p>
                <p className="text-xl font-bold text-sidebar">{fmt$(monthly)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Annual (full pool)</p>
                <p className="text-xl font-bold text-sidebar">{fmt$(annual)}</p>
              </div>
              {loan.term_months > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Full term ({loan.term_months}mo)</p>
                  <p className="text-xl font-bold text-sidebar">{fmt$(monthly * loan.term_months)}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
              Interest accrues on the full {fmt$(loan.total_pool)} pool regardless of draw amount.
              Monthly interest is prorated across linked deals by allocation share.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
