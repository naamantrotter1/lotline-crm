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
import { Loader2, TrendingUp, Home, Users, CheckSquare, ChevronUp, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fetchReportsData, groupByMonth, countBy, fetchAdvancedReportsData } from '../lib/reportsData';

const ACCENT = '#c9703a';
const PIE_COLORS = ['#c9703a', '#4f8ef7', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'];

// Stage → pipeline color mapping for time-in-stage chart
const STAGE_PIPELINE_COLOR = {
  'New Lead': '#c9703a', 'Underwriting': '#c9703a',
  'Negotiating': '#c9703a', 'Waiting on Contract': '#c9703a',
  'Contract Signed': '#4f8ef7', 'Due Diligence': '#4f8ef7',
  'Development': '#4f8ef7', 'Complete': '#4f8ef7',
  'Listed': '#22c55e', 'Under Contract': '#22c55e', 'Closed': '#22c55e',
};
const PIPELINE_ORDER = [
  'New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract',
  'Contract Signed', 'Due Diligence', 'Development', 'Complete',
  'Listed', 'Under Contract', 'Closed',
];
const DD_AND_BEYOND = new Set([
  'Contract Signed', 'Due Diligence', 'Development', 'Complete',
  'Listed', 'Under Contract', 'Closed',
]);

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
  const [advData, setAdvData] = useState({ allDeals: [], investors: [] });
  const [loading, setLoading] = useState(true);
  const [invSort, setInvSort] = useState({ col: 'capitalDeployed', dir: 'desc' });

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    const since = rangeDays
      ? new Date(Date.now() - rangeDays * 86400000).toISOString()
      : null;
    Promise.all([
      fetchReportsData(activeOrgId, since),
      fetchAdvancedReportsData(activeOrgId, since),
    ]).then(([basic, adv]) => {
      setData(basic);
      setAdvData(adv);
      setLoading(false);
    });
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

  // ── Advanced analytics ──────────────────────────────────────────────────────

  // 0. Deal Pipeline Conversion (Land Acq → Deal Overview funnel)
  const pipelineConversion = useMemo(() => {
    // "Entered Deal Overview" = has contract_signed_at (set when deal moves to Contract Signed)
    const enteredDO   = advData.allDeals.filter(d => d.contract_signed_at);
    const activeInDO  = enteredDO.filter(d => !d.is_archived && DD_AND_BEYOND.has(d.stage));
    const deadInDO    = enteredDO.filter(d => d.dead_deal);
    const regArchived = enteredDO.filter(d => d.is_archived && !d.dead_deal);
    const total = enteredDO.length;
    // All dead deals across every pipeline (incl. Land Acq deals marked dead before reaching DO)
    const deadTotal   = advData.allDeals.filter(d => d.dead_deal).length;
    return {
      total,
      active:       activeInDO.length,
      dead:         deadInDO.length,
      deadTotal,
      regArchived:  regArchived.length,
      convPct:      total > 0 ? Math.round((activeInDO.length  / total) * 100) : 0,
      deadPct:      total > 0 ? Math.round((deadInDO.length    / total) * 100) : 0,
      archivedPct:  total > 0 ? Math.round((regArchived.length / total) * 100) : 0,
      pieData: [
        { name: 'Active in DO/Sales', value: activeInDO.length  },
        { name: 'Dead Deal',          value: deadInDO.length    },
        { name: 'Archived',           value: regArchived.length },
      ],
    };
  }, [advData.allDeals]);

  // 1. Lead Source Conversion Funnel
  const leadSourceFunnel = useMemo(() => {
    const map = {};
    for (const d of advData.allDeals) {
      const src = d.lead_source || 'Unknown';
      if (!map[src]) map[src] = { source: src, entered: 0, reachedDD: 0, closed: 0 };
      map[src].entered++;
      if (DD_AND_BEYOND.has(d.stage)) map[src].reachedDD++;
      if (d.stage === 'Closed') map[src].closed++;
    }
    return Object.values(map)
      .sort((a, b) => b.entered - a.entered)
      .map(r => ({
        ...r,
        entryToDDPct:   r.entered   > 0 ? Math.round((r.reachedDD / r.entered)   * 100) : 0,
        DDToClosedPct:  r.reachedDD > 0 ? Math.round((r.closed    / r.reachedDD) * 100) : 0,
      }));
  }, [advData.allDeals]);

  // 2. Time-in-Stage: avg deal age (created_at → now/archived_at) per stage, active deals only
  const timeInStage = useMemo(() => {
    const map = {};
    const now = Date.now();
    for (const d of advData.allDeals) {
      if (d.is_archived) continue; // only active deals
      const s = d.stage || 'Unknown';
      if (!map[s]) map[s] = [];
      const days = Math.round((now - new Date(d.created_at).getTime()) / 86400000);
      map[s].push(days);
    }
    return PIPELINE_ORDER
      .filter(s => map[s])
      .map(s => ({
        stage:   s,
        avgDays: Math.round(map[s].reduce((a, b) => a + b, 0) / map[s].length),
        count:   map[s].length,
        fill:    STAGE_PIPELINE_COLOR[s] || ACCENT,
      }));
  }, [advData.allDeals]);

  // 3. Win / Loss Analysis
  const winLoss = useMemo(() => {
    const archived = advData.allDeals.filter(d => d.is_archived);
    const won  = archived.filter(d => d.stage === 'Closed');
    const lost = archived.filter(d => d.stage !== 'Closed');
    const dropoffMap = {};
    for (const d of lost) {
      const s = d.stage || 'Unknown';
      dropoffMap[s] = (dropoffMap[s] || 0) + 1;
    }
    const dropoff = Object.entries(dropoffMap)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);
    return {
      total:   archived.length,
      won:     won.length,
      lost:    lost.length,
      wonPct:  archived.length ? Math.round((won.length  / archived.length) * 100) : 0,
      lostPct: archived.length ? Math.round((lost.length / archived.length) * 100) : 0,
      dropoff,
      pieData: [
        { name: 'Won (Closed)', value: won.length  },
        { name: 'Lost / Dropped', value: lost.length },
      ],
    };
  }, [advData.allDeals]);

  // 4. Investor ROI Table
  const investorRoi = useMemo(() => {
    const map = {};
    for (const inv of advData.investors) {
      map[inv.name] = { id: inv.id, name: inv.name, capitalDeployed: 0, irrSum: 0, irrCount: 0, dealCount: 0 };
    }
    for (const d of advData.allDeals) {
      if (!d.investor) continue;
      const name = d.investor.trim();
      if (!map[name]) map[name] = { name, capitalDeployed: 0, irrSum: 0, irrCount: 0, dealCount: 0 };
      map[name].dealCount++;
      map[name].capitalDeployed += parseFloat(d.investor_capital_contributed) || 0;
      if (d.projected_irr != null) {
        map[name].irrSum   += parseFloat(d.projected_irr) || 0;
        map[name].irrCount += 1;
      }
    }
    const rows = Object.values(map)
      .filter(r => r.dealCount > 0)
      .map(r => ({
        ...r,
        projectedRoi: r.irrCount > 0 ? +(r.irrSum / r.irrCount).toFixed(1) : null,
        annRoi:       r.irrCount > 0 ? +(r.irrSum / r.irrCount).toFixed(1) : null,
      }));
    const { col, dir } = invSort;
    return rows.sort((a, b) => {
      const av = a[col] ?? -Infinity, bv = b[col] ?? -Infinity;
      return dir === 'asc' ? av - bv : bv - av;
    });
  }, [advData.allDeals, advData.investors, invSort]);

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

          {/* ── ADVANCED ANALYTICS ───────────────────────────────────────────── */}

          {/* Row 3: Deal Pipeline Conversion */}
          <SectionCard title="Deal Pipeline Conversion">
            <p className="text-[11px] text-gray-300 -mt-2 mb-4">
              Tracks deals that moved from Land Acquisition into Deal Overview (via Contract Signed)
            </p>
            {pipelineConversion.total === 0 && pipelineConversion.deadTotal === 0 ? (
              <p className="text-sm text-gray-300 text-center py-6">No deals have entered Deal Overview in this period</p>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Donut — only render when DO data exists */}
                {pipelineConversion.total > 0 && (
                  <div className="shrink-0">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={pipelineConversion.pieData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={70} innerRadius={42} paddingAngle={2}>
                          <Cell fill="#22c55e" />
                          <Cell fill="#f87171" />
                          <Cell fill="#d1d5db" />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Metric grid */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Entered Deal Overview', value: pipelineConversion.total,       pct: null,                           color: '#4f8ef7' },
                    { label: 'Active in DO / Sales',  value: pipelineConversion.active,      pct: pipelineConversion.convPct,     color: '#22c55e' },
                    { label: 'Total Dead Deals',      value: pipelineConversion.deadTotal,   pct: null,                           color: '#f87171' },
                    { label: 'Regular Archived',      value: pipelineConversion.regArchived, pct: pipelineConversion.archivedPct, color: '#9ca3af' },
                    { label: 'Conversion Rate',       value: `${pipelineConversion.convPct}%`,  pct: null, color: '#22c55e', big: true },
                    { label: 'Dead Deal Rate (DO)',   value: `${pipelineConversion.deadPct}%`,  pct: null, color: '#f87171', big: true },
                  ].map(({ label, value, pct, color, big }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                      <p className={`font-bold text-gray-800 ${big ? 'text-2xl' : 'text-xl'}`} style={{ color }}>{value}</p>
                      {pct != null && <p className="text-[11px] text-gray-400 mt-0.5">{pct}% of total</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Legend */}
            {pipelineConversion.total > 0 && (
              <div className="flex gap-4 mt-4 pt-3 border-t border-gray-50 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-green-400" /> Active in DO/Sales</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-red-300" /> Dead Deal</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-gray-300" /> Archived</span>
              </div>
            )}
          </SectionCard>

          {/* Row 4: Lead Source Conversion Funnel */}
          <SectionCard title="Lead Source Conversion Funnel">
            {leadSourceFunnel.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-8">No lead source data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 pr-4 text-gray-400 font-medium">Lead Source</th>
                      <th className="text-right pb-2 px-3 text-gray-400 font-medium w-16">Entered</th>
                      <th className="pb-2 px-3 text-gray-400 font-medium text-left" style={{ minWidth: 160 }}>
                        → Due Diligence
                      </th>
                      <th className="pb-2 px-3 text-gray-400 font-medium text-left" style={{ minWidth: 160 }}>
                        → Closed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadSourceFunnel.map(row => (
                      <tr key={row.source} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-gray-700 max-w-[160px] truncate">{row.source}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{row.entered}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-blue-400 transition-all"
                                style={{ width: `${row.entryToDDPct}%` }} />
                            </div>
                            <span className="text-gray-600 w-14 text-right shrink-0">
                              {row.reachedDD}{' '}
                              <span className="text-gray-300">({row.entryToDDPct}%)</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${row.DDToClosedPct}%`, background: ACCENT }} />
                            </div>
                            <span className="text-gray-600 w-14 text-right shrink-0">
                              {row.closed}{' '}
                              <span className="text-gray-300">({row.DDToClosedPct}%)</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Row 5: Time-in-Stage + Win/Loss */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Avg. Deal Age by Stage (active deals)">
              <p className="text-[11px] text-gray-300 -mt-2 mb-3">
                Days since deal was created, grouped by current stage
              </p>
              {timeInStage.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No active deals in this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, timeInStage.length * 36)}>
                  <BarChart data={timeInStage} layout="vertical"
                    margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                      label={{ value: 'days', position: 'insideRight', offset: 8, fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 10 }} tickLine={false}
                      axisLine={false} width={115} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
                            <p className="font-semibold text-gray-600 mb-1">{label}</p>
                            <p style={{ color: d.fill }}>Avg age: <strong>{d.avgDays} days</strong></p>
                            <p className="text-gray-400">{d.count} deal{d.count !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="avgDays" name="Avg days" radius={[0, 4, 4, 0]}>
                      {timeInStage.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {/* Pipeline legend */}
              {timeInStage.length > 0 && (
                <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#c9703a' }} /> Land Acquisition</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#4f8ef7' }} /> Deal Overview</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#22c55e' }} /> Sales</span>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Win / Loss Analysis">
              {winLoss.total === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No archived deals in this period</p>
              ) : (
                <div className="space-y-4">
                  {/* Summary row */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={winLoss.pieData} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius={60} innerRadius={35} paddingAngle={3}>
                            <Cell fill="#22c55e" />
                            <Cell fill="#f87171" />
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="shrink-0 space-y-2 text-xs">
                      <div>
                        <p className="text-gray-400">Total archived</p>
                        <p className="text-xl font-bold text-gray-800">{winLoss.total}</p>
                      </div>
                      <div className="flex gap-3">
                        <div>
                          <span className="flex items-center gap-1 text-green-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                            Won
                          </span>
                          <p className="text-gray-700 font-bold">{winLoss.won} <span className="text-gray-400 font-normal">({winLoss.wonPct}%)</span></p>
                        </div>
                        <div>
                          <span className="flex items-center gap-1 text-red-500 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            Lost
                          </span>
                          <p className="text-gray-700 font-bold">{winLoss.lost} <span className="text-gray-400 font-normal">({winLoss.lostPct}%)</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Drop-off by stage */}
                  {winLoss.dropoff.length > 0 && (
                    <div>
                      <p className="text-[11px] text-gray-400 mb-2">Where lost deals dropped off</p>
                      <div className="space-y-1.5">
                        {winLoss.dropoff.map(row => (
                          <div key={row.stage} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 w-36 shrink-0 truncate">{row.stage}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-red-400"
                                style={{ width: `${Math.round((row.count / winLoss.lost) * 100)}%` }} />
                            </div>
                            <span className="text-gray-400 w-6 text-right shrink-0">{row.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Row 6: Investor ROI Table */}
          <SectionCard title="Investor ROI Comparison">
            {investorRoi.length === 0 ? (
              <p className="text-sm text-gray-300 text-center py-8">No investor data for this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        { col: 'name',            label: 'Investor',           align: 'left'  },
                        { col: 'capitalDeployed', label: 'Capital Deployed',   align: 'right' },
                        { col: 'projectedRoi',    label: 'Projected ROI %',    align: 'right' },
                        { col: 'annRoi',          label: 'Ann. ROI %',         align: 'right' },
                        { col: 'dealCount',       label: '# Deals',            align: 'right' },
                      ].map(({ col, label, align }) => {
                        const active = invSort.col === col;
                        return (
                          <th
                            key={col}
                            className={`pb-2 px-3 first:pl-0 text-gray-400 font-medium cursor-pointer select-none
                              hover:text-gray-600 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
                            onClick={() => setInvSort(s =>
                              s.col === col
                                ? { col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
                                : { col, dir: 'desc' }
                            )}
                          >
                            <span className="inline-flex items-center gap-0.5">
                              {label}
                              {active
                                ? invSort.dir === 'desc'
                                  ? <ChevronDown size={11} />
                                  : <ChevronUp size={11} />
                                : <span className="w-[11px]" />}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {investorRoi.map((row, i) => (
                      <tr key={row.id ?? row.name ?? i}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 pl-0 px-3 font-medium text-gray-800">{row.name}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">
                          {row.capitalDeployed > 0 ? fmt$(row.capitalDeployed) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {row.projectedRoi != null
                            ? <span className="font-semibold" style={{ color: ACCENT }}>{row.projectedRoi}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {row.annRoi != null
                            ? <span className="font-semibold text-green-600">{row.annRoi}%</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{row.dealCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[10px] text-gray-300 mt-3">
                  ROI % based on projected_irr set per deal. Capital deployed from investor_capital_contributed field.
                </p>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
