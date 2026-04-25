/**
 * CostBreakdownTab — three-column estimated / actual / difference view.
 *
 * Column 1 (Estimated): editable inline, grouped by category group.
 * Column 2 (Actual):    mirrors estimated (muted) until manually overridden;
 *                       green checkmark when overridden; ↺ reset to mirror.
 * Column 3 (Difference): actual_resolved − estimated, color-coded.
 *
 * Behind feature flag "cost_breakdown.three_column" per org.
 * On mobile (<1024px): stacks vertically.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, RotateCcw, Filter, ClipboardList } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  fetchCostLines,
  updateEstimated,
  overrideActual,
  resetActualToMirror,
  resolveActual,
  resolveDifference,
  computeTotalActual,
  computeTotalEstimated,
} from '../../lib/costBreakdownData';

// ── Formatting helpers ────────────────────────────────────────────────────────

const fmt  = n => `$${Math.abs(Math.round(n)).toLocaleString()}`;
const fmtD = n => {
  if (n === 0) return '—';
  const abs = Math.abs(Math.round(n));
  return `${n > 0 ? '+' : '−'}$${abs.toLocaleString()}`;
};

// ── Group order ───────────────────────────────────────────────────────────────

const GROUP_ORDER = ['Land','Build','Sitework','Finishing','Other'];

function groupLines(lines) {
  const groups = {};
  for (const l of lines) {
    const g = l.group_name || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(l);
  }
  return GROUP_ORDER.map(g => ({ group: g, lines: groups[g] || [] })).filter(g => g.lines.length > 0);
}

// ── Inline editable number cell ───────────────────────────────────────────────

function NumCell({ value, muted, onCommit, disabled, placeholder = '0' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef = useRef(null);

  const start = () => {
    if (disabled) return;
    setDraft(value === 0 ? '' : String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const n = parseFloat(draft) || 0;
    onCommit(n);
  };

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setEditing(false); }}
        className="w-full text-right text-sm font-medium bg-white border border-accent/60 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
    );
  }

  return (
    <button
      onClick={start}
      disabled={disabled}
      className={`w-full text-right text-sm rounded px-2 py-0.5 transition-colors ${
        disabled
          ? 'cursor-default'
          : 'cursor-pointer hover:bg-gray-50 group'
      } ${muted ? 'text-gray-400 italic' : 'text-gray-800 font-medium'}`}
    >
      {value === 0 && !muted ? <span className="text-gray-300">—</span> : fmt(value)}
    </button>
  );
}

// ── Difference cell ───────────────────────────────────────────────────────────

function DiffCell({ line }) {
  const diff = resolveDifference(line);
  if (!line.actual_overridden) {
    return <span className="text-gray-300 text-sm text-right block px-2">—</span>;
  }
  const color = diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-500' : 'text-gray-400';
  const tip = `Estimated: ${fmt(line.estimated_amount)} · Actual: ${fmt(resolveActual(line))} · Δ: ${fmtD(diff)}`;
  return (
    <span
      title={tip}
      className={`text-sm font-semibold text-right block px-2 ${color}`}
    >
      {fmtD(diff)}
    </span>
  );
}

// ── Column header strip ───────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',           label: 'All'            },
  { key: 'overridden',    label: 'Overridden'     },
  { key: 'mirrored',     label: 'Mirrored'        },
  { key: 'has_notes',    label: 'Has Notes'       },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CostBreakdownTab({ dealId }) {
  const { profile } = useAuth();
  const { can }     = usePermissions();

  const canEditEst  = can('cost_breakdown.edit_estimated');
  const canEditAct  = can('cost_breakdown.edit_actual');

  const [lines,   setLines]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  const loadLines = useCallback(async () => {
    setLoading(true);
    const data = await fetchCostLines(dealId);
    setLines(data);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { loadLines(); }, [loadLines]);

  // ── Estimated edit ──────────────────────────────────────────────────────────
  const handleEstimated = useCallback(async (lineId, amount) => {
    // Optimistic update
    setLines(prev => prev.map(l => l.line_id === lineId ? { ...l, estimated_amount: amount } : l));
    await updateEstimated(lineId, amount, profile?.id);
  }, [profile?.id]);

  // ── Actual override ─────────────────────────────────────────────────────────
  const handleActual = useCallback(async (lineId, amount) => {
    setLines(prev => prev.map(l =>
      l.line_id === lineId
        ? { ...l, actual_amount: amount, actual_overridden: true, actual_overridden_at: new Date().toISOString() }
        : l
    ));
    await overrideActual(lineId, amount, profile?.id);
  }, [profile?.id]);

  // ── Reset to mirror ─────────────────────────────────────────────────────────
  const handleReset = useCallback(async (lineId) => {
    setLines(prev => prev.map(l =>
      l.line_id === lineId
        ? { ...l, actual_amount: null, actual_overridden: false, actual_overridden_at: null }
        : l
    ));
    await resetActualToMirror(lineId);
  }, []);

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filteredLines = lines.filter(l => {
    if (filter === 'overridden') return l.actual_overridden;
    if (filter === 'mirrored')  return !l.actual_overridden;
    if (filter === 'has_notes') return !!l.notes;
    return true;
  });

  const grouped = groupLines(filteredLines);

  const totalEst = computeTotalEstimated(lines);
  const totalAct = computeTotalActual(lines);
  const totalDiff = totalAct - totalEst;
  const overrideCount = lines.filter(l => l.actual_overridden).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Loading cost breakdown…
      </div>
    );
  }

  // ── Column headers ──────────────────────────────────────────────────────────
  const ColHeader = ({ label }) => (
    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-right px-2 pb-2">
      {label}
    </div>
  );

  // ── Group header row (same for all 3 columns) ───────────────────────────────
  const GroupHeader = ({ name }) => (
    <>
      <div className="col-span-3 bg-gray-50 border-y border-gray-100 px-3 py-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{name}</span>
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col">

      {/* ── Filter strip ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white">
        <Filter size={12} className="text-gray-400" />
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[11px] text-gray-400">
          {overrideCount > 0
            ? <span title={`${overrideCount} manually-entered actuals out of ${lines.length} line items`}
                    className="text-green-600 font-semibold">{overrideCount} override{overrideCount !== 1 ? 's' : ''}</span>
            : 'No overrides'}
        </div>
      </div>

      {/* ── Desktop 3-column grid / Mobile stacked ───────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Desktop (≥ 1024px): side-by-side ─────────────────────────── */}
        <div className="hidden lg:flex gap-0 h-full">

          {/* Estimated */}
          <div className="flex-1 min-w-0 border-r border-gray-100 overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-2 pt-3 pb-0 border-b border-gray-100">
              <ColHeader label="Estimated Expenses" />
            </div>
            {grouped.map(({ group, lines: gl }) => (
              <div key={group}>
                <div className="bg-gray-50 border-y border-gray-100 px-3 py-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group}</span>
                </div>
                {gl.map(l => (
                  <div key={l.line_id} className="border-b border-gray-50 last:border-0 px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-gray-600 flex-1 min-w-0 truncate">{l.label}</span>
                    <div className="w-28 flex-shrink-0">
                      <NumCell
                        value={Number(l.estimated_amount ?? 0)}
                        onCommit={v => handleEstimated(l.line_id, v)}
                        disabled={!canEditEst}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {/* Footer */}
            <div className="sticky bottom-0 bg-[#1a2332] text-white px-3 py-2 flex justify-between">
              <span className="text-[12px] font-semibold">Total Estimated</span>
              <span className="text-[12px] font-bold">{fmt(totalEst)}</span>
            </div>
          </div>

          {/* Actual */}
          <div className="flex-1 min-w-0 border-r border-gray-100 overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-2 pt-3 pb-0 border-b border-gray-100">
              <ColHeader label="Actual Expenses" />
            </div>
            {grouped.map(({ group, lines: gl }) => (
              <div key={group}>
                <div className="bg-gray-50 border-y border-gray-100 px-3 py-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">&nbsp;</span>
                </div>
                {gl.map(l => {
                  const resolvedVal = resolveActual(l);
                  return (
                    <div key={l.line_id} className="border-b border-gray-50 last:border-0 px-3 py-1.5 flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <NumCell
                          value={resolvedVal}
                          muted={!l.actual_overridden}
                          onCommit={v => handleActual(l.line_id, v)}
                          disabled={!canEditAct}
                        />
                      </div>
                      {/* Green checkmark when overridden */}
                      {l.actual_overridden && (
                        <CheckCircle2
                          size={13}
                          className="text-green-500 flex-shrink-0"
                          title={`Overridden ${l.actual_overridden_at ? new Date(l.actual_overridden_at).toLocaleDateString() : ''}`}
                        />
                      )}
                      {/* Reset button — only when overridden and user can edit */}
                      {l.actual_overridden && canEditAct && (
                        <button
                          onClick={() => handleReset(l.line_id)}
                          title="Reset to mirror estimate"
                          className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-accent transition-colors"
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* Footer */}
            <div className="sticky bottom-0 bg-[#1a2332] text-white px-3 py-2 flex justify-between">
              <span className="text-[12px] font-semibold">Total Actual</span>
              <span className="text-[12px] font-bold">{fmt(totalAct)}</span>
            </div>
          </div>

          {/* Difference (narrow) */}
          <div className="w-36 flex-shrink-0 overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-2 pt-3 pb-0 border-b border-gray-100">
              <ColHeader label="Difference" />
            </div>
            {grouped.map(({ group, lines: gl }) => (
              <div key={group}>
                <div className="bg-gray-50 border-y border-gray-100 px-3 py-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">&nbsp;</span>
                </div>
                {gl.map(l => (
                  <div key={l.line_id} className="border-b border-gray-50 last:border-0 px-1 py-1.5 flex items-center justify-end">
                    <DiffCell line={l} />
                  </div>
                ))}
              </div>
            ))}
            {/* Footer */}
            <div className={`sticky bottom-0 px-3 py-2 flex justify-end text-[12px] font-bold ${
              totalDiff < 0 ? 'bg-green-600 text-white' : totalDiff > 0 ? 'bg-red-600 text-white' : 'bg-[#1a2332] text-white'
            }`}>
              {fmtD(totalDiff)}
            </div>
          </div>

        </div>

        {/* ── Mobile (<1024px): stacked ──────────────────────────────────── */}
        <div className="lg:hidden space-y-6 p-4">

          {/* Estimated table */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Estimated Expenses</h4>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {grouped.map(({ group, lines: gl }) => (
                <div key={group}>
                  <div className="bg-gray-50 border-y border-gray-100 px-3 py-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group}</span>
                  </div>
                  {gl.map(l => (
                    <div key={l.line_id} className="border-b border-gray-50 last:border-0 px-3 py-1.5 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-gray-600 flex-1 min-w-0 truncate">{l.label}</span>
                      <div className="w-24 flex-shrink-0">
                        <NumCell value={Number(l.estimated_amount ?? 0)} onCommit={v => handleEstimated(l.line_id, v)} disabled={!canEditEst} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="bg-[#1a2332] text-white px-3 py-2 flex justify-between">
                <span className="text-[12px] font-semibold">Total Estimated</span>
                <span className="text-[12px] font-bold">{fmt(totalEst)}</span>
              </div>
            </div>
          </div>

          {/* Actual table */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Actual Expenses</h4>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {grouped.map(({ group, lines: gl }) => (
                <div key={group}>
                  <div className="bg-gray-50 border-y border-gray-100 px-3 py-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{group}</span>
                  </div>
                  {gl.map(l => (
                    <div key={l.line_id} className="border-b border-gray-50 last:border-0 px-3 py-1.5 flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <NumCell
                          value={resolveActual(l)}
                          muted={!l.actual_overridden}
                          onCommit={v => handleActual(l.line_id, v)}
                          disabled={!canEditAct}
                        />
                      </div>
                      {l.actual_overridden && <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />}
                      {l.actual_overridden && canEditAct && (
                        <button onClick={() => handleReset(l.line_id)} title="Reset to mirror" className="p-0.5 rounded text-gray-300 hover:text-accent">
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div className="bg-[#1a2332] text-white px-3 py-2 flex justify-between">
                <span className="text-[12px] font-semibold">Total Actual</span>
                <span className="text-[12px] font-bold">{fmt(totalAct)}</span>
              </div>
            </div>
          </div>

          {/* Difference summary (non-zero only) */}
          {lines.some(l => l.actual_overridden) && (
            <div>
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Differences</h4>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {lines.filter(l => l.actual_overridden && resolveDifference(l) !== 0).map(l => {
                  const diff = resolveDifference(l);
                  return (
                    <div key={l.line_id} className="border-b border-gray-50 last:border-0 px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[12px] text-gray-600 flex-1 min-w-0 truncate">{l.label}</span>
                      <span className={`text-[12px] font-semibold ${diff < 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtD(diff)}</span>
                    </div>
                  );
                })}
                <div className={`px-3 py-2 flex justify-between text-[12px] font-bold text-white ${
                  totalDiff < 0 ? 'bg-green-600' : totalDiff > 0 ? 'bg-red-600' : 'bg-[#1a2332]'
                }`}>
                  <span>Total Difference</span>
                  <span>{fmtD(totalDiff)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
