/**
 * CapitalStackModule.jsx
 * Capital Stack editor for DealDetail — the Capital Stack tab.
 *
 * Shows:
 *  • Status badge (draft / partially_funded / fully_funded / over_committed)
 *  • Allocation table (one row per investor slice)
 *  • Headroom bars for every active commitment
 *  • Add Allocation modal (inline)
 *  • Auto-Fund button
 *  • Override-reason modal (when headroom check blocks a save)
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Zap, RotateCcw, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  fetchDealStack,
  fetchCommitmentSummaries,
  fetchInvestors,
  addAllocation,
  updateAllocation,
  returnAllocation,
  removeAllocation,
  autoFundDeal,
  refreshDealStackStatus,
} from '../lib/capitalStackData';
import { flushToSupabase } from '../lib/dealsSync';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtPct(n) {
  if (n == null) return '—';
  return `${Number(n).toFixed(1)}%`;
}

const STATUS_CONFIG = {
  draft:             { label: 'Draft',             bg: 'bg-gray-100',    text: 'text-gray-500'   },
  partially_funded:  { label: 'Partially Funded',  bg: 'bg-amber-100',   text: 'text-amber-700'  },
  fully_funded:      { label: 'Fully Funded',       bg: 'bg-green-100',   text: 'text-green-700'  },
  over_committed:    { label: 'Over-Committed',     bg: 'bg-red-100',     text: 'text-red-700'    },
};

const ALLOC_STATUS_OPTIONS = ['planned', 'committed', 'funded', 'returned'];
const POSITION_OPTIONS = ['senior', 'pari_passu', 'subordinate'];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

/** Horizontal headroom bar for one commitment */
function HeadroomBar({ summary }) {
  const isUnlimited = summary.committed_amount == null;
  const allocated = Number(summary.total_allocated ?? 0);
  const committed = Number(summary.committed_amount ?? 0);
  const pct = isUnlimited || committed === 0 ? 0 : Math.min(100, (allocated / committed) * 100);
  const overCommitted = !isUnlimited && allocated > committed;

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-xs font-semibold text-gray-700">{summary.investor_name}</p>
          <p className="text-[10px] text-gray-400">{summary.commitment_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-gray-800">
            {fmt(allocated)} <span className="text-gray-400 font-normal">of</span> {isUnlimited ? '∞' : fmt(committed)}
          </p>
          {!isUnlimited && (
            <p className={`text-[10px] font-medium ${overCommitted ? 'text-red-600' : 'text-green-600'}`}>
              {overCommitted ? 'Over by ' : 'Headroom: '}{fmt(Math.abs(Number(summary.remaining_headroom ?? 0)))}
            </p>
          )}
          {isUnlimited && <p className="text-[10px] text-green-600">Unlimited headroom</p>}
        </div>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overCommitted ? 'bg-red-500' : pct >= 100 ? 'bg-green-500' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Allocation Modal
// ─────────────────────────────────────────────────────────────────────────────

function AllocationModal({ deal, commitments, investors, existing, onClose, onSaved }) {
  const isEdit = !!existing;

  const [investorId, setInvestorId] = useState(existing?.investor_id ?? '');
  const [commitmentId, setCommitmentId] = useState(existing?.commitment_id ?? '');
  const [amount, setAmount] = useState(existing?.amount ?? '');
  const [position, setPosition] = useState(existing?.position ?? 'pari_passu');
  const [preferredReturnPct, setPreferredReturnPct] = useState(existing?.preferred_return_pct ?? '');
  const [profitSharePct, setProfitSharePct] = useState(existing?.profit_share_pct ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'planned');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [headroom, setHeadroom] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Filter commitments to selected investor
  const investorCommitments = commitments.filter(c => c.investor_id === investorId);

  // Auto-select commitment when investor changes
  useEffect(() => {
    if (investorCommitments.length === 1) setCommitmentId(investorCommitments[0].commitment_id);
    else if (!investorCommitments.find(c => c.commitment_id === commitmentId)) setCommitmentId('');
  }, [investorId]); // eslint-disable-line

  const handleSave = async (override = null) => {
    if (!commitmentId || !investorId || !amount) return;
    setSaving(true);

    if (isEdit) {
      const { error } = await updateAllocation(existing.allocation_id, {
        amount: Number(amount),
        position,
        preferred_return_pct: preferredReturnPct !== '' ? Number(preferredReturnPct) : null,
        profit_share_pct: profitSharePct !== '' ? Number(profitSharePct) : null,
        status,
        notes,
      });
      setSaving(false);
      if (!error) { onSaved(); onClose(); }
    } else {
      const result = await addAllocation({
        dealId: deal.id,
        commitmentId,
        investorId,
        amount: Number(amount),
        position,
        preferredReturnPct: preferredReturnPct !== '' ? Number(preferredReturnPct) : null,
        profitSharePct: profitSharePct !== '' ? Number(profitSharePct) : null,
        status,
        notes,
        overrideReason: override,
      });
      setSaving(false);
      if (result.blocked) {
        setBlocked(true);
        setHeadroom(result.headroom);
      } else if (!result.error) {
        onSaved();
        onClose();
      }
    }
  };

  const inputCls = 'text-sm bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full';
  const labelCls = 'text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit Allocation' : 'Add Allocation'}</h2>

        {/* Investor */}
        <div>
          <p className={labelCls}>Investor</p>
          <select value={investorId} onChange={e => setInvestorId(e.target.value)} className={inputCls}>
            <option value="">— Select investor —</option>
            {investors.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.name}</option>
            ))}
          </select>
        </div>

        {/* Commitment */}
        <div>
          <p className={labelCls}>Commitment</p>
          <select value={commitmentId} onChange={e => setCommitmentId(e.target.value)} className={inputCls} disabled={!investorId}>
            <option value="">— Select commitment —</option>
            {investorCommitments.map(c => (
              <option key={c.commitment_id} value={c.commitment_id}>
                {c.commitment_name} ({c.committed_amount == null ? '∞' : fmt(c.remaining_headroom)} headroom)
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Amount */}
          <div>
            <p className={labelCls}>Amount ($)</p>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          {/* Position */}
          <div>
            <p className={labelCls}>Position</p>
            <select value={position} onChange={e => setPosition(e.target.value)} className={inputCls}>
              {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </select>
          </div>
          {/* Preferred return */}
          <div>
            <p className={labelCls}>Preferred Return (%)</p>
            <input type="number" value={preferredReturnPct} onChange={e => setPreferredReturnPct(e.target.value)} placeholder="e.g. 13" className={inputCls} />
          </div>
          {/* Profit share */}
          <div>
            <p className={labelCls}>Profit Share (%)</p>
            <input type="number" value={profitSharePct} onChange={e => setProfitSharePct(e.target.value)} placeholder="e.g. 50" className={inputCls} />
          </div>
          {/* Status */}
          <div>
            <p className={labelCls}>Status</p>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              {ALLOC_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className={labelCls}>Notes</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>

        {/* Over-headroom warning */}
        {blocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
              <AlertTriangle size={14} />
              Exceeds headroom by {fmt(Number(amount) - headroom)}
            </div>
            <p className="text-xs text-red-600">
              This allocation would exceed the commitment's remaining headroom of {fmt(headroom)}.
              Enter a reason to override this guardrail.
            </p>
            <input
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Override reason (required)"
              className={inputCls}
            />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={saving || !commitmentId || !investorId || !amount || (blocked && !overrideReason)}
            onClick={() => handleSave(blocked ? overrideReason : null)}
            className="flex-1 text-sm font-medium bg-accent text-white rounded-xl py-2 hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : blocked ? 'Override & Save' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocation row
// ─────────────────────────────────────────────────────────────────────────────

function AllocationRow({ alloc, onEdit, onReturn, onRemove, readOnly }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = {
    planned: 'bg-gray-100 text-gray-500',
    committed: 'bg-blue-100 text-blue-700',
    funded: 'bg-green-100 text-green-700',
    returned: 'bg-purple-100 text-purple-600',
  }[alloc.status] ?? 'bg-gray-100 text-gray-500';

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-800">{alloc.investor_name}</td>
        <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{alloc.commitment_name}</td>
        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmt(alloc.amount)}</td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className="text-xs text-gray-500">{fmtPct(alloc.percent_of_deal)}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{alloc.status}</span>
        </td>
        <td className="px-4 py-3 text-right">
          {expanded ? <ChevronUp size={14} className="text-gray-400 ml-auto" /> : <ChevronDown size={14} className="text-gray-400 ml-auto" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
              {alloc.position && <span><strong>Position:</strong> {alloc.position.replace('_', ' ')}</span>}
              {alloc.preferred_return_pct != null && <span><strong>Preferred return:</strong> {alloc.preferred_return_pct}%/yr</span>}
              {alloc.profit_share_pct != null && <span><strong>Profit share:</strong> {alloc.profit_share_pct}%</span>}
              {alloc.notes && <span><strong>Notes:</strong> {alloc.notes}</span>}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <button
                  onClick={e => { e.stopPropagation(); onEdit(alloc); }}
                  className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors"
                >
                  Edit
                </button>
                {alloc.status === 'funded' && (
                  <button
                    onClick={e => { e.stopPropagation(); onReturn(alloc.allocation_id); }}
                    className="text-xs font-medium border border-purple-200 text-purple-600 rounded-lg px-3 py-1.5 hover:bg-purple-50 transition-colors"
                  >
                    Mark Returned
                  </button>
                )}
                {alloc.status === 'planned' && (
                  <button
                    onClick={e => { e.stopPropagation(); onRemove(alloc.allocation_id); }}
                    className="text-xs font-medium border border-red-200 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main module
// ─────────────────────────────────────────────────────────────────────────────

export default function CapitalStackModule({ deal, readOnly = false }) {
  const [allocations, setAllocations] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(null);
  const [autoFunding, setAutoFunding] = useState(false);

  const stackStatus = deal.capitalStackStatus ?? 'draft';

  const load = useCallback(async () => {
    setLoading(true);
    const [stack, summaries, invList] = await Promise.all([
      fetchDealStack(deal.id),
      fetchCommitmentSummaries(),
      fetchInvestors(),
    ]);
    setAllocations(stack);
    setCommitments(summaries);
    setInvestors(invList);
    setLoading(false);
  }, [deal.id]);

  useEffect(() => { load(); }, [load]);

  // After any mutation, reload stack and refresh deal status in DB
  // (real-time subscription will sync capitalStackStatus back to DealsContext automatically)
  const afterMutation = useCallback(async () => {
    await refreshDealStackStatus(deal.id);
    await load();
  }, [deal.id, load]);

  const handleReturn = async (allocId) => {
    if (!window.confirm('Mark this allocation as returned? This will restore headroom for revolving commitments.')) return;
    await returnAllocation(allocId);
    await afterMutation();
  };

  const handleRemove = async (allocId) => {
    if (!window.confirm('Remove this planned allocation?')) return;
    await removeAllocation(allocId);
    await afterMutation();
  };

  const handleAutoFund = async () => {
    const required = deal.totalCapitalRequired;
    if (!required) {
      alert('This deal has no Total Capital Required set. Edit cost fields first.');
      return;
    }
    setAutoFunding(true);
    const result = await autoFundDeal(deal.id, required);
    setAutoFunding(false);
    if (result.gap > 0) {
      alert(`Auto-Fund: committed ${fmt(result.totalFunded)} of ${fmt(required)}. Gap of ${fmt(result.gap)} remains — not enough headroom across active commitments.`);
    }
    await afterMutation();
  };

  const totalAllocated = allocations.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const required = deal.totalCapitalRequired ?? 0;
  const gap = required - totalAllocated;

  // Active (non-returned) commitments for headroom bars
  const activeCommitments = commitments.filter(c => c.commitment_status === 'active');

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={stackStatus} />
          <span className="text-sm text-gray-500">
            {fmt(totalAllocated)} allocated{required > 0 ? ` of ${fmt(required)} required` : ''}
            {gap > 0 && required > 0 && <span className="text-amber-600 ml-1">({fmt(gap)} gap)</span>}
          </span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              disabled={autoFunding}
              onClick={handleAutoFund}
              className="flex items-center gap-1.5 text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {autoFunding ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Auto-Fund
            </button>
            <button
              onClick={() => { setEditingAlloc(null); setShowAdd(true); }}
              className="flex items-center gap-1.5 text-xs font-medium bg-accent text-white rounded-lg px-3 py-2 hover:bg-accent/90 transition-colors"
            >
              <Plus size={13} /> Add Allocation
            </button>
          </div>
        )}
      </div>

      {/* ── Allocation Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : allocations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-400">No capital allocated yet.</p>
          {!readOnly && (
            <button
              onClick={() => { setEditingAlloc(null); setShowAdd(true); }}
              className="mt-3 text-xs font-medium text-accent hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Add first allocation
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Investor</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Commitment</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">%</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <AllocationRow
                  key={a.allocation_id}
                  alloc={a}
                  readOnly={readOnly}
                  onEdit={alloc => { setEditingAlloc(alloc); setShowAdd(true); }}
                  onReturn={handleReturn}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 bg-gray-50">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-600" colSpan={2}>Total</td>
                <td className="px-4 py-2.5 text-sm font-bold text-gray-900 text-right">{fmt(totalAllocated)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-400 text-right hidden md:table-cell">100%</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Headroom bars ── */}
      {activeCommitments.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Commitment Headroom</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeCommitments.map(c => (
              <HeadroomBar key={c.commitment_id} summary={c} />
            ))}
          </div>
        </div>
      )}

      {/* ── Total Capital Required field ── */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deal Parameters</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Total Capital Required ($)</p>
              <input
                type="number"
                defaultValue={deal.totalCapitalRequired ?? ''}
                onBlur={e => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  flushToSupabase({ ...deal, totalCapitalRequired: val });
                }}
                placeholder="Auto-calculated from costs"
                className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd && (
        <AllocationModal
          deal={deal}
          commitments={commitments}
          investors={investors}
          existing={editingAlloc}
          onClose={() => { setShowAdd(false); setEditingAlloc(null); }}
          onSaved={afterMutation}
        />
      )}
    </div>
  );
}
