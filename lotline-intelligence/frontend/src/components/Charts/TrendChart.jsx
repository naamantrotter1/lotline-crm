import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';

const fmtMonth = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const fmtVal = (v, metric) => {
  if (v == null) return '–';
  if (metric === 'median_price' || metric === 'median_sale_price')
    return '$' + Math.round(v / 1000) + 'k';
  if (metric === 'sales') return v;
  if (metric === 'median_dom') return v?.toFixed(0) + 'd';
  if (metric === 'avg_lts') return v?.toFixed(1) + '%';
  return v;
};

const COLORS = {
  primary:   '#DA7858',
  secondary: '#22c55e',
  warning:   '#f59e0b',
};

export function TrendChart({ data, dataKey, label, color = 'primary', type = 'area', height = 120 }) {
  const c = COLORS[color] || color;

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-xs"
           style={{ height }}>
        No trend data
      </div>
    );
  }

  const Chart  = type === 'bar' ? BarChart : AreaChart;
  const Series = type === 'bar' ? Bar : Area;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D8D5CB" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={fmtMonth}
          tick={{ fill: '#767C80', fontSize: 10 }}
          axisLine={false} tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#767C80', fontSize: 10 }}
          axisLine={false} tickLine={false}
          tickFormatter={v => fmtVal(v, dataKey)}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: '#E9E7DD', border: '1px solid #D8D5CB',
            borderRadius: 8, fontSize: 12, color: '#333638',
          }}
          labelFormatter={fmtMonth}
          formatter={(v) => [fmtVal(v, dataKey), label]}
        />
        {type === 'bar'
          ? <Bar dataKey={dataKey} fill={c} radius={[3, 3, 0, 0]} />
          : <Area
              type="monotone" dataKey={dataKey}
              stroke={c} strokeWidth={2}
              fill={c} fillOpacity={0.12}
              dot={false} activeDot={{ r: 4, stroke: c, strokeWidth: 2, fill: '#E9E7DD' }}
            />
        }
      </Chart>
    </ResponsiveContainer>
  );
}

export function MiniSparkline({ data, dataKey, color = '#3b82f6', height = 40 }) {
  if (!data?.length) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Area type="monotone" dataKey={dataKey}
          stroke={color} strokeWidth={1.5}
          fill={color} fillOpacity={0.1}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
