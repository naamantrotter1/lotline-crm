/**
 * CapitalStackModule.jsx
 * Capital Stack editor for DealDetail.
 *
 * Shows:
 *  • Dual health indicators: Deal Funding pill + Commitment Health pill
 *  • Allocation table (one row per investor slice)
 *  • "Funding sources on this deal" chip list (replaces global headroom panel)
 *  • Add / Edit Allocation modal with:
 *      - Live deal-remaining hint on the amount field
 *      - Headroom hint per commitment option
 *      - Only non-legacy active commitments in the dropdown
 *  • "Fix this allocation" / "Remove this allocation" action on over-allocated rows
 *  • Auto-Fund button (skips legacy commitments)
 *  • Override-reason field when either guardrail is triggered
 *
 * The global "Commitment Headroom" panel has been removed from the deal page.
 * It lives on /capital-planner and /investors where a global view makes sense.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Zap, AlertTriangle, ChevronDown, ChevronUp, Loader2, Wrench } from 'lucide-react';
import {
  fetchDealStack,
  fetchCommitmentSummaries,
  fetchActiveCommitmentsForModal,
  fetchInvestors,
  addAllocation,
  updateAllocation,
  returnAllocation,
  removeAllocation,
  autoFundDeal,
  refreshDealStackStatus,
} from '../lib/capitalStackData';
import { flushToSupabase } from '../lib/dealsSync';
import { INVESTORS as STATIC_INVESTORS } from '../data/investors';

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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pill showing deal-level allocation health.
 * Draft | Partially Allocated | Fully Allocated | Over-Allocated
 */
