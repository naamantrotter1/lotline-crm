import React from 'react';

const fmt = (n) => n == null ? '–' : Number(n).toLocaleString();
const fmtPrice = (n) => n == null ? '–' : '$' + Math.round(n / 1000) + 'k';

export default function Navigation({ tabs, activeTab, onTabChange }) {
  return (
    <header className="flex-shrink-0 bg-surface-raised border-b border-surface-border">
      <div className="flex items-center gap-4 px-3 h-10">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold text-xs">L</div>
          <span className="font-bold text-[#333638] tracking-tight text-sm">LotLine Intelligence</span>
        </div>

        <div className="w-px h-5 bg-surface-border flex-shrink-0" />

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                activeTab === tab
                  ? 'bg-brand-500 text-white'
                  : 'text-[#767C80] hover:text-[#333638] hover:bg-surface-overlay'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Kpi({ label, value, color = 'text-[#333638]' }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-[#767C80] uppercase tracking-wide" style={{ fontSize: 10 }}>{label}</span>
    </div>
  );
}
