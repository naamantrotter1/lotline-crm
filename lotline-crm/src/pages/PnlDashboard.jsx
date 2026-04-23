import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DEAL_OVERVIEW_DEALS, calcNetProfit } from '../data/deals';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const monthlyData = [
  { month: 'Jan 2026', revenue: 0, costs: 0, profit: 0 },
  { month: 'Feb 2026', revenue: 0, costs: 0, profit: 0 },
  { month: 'Mar 2026', revenue: 0, costs: 0, profit: 0 },
  { month: 'Apr 2026', revenue: 0, costs: 0, profit: 0 },
];

export default function PnlDashboard() {
  const { orgSlug } = useAuth();
  const deals = orgSlug === 'lotline-homes' ? DEAL_OVERVIEW_DEALS : [];

  const totalBuildCosts = deals.reduce((s, d) => {
    const c = (d.land || 0) + (d.mobileHome || 0) + (d.hudEngineer || 0) +
      (d.percTest || 0) + (d.survey || 0) + (d.footers || 0) + (d.setup || 0);
    return s + c;
  }, 0);

  const costBreakdown = [
    { category: 'Land', total: deals.reduce((s, d) => s + (d.land || 0), 0) },
    { category: 'Mobile Homes', total: deals.reduce((s, d) => s + (d.mobileHome || 0), 0) },
    { category: 'Perc Tests', total: deals.reduce((s, d) => s + (d.percTest || 0), 0) },
    { category: 'Setup', total: deals.reduce((s, d) => s + (d.setup || 0), 0) },
    { category: 'Other', total: 0 },
  ];

  const pipelineProfit = deals.reduce((s, d) => s + calcNetProfit(d), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <TrendingUp size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">P&L Dashboard</h1>
          <p className="text-sm text-gray-500">Profit & Loss overview — 2026</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue (YTD)', value: '$0', sub: 'No closed deals yet' },
          { label: 'Total Costs (YTD)', value: '$0', sub: 'No closed deals yet' },
          { label: 'Net Profit (YTD)', value: '$0', sub: 'Realized profit' },
          { label: 'Pipeline Profit', value: `$${pipelineProfit.toLocaleString()}`, sub: 'Projected from active deals' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-sidebar">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Costs Chart */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Revenue vs Costs (Monthly)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="costs" name="Costs" fill="#c8613a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Trend */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Profit Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#1a2332" strokeWidth={2} dot={{ r: 4, fill: '#1a2332' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline Cost Breakdown */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-sidebar mb-4">Pipeline Cost Breakdown (All Active Deals)</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {costBreakdown.map((c) => (
            <div key={c.category} className="text-center">
              <p className="text-lg font-bold text-sidebar">${c.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{c.category}</p>
              <div className="mt-2 h-1 bg-gray-200 rounded-full">
                <div
                  className="h-1 bg-accent rounded-full"
                  style={{ width: `${totalBuildCosts > 0 ? (c.total / totalBuildCosts) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Year at a Glance */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="font-semibold text-sidebar mb-4">Year at a Glance — 2026</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {[
            { label: 'Deals Closed', value: '0' },
            { label: 'Gross Revenue', value: '$0' },
            { label: 'Total Costs', value: '$0' },
            { label: 'Net Profit', value: '$0' },
            { label: 'ROI', value: '—' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-3xl font-bold text-sidebar">{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
