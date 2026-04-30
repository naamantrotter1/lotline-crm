import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  TrendingUp, DollarSign, BarChart2, Clock,
  ArrowUpRight, Minus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  fetchMyDeals, fetchMyDistributions,
} from '../../lib/investorPortalData';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n)    { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtPct(n) { return `${(n ?? 0).toFixed(2)}%`; }
function fmtX(n)   { return `${(n ?? 0).toFixed(2)}x`; }

/**
 * XIRR approximation using Newton–Raphson.
 * cashFlows: [{ amount, date }] — outflows negative, inflows positive
 */
function xirr(cashFlows, guess = 0.1) {
  if (!cashFlows || cashFlows.length < 2) return null;
  const t0 = new Date(cashFlows[0].date).getTime();
  const years = cashFlows.map(cf => (new Date(cf.date).getTime() - t0) / (365.25 * 24 * 3600 * 1000));
  const amounts = cashFlows.map(cf => cf.amount);

  const npv  = r => amounts.reduce((s, a, i) => s + a / Math.pow(1 + r, years[i]), 0);
  const dnpv = r => amounts.reduce((s, a, i) => s - years[i] * a / Math.pow(1 + r, years[i] + 1), 0);

  let r = guess;
  for (let i = 0; i < 100; i++) {
    const n = npv(r);
    const dn = dnpv(r);
    if (Math.abs(dn) < 1e-10) break;
    const nr = r - n / dn;
    if (Math.abs(nr - r) < 1e-8) { r = nr; break; }
    r = nr;
  }
  return Math.abs(r) > 10 || isNaN(r) ? null : r;
}

function dealIrr(deal, dists) {
  const contributed = deal.investor_capital ?? deal.min_check_size ?? 0;
  if (!contributed || contributed <= 0) return null;
  const dealDists = dists.filter(d => d.deal_id === deal.id);
  const startDate = deal.contract_signed_at ?? deal.created_at ?? new Date().toISOString();
  const flows = [{ amount: -contributed, date: startDate }];
  for (const d of dealDists) flows.push({ amount: d.amount, date: d.date });
  // If no payout yet, add projected
  if (dealDists.length === 0 && deal.projected_payout_date && deal.projected_irr) {
    const projected = contributed * (1 + (deal.projected_irr / 100));
    flows.push({ amount: projected, date: deal.projected_payout_date });
  }
  if (flows.length < 2) return null;
  const r = xirr(flows);
  return r != null ? r * 100 : null;
}

function dealHoldMonths(deal) {
  const start = deal.contract_signed_at ?? deal.created_at;
  const end   = deal.closed_at ?? deal.projected_payout_date ?? new Date().toISOString();
  if (!start) return null;
  const ms = new Date(end) - new Date(start);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

function dealCapital(deal) {
  return deal.investor_capital ?? deal.min_check_size ??
    (deal.total_actual != null ? Number(deal.total_actual) : 0);
}

const ORANGE  = '#E8642A';
const GREEN   = '#16A34A';
const NAVY    = '#1c2130';

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1 truncate max-w-[180px]">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-semibold text-white">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvestorPerformance() {
  const { investor } = useOutletContext();
  const [deals, setDeals]               = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!investor) return;
    setLoading(true);
    Promise.all([
      fetchMyDeals(investor.name),
      fetchMyDistributions(investor.id),
    ]).then(([{ deals: d }, { distributions: dist }]) => {
      setDeals(d);
      setDistributions(dist);
      setLoading(false);
    });
  }, [investor]);

  if (!investor) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        No investor linked to this account.
      </div>
    );
  }

  // ── Compute metrics ─────────────────────────────────────────────────────────
  const totalDeployed   = deals.reduce((s, d) => s + dealCapital(d), 0);
  const totalReturned   = distributions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const moic            = totalDeployed > 0 ? (totalDeployed + totalReturned) / totalDeployed : 0;
  const unreturned      = Math.max(0, totalDeployed - totalReturned);
  const holdMonths      = deals.map(dealHoldMonths).filter(Boolean);
  const avgHold         = holdMonths.length > 0
    ? Math.round(holdMonths.reduce((a, b) => a + b, 0) / holdMonths.length)
    : 0;

  // Portfolio IRR (all cash flows combined)
  const allFlows = [];
  for (const deal of deals) {
    const capital = dealCapital(deal);
    if (!capital) continue;
    const startDate = deal.contract_signed_at ?? deal.created_at ?? new Date().toISOString();
    allFlows.push({ amount: -capital, date: startDate });
  }
  for (const d of distributions) {
    allFlows.push({ amount: d.amount, date: d.date });
  }
  allFlows.sort((a, b) => new Date(a.date) - new Date(b.date));
  const portfolioIrr = allFlows.length >= 2 ? xirr(allFlows) : null;

  // ── Deal-level rows ─────────────────────────────────────────────────────────
  const dealRows = deals.map(deal => {
    const capital  = dealCapital(deal);
    const received = distributions.filter(d => d.deal_id === deal.id).reduce((s, d) => s + (d.amount ?? 0), 0);
    const irr      = dealIrr(deal, distributions);
    const hold     = dealHoldMonths(deal);
    const dealMoic = capital > 0 ? (capital + received) / capital : null;
    return { deal, capital, received, irr, hold, dealMoic };
  });

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = dealRows.map(r => ({
    name: (r.deal.address ?? '').split(',')[0].trim(),
    Deployed: r.capital,
    Returned: r.received,
  }));

  const METRICS = [
    {
      label: 'Portfolio IRR',
      value: portfolioIrr != null ? fmtPct(portfolioIrr * 100) : '—',
      sub:   'Annualized internal return',
      icon:  TrendingUp,
      color: 'text-accent',
    },
    {
      label: 'Equity Multiple',
      value: fmtX(moic),
      sub:   'Total value / total invested',
      icon:  BarChart2,
      color: 'text-blue-400',
    },
    {
      label: 'Capital Deployed',
      value: fmt(totalDeployed),
      sub:   'Across all deals',
      icon:  DollarSign,
      color: 'text-green-400',
    },
    {
      label: 'Distributions Received',
      value: fmt(totalReturned),
      sub:   'Total returned to date',
      icon:  ArrowUpRight,
      color: 'text-purple-400',
    },
    {
      label: 'Unreturned Capital',
      value: fmt(unreturned),
      sub:   'Still deployed',
      icon:  Minus,
      color: 'text-yellow-400',
    },
    {
      label: 'Avg Hold Period',
      value: avgHold ? `${avgHold} mo` : '—',
      sub:   'Months per deal',
      icon:  Clock,
      color: 'text-pink-400',
    },
  ];

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-white/10 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-200 dark:bg-white/10 rounded-xl" />)}
        </div>
        <div className="h-56 bg-gray-200 dark:bg-white/10 rounded-xl" />
        <div className="h-48 bg-gray-200 dark:bg-white/10 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Portfolio analytics for {investor.name}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {METRICS.map(({ label, value, sub, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-[#1c2130] rounded-xl p-5 border border-gray-200 dark:border-white/8"
          >
            <div className={`flex items-center gap-2 mb-3 ${color}`}>
              <Icon size={15} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-[#1c2130] rounded-xl p-5 border border-gray-200 dark:border-white/8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-4">
            Capital by Deal
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="name"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, color: '#9CA3AF', paddingTop: 8 }}
              />
              <Bar dataKey="Deployed" fill={ORANGE} radius={[4, 4, 0, 0]} maxBarSize={48} />
              <Bar dataKey="Returned" fill={GREEN}  radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deal-by-deal table */}
      <div className="bg-white dark:bg-[#1c2130] rounded-xl border border-gray-200 dark:border-white/8 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Deal-by-Deal Breakdown
          </h2>
        </div>
        {dealRows.length === 0 ? (
          <div className="p-10 text-center text-gray-400 dark:text-gray-500 text-sm">
            No deals assigned yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-100 dark:border-white/8">
                <tr>
                  {['Deal', 'Capital In', 'Distributed', 'IRR', 'Equity Multiple', 'Hold'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {dealRows.map(({ deal, capital, received, irr, hold, dealMoic }) => (
                  <tr key={deal.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                      {(deal.address ?? '').split(',')[0]}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{fmt(capital)}</td>
                    <td className={`px-4 py-3 font-semibold ${received > 0 ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}`}>
                      {received > 0 ? fmt(received) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {irr != null ? (
                        <span className={`font-semibold ${irr >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                          {fmtPct(irr)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          {deal.projected_irr ? `~${deal.projected_irr}% (proj)` : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {dealMoic != null ? fmtX(dealMoic) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {hold != null ? `${hold} mo` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
