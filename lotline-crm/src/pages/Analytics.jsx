import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart2, Loader2 } from 'lucide-react';
import { useDeals } from '../lib/DealsContext';
import { calcNetProfit } from '../data/deals';

const COLORS = ['#c8613a', '#1a2332', '#6366f1', '#10b981', '#f59e0b', '#6b7280', '#ec4899', '#14b8a6'];
const GRADE_COLORS = { A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };

// Known pipeline stage order for sorting
const STAGE_ORDER = [
  'New Lead', 'Active Lead', 'Contract Signed',
  'Due Diligence', 'Development', 'Sales', 'Complete',
];

function fmt$(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString();
}

export default function Analytics() {
  const { deals, archivedDeals, dealsLoading } = useDeals();

  // Combine active + archived so completed deals count too
  const allDeals = useMemo(() => [...(deals || []), ...(archivedDeals || [])], [deals, archivedDeals]);
  const activeDeals = deals || [];

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const totalPipelineProfit = useMemo(
    () => activeDeals.reduce((s, d) => s + calcNetProfit(d), 0),
    [activeDeals],
  );
  const avgProfit = activeDeals.length ? Math.round(totalPipelineProfit / activeDeals.length) : 0;

  const statesActive = useMemo(() => {
    const states = [...new Set(activeDeals.map(d => d.state).filter(Boolean))];
    return states.length ? `${states.length} (${states.sort().join(', ')})` : '—';
  }, [activeDeals]);

  const totalARV = useMemo(
    () => activeDeals.reduce((s, d) => s + (d.arv || 0), 0),
    [activeDeals],
  );

  // ── Deals by Stage ────────────────────────────────────────────────────────────
  const stageData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      const s = d.stage || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a.stage);
        const bi = STAGE_ORDER.indexOf(b.stage);
        if (ai === -1 && bi === -1) return a.stage.localeCompare(b.stage);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
  }, [activeDeals]);

  // ── Financing Mix ─────────────────────────────────────────────────────────────
  const financingData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      const f = d.financing || 'Unspecified';
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeDeals]);

  // ── Deals by County (top 8) ───────────────────────────────────────────────────
  const countyData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      if (!d.county) return;
      const key = `${d.county}${d.state ? ', ' + d.state : ''}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([county, count]) => ({ county, count }))
      .sort((a, b) => b.count - a.count);
    if (sorted.length <= 8) return sorted;
    const top = sorted.slice(0, 7);
    const othersCount = sorted.slice(7).reduce((s, c) => s + c.count, 0);
    return [...top, { county: 'Others', count: othersCount }];
  }, [activeDeals]);

  // ── Grade Distribution ────────────────────────────────────────────────────────
  const gradeData = useMemo(() => {
    const grades = ['A', 'B', 'C', 'D'];
    return grades
      .map(grade => ({ grade, count: activeDeals.filter(d => d.grade === grade).length }))
      .filter(g => g.count > 0);
  }, [activeDeals]);

  // ── Stage Breakdown Table ─────────────────────────────────────────────────────
  const stageBreakdown = useMemo(() => {
    const stages = [...new Set(activeDeals.map(d => d.stage || 'Unknown'))];
    return stages
      .sort((a, b) => {
        const ai = STAGE_ORDER.indexOf(a);
        const bi = STAGE_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map(stage => {
        const stageDeals = activeDeals.filter(d => (d.stage || 'Unknown') === stage);
        const arv = stageDeals.reduce((s, d) => s + (d.arv || 0), 0);
        const profit = stageDeals.reduce((s, d) => s + calcNetProfit(d), 0);
        return { stage, count: stageDeals.length, arv, profit };
      });
  }, [activeDeals]);

  // ── Pipeline Breakdown ────────────────────────────────────────────────────────
  const pipelineData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      const p = d.pipeline || 'Unknown';
      counts[p] = (counts[p] || 0) + 1;
    });
    const LABELS = {
      'land-acquisition': 'Land Acquisition',
      'deal-overview': 'Deal Overview',
      'due-diligence': 'Due Diligence',
      development: 'Development',
      sales: 'Sales',
    };
    return Object.entries(counts)
      .map(([name, value]) => ({ name: LABELS[name] || name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeDeals]);

  // ── Lead Source Breakdown ─────────────────────────────────────────────────────
  const leadSourceData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      const src = d.leadSource || 'Unknown';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [activeDeals]);

  // ────────────────────────────────────────────────────────────────────────────
  if (dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <BarChart2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-sidebar">Analytics</h1>
          <p className="text-sm text-gray-500">Live portfolio performance from your pipeline data</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Active Deals', value: activeDeals.length },
          { label: 'Pipeline Profit', value: fmt$(totalPipelineProfit) },
          { label: 'Avg Profit / Deal', value: fmt$(avgProfit) },
          { label: 'States Active', value: statesActive },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-sidebar">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Second KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total ARV (Active)', value: fmt$(totalARV) },
          { label: 'Total + Archived Deals', value: allDeals.length },
          { label: 'Counties Active', value: [...new Set(activeDeals.map(d => d.county).filter(Boolean))].length },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-sidebar">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Breakdown */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals by Stage</h3>
          {stageData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No deal data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#c8613a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Financing Mix */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Financing Mix</h3>
          {financingData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No financing data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={financingData}
                  cx="50%" cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ percent }) => `${Math.round(percent * 100)}%`}
                >
                  {financingData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* County Distribution */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals by County</h3>
          {countyData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No county data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={countyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="county" tick={{ fontSize: 10, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#1a2332" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Grade Distribution */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deal Grade Distribution</h3>
          {gradeData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No grade data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={gradeData}
                  cx="50%" cy="50%"
                  outerRadius={75}
                  dataKey="count"
                  nameKey="grade"
                  label={({ grade, count }) => `${grade}: ${count}`}
                >
                  {gradeData.map((entry) => (
                    <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || '#6b7280'} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Distribution */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals by Pipeline</h3>
          {pipelineData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No pipeline data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={130} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Source */}
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Lead Sources</h3>
          {leadSourceData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No lead source data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={leadSourceData}
                  cx="50%" cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  nameKey="name"
                  label={({ percent }) => `${Math.round(percent * 100)}%`}
                >
                  {leadSourceData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Stage Breakdown Table */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-sidebar">Stage Breakdown Detail</h3>
        </div>
        {stageBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No deals in pipeline yet</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Deals</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total ARV</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Est. Profit</th>
              </tr>
            </thead>
            <tbody>
              {stageBreakdown.map(({ stage, count, arv, profit }) => (
                <tr key={stage} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{stage}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{count}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{fmt$(arv)}</td>
                  <td className={`py-3 px-4 text-sm text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmt$(profit)}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <td className="py-3 px-4 text-sm text-gray-800">Total</td>
                <td className="py-3 px-4 text-sm text-right text-gray-800">{activeDeals.length}</td>
                <td className="py-3 px-4 text-sm text-right text-gray-800">{fmt$(totalARV)}</td>
                <td className={`py-3 px-4 text-sm text-right ${totalPipelineProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt$(totalPipelineProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
