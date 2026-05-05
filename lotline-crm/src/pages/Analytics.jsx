import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart2, Loader2, Trophy, X } from 'lucide-react';
import { useDeals } from '../lib/DealsContext';
import { calcNetProfit } from '../data/deals';

const COLORS = ['#c8613a', '#1a2332', '#6366f1', '#10b981', '#f59e0b', '#6b7280', '#ec4899', '#14b8a6'];
const LAND_ACQ_COLOR = '#c8613a';
const ACTIVE_PIPELINE_COLOR = '#1a2332';

const STAGE_ORDER = [
  'New Lead', 'Active Lead', 'Negotiating', 'Underwriting', 'Waiting on Contract',
  'Contract Signed', 'Due Diligence', 'Development', 'Sales', 'Complete',
];

const FINANCING_LABELS = {
  'hard-money-land-home': 'Hard Money (Land + Home)',
  'hard-money-loan': 'Hard Money Loan',
  'hmcb': 'Hard Money \u2013 Construction Holdback',
  'committed-capital-partner': 'Committed Capital Partner',
  'profit-split': 'Profit Split',
  'loc': 'Line of Credit',
};

function normalizeFinancing(f) {
  if (!f) return 'Unspecified';
  const key = f.toLowerCase().trim();
  return FINANCING_LABELS[key] || FINANCING_LABELS[f] || f;
}

function fmt$(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString();
}

