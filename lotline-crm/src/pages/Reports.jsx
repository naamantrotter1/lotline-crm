/**
 * Reports.jsx
 * Phase 9: Analytics & reporting dashboard.
 * Charts: deals over time, by stage, by pipeline, top counties.
 * KPIs: total deals, total ARV, contacts, tasks completed.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Loader2, TrendingUp, Home, Users, CheckSquare } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fetchReportsData, groupByMonth, countBy } from '../lib/reportsData';

const ACCENT = '#c9703a';
const PIE_COLORS = ['#c9703a', '#4f8ef7', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'];

const DATE_RANGES = [
  { label: 'All Time', days: null },
  { label: 'Last Year', days: 365 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last 30 Days', days: 30 },
];

function fmt$(n) {
  if (!n) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function KpiCard({ icon: Icon, label, value, sub, color = ACCENT }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 ${className}`}>
      <p className="text-sm font-semibold text-gray-700 mb-4">{title}</p>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-600 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function Reports() {
  const { activeOrgId } = useAuth();
  const [rangeDays, setRangeDays] = useState(null);
  const [data, setData] = useState({ deals: [], contacts: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    const since = rangeDays
      ? new Date(Date.now() - rangeDays * 86400000).toISOString()
      : null;
    fetchReportsData(activeOrgId, since).then(d => { setData(d); setLoading(false); });
  }, [activeOrgId, rangeDays]);

  const { deals, contacts, tasks } = data;

  // KPIs
  const totalARV       = useMemo(() => deals.reduce((s, d) => s + (parseFloat(d.arv) || 0), 0), [deals]);
  const tasksCompleted = useMemo(() => tasks.filter(t => t.status === 'done' || t.status === 'completed').length, [tasks]);

  // Chart data
  const dealsOverTime    = useMemo(() => groupByMonth(deals), [deals]);
  const contactsOverTime = useMemo(() => groupByMonth(contacts), [contacts]);
  const byStage          = useMemo(() => countBy(deals, 'stage', 10), [deals]);
  const byPipeline       = useMemo(() => countBy(deals, 'pipeline', 6), [deals]);
  const byCounty         = useMemo(() => countBy(deals, 'county', 8), [deals]);

  // Merge deals + contacts over time for the area chart
  const activityData = useMemo(() => {
    const map = {};
    for (const r of dealsOverTime) map[r.month] = { month: r.month, Deals: r.count, Contacts: 0 };
    for (const r of contactsOverTime) {
      if (!map[r.month]) map[r.month] = { month: r.month, Deals: 0, Contacts: 0 };
      map[r.month].Contacts = r.count;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [dealsOverTime, contactsOverTime]);

  const pipelineLabel = (id) => {
    const labels = {
      'land-acquisition': 'Land Acq.',
      'deal-overview': 'Deal Overview',
      'due-diligence': 'Due Diligence',
      'development': 'Development',
      'sales': 'Sales',
    };
    return labels[id] || id;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Portfolio analytics and activity overview</p>
        </div>
        {/* Date range picker */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {DATE_RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                rangeDays === r.days
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={Home}        label="Total Deals"       value={deals.length}      />
            <KpiCard icon={TrendingUp}  label="Total ARV"         value={fmt$(totalARV)}    color="#4f8ef7" />
            <KpiCard icon={Users}       label="Contacts"          value={contacts.length}   color="#22c55e" />
            <KpiCard icon={CheckSquare} label="Tasks Completed"   value={tasksCompleted}    color="#a855f7" />
          </div>

          {/* Row 1: Activity over time + By Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SectionCard title="Activity Over Time" className="lg:col-span-2">
              {activityData.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={activityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDeals" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gContacts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4f8ef7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="Deals"    stroke={ACCENT}   fill="url(#gDeals)"    strokeWidth={2} />
                    <Area type="monotone" dataKey="Contacts" stroke="#4f8ef7" fill="url(#gContacts)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="By Pipeline">
              {byPipeline.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={byPipeline.map(p => ({ ...p, name: pipelineLabel(p.name) }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {byPipeline.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>

          {/* Row 2: By Stage + Top Counties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Deals by Stage">
              {byStage.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byStage} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Deals" fill={ACCENT} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="Top Counties">
              {byCounty.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={byCounty} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Deals" fill="#4f8ef7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
