import React, { useState, useEffect } from 'react';
import api from '../api';

const fmt    = (n) => n == null ? '–' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n) => n == null ? '–' : Number(n).toFixed(1) + '%';

const STATUS_ORDER = [
  'prospecting','due_diligence','under_contract','permit_pending',
  'home_ordered','home_installed','listed','under_contract_sale','closed','dead',
];
const STATUS_LABELS = {
  prospecting: 'Prospecting', due_diligence: 'Due Diligence', under_contract: 'Under Contract',
  permit_pending: 'Permit Pending', home_ordered: 'Home Ordered', home_installed: 'Home Installed',
  listed: 'Listed', under_contract_sale: 'Under Contract (Sale)', closed: 'Closed', dead: 'Dead',
};
const STATUS_BADGE = {
  prospecting: 'badge-gray', due_diligence: 'badge-blue', under_contract: 'badge-yellow',
  permit_pending: 'badge-yellow', home_ordered: 'badge-blue', home_installed: 'badge-blue',
  listed: 'badge-green', under_contract_sale: 'badge-green', closed: 'badge-gray', dead: 'badge-red',
};

const btnBase = 'px-3 py-1 text-xs rounded font-medium transition-colors';
const btnActive = `${btnBase} bg-brand-500 text-white`;
const btnInactive = `${btnBase} bg-surface-overlay text-[#767C80] hover:text-[#333638]`;

export default function Pipeline() {
  const [data, setData]       = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState('table');
  const [filter, setFilter]   = useState('active');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.deals.list()
      .then(r => { setData(r.data || []); setSummary(r.summary); })
      .finally(() => setLoading(false));
  }, []);

  const activeStatuses = STATUS_ORDER.filter(s => !['closed','dead'].includes(s));
  const filtered = data.filter(d => {
    if (filter === 'active')  return !['closed','dead'].includes(d.status);
    if (filter === 'closed')  return d.status === 'closed';
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface-raised">
        <h1 className="font-bold text-[#333638]">Deal Pipeline</h1>

        <div className="flex gap-1 ml-4">
          {['active','closed','all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? btnActive : btnInactive}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto">
          <button onClick={() => setView('table')}
            className={view === 'table' ? btnActive : btnInactive}>
            Table
          </button>
          <button onClick={() => setView('kanban')}
            className={view === 'kanban' ? btnActive : btnInactive}>
            Kanban
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="flex-shrink-0 grid grid-cols-6 gap-3 p-3 border-b border-surface-border bg-surface-base">
          <SummaryCard label="Active Deals"     value={summary.total_active} />
          <SummaryCard label="Total Invested"   value={fmt(summary.total_invested)} color="text-yellow-600" />
          <SummaryCard label="Proj Profit"      value={fmt(summary.projected_profit)} color="text-green-600" />
          <SummaryCard label="Avg Proj ROI"     value={fmtPct(summary.avg_projected_roi)} color="text-green-600" />
          <SummaryCard label="Deals Closed"     value={summary.closed_deals} />
          <SummaryCard label="Actual Profit"    value={fmt(summary.total_actual_profit)} color="text-green-600" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[#767C80]">Loading...</div>
        ) : view === 'kanban' ? (
          <KanbanView deals={filtered} activeStatuses={activeStatuses} />
        ) : (
          <TableView deals={filtered} onSelect={setSelected} selected={selected} />
        )}
      </div>
    </div>
  );
}

function TableView({ deals, onSelect, selected }) {
  return (
    <table className="data-table w-full text-xs">
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="text-left">Address</th>
          <th className="text-left">County</th>
          <th className="text-left">Status</th>
          <th>All-In</th>
          <th>Target</th>
          <th>Proj Profit</th>
          <th>Proj ROI</th>
          <th>Acres</th>
          <th>Contract</th>
          <th>Assigned</th>
        </tr>
      </thead>
      <tbody>
        {deals.map(d => (
          <tr key={d.id} onClick={() => onSelect(selected === d.id ? null : d.id)}
            className={`cursor-pointer ${selected === d.id ? 'bg-brand-500/10' : ''}`}>
            <td className="font-medium text-[#333638] max-w-[200px] truncate">{d.address}</td>
            <td className="whitespace-nowrap">{d.county_name}, {d.state}</td>
            <td>
              <span className={`badge ${STATUS_BADGE[d.status] || 'badge-gray'}`}>
                {STATUS_LABELS[d.status] || d.status}
              </span>
            </td>
            <td className="tabular-nums">{fmt(d.all_in_cost)}</td>
            <td className="tabular-nums">{fmt(d.target_sale_price)}</td>
            <td className="tabular-nums">
              <span className={d.projected_profit >= 40000 ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
                {fmt(d.projected_profit)}
              </span>
            </td>
            <td className="tabular-nums">
              <span className={d.projected_roi_pct >= 25 ? 'text-green-600' : 'text-[#767C80]'}>
                {fmtPct(d.projected_roi_pct)}
              </span>
            </td>
            <td className="tabular-nums">{Number(d.acreage).toFixed(1)}</td>
            <td className="whitespace-nowrap text-[#767C80]">{d.contract_date?.slice(0, 10) || '–'}</td>
            <td className="text-[#767C80]">{d.assigned_to || '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KanbanView({ deals, activeStatuses }) {
  const cols = activeStatuses.filter(s => !['closed','dead'].includes(s));
  return (
    <div className="flex gap-3 p-3 h-full overflow-x-auto">
      {cols.map(status => {
        const colDeals = deals.filter(d => d.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-56">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-semibold text-[#767C80]">{STATUS_LABELS[status]}</h3>
              <span className="badge badge-gray">{colDeals.length}</span>
            </div>
            <div className="space-y-2">
              {colDeals.map(d => (
                <div key={d.id} className="card p-3 cursor-pointer hover:border-brand-500/50 transition-colors">
                  <p className="text-xs font-medium text-[#333638] mb-1 truncate">{d.address?.split(',')[0]}</p>
                  <p className="text-xs text-[#767C80] mb-2">{d.county_name}, {d.state}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#767C80]">{fmt(d.all_in_cost)}</span>
                    <span className="text-green-600 font-semibold">+{fmt(d.projected_profit)}</span>
                  </div>
                  <div className="text-xs text-[#A0A5A8] mt-1">{Number(d.acreage).toFixed(1)} ac · {d.assigned_to}</div>
                </div>
              ))}
              {!colDeals.length && (
                <div className="text-center text-[#A0A5A8] text-xs py-6 border border-dashed border-surface-border rounded-lg">
                  No deals
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value, color = 'text-[#333638]' }) {
  return (
    <div className="stat-card">
      <p className="text-label">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-1 ${color}`}>{value}</p>
    </div>
  );
}
