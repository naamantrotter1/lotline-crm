import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DEAL_OVERVIEW_DEALS, LAND_DEALS, calcNetProfit } from '../data/deals';
import { BarChart2 } from 'lucide-react';

const stageData = [
  { stage: 'Contract Signed', count: 3 },
  { stage: 'Due Diligence', count: 16 },
  { stage: 'Development', count: 2 },
  { stage: 'Complete', count: 0 },
];

const countyData = [
  { county: 'Dorchester SC', count: 6 },
  { county: 'Brunswick NC', count: 3 },
  { county: 'Marion SC', count: 7 },
  { county: 'Lincoln NC', count: 1 },
  { county: 'Rowan NC', count: 1 },
  { county: 'Others', count: 3 },
];

const COLORS = ['#c8613a', '#1a2332', '#6366f1', '#10b981', '#f59e0b', '#6b7280'];

const financingData = [
  { name: 'Hard Money (Land+Home)', value: 14 },
  { name: 'Cash', value: 7 },
  { name: 'Hard Money Loan', value: 1 },
];

const gradeData = [
  { grade: 'A', count: DEAL_OVERVIEW_DEALS.filter((d) => d.grade === 'A').length },
  { grade: 'B', count: DEAL_OVERVIEW_DEALS.filter((d) => d.grade === 'B').length },
  { grade: 'C', count: DEAL_OVERVIEW_DEALS.filter((d) => d.grade === 'C').length },
  { grade: 'D', count: DEAL_OVERVIEW_DEALS.filter((d) => d.grade === 'D').length },
];

export default function Analytics() {
  const totalPipelineProfit = DEAL_OVERVIEW_DEALS.reduce((s, d) => s + calcNetProfit(d), 0);
  const avgProfit = Math.round(totalPipelineProfit / DEAL_OVERVIEW_DEALS.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Analytics</h1>
          <p className="text-sm text-gray-500">Portfolio performance and pipeline insights</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Active Deals', value: DEAL_OVERVIEW_DEALS.length },
          { label: 'Pipeline Profit', value: `$${totalPipelineProfit.toLocaleString()}` },
          { label: 'Avg Profit / Deal', value: `$${avgProfit.toLocaleString()}` },
          { label: 'States Active', value: '3 (NC, SC, ...)' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-sidebar">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Breakdown */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals by Stage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} width={110} />
              <Tooltip />
              <Bar dataKey="count" fill="#c8613a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Financing Mix */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Financing Mix</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={financingData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${Math.round(percent * 100)}%`}>
                {financingData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* County Distribution */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals by County</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={countyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="county" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a2332" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Grade Distribution */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deal Grade Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={gradeData} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="grade" label={({ grade, count }) => `${grade}: ${count}`}>
                {gradeData.map((entry, i) => (
                  <Cell key={i} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444'][i]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stage Breakdown Table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-sidebar">Stage Breakdown Detail</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Stage</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Count</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total ARV</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total Profit</th>
            </tr>
          </thead>
          <tbody>
            {['Contract Signed', 'Due Diligence', 'Development', 'Complete'].map((stage) => {
              const deals = DEAL_OVERVIEW_DEALS.filter((d) => d.stage === stage);
              const arv = deals.reduce((s, d) => s + (d.arv || 0), 0);
              const profit = deals.reduce((s, d) => s + calcNetProfit(d), 0);
              return (
                <tr key={stage} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{stage}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{deals.length}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">${arv.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-sm text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    ${profit.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
