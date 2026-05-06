/**
 * Analytics — Land Acq Sales Dashboard
 *
 * Command centre for the acquisition team: KPI goals, leaderboard,
 * pipeline funnel, activity pulse, deal-age alerts, lead-source table.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import {
  Trophy, TrendingUp, TrendingDown, Check, Loader2,
  Plus, Download, AlertTriangle, ChevronDown, ChevronUp,
  X, ArrowRight, Clock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useDeals } from '../lib/DealsContext';
import { usePermissions } from '../hooks/usePermissions';
import { saveDeal } from '../lib/dealsSync';

// ─── Brand ────────────────────────────────────────────────────────────────────
const ACCENT = '#E8642A';
const BG     = '#F5F3EF';

// ─── Domain constants ─────────────────────────────────────────────────────────
const LEAD_SOURCE_OPTIONS = [
  'Direct Mail', 'Driving for Dollars', 'Wholesaler', 'MLS',
  'Referral', 'Cold Call', 'Online/Website', 'FB Market Place', 'Other',
];

const LA_STAGE_ORDER = [
  'New Lead', 'Negotiating', 'Underwriting', 'Waiting on Contract', 'Contract Signed',
];

const STAGE_LIMITS = {
  'New Lead': 14,
  'Negotiating': 14,
  'Underwriting': 7,
  'Waiting on Contract': 21,
};

// ─── Period helpers ───────────────────────────────────────────────────────────
function getPeriodBounds(period) {
  const now = new Date();
  switch (period) {
    case 'week': {
      const d = new Date(now);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      d.setHours(0, 0, 0, 0);
      const periodEnd = new Date(d);
      periodEnd.setDate(d.getDate() + 7);
      return { start: d, end: new Date(Math.min(now, periodEnd)), periodEnd };
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const periodEnd = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      return { start, end: now, periodEnd };
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      const periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { start, end: now, periodEnd };
    }
    default: { // month
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end: now, periodEnd };
    }
  }
}

function getPrevBounds(period, currentStart) {
  const s = new Date(currentStart);
  switch (period) {
    case 'week': {
      const ps = new Date(s); ps.setDate(ps.getDate() - 7);
      return { start: ps, end: new Date(s) };
    }
    case 'quarter': {
      const ps = new Date(s.getFullYear(), s.getMonth() - 3, 1);
      return { start: ps, end: new Date(s) };
    }
    case 'ytd': {
      return { start: new Date(s.getFullYear() - 1, 0, 1), end: new Date(s) };
    }
    default: {
      return { start: new Date(s.getFullYear(), s.getMonth() - 1, 1), end: new Date(s) };
    }
  }
}

const PERIOD_LABELS = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', ytd: 'YTD' };

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtM(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(mins / 60);
  const days  = Math.floor(hrs / 24);
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function inRange(d, start, end) {
  const t = new Date(d).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// ─── KPI computation (client-side from context deals) ─────────────────────────
function computeKpis(deals, { start, end }) {
  const laInPeriod = deals.filter(
    d => d.pipeline === 'land-acquisition' && inRange(d.created_at, start, end),
  );

  const newLeads = laInPeriod.length;

  const offersMade = laInPeriod.filter(
    d => ['Negotiating', 'Underwriting', 'Waiting on Contract', 'Contract Signed']
      .includes(d.stage),
  ).length;

  const contractsSigned = deals.filter(
    d => d.contractSignedAt && inRange(d.contractSignedAt, start, end),
  ).length;

  const dealsAdvanced = deals.filter(
    d => d.pipeline === 'deal-overview' && inRange(d.created_at, start, end),
  ).length;

  const pipelineArv = deals
    .filter(d => d.pipeline === 'land-acquisition')
    .reduce((s, d) => s + (d.arv || 0), 0);

  const contracted = deals.filter(
    d => d.contractSignedAt && inRange(d.contractSignedAt, start, end) && d.created_at,
  );
  const avgDaysToContract = contracted.length
    ? Math.round(
        contracted.reduce((s, d) => {
          return s + (new Date(d.contractSignedAt) - new Date(d.created_at)) / 86400000;
        }, 0) / contracted.length,
      )
    : null;

  return { newLeads, offersMade, contractsSigned, dealsAdvanced, pipelineArv, avgDaysToContract };
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, metricKey, kpiPeriod, value, prevValue, target, onSaveTarget, canEditGoals, flash }) {
  const [editing, setSaving_]  = useState(false);
  const [draft, setDraft]      = useState('');
  const [saving, setSaving]    = useState(false);
  const [saved, setSaved]      = useState(false);

  const pct      = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const trend    = prevValue != null ? value - prevValue : null;
  const trendUp  = trend !== null && trend >= 0;
  const barColor = pct >= 100 ? '#22c55e' : ACCENT;

  const displayVal = () => {
    if (metricKey === 'pipeline_arv')          return fmtM(value);
    if (metricKey === 'avg_days_to_contract')  return value != null ? `${value}d` : '—';
    return value;
  };

  const displayTarget = () => {
    if (!target) return '—';
    if (metricKey === 'pipeline_arv')         return fmtM(target);
    if (metricKey === 'avg_days_to_contract') return `${target}d`;
    return target;
  };

  const displayTrend = () => {
    if (trend === null) return '';
    if (metricKey === 'pipeline_arv')         return fmtM(Math.abs(trend));
    if (metricKey === 'avg_days_to_contract') return `${Math.abs(trend)}d`;
    return Math.abs(trend);
  };

  const handleSave = async () => {
    const num = parseFloat(draft);
    if (isNaN(num) || num <= 0) { setSaving_(false); return; }
    setSaving(true);
    await onSaveTarget(metricKey, kpiPeriod, num);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving_(false);
  };

  return (
    <div
      className={`bg-white rounded-xl p-5 border shadow-sm transition-all duration-300 ${
        flash ? 'ring-2 ring-orange-400 scale-[1.02]' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {icon} {label}
        </span>
        {trend !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trendUp ? '+' : '-'}{displayTrend()} vs last
          </span>
        )}
      </div>

      <div className="text-4xl font-extrabold text-gray-900 mb-3 tabular-nums">
        {displayVal()}
      </div>

      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
          <span>{pct}% of goal</span>
          {pct >= 100 && <span className="text-green-600 font-semibold">✓ Goal hit!</span>}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-[11px] text-gray-400">Goal:</span>
        {editing && canEditGoals ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setSaving_(false);
              }}
              className="text-xs border border-orange-300 rounded px-1.5 py-0.5 w-24 focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            {saving && <Loader2 size={10} className="animate-spin text-gray-400" />}
            {saved  && <Check    size={10} className="text-green-500" />}
          </div>
        ) : (
          <button
            onClick={() => {
              if (!canEditGoals) return;
              setDraft(String(target || ''));
              setSaving_(true);
            }}
            title={canEditGoals ? 'Click to edit goal' : 'Admin only'}
            className={`text-xs font-semibold transition-colors ${
              target ? 'text-gray-700' : 'text-gray-300'
            } ${canEditGoals ? 'hover:text-orange-500 cursor-pointer' : 'cursor-default'}`}
          >
            {displayTarget()}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function Leaderboard({ deals }) {
  const navigate  = useNavigate();
  const [tab,       setTab]       = useState('advanced');
  const [lbPeriod,  setLbPeriod]  = useState('month');
  const [expanded,  setExpanded]  = useState(null);

  const { start: lbStart, end: lbEnd } = useMemo(
    () => lbPeriod === 'all' ? { start: new Date(0), end: new Date() } : getPeriodBounds(lbPeriod),
    [lbPeriod],
  );

  const rows = useMemo(() => {
    const map = {};
    deals.forEach(d => {
      const owner = d.dealOwner || 'Unassigned';
      if (!map[owner]) map[owner] = { owner, leads: 0, advanced: 0, contracts: 0, pipelineArv: 0, inDd: 0, inDev: 0 };
      if (d.pipeline === 'land-acquisition') map[owner].leads++;
      if (d.pipeline === 'deal-overview') {
        const t = new Date(d.created_at).getTime();
        if (t >= lbStart.getTime() && t <= lbEnd.getTime()) map[owner].advanced++;
        map[owner].pipelineArv += d.arv || 0;
        if (d.stage === 'Due Diligence') map[owner].inDd++;
        if (d.stage === 'Development')   map[owner].inDev++;
      }
      if (d.contractSignedAt && inRange(d.contractSignedAt, lbStart, lbEnd)) {
        map[owner].contracts++;
      }
    });

    return Object.values(map)
      .filter(r => r.owner !== 'Unassigned' || r.advanced > 0 || r.leads > 0)
      .sort((a, b) => {
        if (tab === 'contracts') return b.contracts - a.contracts;
        if (tab === 'arv')       return b.pipelineArv - a.pipelineArv;
        return b.advanced - a.advanced;
      });
  }, [deals, tab, lbStart, lbEnd]);

  const maxVal = rows.length
    ? Math.max(tab === 'arv' ? rows[0].pipelineArv : tab === 'contracts' ? rows[0].contracts : rows[0].advanced, 1)
    : 1;

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">🏆 Leaderboard</h2>
          <p className="text-xs text-gray-400 mt-0.5">Deals advanced to active pipeline</p>
        </div>
        <div className="flex gap-1">
          {[['month', 'Month'], ['quarter', 'Quarter'], ['all', 'All Time']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setLbPeriod(k)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={lbPeriod === k ? { backgroundColor: ACCENT, color: '#fff' } : { color: '#9ca3af' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-100 mb-4">
        {[['advanced', 'DEALS ADVANCED'], ['contracts', 'CONTRACTS SIGNED'], ['arv', 'PIPELINE VALUE']].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-[11px] font-bold tracking-wider border-b-2 -mb-px transition-colors ${
              tab === k ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.5rem_1fr_5rem_4rem_4rem_4rem_1.5rem] gap-2 px-2 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        <div>#</div>
        <div>Member</div>
        <div className="text-right">{tab === 'arv' ? 'ARV' : tab === 'contracts' ? 'Contracts' : 'Deals'}</div>
        <div className="text-right">In DD</div>
        <div className="text-right">In Dev</div>
        <div className="text-right">Conv%</div>
        <div />
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No data for this period</p>
      ) : rows.map((r, i) => {
        const val    = tab === 'arv' ? r.pipelineArv : tab === 'contracts' ? r.contracts : r.advanced;
        const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const conv   = r.leads > 0 ? Math.round((r.advanced / r.leads) * 100) : 0;
        const isExp  = expanded === r.owner;
        const ownedActivePipeline = deals.filter(d => d.pipeline === 'deal-overview' && d.dealOwner === r.owner);

        return (
          <div key={r.owner}>
            <div
              className="grid grid-cols-[1.5rem_1fr_5rem_4rem_4rem_4rem_1.5rem] gap-2 items-center py-2.5 px-2 rounded-xl hover:bg-orange-50/40 cursor-pointer group transition-colors"
              onClick={() => setExpanded(isExp ? null : r.owner)}
            >
              {/* Rank */}
              <div className="text-base leading-none">
                {i < 3 ? MEDALS[i] : <span className="text-xs font-bold text-gray-400">{i + 1}</span>}
              </div>
              {/* Name + bar */}
              <div>
                <div className="text-sm font-semibold text-gray-800">{r.owner}</div>
                <div className="mt-1 h-1.5 w-full max-w-[140px] bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, backgroundColor: ACCENT }} />
                </div>
              </div>
              <div className="text-right text-sm font-extrabold text-gray-800 tabular-nums">
                {tab === 'arv' ? fmtM(val) : val}
              </div>
              <div className="text-right text-sm text-gray-500 tabular-nums">{r.inDd}</div>
              <div className="text-right text-sm text-gray-500 tabular-nums">{r.inDev}</div>
              <div className="text-right text-sm text-gray-500 tabular-nums">{conv}%</div>
              <div className="text-gray-300 group-hover:text-gray-500 flex justify-end transition-colors">
                {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </div>
            </div>

            {/* Expanded deal list */}
            {isExp && (
              <div className="ml-8 mr-4 mb-3 bg-gray-50 rounded-xl p-3 space-y-1">
                {ownedActivePipeline.length === 0 ? (
                  <p className="text-xs text-gray-400">No active pipeline deals</p>
                ) : ownedActivePipeline.map(d => (
                  <button
                    key={d.id}
                    onClick={e => { e.stopPropagation(); navigate(`/deal/${d.id}`); }}
                    className="flex items-center justify-between w-full text-left py-1.5 px-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group/deal"
                  >
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[60%]">
                      {d.address || d.id}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 group-hover/deal:text-orange-500 transition-colors">
                      {d.stage} <ArrowRight size={9} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────
function PipelineFunnel({ deals }) {
  const stageCounts = useMemo(() => {
    const la = deals.filter(d => d.pipeline === 'land-acquisition');
    return LA_STAGE_ORDER.map(stage => ({
      stage,
      short: stage === 'Waiting on Contract' ? 'Waiting' : stage,
      count: la.filter(d => d.stage === stage).length,
      arv:   la.filter(d => d.stage === stage).reduce((s, d) => s + (d.arv || 0), 0),
    }));
  }, [deals]);

  const advanced = deals.filter(d => d.pipeline === 'deal-overview').length;
  const maxCount = Math.max(...stageCounts.map(s => s.count), advanced, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex-1 min-w-0" style={{ minWidth: 280 }}>
      <h2 className="text-base font-extrabold text-gray-900 mb-5">Land Acq Funnel</h2>
      <div className="space-y-2">
        {stageCounts.map((s, i) => {
          const prev = i > 0 ? stageCounts[i - 1].count : null;
          const conv = prev != null && prev > 0 ? Math.round((s.count / prev) * 100) : null;
          const barPct = (s.count / maxCount) * 100;
          return (
            <div key={s.stage}>
              {conv !== null && (
                <div className="text-[10px] text-gray-300 text-right -mb-0.5 pr-8">{conv}% ↓</div>
              )}
              <div className="flex items-center gap-3 group">
                <div className="text-xs text-gray-400 w-32 text-right flex-shrink-0 leading-tight">{s.short}</div>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative cursor-default">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barPct}%`, backgroundColor: ACCENT, opacity: 0.85 }}
                  />
                  {s.arv > 0 && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition-opacity bg-black/10 rounded-full">
                      {fmtM(s.arv)} ARV
                    </div>
                  )}
                </div>
                <div className="text-sm font-extrabold text-gray-700 w-6 text-right tabular-nums">{s.count}</div>
              </div>
            </div>
          );
        })}

        {/* Advanced to DD divider */}
        <div className="border-t border-dashed border-gray-200 pt-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-gray-600 w-32 text-right flex-shrink-0">→ In Pipeline</div>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(advanced / maxCount) * 100}%`, backgroundColor: '#22c55e' }}
              />
            </div>
            <div className="text-sm font-extrabold text-green-600 w-6 text-right tabular-nums">{advanced}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stage Velocity ───────────────────────────────────────────────────────────
function StageVelocity({ deals }) {
  const data = useMemo(() => {
    const la = deals.filter(d => d.pipeline === 'land-acquisition');
    return LA_STAGE_ORDER.map(stage => {
      const inStage = la.filter(d => d.stage === stage);
      const avgDays = inStage.length
        ? Math.round(inStage.reduce((s, d) => s + (Date.now() - new Date(d.created_at).getTime()) / 86400000, 0) / inStage.length)
        : 0;
      return {
        stage: stage === 'Waiting on Contract' ? 'Waiting' : stage,
        fullStage: stage,
        days: avgDays,
        limit: STAGE_LIMITS[stage] || 30,
        count: inStage.length,
      };
    });
  }, [deals]);

  const chartData = data.map(d => ({ name: d.stage, days: d.days, limit: d.limit, isOver: d.days > d.limit }));
  const maxDays = Math.max(...data.map(d => d.days), 10);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex-1 min-w-0" style={{ minWidth: 280 }}>
      <h2 className="text-base font-extrabold text-gray-900 mb-1">Stage Velocity</h2>
      <p className="text-[11px] text-gray-400 mb-4">
        Avg days in stage · <span className="text-red-400">Red = over target</span>
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 32, top: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, maxDays + 5]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={64} />
          <Tooltip
            formatter={(val, _, props) => [`${val}d (limit: ${props.payload.limit}d)`, 'Avg Days']}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="days" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isOver ? '#ef4444' : ACCENT} fillOpacity={0.85} />
            ))}
          </Bar>
          {/* Target reference lines per stage would need per-row approach; skip for simplicity */}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1">
        {data.map(d => (
          <div key={d.stage} className="flex items-center justify-between text-[11px]">
            <span className="text-gray-400">{d.stage}</span>
            <span className={`font-semibold ${d.days > d.limit ? 'text-red-500' : 'text-gray-600'}`}>
              {d.days}d
              {d.count > 0 && <span className="text-gray-300 font-normal ml-1">({d.count} deals)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Pulse ───────────────────────────────────────────────────────────
function ActivityPulse({ orgId, deals }) {
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);

  const dealsById = useMemo(
    () => Object.fromEntries(deals.map(d => [String(d.id), d])),
    [deals],
  );

  useEffect(() => {
    if (!supabase || !orgId) { setLoading(false); return; }
    const since = new Date(Date.now() - 7 * 86400000).toISOString();

    supabase
      .from('activity_notes')
      .select('id, body, deal_id, author_id, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', since)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setLoading(false); return; }
        const authorIds = [...new Set(data.map(n => n.author_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', authorIds);
        const byId = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
        setNotes(data.map(n => ({ ...n, authorName: byId[n.author_id] || 'Team member' })));
        setLoading(false);
      });
  }, [orgId]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex-1 min-w-0" style={{ minWidth: 260 }}>
      <h2 className="text-base font-extrabold text-gray-900 mb-4">
        ⚡ Activity Pulse
        <span className="text-xs font-normal text-gray-400 ml-2">last 7 days</span>
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Loading&hellip;
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-400">No recent activity notes</p>
      ) : (
        <div className="space-y-4">
          {notes.map(n => {
            const deal = n.deal_id ? dealsById[String(n.deal_id)] : null;
            return (
              <div key={n.id} className="flex gap-2.5">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: ACCENT }}
                />
                <div className="min-w-0">
                  <p className="text-xs text-gray-800">
                    <span className="font-semibold">{n.authorName}</span>
                    {deal && (
                      <span className="text-gray-400"> · {deal.address?.split(',')[0] || 'deal'}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Deal Age Alerts ──────────────────────────────────────────────────────────
function DealAgeAlerts({ orgId }) {
  const navigate = useNavigate();
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !orgId) { setLoading(false); return; }

    const queries = Object.entries(STAGE_LIMITS).map(([stage, limit]) => {
      const cutoff = new Date(Date.now() - limit * 86400000).toISOString();
      return supabase
        .from('deals')
        .select('id, address, stage, updated_at')
        .eq('organization_id', orgId)
        .eq('is_archived', false)
        .eq('pipeline', 'land-acquisition')
        .eq('stage', stage)
        .lt('updated_at', cutoff);
    });

    Promise.all(queries).then(results => {
      const all = results
        .flatMap(r => r.data || [])
        .map(d => ({
          ...d,
          daysStuck: Math.round((Date.now() - new Date(d.updated_at).getTime()) / 86400000),
          limit: STAGE_LIMITS[d.stage],
        }))
        .sort((a, b) => b.daysStuck - a.daysStuck);
      setAlerts(all);
      setLoading(false);
    });
  }, [orgId]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex-1 min-w-0" style={{ minWidth: 260 }}>
      <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-red-500">🔴</span> Deal Age Alerts
        {alerts.length > 0 && (
          <span className="bg-red-100 text-red-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={13} className="animate-spin" /> Checking&hellip;
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check size={14} /> No stuck deals — great work!
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => {
            const ratio  = a.daysStuck / a.limit;
            const border = ratio >= 2 ? '#ef4444' : '#f97316';
            const short  = a.address ? a.address.split(',')[0] : a.id.slice(0, 8);
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/deal/${a.id}`)}
                className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl border hover:shadow-sm transition-all group"
                style={{ borderColor: border }}
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: border }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate">{short}</p>
                  <p className="text-[11px] text-gray-500">
                    {a.daysStuck}d in <span className="font-semibold">{a.stage}</span>
                    <span className="text-gray-300"> (limit {a.limit}d)</span>
                  </p>
                </div>
                <ArrowRight
                  size={11}
                  className="flex-shrink-0 mt-0.5 text-gray-300 group-hover:text-orange-400 transition-colors"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Lead Source Table ────────────────────────────────────────────────────────
function LeadSourceTable({ deals, periodStart, periodEnd }) {
  const [sortKey, setSortKey] = useState('newLeads');
  const [sortDir, setSortDir] = useState(-1);

  const rows = useMemo(() => {
    const map = {};
    deals.forEach(d => {
      const src = d.leadSource || 'Other';
      if (!map[src]) map[src] = { source: src, newLeads: 0, offers: 0, contracts: 0, totalArv: 0, arvCount: 0 };
      if (inRange(d.created_at, periodStart, periodEnd)) {
        map[src].newLeads++;
        if (d.stage && !['New Lead'].includes(d.stage)) map[src].offers++;
        if (d.contractSignedAt) map[src].contracts++;
      }
      if (d.arv) { map[src].totalArv += d.arv; map[src].arvCount++; }
    });
    return Object.values(map).map(r => ({
      ...r,
      conv:   r.newLeads > 0 ? +((r.contracts / r.newLeads) * 100).toFixed(1) : 0,
      avgArv: r.arvCount  > 0 ? Math.round(r.totalArv / r.arvCount) : 0,
    }));
  }, [deals, periodStart, periodEnd]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * sortDir),
    [rows, sortKey, sortDir],
  );

  const ColH = ({ k, label }) => (
    <th
      className="text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider pb-3 pr-4 cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
      onClick={() => { if (sortKey === k) setSortDir(d => d * -1); else { setSortKey(k); setSortDir(-1); } }}
    >
      {label}{sortKey === k ? (sortDir > 0 ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-extrabold text-gray-900 mb-5">Lead Source Breakdown</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <ColH k="source"    label="Lead Source" />
              <ColH k="newLeads"  label="New Leads"   />
              <ColH k="offers"    label="Offers"       />
              <ColH k="contracts" label="Contracts"   />
              <ColH k="conv"      label="Conv %"      />
              <ColH k="avgArv"    label="Avg ARV"     />
              <ColH k="totalArv"  label="Total ARV"   />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(r => (
              <tr key={r.source} className="hover:bg-orange-50/20 transition-colors">
                <td className="py-3 pr-4 text-sm font-semibold text-gray-800">{r.source || '—'}</td>
                <td className="py-3 pr-4 text-sm text-center tabular-nums">{r.newLeads}</td>
                <td className="py-3 pr-4 text-sm text-center tabular-nums">{r.offers}</td>
                <td className="py-3 pr-4 text-sm text-center tabular-nums">{r.contracts}</td>
                <td className="py-3 pr-4 text-sm text-center font-semibold tabular-nums">{r.conv}%</td>
                <td className="py-3 pr-4 text-sm text-right tabular-nums">{r.avgArv ? fmtM(r.avgArv) : '—'}</td>
                <td className="py-3 text-sm text-right font-bold tabular-nums">{fmtM(r.totalArv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Quick Add Lead Modal ─────────────────────────────────────────────────────
function QuickAddModal({ onClose, orgId, profile }) {
  const navigate     = useNavigate();
  const { setDeals } = useDeals();
  const [form, setForm]       = useState({ address: '', county: '', state: '', arv: '', leadSource: '', dealOwner: '' });
  const [saving, setSaving]   = useState(false);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!supabase || !orgId) return;
    supabase.from('memberships').select('user_id').eq('organization_id', orgId).eq('status', 'active')
      .then(({ data: mems }) => {
        if (!mems?.length) return;
        supabase.from('profiles').select('id, name').in('id', mems.map(m => m.user_id))
          .then(({ data }) => { if (data) setMembers(data.filter(p => p.name)); });
      });
  }, [orgId]);

  const handleSubmit = async () => {
    if (!form.address.trim()) return;
    setSaving(true);
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `lead-${Date.now()}`;
    const deal = {
      id,
      pipeline:       'land-acquisition',
      stage:          'New Lead',
      address:        form.address.trim(),
      county:         form.county   || null,
      state:          form.state    || null,
      arv:            form.arv      ? parseFloat(form.arv) : null,
      leadSource:     form.leadSource || null,
      dealOwner:      form.dealOwner  || null,
      organizationId: orgId,
      created_at:     new Date().toISOString(),
    };
    saveDeal(deal, orgId);
    setDeals(prev => [deal, ...prev]);
    setSaving(false);
    onClose();
    navigate(`/deal/${id}`);
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold text-gray-900">+ Quick Add Lead</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            placeholder="Address *"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            className={inputCls}
            style={{ '--tw-ring-color': ACCENT }}
            onFocus={e => e.target.style.borderColor = ACCENT}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="County"
              value={form.county}
              onChange={e => setForm(f => ({ ...f, county: e.target.value }))}
              className={inputCls}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            <input
              placeholder="State (SC)"
              value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
              className={inputCls}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <input
            type="number"
            placeholder="ARV estimate ($)"
            value={form.arv}
            onChange={e => setForm(f => ({ ...f, arv: e.target.value }))}
            className={inputCls}
            onFocus={e => e.target.style.borderColor = ACCENT}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
          <select
            value={form.leadSource}
            onChange={e => setForm(f => ({ ...f, leadSource: e.target.value }))}
            className={inputCls}
          >
            <option value="">Lead Source…</option>
            {LEAD_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select
            value={form.dealOwner}
            onChange={e => setForm(f => ({ ...f, dealOwner: e.target.value }))}
            className={inputCls}
          >
            <option value="">Assign to…</option>
            {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.address.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-extrabold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
            style={{ backgroundColor: ACCENT }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Add Lead
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Analytics component ─────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { key: 'week',    label: 'This Week'    },
  { key: 'month',   label: 'This Month'   },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'ytd',     label: 'YTD'          },
];

const KPI_DEFS = [
  { icon: '🎯', label: 'New Leads',           key: 'new_leads',            valKey: 'newLeads'           },
  { icon: '📋', label: 'Offers Made',          key: 'offers_made',          valKey: 'offersMade'         },
  { icon: '✅', label: 'Contracts Signed',     key: 'contracts_signed',     valKey: 'contractsSigned'    },
  { icon: '🔄', label: 'Deals Advanced',       key: 'deals_advanced',       valKey: 'dealsAdvanced'      },
  { icon: '💰', label: 'Pipeline ARV',         key: 'pipeline_arv',         valKey: 'pipelineArv'        },
  { icon: '⚡', label: 'Avg Days to Contract', key: 'avg_days_to_contract', valKey: 'avgDaysToContract'  },
];

const PERIOD_KPI_MAP = { week: 'weekly', month: 'monthly', quarter: 'quarterly', ytd: 'yearly' };

export default function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeOrgId, profile, orgRole } = useAuth();
  const { deals, dealsLoading }           = useDeals();

  const [period,         setPeriod]         = useState(searchParams.get('period') || 'month');
  const [showComparison, setShowComparison] = useState(false);
  const [showQuickAdd,   setShowQuickAdd]   = useState(false);
  const [goals,          setGoals]          = useState({});
  const [flashCard,      setFlashCard]      = useState(null);
  const prevCountRef = useRef(deals.length);

  const canEditGoals = orgRole === 'owner' || orgRole === 'admin';

  // Sync period to URL
  useEffect(() => {
    setSearchParams(p => { const n = new URLSearchParams(p); n.set('period', period); return n; }, { replace: true });
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load KPI goals
  useEffect(() => {
    if (!supabase || !activeOrgId) return;
    supabase
      .from('kpi_goals')
      .select('metric_key, period, target_value')
      .eq('organization_id', activeOrgId)
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        data.forEach(g => { map[`${g.period}::${g.metric_key}`] = g.target_value; });
        setGoals(map);
      });
  }, [activeOrgId]);

  // Flash new-lead card when deals list grows
  useEffect(() => {
    if (deals.length > prevCountRef.current) {
      setFlashCard('new_leads');
      setTimeout(() => setFlashCard(null), 2000);
    }
    prevCountRef.current = deals.length;
  }, [deals.length]);

  const bounds     = useMemo(() => getPeriodBounds(period), [period]);
  const prevBounds = useMemo(() => getPrevBounds(period, bounds.start), [period, bounds.start]);

  const kpis     = useMemo(() => computeKpis(deals, bounds),                      [deals, bounds]);
  const prevKpis = useMemo(() => showComparison ? computeKpis(deals, prevBounds) : null, [deals, prevBounds, showComparison]);

  const kpiPeriod = PERIOD_KPI_MAP[period] || 'monthly';
  const getGoal   = key => goals[`${kpiPeriod}::${key}`] || 0;

  const saveGoal = useCallback(async (metricKey, kpiPeriod, value) => {
    if (!supabase || !activeOrgId) return;
    const { data } = await supabase
      .from('kpi_goals')
      .upsert(
        { organization_id: activeOrgId, period: kpiPeriod, metric_key: metricKey, target_value: value, created_by: profile?.id || null, updated_at: new Date().toISOString() },
        { onConflict: 'organization_id,period,metric_key' },
      )
      .select('metric_key, period, target_value')
      .single();
    if (data) setGoals(g => ({ ...g, [`${data.period}::${data.metric_key}`]: data.target_value }));
  }, [activeOrgId, profile?.id]);

  // Period progress bar
  const totalMs     = Math.max(1, bounds.periodEnd - bounds.start);
  const elapsedMs   = Math.max(0, Date.now() - bounds.start.getTime());
  const progressPct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  const daysLeft    = Math.max(0, Math.round((bounds.periodEnd - Date.now()) / 86400000));

  // CSV export
  const handleExport = () => {
    const kpiRows = KPI_DEFS.map(k => [k.label, kpis[k.valKey] ?? '']);
    const lbOwners = [...new Set(deals.map(d => d.dealOwner).filter(Boolean))];
    const lbRows   = lbOwners.map(o => {
      const owned = deals.filter(d => d.dealOwner === o);
      return [o, owned.filter(d => d.pipeline === 'land-acquisition').length, owned.filter(d => d.pipeline === 'deal-overview').length];
    });
    const csv = [
      [`Land Acq Sales — ${PERIOD_LABELS[period]} — ${new Date().toLocaleDateString()}`],
      [],
      ['KPI', 'Value'],
      ...kpiRows,
      [],
      ['Leaderboard', 'Leads', 'Advanced'],
      ...lbRows,
    ].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `land-acq-${period}-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2.5">
              <Trophy size={24} style={{ color: ACCENT }} />
              Land Acq Sales
            </h1>
            <p className="text-sm text-gray-400 mt-1">Live acquisition performance</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Comparison toggle */}
            <button
              onClick={() => setShowComparison(c => !c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                showComparison
                  ? 'border-orange-400 text-orange-600 bg-orange-50'
                  : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
              }`}
            >
              vs Previous Period
            </button>

            {/* Period pills */}
            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {PERIOD_OPTIONS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className="px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={period === p.key
                    ? { backgroundColor: ACCENT, color: '#fff' }
                    : { color: '#9ca3af' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-300 shadow-sm transition-colors"
            >
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* ── Period progress bar ─────────────────────────────────────── */}
        <div>
          <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
            <span className="font-semibold">{PERIOD_LABELS[period]}</span>
            <span>{daysLeft} days left in period</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, backgroundColor: ACCENT }}
            />
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {KPI_DEFS.map(k => (
            <KpiCard
              key={k.key}
              icon={k.icon}
              label={k.label}
              metricKey={k.key}
              kpiPeriod={kpiPeriod}
              value={kpis[k.valKey] ?? 0}
              prevValue={showComparison ? (prevKpis?.[k.valKey] ?? null) : null}
              target={getGoal(k.key)}
              onSaveTarget={saveGoal}
              canEditGoals={canEditGoals}
              flash={flashCard === k.key}
            />
          ))}
        </div>

        {/* ── Leaderboard ─────────────────────────────────────────────── */}
        <Leaderboard deals={deals} />

        {/* ── Funnel + Velocity ─────────────────────────────────────── */}
        <div className="flex gap-4 flex-wrap lg:flex-nowrap">
          <PipelineFunnel deals={deals} />
          <StageVelocity  deals={deals} />
        </div>

        {/* ── Activity + Alerts ─────────────────────────────────────── */}
        <div className="flex gap-4 flex-wrap lg:flex-nowrap">
          <ActivityPulse   orgId={activeOrgId} deals={deals} />
          <DealAgeAlerts   orgId={activeOrgId} />
        </div>

        {/* ── Lead Source Table ─────────────────────────────────────── */}
        <LeadSourceTable deals={deals} periodStart={bounds.start} periodEnd={bounds.end} />

      </div>

      {/* ── Fixed "+ Add Lead" button ─────────────────────────────── */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 text-white font-extrabold text-sm px-5 py-3 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all z-30"
        style={{ backgroundColor: ACCENT }}
      >
        <Plus size={16} /> Add Lead
      </button>

      {/* ── Quick Add Modal ────────────────────────────────────────── */}
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          orgId={activeOrgId}
          profile={profile}
        />
      )}
    </div>
  );
}
