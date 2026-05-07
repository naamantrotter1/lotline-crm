/**
 * PaymentScheduleSection.jsx
 *
 * Operator-side payment-schedule UI for the Financing tab. Renders below the
 * Cost of Capital Summary in DealDetail.jsx. Lets the operator generate /
 * regenerate the schedule, mark individual payments paid, and export to CSV.
 *
 * The schedule is stored in `investor_payment_schedule` and projected onto the
 * deal calendar via a SECURITY DEFINER trigger — see lib/paymentScheduleData.js
 * and migration 113.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchScheduleForDeal,
  savePaymentSchedule,
  markPaymentPaid,
  unmarkPaymentPaid,
  formatPaymentType,
  lookupInvestorByName,
  summariseSchedule,
  applyOverdue,
  STATUS_LABEL,
  STATUS_PILL,
} from '../../lib/paymentScheduleData';

const fmtCurrency = (n) =>
  '$' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(`${d}T12:00:00`);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function PaymentScheduleSection({
  deal,
  investorName,                  // Display name from the financing scenario dropdown
  capitalDeployedDateOverride,   // Local React state from FinancingScenarioPanel — fresher than deal.capitalDeployedDate
  allocation,                    // Optional deal_allocations row (CCP scenario)
  readOnly,
}) {
  // Use the freshest capital-deployed-date available
  const effectiveDeployedDate =
    capitalDeployedDateOverride || deal?.capitalDeployedDate || deal?.capital_deployed_date;
  const [investor, setInvestor]   = useState(null);
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [error, setError]         = useState(null);
  const instanceId = useRef(Math.random().toString(36).slice(2));

  // Resolve investor record (CCP allocation passes id directly; other scenarios
  // store only the name in scenario_data — look it up).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (allocation?.investor_id && allocation?.investor) {
        if (!cancelled) setInvestor({ id: allocation.investor_id, name: allocation.investor.name || investorName });
        return;
      }
      if (allocation?.investor_id) {
        const { data } = await supabase
          .from('investors')
          .select('id, name')
          .eq('id', allocation.investor_id)
          .maybeSingle();
        if (!cancelled && data) setInvestor(data);
        return;
      }
      if (investorName && deal?.organization_id) {
        const found = await lookupInvestorByName(deal.organization_id, investorName);
        if (!cancelled) setInvestor(found || null);
      } else if (!cancelled) {
        setInvestor(null);
      }
    })();
    return () => { cancelled = true; };
  }, [allocation?.investor_id, investorName, deal?.organization_id]);

  // Initial + reactive load
  const load = async () => {
    if (!deal?.id) return;
    setLoading(true);
    const { rows: data, error: err } = await fetchScheduleForDeal(deal.id);
    setLoading(false);
    if (err) {
      setError(err.message || String(err));
      return;
    }
    // Filter to current investor only (a deal can have multiple)
    const filtered = investor
      ? data.filter((r) => r.investor_id === investor.id)
      : data;
    setRows(filtered);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id, investor?.id]);

  // Realtime — refresh on any change to this deal's schedule
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const ch = supabase
      .channel(`payment-schedule-${deal.id}-${instanceId.current}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'investor_payment_schedule',
        filter: `deal_id=eq.${deal.id}`,
      }, () => load())
      .subscribe();
    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id]);

  const totals = useMemo(() => summariseSchedule(rows), [rows]);

  const handleGenerate = async () => {
    if (!investor || !deal) return;
    setGenerating(true);
    setError(null);
    const { error: err } = await savePaymentSchedule({
      deal,
      investor,
      allocation: allocation || null,
      orgId: deal.organization_id,
    });
    setGenerating(false);
    if (err) setError(err.message || String(err));
    else load();
  };

  const handleExportCsv = () => {
    const header = ['Due Date', 'Type', 'Amount', 'Status', 'Paid Date', 'Paid Amount'];
    const lines = rows.map((r) => [
      r.due_date,
      formatPaymentType(r.payment_type),
      r.amount,
      r.status,
      r.paid_date || '',
      r.paid_amount ?? '',
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `payment-schedule-${deal.id || 'deal'}-${investor?.name || 'investor'}.csv`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  };

  // Hide the section entirely until prerequisites are met
  if (!deal?.capitalDeployedDate && !deal?.capital_deployed_date) return null;
  if (!investor && !investorName) return null;

  const showEmpty = rows.length === 0 && !loading;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Payment Schedule</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="text-[11px] flex items-center gap-1 text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 disabled:opacity-40"
          >
            <Download size={11} /> Export CSV
          </button>
          {!readOnly && (
            <button
              onClick={handleGenerate}
              disabled={generating || !investor}
              className="text-[11px] flex items-center gap-1 bg-accent text-white font-semibold px-2.5 py-1 rounded-lg hover:bg-accent/90 disabled:opacity-40"
              title={!investor ? 'Investor not yet linked to an investor record' : 'Generate / regenerate schedule'}
            >
              <RefreshCw size={11} className={generating ? 'animate-spin' : ''} />
              {rows.length > 0 ? 'Regenerate' : 'Generate Schedule'}
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mb-3">
        Investor: <span className="font-medium text-gray-700">{investor?.name || investorName || '—'}</span>
        {' · '}
        Capital Deployed: <span className="font-medium text-gray-700">
          {fmtDate(deal.capitalDeployedDate || deal.capital_deployed_date)}
        </span>
      </p>

      {error && (
        <div className="text-[11px] text-red-500 mb-2">{String(error)}</div>
      )}

      {showEmpty ? (
        <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
          <p className="text-[12px] text-gray-400">
            No schedule yet. Click <span className="font-semibold text-accent">Generate Schedule</span> to create
            one from the financing terms.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Due Date</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
                <th className="text-right px-3 py-2 font-medium text-gray-500">Amount</th>
                <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                <th className="text-right px-3 py-2 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {formatPaymentType(r.payment_type)}
                    {r.payment_number ? <span className="text-gray-400"> #{r.payment_number}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmtCurrency(r.amount)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[r.status] || ''}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === 'paid' ? (
                      <button
                        onClick={async () => {
                          if (!window.confirm('Undo this payment? This will delete the linked distribution.')) return;
                          setMarkingId(r.id);
                          await unmarkPaymentPaid(r);
                          setMarkingId(null);
                          load();
                        }}
                        className="text-[11px] text-gray-400 hover:text-red-500"
                        disabled={readOnly || markingId === r.id}
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => setMarkingId(r.id)}
                        disabled={readOnly}
                        className="text-[11px] text-accent font-semibold hover:text-accent/80 disabled:opacity-40"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={2} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Total Owed</td>
                <td className="px-3 py-2 text-right text-gray-800 font-semibold">{fmtCurrency(totals.owed)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="bg-gray-50">
                <td colSpan={2} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">Total Paid</td>
                <td className="px-3 py-2 text-right text-green-700 font-semibold">{fmtCurrency(totals.paid)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={2} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700">Remaining</td>
                <td className="px-3 py-2 text-right text-accent font-bold">{fmtCurrency(totals.remaining)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {markingId && (
        <MarkPaidModal
          row={rows.find((r) => r.id === markingId)}
          onClose={() => setMarkingId(null)}
          onSaved={() => { setMarkingId(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
function MarkPaidModal({ row, onClose, onSaved }) {
  const [paidAmount, setPaidAmount] = useState(row?.amount ?? '');
  const [paidDate, setPaidDate]     = useState(new Date().toISOString().slice(0, 10));
  const [wireRef, setWireRef]       = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await markPaymentPaid({
      scheduleRow: row,
      paidAmount,
      paidDate,
      wireRef,
      notes,
    });
    setSaving(false);
    if (err) setError(err.message || String(err));
    else onSaved();
  };

  if (!row) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-500" />
            Mark Payment Paid
          </p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="text-[12px] text-gray-500">
          {formatPaymentType(row.payment_type)} · due {fmtDate(row.due_date)} · scheduled {fmtCurrency(row.amount)}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wide">Amount paid</label>
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wide">Date paid</label>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wide">Wire reference</label>
            <input
              type="text"
              value={wireRef}
              onChange={(e) => setWireRef(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-semibold text-gray-500 tracking-wide">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent/40 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-[11px] text-red-500">{String(error)}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="text-xs text-white bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/90 font-semibold disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