function fmtM(n) {
  if (n == null || isNaN(n)) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

const RANK_MEDALS = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

function stageSort(a, b) {
  const ai = STAGE_ORDER.indexOf(a);
  const bi = STAGE_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

export default function Analytics() {
  const { deals, dealsLoading } = useDeals();
  const navigate = useNavigate();
  const activeDeals = deals || [];
  const [selectedOwner, setSelectedOwner] = useState(null);

  const landAcqDeals = useMemo(
    () => activeDeals.filter(d => d.pipeline === 'land-acquisition'),
    [activeDeals],
  );
  const activePipelineDeals = useMemo(
    () => activeDeals.filter(d => d.pipeline === 'deal-overview'),
    [activeDeals],
  );

  // ── Primary KPIs ────────────────────────────────────────────────────────────
  const activePipelineCount = activePipelineDeals.length;

  const activePipelineProfit = useMemo(
    () => activePipelineDeals.reduce((s, d) => s + calcNetProfit(d), 0),
    [activePipelineDeals],
  );

  const avgActivePipelineProfit = activePipelineCount
    ? Math.round(activePipelineProfit / activePipelineCount) : 0;

  const activePipelineARV = useMemo(
    () => activePipelineDeals.reduce((s, d) => s + (d.arv || 0), 0),
    [activePipelineDeals],
  );

  // ── Secondary KPIs ──────────────────────────────────────────────────────────
  const totalARV = useMemo(
    () => activeDeals.reduce((s, d) => s + (d.arv || 0), 0),
    [activeDeals],
  );

  const statesActive = useMemo(() => {
    const states = [...new Set(activeDeals.map(d => d.state).filter(Boolean))];
    return states.length ? `${states.length} (${states.sort().join(', ')})` : '\u2014';
  }, [activeDeals]);

  const countiesActive = useMemo(
    () => [...new Set(activeDeals.map(d => d.county).filter(Boolean))].length,
    [activeDeals],
  );

  // ── Stage Chart (color-coded by pipeline, pipeline+stage as key) ─────────
  const stageData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      const s = d.stage || 'Unknown';
      const p = d.pipeline || 'land-acquisition';
      const key = `${p}::${s}`;
      if (!counts[key]) counts[key] = { stage: s, count: 0, isActive: p === 'deal-overview' };
      counts[key].count++;
    });
    return Object.values(counts).sort((a, b) => stageSort(a.stage, b.stage));
  }, [activeDeals]);

  // ── Financing Mix (normalized + deduplicated) ───────────────────────────
  const financingData = useMemo(() => {
    const counts = {};
    activeDeals.forEach(d => {
      const f = normalizeFinancing(d.financing);
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeDeals]);

  // ── County Distribution ─────────────────────────────────────────────────
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

  // ── Lead Sources ────────────────────────────────────────────────────────
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

  // ── Stage Breakdown Table (pipeline+stage combos) ────────────────────────
  const stageBreakdown = useMemo(() => {
    const combos = {};
    activeDeals.forEach(d => {
      const s = d.stage || 'Unknown';
      const p = d.pipeline || 'land-acquisition';
      const key = `${p}::${s}`;
      if (!combos[key]) combos[key] = {
        stage: s,
        pipeline: p,
        pipelineLabel: p === 'deal-overview' ? 'Active Pipeline' : 'Land Acquisition',
        count: 0, arv: 0, profit: 0,
      };
      combos[key].count++;
      combos[key].arv += d.arv || 0;
      combos[key].profit += calcNetProfit(d);
    });
    return Object.values(combos).sort((a, b) => {
      if (a.pipeline !== b.pipeline) return a.pipeline === 'land-acquisition' ? -1 : 1;
      return stageSort(a.stage, b.stage);
    });
  }, [activeDeals]);

  const landAcqRows = stageBreakdown.filter(r => r.pipeline === 'land-acquisition');
  const activeRows = stageBreakdown.filter(r => r.pipeline === 'deal-overview');

  const landAcqSub = {
    count: landAcqRows.reduce((s, r) => s + r.count, 0),
    arv: landAcqRows.reduce((s, r) => s + r.arv, 0),
    profit: landAcqRows.reduce((s, r) => s + r.profit, 0),
  };
  const activeSub = {
    count: activeRows.reduce((s, r) => s + r.count, 0),
    arv: activeRows.reduce((s, r) => s + r.arv, 0),
    profit: activeRows.reduce((s, r) => s + r.profit, 0),
  };

  // ── Deal Owner Leaderboard ───────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const owners = {};
    activePipelineDeals.forEach(d => {
      const owner = d.dealOwner || 'Unassigned';
      if (!owners[owner]) owners[owner] = { owner, deals: 0, arv: 0, inDD: 0, inDev: 0, inSales: 0 };
      owners[owner].deals++;
      owners[owner].arv += d.arv || 0;
      if (d.stage === 'Due Diligence') owners[owner].inDD++;
      if (d.stage === 'Development') owners[owner].inDev++;
      if (d.stage === 'Sales' || d.stage === 'Complete') owners[owner].inSales++;
    });
    return Object.values(owners).sort((a, b) => b.deals - a.deals || b.arv - a.arv);
  }, [activePipelineDeals]);

  // ── Prospects in Land Acq by Owner ──────────────────────────────────────
  const prospectsLeaderboard = useMemo(() => {
    const owners = {};
    landAcqDeals.forEach(d => {
      const owner = d.dealOwner || 'Unassigned';
      if (!owners[owner]) owners[owner] = { owner, total: 0, newLeads: 0, qualified: 0 };
      owners[owner].total++;
      if (d.stage === 'New Lead') owners[owner].newLeads++;
      else owners[owner].qualified++;
    });
    return Object.values(owners).sort((a, b) => b.total - a.total);
  }, [landAcqDeals]);

  // ──────────────────────────────────────────────────────────────────────────
  if (dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Loading analytics\u2026</span>
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

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Deals in Active Pipeline', value: activePipelineCount },
          { label: 'Active Deal Profit', value: fmt$(activePipelineProfit) },
          { label: 'Avg Profit / Active Deal', value: fmt$(avgActivePipelineProfit) },
          { label: 'Active Pipeline ARV', value: fmtM(activePipelineARV) },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm p-4">
            <p className="text-2xl font-bold text-sidebar">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Land Acq Prospects', value: landAcqDeals.length },
          { label: 'States Active', value: statesActive },
          { label: 'Counties Active', value: countiesActive },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm p-3">
            <p className="text-xl font-bold text-sidebar">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Stage + Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sidebar">Deals by Stage</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: LAND_ACQ_COLOR }} />
                Land Acq
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: ACTIVE_PIPELINE_COLOR }} />
                Active Pipeline
              </span>
            </div>
          </div>
          {stageData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No deal data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stageData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#6b7280' }} width={135} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stageData.map((entry, i) => (
                    <Cell key={i} fill={entry.isActive ? ACTIVE_PIPELINE_COLOR : LAND_ACQ_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Lead Sources</h3>
          {leadSourceData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No lead source data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={leadSourceData}
                  cx="50%" cy="50%"
                  outerRadius={85}
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

      {/* Charts Row 2: County + Financing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Deals by County</h3>
          {countyData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No county data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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

        <div className="bg-card rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sidebar mb-4">Financing Mix</h3>
          {financingData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No financing data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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
      </div>

      {/* Stage Breakdown Table with Pipeline grouping */}
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Pipeline</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Deals</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total ARV</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Est. Profit</th>
              </tr>
            </thead>
            <tbody>
              {landAcqRows.map(({ stage, count, arv, profit }) => (
                <tr key={`la:${stage}`} className="border-b border-gray-100 bg-gray-50/70 hover:bg-gray-100/70 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">Land Acquisition</td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{stage}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{count}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{fmt$(arv)}</td>
                  <td className={`py-3 px-4 text-sm text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt$(profit)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-gray-300 bg-gray-100">
                <td className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase" colSpan={2}>Land Acq Subtotal</td>
                <td className="py-2.5 px-4 text-sm text-right font-bold text-gray-800">{landAcqSub.count}</td>
                <td className="py-2.5 px-4 text-sm text-right font-bold text-gray-800">{fmt$(landAcqSub.arv)}</td>
                <td className={`py-2.5 px-4 text-sm text-right font-bold ${landAcqSub.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt$(landAcqSub.profit)}</td>
              </tr>
              {activeRows.map(({ stage, count, arv, profit }) => (
                <tr key={`ap:${stage}`} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-400">Active Pipeline</td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{stage}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{count}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-600">{fmt$(arv)}</td>
                  <td className={`py-3 px-4 text-sm text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt$(profit)}</td>
                </tr>
              ))}
              <tr className="border-b-2 border-gray-300 bg-gray-100">
                <td className="py-2.5 px-4 text-xs font-bold text-gray-500 uppercase" colSpan={2}>Active Pipeline Subtotal</td>
                <td className="py-2.5 px-4 text-sm text-right font-bold text-gray-800">{activeSub.count}</td>
                <td className="py-2.5 px-4 text-sm text-right font-bold text-gray-800">{fmt$(activeSub.arv)}</td>
                <td className={`py-2.5 px-4 text-sm text-right font-bold ${activeSub.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt$(activeSub.profit)}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="py-3 px-4 text-sm font-bold text-gray-800" colSpan={2}>Total</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-800">{activeDeals.length}</td>
                <td className="py-3 px-4 text-sm text-right font-bold text-gray-800">{fmt$(totalARV)}</td>
                <td className={`py-3 px-4 text-sm text-right font-bold ${(landAcqSub.profit + activeSub.profit) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt$(landAcqSub.profit + activeSub.profit)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Deal Owner Leaderboard */}
      <div className="bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" />
            <h3 className="font-semibold text-sidebar">Deal Owner Leaderboard</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">Deals advanced from Land Acquisition into the active pipeline</p>
          {activePipelineCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {activePipelineCount} deals in active pipeline &middot; {fmtM(activePipelineARV)} combined ARV
            </p>
          )}
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No deals in active pipeline yet</p>
        ) : (
          <div className="p-4 space-y-3">
            {leaderboard.map((entry, i) => {
              const pct = activePipelineCount > 0 ? (entry.deals / activePipelineCount) * 100 : 0;
              const medal = RANK_MEDALS[i] ?? null;
              const stages = [
                entry.inDD > 0 && `${entry.inDD} in DD`,
                entry.inDev > 0 && `${entry.inDev} in Dev`,
                entry.inSales > 0 && `${entry.inSales} in Sales`,
              ].filter(Boolean);
              return (
                <div
                  key={entry.owner}
                  className="border border-gray-200 rounded-xl p-4 bg-white cursor-pointer hover:border-accent hover:shadow-md transition-all"
                  onClick={() => setSelectedOwner(entry)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold text-sidebar">
                        {medal ? `${medal} ` : `#${i + 1} `}{entry.owner}
                      </span>
                      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span>{entry.deals} deal{entry.deals !== 1 ? 's' : ''} advanced</span>
                        <span>&middot;</span>
                        <span>{fmtM(entry.arv)} ARV</span>
                        {stages.length > 0 && (
                          <>
                            <span>&middot;</span>
                            <span>{stages.join(' \u00b7 ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-sidebar ml-2 tabular-nums">{entry.deals}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: '#E8642A' }}
                    />
                  </div>
                  <div className="text-right text-xs text-gray-400 mt-1">{entry.deals}/{activePipelineCount}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prospects in Land Acquisition */}
      {prospectsLeaderboard.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-sidebar">Prospects in Land Acquisition</h3>
            <p className="text-xs text-gray-500 mt-1">Deals currently being worked in the Land Acquisition pipeline</p>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Owner</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Total Leads</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">New Leads</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Qualified</th>
              </tr>
            </thead>
            <tbody>
              {prospectsLeaderboard.map(({ owner, total, newLeads, qualified }) => (
                <tr key={owner} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{owner}</td>
                  <td className="py-3 px-4 text-sm text-right font-semibold text-gray-700">{total}</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-400">{newLeads}</td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-green-600">{qualified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal Owner Modal */}
      {selectedOwner && (() => {
        const ownerDeals = activePipelineDeals.filter(
          d => (d.dealOwner || 'Unassigned') === selectedOwner.owner
        );
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            onClick={() => setSelectedOwner(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <div>
                  <h2 className="font-semibold text-sidebar text-base">{selectedOwner.owner}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ownerDeals.length} deal{ownerDeals.length !== 1 ? 's' : ''} in active pipeline
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOwner(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Deal list */}
              <div className="overflow-y-auto flex-1">
                {ownerDeals.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No deals found</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase">Address</th>
                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                        <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase">ARV</th>
                        <th className="text-right py-2.5 px-5 text-xs font-semibold text-gray-500 uppercase">Est. Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownerDeals.map(d => {
                        const profit = calcNetProfit(d);
                        return (
                          <tr
                            key={d.id}
                            className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => { setSelectedOwner(null); navigate(`/deal/${d.id}`); }}
                          >
                            <td className="py-3 px-5 text-sm font-medium text-accent hover:underline">
                              {d.address || '(No address)'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">{d.stage || '—'}</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-600">{fmt$(d.arv || 0)}</td>
                            <td className={`py-3 px-5 text-sm text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
          </div>
        );
      })()}
    </div>
  );
}
