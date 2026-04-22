import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

function fmtK(v) {
  if (v == null) return '';
  return v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill }} className="font-medium">
          {p.name}: {fmtK(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function CashFlowWidget({ distributions = [] }) {
  // Build monthly bars from actual distributions
  const monthly = {};
  distributions.forEach(d => {
    const month = d.date ? d.date.slice(0, 7) : null;
    if (!month) return;
    if (!monthly[month]) monthly[month] = { month, profit: 0, roc: 0, interest: 0 };
    if (d.type === 'profit')    monthly[month].profit   += d.amount ?? 0;
    else if (d.type === 'roc')  monthly[month].roc      += d.amount ?? 0;
    else if (d.type === 'interest') monthly[month].interest += d.amount ?? 0;
    else                        monthly[month].profit   += d.amount ?? 0;
  });

  const data = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
    ...m,
    label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
  }));

  const hasData = data.length > 0;

  return (
    <div className="bg-[#1c2130] rounded-2xl border border-white/8 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-4 rounded-full bg-green-400" />
        <h2 className="text-xs font-semibold text-white uppercase tracking-widest">Cash Flow</h2>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <TrendingUp size={24} className="text-gray-700" />
          <p className="text-xs text-gray-600">No distributions yet.<br />Returns will appear here when issued.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barSize={10} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: '#6b7280', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fill: '#6b7280', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend
              iconType="circle"
              iconSize={6}
              wrapperStyle={{ fontSize: 9, color: '#9ca3af', paddingTop: 8 }}
            />
            <Bar dataKey="profit"   name="Profit"   fill="#c2651a" radius={[3, 3, 0, 0]} stackId="a" />
            <Bar dataKey="roc"      name="Return of Capital" fill="#3b82f6" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="interest" name="Interest" fill="#a78bfa" radius={[3, 3, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
