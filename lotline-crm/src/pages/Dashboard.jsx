import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Home, DollarSign, Target, Activity } from 'lucide-react';
import { StatCard } from '../components/UI/Card';

const monthlyDeals = [
  { month: 'Jan', deals: 0, revenue: 0 },
  { month: 'Feb', deals: 0, revenue: 0 },
  { month: 'Mar', deals: 0, revenue: 0 },
  { month: 'Apr', deals: 0, revenue: 0 },
  { month: 'May', deals: 0, revenue: 0 },
  { month: 'Jun', deals: 0, revenue: 0 },
];

const pipelineSummary = [
  { label: 'Land Acquisition', deals: 19, value: 4050000, color: 'bg-blue-500' },
  { label: 'Development', deals: 21, value: 5510000, color: 'bg-orange-500' },
  { label: 'Sales Pipeline', deals: 0, value: 0, color: 'bg-green-500' },
  { label: 'Closed', deals: 0, value: 0, color: 'bg-gray-400' },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, Naaman. Here's your portfolio overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Active Deals" value="21" icon={Home} color="text-blue-500" />
        <StatCard label="New This Month" value="10" icon={Activity} color="text-green-500" />
        <StatCard label="Pipeline Profit" value="$1,339,562" icon={TrendingUp} color="text-accent" />
        <StatCard label="Total Profit" value="$0" subtext="Closed deals" icon={DollarSign} color="text-purple-500" />
        <StatCard label="Total Revenue" value="$0" subtext="Closed deals" icon={Target} color="text-gray-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals Closed by Month (2026)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyDeals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="deals" fill="#c8613a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Revenue by Month (2026)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyDeals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#1a2332" radius={[4, 4, 0, 0]} />
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
              <p className="text-sm font-semibold text-accent mt-2">${p.value.toLocaleString()}</p>
              <p className="text-xs text-gray-400">pipeline value</p>
            </div>
          ))}
        </div>
      </div>

      {/* Year at a Glance */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-semibold text-sidebar mb-4">Year at a Glance — 2026</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Deals Closed', value: '0' },
            { label: 'Total Profit', value: '$0' },
            { label: 'Avg Profit / Deal', value: '$0' },
            { label: 'Avg Days to Close', value: '—' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-3xl font-bold text-sidebar">{item.value}</p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
