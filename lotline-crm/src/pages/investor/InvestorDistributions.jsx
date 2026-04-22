import { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { DollarSign, Download, TrendingUp, BarChart2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchMyDistributions, fetchMyDeals, distributionsToCsv } from '../../lib/investorPortalData';

function fmt(n)    { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_LABELS = { return_of_capital: 'Return of Capital', profit: 'Profit', preferred_return: 'Preferred Return' };
const TYPE_COLORS = { return_of_capital: 'bg-blue-500/15 text-blue-400', profit: 'bg-green-500/15 text-green-400', preferred_return: 'bg-purple-500/15 text-purple-400' };

export default function InvestorDistributions() {
  const { investor }             = useOutletContext();
  const [distributions, setDist] = useState([]);
  const [deals, setDeals]        = useState([]);
  const [loading, setLoading]    = useState(true);

  useEffect(() => {
    if (!investor) return;
    Promise.all([
      fetchMyDistributions(investor.id),
      fetchMyDeals(investor.name),
    ]).then(([{ distributions: d }, { deals: dl }]) => {
      setDist(d);
      setDeals(dl);
      setLoading(false);
    });
  }, [investor]);

  const totalDistributed = distributions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const totalProjected   = deals.reduce((s, d) => {
    const arv  = d.arv ?? 0;
    const cost = (d.land ?? 0) + (d.mobile_home ?? 0) + (d.permits ?? 0);
    return s + Math.max(0, arv - cost - arv * 0.045);
  }, 0);

  // Chart: cumulative distributions by month
  const chartData = useMemo(() => {
    const byMonth = {};
    [...distributions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(d => {
      const key = d.date?.slice(0, 7); // YYYY-MM
      if (!key) return;
      byMonth[key] = (byMonth[key] ?? 0) + (d.amount ?? 0);
    });
    let cum = 0;
    return Object.entries(byMonth).map(([month, amt]) => {
      cum += amt;
      return { month, amount: amt, cumulative: cum };
    });
  }, [distributions]);

  const exportCsv = () => {
    const csv = distributionsToCsv(distributions);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `distributions-${investor.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Distributions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{distributions.length} distribution{distributions.length !== 1 ? 's' : ''}</p>
        </div>
        {distributions.length > 0 && (
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Distributed', value: fmt(totalDistributed), icon: DollarSign, color: 'text-green-400' },
          { label: 'Projected Returns', value: fmt(totalProjected),   icon: TrendingUp, color: 'text-blue-400'  },
          { label: 'Remaining',         value: fmt(Math.max(0, totalProjected - totalDistributed)), icon: BarChart2, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#1c2130] rounded-xl p-5 border border-white/8">
            <div className={`flex items-center gap-1.5 mb-1 ${color}`}><Icon size={13} /></div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-[#1c2130] rounded-xl p-5 border border-white/8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Cumulative Distributions</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent, #c2651a)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent, #c2651a)" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1c2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: '#fff' }}
                formatter={v => [`$${v.toLocaleString()}`, 'Cumulative']}
              />
              <Area type="monotone" dataKey="cumulative" stroke="#c2651a" strokeWidth={2} fill="url(#distGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="bg-white/5 rounded-xl h-12 animate-pulse" />)}</div>
      ) : distributions.length === 0 ? (
        <div className="bg-[#1c2130] rounded-xl p-12 text-center border border-white/8">
          <DollarSign size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No distributions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-[#1c2130] rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-white/10">
              <tr>
                {['Date', 'Deal', 'Amount', 'Type', 'Wire Ref', 'Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {distributions.map(d => (
                <tr key={d.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDate(d.date)}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[160px] truncate">{d.deals?.address ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-green-400 whitespace-nowrap">{fmt(d.amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[d.type] ?? 'bg-white/10 text-gray-400'}`}>
                      {TYPE_LABELS[d.type] ?? d.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{d.wire_reference ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{d.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