function DealFundingBadge({ totalAllocated, required }) {
  let label, bg, text;
  if (!required || required === 0 || totalAllocated === 0) {
    label = 'Draft'; bg = 'bg-gray-100'; text = 'text-gray-500';
  } else if (totalAllocated > required) {
    label = 'Over-Allocated'; bg = 'bg-red-100'; text = 'text-red-700';
  } else if (totalAllocated >= required) {
    label = 'Fully Allocated'; bg = 'bg-green-100'; text = 'text-green-700';
  } else {
    label = 'Partially Allocated'; bg = 'bg-amber-100'; text = 'text-amber-700';
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${bg} ${text}`}>
        {label}
      </span>
      <span className="text-sm text-gray-500">
        {fmt(totalAllocated)}
        {required > 0 ? <span className="text-gray-400"> / {fmt(required)}</span> : null}
      </span>
    </div>
  );
}


/**
 * Compact chip list: distinct investors on THIS deal with their pro-rata %.
 * Replaces the global Commitment Headroom panel on individual deal pages.
 */
function FundingSourcesChips({ allocations, totalAllocated }) {
  if (!allocations.length) return null;

  const byInvestor = {};
  for (const a of allocations) {
    if (!byInvestor[a.investor_id]) {
      byInvestor[a.investor_id] = { name: a.investor_name, amount: 0 };
    }
    byInvestor[a.investor_id].amount += Number(a.amount ?? 0);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
        Funding sources
      </span>
      {Object.values(byInvestor).map(inv => {
        const pct = totalAllocated > 0 ? Math.round((inv.amount / totalAllocated) * 100) : 0;
        return (
          <span
            key={inv.name}
            className="text-[11px] font-medium bg-gray-100 text-gray-600 rounded-full px-2.5 py-1"
          >
            {inv.name} — {pct}%
          </span>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Allocation Modal
// ─────────────────────────────────────────────────────────────────────────────

function AllocationModal({
  deal,
  modalCommitments,   // non-legacy active commitments only
  investors,
  existing,           // existing allocation when editing; may have _fixedAmount
  dealRemaining,      // deal.totalCapitalRequired - sum(other active allocs)
  onClose,
  onSaved,
}) {
  const isEdit = !!existing;

  const [investorId, setInvestorId] = useState(existing?.investor_id ?? '');
  const [commitmentId, setCommitmentId] = useState(existing?.commitment_id ?? '');
  const [amountDisplay, setAmountDisplay] = useState(() => {
    // Pre-fill with _fixedAmount when "Fix this allocation" opens the modal
    const prefill = existing?._fixedAmount ?? existing?.amount;
    return prefill ? Number(prefill).toLocaleString() : '';
  });
  const amountNum = Number(amountDisplay.replace(/,/g, '')) || 0;

  const [position, setPosition] = useState(existing?.position ?? '1st Position');
  const [preferredReturnPct, setPreferredReturnPct] = useState(existing?.preferred_return_pct ?? '');
  const [profitSharePct, setProfitSharePct] = useState(existing?.profit_share_pct ?? '');
  const [status, setStatus] = useState(existing?.status ?? 'planned');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Server-side headroom block (commitment-level only — deal-level is caught client-side)
  const [headroomBlocked, setHeadroomBlocked] = useState(false);
  const [headroom, setHeadroom] = useState(null);

  // Filter commitments to selected investor
  const investorCommitments = modalCommitments.filter(c => c.investor_id === investorId);

  useEffect(() => {
    if (investorCommitments.length === 1) setCommitmentId(investorCommitments[0].commitment_id);
    else if (!investorCommitments.find(c => c.commitment_id === commitmentId)) setCommitmentId('');
  }, [investorId]); // eslint-disable-line

  // ── Deal-capacity inline warning (client-side, proactive) ─────────────────
  const hasDealCap = deal.totalCapitalRequired != null && deal.totalCapitalRequired > 0;
  const exceedsDealCap = hasDealCap && dealRemaining != null && amountNum > 0 && amountNum > dealRemaining;
  const dealFullyAllocated = hasDealCap && dealRemaining != null && dealRemaining <= 0;

  // Override required when either guardrail is triggered
  const overrideNeeded = (exceedsDealCap || headroomBlocked) && !overrideReason;

  const handleSave = async () => {
    if (!commitmentId || !investorId || !amountNum) return;
    if (overrideNeeded) return;
    setSaving(true);

    if (isEdit) {
      const { error, blocked, dealCapacityExceeded, dealRemaining: dr } = await updateAllocation(
        existing.allocation_id,
        {
          amount: amountNum,
          position,
          preferred_return_pct: preferredReturnPct !== '' ? Number(preferredReturnPct) : null,
          profit_share_pct: profitSharePct !== '' ? Number(profitSharePct) : null,
          status,
          notes,
        },
        overrideReason || null,
      );
      setSaving(false);
      if (blocked && dealCapacityExceeded) {
        // Shouldn't reach here (client catches it), but handle gracefully
        setHeadroomBlocked(false);
      } else if (!error) {
        onSaved();
        onClose();
      }
    } else {
      const result = await addAllocation({
        dealId: deal.id,
        commitmentId,
        investorId,
        amount: amountNum,
        position,
        preferredReturnPct: preferredReturnPct !== '' ? Number(preferredReturnPct) : null,
        profitSharePct: profitSharePct !== '' ? Number(profitSharePct) : null,
        status,
        notes,
        overrideReason: overrideReason || null,
      });
      setSaving(false);
      if (result.blocked && !result.dealCapacityExceeded) {
        // Commitment-level block (server caught it, client missed it)
        setHeadroomBlocked(true);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold text-gray-900">
          {isEdit ? (existing._fixedAmount ? 'Fix Allocation' : 'Edit Allocation') : 'Add Allocation'}
        </h2>

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

        {/* Commitment — headroom hint in option text */}
        <div>
          <p className={labelCls}>Commitment</p>
          <select
            value={commitmentId}
            onChange={e => setCommitmentId(e.target.value)}
            className={inputCls}
            disabled={!investorId}
          >
            <option value="">— Select commitment —</option>
            {investorCommitments.map(c => {
              const remainingText = c.committed_amount == null
                ? '∞ remaining'
                : `${fmt(c.remaining_headroom)} remaining`;
              return (
                <option key={c.commitment_id} value={c.commitment_id}>
                  {c.commitment_name} — {remainingText}
                </option>
              );
            })}
          </select>
          {investorId && investorCommitments.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              No active commitments for this investor. Create one on the Capital Planner first.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Amount with deal-remaining hint */}
          <div className="col-span-2">
            <p className={labelCls}>Amount</p>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setAmountDisplay(raw === '' ? '' : Number(raw).toLocaleString());
                  // Clear server-side headroom block when user changes amount
                  setHeadroomBlocked(false);
                }}
                placeholder="0"
                className={`${inputCls} pl-6`}
              />
            </div>
            {/* Deal-capacity inline hints */}
            {hasDealCap && amountNum > 0 && (() => {
              if (dealFullyAllocated) return (
                <p className="text-[11px] text-red-600 mt-1">
                  This deal is already fully allocated. Enter an override reason to proceed.
                </p>
              );
              if (exceedsDealCap) return (
                <p className="text-[11px] text-amber-600 mt-1">
                  This deal only needs <strong>{fmt(dealRemaining)}</strong> more.
                  Reduce the amount or enter an override reason below.
                </p>
              );
              if (dealRemaining != null && dealRemaining > 0) return (
                <p className="text-[11px] text-gray-400 mt-1">
                  Deal has <strong>{fmt(dealRemaining)}</strong> of capacity remaining.
                </p>
              );
              return null;
            })()}
          </div>

          {/* Position */}
          <div>
            <p className={labelCls}>Position</p>
            <select value={position} onChange={e => setPosition(e.target.value)} className={inputCls}>
              <option>1st Position</option>
              <option>2nd Position</option>
            </select>
          </div>

          {/* Preferred return */}
          <div>
            <p className={labelCls}>Preferred Return (%)</p>
            <input
              type="number"
              value={preferredReturnPct}
              onChange={e => setPreferredReturnPct(e.target.value)}
              placeholder="e.g. 13"
              className={inputCls}
            />
          </div>

          {/* Profit share */}
          <div>
            <p className={labelCls}>Profit Share (%)</p>
            <input
              type="number"
              value={profitSharePct}
              onChange={e => setProfitSharePct(e.target.value)}
              placeholder="e.g. 50"
              className={inputCls}
            />
          </div>

          {/* Status */}
          <div>
            <p className={labelCls}>Status</p>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
              {['planned', 'committed', 'funded', 'returned'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className={labelCls}>Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Override reason — shown when either guardrail is triggered */}
        {(exceedsDealCap || dealFullyAllocated || headroomBlocked) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-700 text-sm font-semibold">
              <AlertTriangle size={14} />
              {headroomBlocked
                ? `Exceeds commitment headroom by ${fmt(amountNum - (headroom ?? 0))}`
                : exceedsDealCap
                  ? `Exceeds deal capacity by ${fmt(amountNum - (dealRemaining ?? 0))}`
                  : 'Deal is already fully allocated'}
            </div>
            <p className="text-xs text-red-600">
              {headroomBlocked
                ? `Remaining headroom on this commitment: ${fmt(headroom)}.`
                : `This deal requires only ${fmt(deal.totalCapitalRequired)} total.`}{' '}
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
            disabled={saving || !commitmentId || !investorId || !amountNum || overrideNeeded}
            onClick={handleSave}
            className="flex-1 text-sm font-medium bg-accent text-white rounded-xl py-2 hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : (exceedsDealCap || dealFullyAllocated || headroomBlocked) ? 'Override & Save' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocation row
// ─────────────────────────────────────────────────────────────────────────────

function AllocationRow({ alloc, onEdit, onReturn, onRemove, onFix, readOnly, totalAllocated, required }) {
  const [expanded, setExpanded] = useState(false);

  // How much deal capacity is available for this specific slot?
  const otherAllocsTotal = totalAllocated - Number(alloc.amount ?? 0);
  const dealRemainingForSlot = required > 0 ? required - otherAllocsTotal : null;
  // This allocation is over-sized when it takes more than the slot allows
  const isOverAllocated = dealRemainingForSlot != null && Number(alloc.amount) > dealRemainingForSlot;
  const noCapacityRemains = dealRemainingForSlot != null && dealRemainingForSlot <= 0;

  const statusColor = {
    planned:   'bg-gray-100 text-gray-500',
    committed: 'bg-blue-100 text-blue-700',
    funded:    'bg-green-100 text-green-700',
    returned:  'bg-purple-100 text-purple-600',
  }[alloc.status] ?? 'bg-gray-100 text-gray-500';

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-800">{alloc.investor_name}</td>
        <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{alloc.commitment_name}</td>
        <td className="px-4 py-3 text-right">
          <span className={`text-sm font-semibold ${isOverAllocated ? 'text-red-600' : 'text-gray-900'}`}>
            {fmt(alloc.amount)}
          </span>
          {isOverAllocated && (
            <AlertTriangle size={12} className="inline ml-1 text-red-500" />
          )}
        </td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className="text-xs text-gray-500">{fmtPct(alloc.percent_of_deal)}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
            {alloc.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {expanded
            ? <ChevronUp size={14} className="text-gray-400 ml-auto" />
            : <ChevronDown size={14} className="text-gray-400 ml-auto" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
              {alloc.position && <span><strong>Position:</strong> {alloc.position}</span>}
              {alloc.preferred_return_pct != null && (
                <span><strong>Preferred return:</strong> {alloc.preferred_return_pct}%/yr</span>
              )}
              {alloc.profit_share_pct != null && (
                <span><strong>Profit share:</strong> {alloc.profit_share_pct}%</span>
              )}
              {alloc.notes && <span><strong>Notes:</strong> {alloc.notes}</span>}
            </div>

            {/* Over-allocation warning with Fix / Remove action (option B) */}
            {isOverAllocated && !readOnly && (
              <div className="mb-2 p-2.5 bg-red-50 rounded-lg border border-red-100 text-xs">
                <p className="text-red-700 font-semibold mb-1">
                  Over-allocated by {fmt(Number(alloc.amount) - (dealRemainingForSlot ?? 0))}
                </p>
                {noCapacityRemains ? (
                  <p className="text-red-600">
                    No capacity remains for this slot.{' '}
                    <button
                      onClick={e => { e.stopPropagation(); onRemove(alloc.allocation_id); }}
                      className="underline font-medium"
                    >
                      Remove this allocation
                    </button>{' '}
                    to free up space.
                  </p>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); onFix(alloc, dealRemainingForSlot); }}
                    className="flex items-center gap-1 text-red-700 font-medium underline"
                  >
                    <Wrench size={11} />
                    Fix: set amount to {fmt(dealRemainingForSlot)}
                  </button>
                )}
              </div>
            )}

            {!readOnly && (
              alloc.source_scenario === 'committed_capital_partner' ? (
                <p className="text-xs text-gray-500 italic flex items-center gap-1">
                  Managed by Financing Scenario — edit in the Deal Evaluation panel.
                </p>
              ) : (
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
              )
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
  const [allCommitments, setAllCommitments] = useState([]);      // all types — for health badge
  const [modalCommitments, setModalCommitments] = useState([]);  // non-legacy active — for modal
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(null);
  const [autoFunding, setAutoFunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [stack, allSummaries, modalSummaries, invList] = await Promise.all([
      fetchDealStack(deal.id),
      fetchCommitmentSummaries(),
      fetchActiveCommitmentsForModal(),
      fetchInvestors(),
    ]);
    setAllocations(stack);
    setAllCommitments(allSummaries);
    setModalCommitments(modalSummaries);
    const realInvestors = invList.filter(i => !['Alpha Investor', 'Beta Investor'].includes(i.name));
    setInvestors(realInvestors.length > 0 ? realInvestors : STATIC_INVESTORS);
    setLoading(false);
  }, [deal.id]);

  useEffect(() => { load(); }, [load]);

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

  const handleFix = (alloc, clampedAmount) => {
    // Open edit modal pre-filled with the clamped (correct) amount
    setEditingAlloc({ ...alloc, _fixedAmount: clampedAmount });
    setShowAdd(true);
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
      alert(
        `Auto-Fund: committed ${fmt(result.totalFunded)} of ${fmt(required)}. ` +
        `Gap of ${fmt(result.gap)} remains — not enough headroom across active commitments.`,
      );
    }
    await afterMutation();
  };

  const totalAllocated = allocations.reduce((s, a) => s + Number(a.amount ?? 0), 0);
  const required = deal.totalCapitalRequired ?? 0;

  // Deal remaining for the modal (new allocation context)
  const dealRemainingForNew = required > 0 ? required - totalAllocated : null;
  // Deal remaining for edit context (add back the allocation being edited)
  const dealRemainingForEdit = editingAlloc
    ? (required > 0 ? required - (totalAllocated - Number(editingAlloc._fixedAmount != null ? editingAlloc.amount : editingAlloc.amount ?? 0)) : null)
    : null;

  return (
    <div className="space-y-4">

      {/* ── Deal funding status ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DealFundingBadge totalAllocated={totalAllocated} required={required} />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              disabled={autoFunding}
              onClick={handleAutoFund}
              title="Auto-Fund fills remaining capacity using active commitments (legacy excluded)"
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
                  totalAllocated={totalAllocated}
                  required={required}
                  onEdit={alloc => { setEditingAlloc(alloc); setShowAdd(true); }}
                  onReturn={handleReturn}
                  onRemove={handleRemove}
                  onFix={handleFix}
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

          {/* Funding sources chip list — scoped strictly to THIS deal */}
          <div className="px-4 pb-3">
            <FundingSourcesChips allocations={allocations} totalAllocated={totalAllocated} />
          </div>
        </div>
      )}

      {/* ── Total Capital Required field ── */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deal Parameters</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">
                Total Capital Required ($)
              </p>
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

      {/* ── Modal ── */}
      {showAdd && (
        <AllocationModal
          deal={deal}
          modalCommitments={modalCommitments}
          investors={investors}
          existing={editingAlloc}
          dealRemaining={editingAlloc ? dealRemainingForEdit : dealRemainingForNew}
          onClose={() => { setShowAdd(false); setEditingAlloc(null); }}
          onSaved={afterMutation}
        />
      )}
    </div>
  );
}
