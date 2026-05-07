/**
 * InvestorPayments.jsx
 *
 * Investor-portal "Payments" tab — shows the logged-in investor's scheduled
 * payment dates across all of their deals, plus a banner for overdue rows
 * and a "Payment History" section for already-paid rows.
 *
 * Data comes from `investor_payment_schedule`. RLS lets investors read only
 * their own rows; overdue is promoted at read time in fetchMyPaymentSchedule().
 */
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { fetchMyPaymentSchedule } from '../../lib/investorPortalData';
import { formatPaymentType, STATUS_LABEL, STATUS_PILL } from '../../lib/paymentScheduleData';

function fmt(n)    { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtFull(n){ return `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function InvestorPayments() {
  const { investor }      = useOutletContext();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!investor) return;
    setLoading(true);
    fetchMyPaymentSchedule(investor.id).then(({ schedule: rows }) => {
      setSchedule(rows || []);
      setLoading(false);
    });
  }, [investor]);

  const upcoming = useMemo(
    () => schedule.filter(r => r.status === 'scheduled' || r.status === 'overdue'),
    [schedule]
  );
  const overdue  = useMemo(() => schedule.filter(r => r.status === 'overdue'), [schedule]);
  const paid     = useMemo(() => schedule.filter(r => r.status === 'paid'),     [schedule]);

  const totalPaid     = useMemo(
    () => paid.reduce((s, r) => s + Number(r.paid_amount ?? r.amount ?? 0), 0),
    [paid]
  );
  const totalRemaining = useMemo(
    () => upcoming.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [upcoming]
  );
  const overdueTotal = useMemo(
    () => overdue.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [overdue]
  );
  const nextDue = upcoming[0] || null;

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Loading payments…</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="text-accent" size={20} />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Payments</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          label="Next Payment Due"
          value={nextDue ? fmt(nextDue.amount) : '—'}
          subtitle={nextDue ? fmtDate(nextDue.due_date) : 'No upcoming payments'}
          accent={nextDue?.status === 'overdue' ? 'text-red-400' : 'text-accent'}
        />
        <SummaryCard
          label="Total Paid"
          value={fmt(totalPaid)}
          subtitle="All time"
          accent="text-green-400"
        />
        <SummaryCard
          label="Total Remaining"
          value={fmt(totalRemaining)}
          subtitle="Still owed"
          accent="text-accent"
        />
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              You have {overdue.length} overdue payment{overdue.length === 1 ? '' : 's'} totaling {fmtFull(overdueTotal)}.
            </p>
            <p className="text-xs mt-0.5 text-red-400/80">Contact LotLine to arrange payment.</p>
          </div>
        </div>
      )}

      {/* Upcoming + overdue table */}
      <Section title="Schedule">
        {upcoming.length === 0 ? (
          <Empty label="No upcoming payments." />
        ) : (
          <Table headers={['Deal', 'Due Date', 'Type', 'Amount', 'Status']}>
            {upcoming.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {r.deals?.address || r.deal_id}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {formatPaymentType(r.payment_type)}
                  {r.payment_number ? <span className="text-gray-400"> #{r.payment_number}</span> : null}
                </td>
                <td className="px-4 py-3 text-gray-800 dark:text-white font-medium">{fmtFull(r.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[r.status] || ''}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      {/* Payment history */}
      <Section title="Payment History">
        {paid.length === 0 ? (
          <Empty label="No payments recorded yet." />
        ) : (
          <Table headers={['Deal', 'Paid Date', 'Type', 'Amount']}>
            {paid
              .slice()
              .sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''))
              .map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {r.deals?.address || r.deal_id}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(r.paid_date)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatPaymentType(r.payment_type)}</td>
                  <td className="px-4 py-3 text-green-700 dark:text-green-400 font-medium">{fmtFull(r.paid_amount ?? r.amount)}</td>
                </tr>
              ))}
          </Table>
        )}
      </Section>
    </div>
  );
}

function SummaryCard({ label, value, subtitle, accent = 'text-accent' }) {
  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-xl p-5 border border-gray-200 dark:border-white/8">
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${accent}`}>{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ label }) {
  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-xl p-12 text-center border border-gray-200 dark:border-white/8">
      <CreditCard size={32} className="mx-auto text-gray-400 mb-3" />
      <p className="text-gray-500 dark:text-gray-400 text-sm">{label}</p>
    </div>
  );
}

function Table({ headers, children }) {
  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="border-b border-gray-200 dark:border-white/8">
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">{children}</tbody>
      </table>
    </div>
  );
}
