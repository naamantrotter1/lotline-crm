import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Home, DollarSign, Target, Activity, Loader2, X } from 'lucide-react';
import { StatCard } from '../components/UI/Card';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { calcNetProfit } from '../data/deals';
import { useNavigate } from 'react-router-dom';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Each entry defines how its pipeline page actually filters deals:
//   Land Acquisition → pipeline field === 'land-acquisition'
//   Due Diligence    → stage in ['Contract Signed', 'Due Diligence']
//   Development      → stage === 'Development'
//   Complete/Sales   → stage === 'Complete'
const PIPELINE_CONFIG = [
  {
    label: 'Land Acquisition',
    color: 'bg-blue-500',
    match: d => (d.pipeline || '').toLowerCase() === 'land-acquisition',
  },
  {
    label: 'Due Diligence',
    color: 'bg-yellow-500',
    match: d => d.stage === 'Contract Signed' || d.stage === 'Due Diligence',
  },
  {
    label: 'Development',
    color: 'bg-orange-500',
    match: d => d.stage === 'Development',
  },
  {
    label: 'Complete',
    color: 'bg-green-500',
    match: d => d.stage === 'Complete',
  },
];

function fmt$(n) {
  if (!n) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { deals, archivedDeals, dealsLoading } = useDeals();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showNewThisMonth, setShowNewThisMonth] = useState(false);

  const LAND_ACQ_ONLY = new Set(['New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract']);
  const activeDeals   = (deals || []).filter(d => !LAND_ACQ_ONLY.has(d.stage));
  const closedDeals   = archivedDeals || [];
  const year          = new Date().getFullYear();
  const thisMonthKey  = getMonthKey(new Date().toISOString());

  // ── Stat cards ──────────────────────────────────────────────────────────────
  const pipelineProfit = useMemo(
    () => activeDeals.reduce((s, d) => s + calcNetProfit(d), 0),
    [activeDeals],
  );

  const newThisMonthDeals = useMemo(
    () => activeDeals.filter(d => {
      const stamp = d.contractSignedAt || d.contractDate;
      return stamp && getMonthKey(stamp) === thisMonthKey;
    }),
    [activeDeals, thisMonthKey],
  );
  const newThisMonth = newThisMonthDeals.length;

  const closedProfit = useMemo(
    () => closedDeals.reduce((s, d) => s + calcNetProfit(d), 0),
    [closedDeals],
  );

  const totalARV = useMemo(
    () => activeDeals.reduce((s, d) => s + (d.arv || 0), 0),
    [activeDeals],
  );

  // ── Monthly activity chart (current year, active deals by contractDate) ──────
  const monthlyData = useMemo(() => {
    const counts   = Array(12).fill(0);
    const arvTotals = Array(12).fill(0);
    activeDeals.forEach(d => {
      const dt = d.contractDate ? new Date(d.contractDate) : null;
      if (dt && !isNaN(dt) && dt.getFullYear() === year) {
        counts[dt.getMonth()]    += 1;
        arvTotals[dt.getMonth()] += (d.arv || 0);
      }
    });
    return MONTHS.map((month, i) => ({ month, deals: counts[i], arv: arvTotals[i] }));
  }, [activeDeals, year]);

  // ── Closed deals this year (use archivedAt or closeDate) ────────────────────
  const closedThisYear = useMemo(
    () => closedDeals.filter(d => {
      const dt = new Date(d.closeDate || d.archivedAt || '');
      return !isNaN(dt) && dt.getFullYear() === year;
    }),
    [closedDeals, year],
  );

  const closedThisYearProfit = useMemo(
    () => closedThisYear.reduce((s, d) => s + calcNetProfit(d), 0),
    [closedThisYear],
  );

  const avgProfitClosed = closedThisYear.length
    ? Math.round(closedThisYearProfit / closedThisYear.length)
    : 0;

  const avgDaysToClose = useMemo(() => {
    const withDates = closedThisYear.filter(d => d.contractDate && (d.closeDate || d.archivedAt));
    if (!withDates.length) return null;
    const total = withDates.reduce((s, d) => {
      const start = new Date(d.contractDate);
      const end   = new Date(d.closeDate || d.archivedAt);
      return s + (end - start) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(total / withDates.length);
  }, [closedThisYear]);

  // ── Pipeline summary ─────────────────────────────────────────────────────────
  const pipelineSummary = useMemo(() => {
    return PIPELINE_CONFIG.map(({ label, color, match }) => {
      const pDeals = activeDeals.filter(match);
      const value  = pDeals.reduce((s, d) => s + (d.arv || 0), 0);
      return { label, color, deals: pDeals.length, value };
    });
  }, [activeDeals]);

  // ── Recent deals (last 6 by contractDate desc) ───────────────────────────────
  const recentDeals = useMemo(() => {
    return [...activeDeals]
      .sort((a, b) => {
        const da = a.contractDate ? new Date(a.contractDate) : new Date(0);
        const db = b.contractDate ? new Date(b.contractDate) : new Date(0);
        return db - da;
      })
      .slice(0, 6);
  }, [activeDeals]);

  // ────────────────────────────────────────────────────────────────────────────
  const firstName = profile?.name?.split(' ')[0] || 'back';

  if (dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {firstName}. Here's your live portfolio overview.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Active Deals"
          value={activeDeals.length}
          icon={Home}
          color="text-blue-500"
        />
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowNewThisMonth(true)}
          title="Click to view deals"
        >
          <StatCard
            label="New This Month"
            value={newThisMonth}
            subtext="click to view"
            icon={Activity}
            color="text-green-500"
          />
        </div>
        <StatCard
          label="Pipeline Profit"
          value={fmt$(pipelineProfit)}
          subtext="est. from active deals"
          icon={TrendingUp}
          color="text-accent"
        />
        <StatCard
          label="Closed Profit"
          value={fmt$(closedProfit)}
          subtext="archived deals"
          icon={DollarSign}
          color="text-purple-500"
        />
        <StatCard
          label="Total Pipeline ARV"
          value={fmt$(totalARV)}
          subtext="active deals"
          icon={Target}
          color="text-gray-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals Added by Month ({year})</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="deals" name="Deals" fill="#c8613a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Pipeline ARV by Month ({year})</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => `$${v.toLocaleString()}`} />
              <Bar dataKey="arv" name="ARV" fill="#1a2332" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div>
        <h2 className="text-lg font-semibold text-sidebar mb-3">Pipeline Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {pipelineSummary.map((p) => (
            <div key={p.label} className="bg-card rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${p.color}`} />
                <span className="text-sm font-medium text-gray-700">{p.label}</span>
              </div>
              <p className="text-2xl font-bold text-sidebar">{p.deals}</p>
              <p className="text-xs text-gray-500 mt-1">deals</p>
              <p className="text-sm font-semibold text-accent mt-2">{fmt$(p.value)}</p>
              <p className="text-xs text-gray-400">pipeline ARV</p>
            </div>
          ))}
        </div>
      </div>

      {/* Year at a Glance + Recent Deals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Year at a Glance */}
        <div className="bg-card rounded-xl shadow-sm p-4 lg:col-span-1">
          <h2 className="text-base font-semibold text-sidebar mb-4">Year at a Glance — {year}</h2>
          <div className="space-y-4">
            {[
              { label: 'Deals Closed', value: closedThisYear.length },
              { label: 'Closed Profit', value: fmt$(closedThisYearProfit) },
              { label: 'Avg Profit / Deal', value: closedThisYear.length ? fmt$(avgProfitClosed) : '—' },
              { label: 'Avg Days to Close', value: avgDaysToClose != null ? `${avgDaysToClose}d` : '—' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-base font-bold text-sidebar">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deals */}
        <div className="bg-card rounded-xl shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-sidebar">Recent Deals</h2>
          </div>
          {recentDeals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No deals yet</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Address</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Stage</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">ARV</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Est. Profit</th>
                </tr>
              </thead>
              <tbody>
                {recentDeals.map((d) => {
                  const profit = calcNetProfit(d);
                  return (
                    <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-4 text-sm text-gray-700 max-w-[180px]">
                        <p className="truncate">{d.address || '—'}</p>
                        <p className="text-xs text-gray-400">{d.county}{d.state ? `, ${d.state}` : ''}</p>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-500 hidden md:table-cell">{d.stage || '—'}</td>
                      <td className="py-2.5 px-4 text-sm text-right text-gray-600 font-medium">{fmt$(d.arv)}</td>
                      <td className={`py-2.5 px-4 text-sm text-right font-semibold hidden sm:table-cell ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {fmt$(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* New This Month Modal */}
      {showNewThisMonth && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowNewThisMonth(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-sidebar">New This Month</h2>
                <p className="text-xs text-gray-400 mt-0.5">{newThisMonthDeals.length} deal{newThisMonthDeals.length !== 1 ? 's' : ''} with contract signed date in {MONTHS[new Date().getMonth()]}</p>
              </div>
              <button
                onClick={() => setShowNewThisMonth(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-96">
              {newThisMonthDeals.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No deals this month</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {newThisMonthDeals.map(d => {
                    const profit = calcNetProfit(d);
                    return (
                      <li
                        key={d.id}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => { setShowNewThisMonth(false); navigate(`/deal/${d.id}`); }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-sidebar truncate">{d.address || '—'}</p>
                          <p className="text-xs text-gray-400">{d.county}{d.state ? `, ${d.state}` : ''} · {d.stage}</p>
                        </div>
                        <div className="ml-4 text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-700">{fmt$(d.arv)}</p>
                          <p className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt$(profit)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
