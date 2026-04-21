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
    label: 'For Sale',
    color: 'bg-green-500',
    match: d => d.stage === 'Listed' || d.stage === 'Under Contract',
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
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight which shifts the day
  // in non-UTC timezones — append local noon to force correct local-date parsing.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T12:00:00' : dateStr;
  const d = new Date(normalized);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { deals, archivedDeals, dealsLoading } = useDeals();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showActiveDeals, setShowActiveDeals] = useState(false);
  const [showNewThisMonth, setShowNewThisMonth] = useState(false);
  const [monthModal, setMonthModal] = useState(null); // { month: 'Apr', deals: [] }

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
    () => activeDeals.filter(d => d.contractDate && getMonthKey(d.contractDate) === thisMonthKey),
    [activeDeals, thisMonthKey],
  );
  const newThisMonth = newThisMonthDeals.length;

  const salesClosedDeals = useMemo(
    () => (deals || []).filter(d => d.stage === 'Closed'),
    [deals],
  );

  const closedProfit = useMemo(
    () => salesClosedDeals.reduce((s, d) => s + calcNetProfit(d), 0),
    [salesClosedDeals],
  );

  const salesAvgProfit = salesClosedDeals.length ? closedProfit / salesClosedDeals.length : 0;

  const salesAvgDaysToList = useMemo(() => {
    const withDates = salesClosedDeals.filter(d => d.contractDate && d.dateListed);
    if (!withDates.length) return null;
    const total = withDates.reduce((s, d) => {
      return s + (new Date(d.dateListed) - new Date(d.contractDate)) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(total / withDates.length);
  }, [salesClosedDeals]);

  const totalARV = useMemo(
    () => activeDeals.reduce((s, d) => s + (d.arv || 0), 0),
    [activeDeals],
  );

  // ── Monthly activity chart (current year, active deals by contractDate) ──────
  const monthlyData = useMemo(() => {
    const counts    = Array(12).fill(0);
    const arvTotals = Array(12).fill(0);
    const dealLists = Array.from({ length: 12 }, () => []);
    activeDeals.forEach(d => {
      if (!d.contractDate) return;
      // Use noon to avoid UTC-midnight timezone shift on date-only strings
      const normalized = /^\d{4}-\d{2}-\d{2}$/.test(d.contractDate) ? d.contractDate + 'T12:00:00' : d.contractDate;
      const dt = new Date(normalized);
      if (isNaN(dt) || dt.getFullYear() !== year) return;
      const m = dt.getMonth();
      counts[m]    += 1;
      arvTotals[m] += (d.arv || 0);
      dealLists[m].push(d);
    });
    return MONTHS.map((month, i) => ({ month, deals: counts[i], arv: arvTotals[i], dealList: dealLists[i] }));
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

  // ── Deal Overview + Sales pipeline stats ─────────────────────────────────────
  const DO_AND_SALES_STAGES = new Set([
    'Contract Signed', 'Due Diligence', 'Development', 'Complete',
    'Listed', 'Under Contract', 'Closed',
  ]);
  const doAllDeals = useMemo(
    () => (deals || []).filter(d => DO_AND_SALES_STAGES.has(d.stage)),
    [deals],
  );

  const doCompleteThisYear = useMemo(
    () => doAllDeals.filter(d => {
      if (d.stage !== 'Complete') return false;
      const dt = new Date(d.closeDate || d.contractDate || '');
      return !isNaN(dt) && dt.getFullYear() === year;
    }),
    [doAllDeals, year],
  );

  const doCompleteProfit = useMemo(
    () => doCompleteThisYear.reduce((s, d) => s + calcNetProfit(d), 0),
    [doCompleteThisYear],
  );

  const doAllProfit = useMemo(
    () => doAllDeals.reduce((s, d) => s + calcNetProfit(d), 0),
    [doAllDeals],
  );

  const doAvgProfit = doAllDeals.length
    ? doAllProfit / doAllDeals.length
    : 0;

  const doAvgDaysToClose = useMemo(() => {
    const withDates = doCompleteThisYear.filter(d => d.contractDate && d.closeDate);
    if (!withDates.length) return null;
    const total = withDates.reduce((s, d) => {
      return s + (new Date(d.closeDate) - new Date(d.contractDate)) / (1000 * 60 * 60 * 24);
    }, 0);
    return Math.round(total / withDates.length);
  }, [doCompleteThisYear]);

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
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowActiveDeals(true)}
        >
          <StatCard
            label="Active Deals"
            value={activeDeals.length}
            icon={Home}
            color="text-blue-500"
          />
        </div>
        <div
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setShowNewThisMonth(true)}
          title="Click to view deals"
        >
          <StatCard
            label="New This Month"
            value={newThisMonth}
            icon={Activity}
            color="text-green-500"
          />
        </div>
        <StatCard
          label="Pipeline Profit"
          value={fmt$(pipelineProfit)}
          icon={TrendingUp}
          color="text-accent"
        />
        <StatCard
          label="Closed Profit"
          value={fmt$(closedProfit)}
          icon={DollarSign}
          color="text-purple-500"
        />
        <StatCard
          label="Total Pipeline ARV"
          value={fmt$(totalARV)}
          icon={Target}
          color="text-gray-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals Added by Month</h3>
          <p className="text-xs text-gray-400 -mt-3 mb-3">Click a bar to see deals</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={false} />
              <Bar
                dataKey="deals"
                name="Deals"
                fill="#c8613a"
                radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  if (data?.dealList?.length > 0) setMonthModal({ month: data.month, deals: data.dealList });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Pipeline ARV by Month</h3>
          <p className="text-xs text-gray-400 -mt-3 mb-3">Click a bar to see deals</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={false} formatter={v => `$${v.toLocaleString()}`} />
              <Bar dataKey="arv" name="ARV" fill="#1a2332" radius={[4, 4, 0, 0]}
                onClick={(data) => {
                  if (data?.dealList?.length > 0) setMonthModal({ month: data.month, deals: data.dealList });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Deal Overview + Sales Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h2 className="text-base font-semibold text-sidebar mb-4">Deal Overview</h2>
          <div className="space-y-4">
            {[
              { label: 'Deals', value: doAllDeals.length },
              { label: 'Avg Profit / Deal', value: doAllDeals.length ? `$${Math.round(doAvgProfit).toLocaleString()}` : '—' },
              { label: 'Avg Days to List', value: doAvgDaysToClose != null ? `${doAvgDaysToClose}d` : '—' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-base font-bold text-sidebar">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4">
          <h2 className="text-base font-semibold text-sidebar mb-4">Sales Overview</h2>
          <div className="space-y-4">
            {[
              { label: 'Deals Closed', value: salesClosedDeals.length },
              { label: 'Closed Profit', value: fmt$(closedProfit) },
              { label: 'Avg Profit / Deal', value: salesClosedDeals.length ? fmt$(salesAvgProfit) : '—' },
              { label: 'Avg Days to List', value: salesAvgDaysToList != null ? `${salesAvgDaysToList}d` : '—' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-base font-bold text-sidebar">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Month Drilldown Modal */}
      {monthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMonthModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-sidebar">{monthModal.month} {year}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{monthModal.deals.length} deal{monthModal.deals.length !== 1 ? 's' : ''} by contract signed date</p>
              </div>
              <button onClick={() => setMonthModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto max-h-96">
              <ul className="divide-y divide-gray-100">
                {monthModal.deals.map(d => {
                  const profit = calcNetProfit(d);
                  return (
                    <li key={d.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => { setMonthModal(null); navigate(`/deal/${d.id}`); }}>
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
            </div>
          </div>
        </div>
      )}

      {/* Active Deals Modal */}
      {showActiveDeals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowActiveDeals(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-sidebar">Active Deals</h2>
                <p className="text-xs text-gray-400 mt-0.5">{activeDeals.length} deal{activeDeals.length !== 1 ? 's' : ''} in pipeline</p>
              </div>
              <button onClick={() => setShowActiveDeals(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto max-h-96">
              {activeDeals.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No active deals</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {activeDeals.map(d => {
                    const profit = calcNetProfit(d);
                    return (
                      <li key={d.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => { setShowActiveDeals(false); navigate(`/deal/${d.id}`); }}>
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
