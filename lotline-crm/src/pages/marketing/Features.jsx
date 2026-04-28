import { Link } from 'react-router-dom';
import { Check, ArrowRight, Kanban, DollarSign, CalendarCheck, BarChart2, LineChart, Users, Map, FileText, Wrench, Bell, Activity, CreditCard, Building2, ClipboardList } from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';

/* ─── Shared chrome wrapper ─── */
function BrowserChrome({ title, children }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
        <span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Mock 1: Deal Pipeline (Kanban) ─── */
function PipelineMock() {
  const stages = [
    {
      label: 'Land Acq.', color: '#3b82f6',
      cards: [
        { name: 'Pleasantdale Rd', loc: 'Nichols, SC', price: '$42k' },
        { name: 'Brewer Springs Rd', loc: 'Camden, SC', price: '$38k' },
        { name: 'Manning', loc: 'Manning, SC', price: '$55k' },
      ],
    },
    {
      label: 'Due Diligence', color: '#f59e0b',
      cards: [
        { name: 'Erwin Temple Church', loc: 'Woodleaf, NC', price: '$67k' },
        { name: 'Crowder Creek Rd', loc: 'Gastonia, NC', price: '$74k' },
      ],
    },
    {
      label: 'Development', color: '#8b5cf6',
      cards: [
        { name: 'Grummen Rd', loc: 'Hope Mills, NC', price: '$89k' },
      ],
    },
    {
      label: 'Sales', color: '#10b981',
      cards: [
        { name: 'Blue Newkirk Rd', loc: 'Magnolia, NC', price: '$210k ARV' },
      ],
    },
  ];
  return (
    <BrowserChrome title="Deal Pipeline — Land Acquisition">
      <div className="flex gap-2 p-3 overflow-x-hidden">
        {stages.map((s) => (
          <div key={s.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-[10px] font-semibold text-white/60 truncate">{s.label}</span>
              <span className="ml-auto text-[9px] text-white/30">{s.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {s.cards.map((c) => (
                <div key={c.name} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-[11px] font-semibold text-white/85 leading-tight truncate">{c.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{c.loc}</div>
                  <div className="text-[10px] font-medium mt-1" style={{ color: s.color }}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 2: Deal Detail / Activity Feed ─── */
function DealDetailMock() {
  const notes = [
    { author: 'NT', name: 'Naaman T.', time: '2h ago', text: 'Perc test scheduled for Monday. Contractor confirmed.', color: '#c8613a' },
    { author: 'ZL', name: 'Zach L.', time: '1d ago', text: 'Land survey quote came in at $1,200. Approving.', color: '#3b82f6' },
    { author: 'NT', name: 'Naaman T.', time: '3d ago', text: 'Stage changed from Land Acq. to Due Diligence', color: '#c8613a', isStage: true },
  ];
  return (
    <BrowserChrome title="Blue Newkirk Rd — Deal Detail">
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[13px] font-bold text-white/90">Blue Newkirk Rd</div>
            <div className="text-[10px] text-white/40">Magnolia, NC 28453 · 2.4 acres</div>
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>Due Diligence</span>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-1.5">
          {[{ l: 'Purchase', v: '$42,000' }, { l: 'ARV', v: '$210,000' }, { l: 'All-In Est.', v: '$148,000' }].map(m => (
            <div key={m.l} className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[11px] font-bold text-white/85">{m.v}</div>
              <div className="text-[9px] text-white/35">{m.l}</div>
            </div>
          ))}
        </div>
        {/* Activity feed */}
        <div className="space-y-1.5 mt-1">
          <div className="text-[9px] font-semibold text-white/30 uppercase tracking-widest">Activity</div>
          {notes.map((n, i) => (
            <div key={i} className={`flex gap-2 rounded-lg px-2.5 py-2 ${n.isStage ? '' : ''}`} style={{ background: n.isStage ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.05)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 mt-0.5" style={{ background: n.color + '33', color: n.color }}>{n.author}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-white/70">{n.name}</span>
                  <span className="text-[9px] text-white/25">{n.time}</span>
                </div>
                <div className={`text-[10px] mt-0.5 leading-snug ${n.isStage ? 'text-purple-400/80' : 'text-white/55'}`}>{n.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 3: Due Diligence Pipeline ─── */
function DueDiligenceMock() {
  const deals = [
    {
      name: 'Erwin Temple Church Rd', county: 'Rowan Co., NC',
      milestones: [
        { label: 'Perc Tests', status: 'done', date: 'Apr 2' },
        { label: 'Land Survey', status: 'done', date: 'Apr 9' },
        { label: 'Env. Permits Submitted', status: 'active', date: 'Apr 22' },
        { label: 'Env. Permits Approved', status: 'pending', date: 'May 10' },
      ],
    },
    {
      name: 'Blue Newkirk Rd', county: 'Duplin Co., NC',
      milestones: [
        { label: 'Perc Tests', status: 'done', date: 'Mar 18' },
        { label: 'Land Survey', status: 'active', date: 'Apr 28' },
        { label: 'Env. Permits Submitted', status: 'pending', date: 'May 5' },
        { label: 'Env. Permits Approved', status: 'pending', date: 'Jun 1' },
      ],
    },
  ];
  const statusDot = (s) => s === 'done' ? '#10b981' : s === 'active' ? '#f59e0b' : '#374151';
  const statusBg = (s) => s === 'done' ? 'rgba(16,185,129,0.15)' : s === 'active' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)';
  const statusLabel = (s) => s === 'done' ? 'Done' : s === 'active' ? 'In Progress' : 'Pending';

  return (
    <BrowserChrome title="Due Diligence Pipeline">
      <div className="p-3 space-y-3">
        {deals.map((d) => (
          <div key={d.name} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[11px] font-semibold text-white/85">{d.name}</div>
                <div className="text-[9px] text-white/35">{d.county}</div>
              </div>
              <div className="text-[9px] text-white/40">{d.milestones.filter(m => m.status === 'done').length}/{d.milestones.length} done</div>
            </div>
            <div className="space-y-1">
              {d.milestones.map((m) => (
                <div key={m.label} className="flex items-center justify-between rounded-md px-2 py-1" style={{ background: statusBg(m.status) }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusDot(m.status) }} />
                    <span className="text-[10px] text-white/65">{m.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px]" style={{ color: statusDot(m.status) }}>{statusLabel(m.status)}</span>
                    <span className="text-[9px] text-white/30">{m.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 4: Development Pipeline ─── */
function DevelopmentMock() {
  const milestones = [
    { label: 'Land Closed', status: 'done', date: 'Feb 14', contractor: 'Wilson Title' },
    { label: 'Land Clearing', status: 'done', date: 'Mar 3', contractor: 'Anderson Land Svcs' },
    { label: 'Building Permits', status: 'done', date: 'Mar 21', contractor: 'Harnett Co. Permits' },
    { label: 'Home Ordered', status: 'done', date: 'Mar 28', contractor: 'Clayton Homes' },
    { label: 'Septic Install', status: 'active', date: 'Apr 30', contractor: 'Cape Fear Septic' },
    { label: 'Well Install', status: 'pending', date: 'May 12', contractor: 'Grady Well Drilling' },
    { label: 'Power Connection', status: 'pending', date: 'May 20', contractor: 'Duke Energy' },
    { label: 'Home Delivered & Set Up', status: 'pending', date: 'Jun 8', contractor: 'Clayton Homes' },
    { label: 'CO Received', status: 'pending', date: 'Jun 25', contractor: '' },
  ];
  const dot = (s) => s === 'done' ? '#10b981' : s === 'active' ? '#f59e0b' : '#374151';
  return (
    <BrowserChrome title="Grummen Rd — Development Pipeline">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[11px] font-bold text-white/85">204 Grummen Rd</div>
            <div className="text-[9px] text-white/35">Hope Mills, NC · Development</div>
          </div>
          <span className="text-[9px] font-semibold" style={{ color: '#f59e0b' }}>4/9 Complete</span>
        </div>
        <div className="space-y-1">
          {milestones.map((m) => (
            <div key={m.label} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: m.status === 'active' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)' }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot(m.status) }} />
              <span className="text-[10px] text-white/70 flex-1 truncate">{m.label}</span>
              {m.contractor && <span className="text-[9px] text-white/25 hidden sm:block truncate max-w-[80px]">{m.contractor}</span>}
              <span className="text-[9px] text-white/35 flex-shrink-0">{m.date}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 5: Cost Breakdown ─── */
function CostBreakdownMock() {
  const rows = [
    { cat: 'Land Purchase', est: '$42,000', act: '$42,000', status: 'paid' },
    { cat: 'Land Clearing', est: '$8,500', act: '$8,200', status: 'paid' },
    { cat: 'Building Permits', est: '$3,200', act: '$3,400', status: 'paid' },
    { cat: 'Home (Clayton)', est: '$85,000', act: '$85,000', status: 'paid' },
    { cat: 'Septic Install', est: '$12,000', act: null, status: 'pending' },
    { cat: 'Well Drilling', est: '$9,500', act: null, status: 'pending' },
    { cat: 'Electrical / Power', est: '$4,200', act: null, status: 'pending' },
    { cat: 'Home Setup & Delivery', est: '$6,800', act: null, status: 'pending' },
  ];
  return (
    <BrowserChrome title="Blue Newkirk Rd — Cost Breakdown">
      <div className="p-3">
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[{ l: 'All-In Est.', v: '$171,200', c: '#c8613a' }, { l: 'Spent', v: '$138,600', c: '#10b981' }, { l: 'Remaining', v: '$32,600', c: '#f59e0b' }].map(m => (
            <div key={m.l} className="rounded-lg py-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="text-[12px] font-bold" style={{ color: m.c }}>{m.v}</div>
              <div className="text-[9px] text-white/35 mt-0.5">{m.l}</div>
            </div>
          ))}
        </div>
        <div className="space-y-0.5">
          <div className="grid grid-cols-3 gap-2 px-2 pb-1">
            <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">Category</span>
            <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider text-right">Estimated</span>
            <span className="text-[9px] text-white/30 font-semibold uppercase tracking-wider text-right">Actual</span>
          </div>
          {rows.map((r) => (
            <div key={r.cat} className="grid grid-cols-3 gap-2 rounded-md px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="text-[10px] text-white/65 truncate">{r.cat}</span>
              <span className="text-[10px] text-white/50 text-right">{r.est}</span>
              <span className="text-[10px] text-right font-medium" style={{ color: r.act ? '#10b981' : '#6b7280' }}>{r.act || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 6: Capital Stack ─── */
function CapitalStackMock() {
  const rows = [
    { label: '1st Position Lender', pct: '60%', amount: '$102k', color: '#3b82f6' },
    { label: 'Committed Capital', pct: '25%', amount: '$42k', color: '#8b5cf6' },
    { label: 'Cash Investor', pct: '15%', amount: '$25k', color: '#10b981' },
  ];
  return (
    <BrowserChrome title="Blue Newkirk Rd — Capital Stack">
      <div className="p-4 space-y-3">
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          <div className="bg-blue-500" style={{ width: '60%' }} />
          <div className="bg-purple-500" style={{ width: '25%' }} />
          <div className="bg-green-500" style={{ width: '15%' }} />
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              <span className="text-xs text-white/70">{r.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/40">{r.pct}</span>
              <span className="text-xs font-semibold text-white/80">{r.amount}</span>
            </div>
          </div>
        ))}
        <div className="rounded-lg px-3 py-2 text-xs font-semibold text-white/50 flex justify-between" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <span>Total raise</span><span className="text-white/80">$169,000</span>
        </div>
        <div className="rounded-lg px-3 py-2 text-xs flex justify-between" style={{ background: 'rgba(16,185,129,0.08)' }}>
          <span className="text-white/40">LTV Coverage</span><span className="font-semibold" style={{ color: '#10b981' }}>80.5% · Healthy</span>
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 7: P&L Dashboard ─── */
function PnlMock() {
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const revenue = [48, 0, 95, 210, 87, 175];
  const expenses = [32, 18, 61, 88, 54, 103];
  const max = 220;
  return (
    <BrowserChrome title="P&L Dashboard — Portfolio View">
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[{ label: 'Revenue YTD', val: '$567k', c: '#10b981' }, { label: 'Expenses YTD', val: '$354k', c: '#f87171' }, { label: 'Net Profit', val: '$213k', c: '#c8613a' }].map((m) => (
            <div key={m.label} className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="text-sm font-bold" style={{ color: m.c }}>{m.val}</div>
              <div className="text-xs text-white/35 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1.5 h-24 mb-1">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: 80 }}>
                <div className="w-full rounded-t-sm" style={{ height: `${(expenses[i] / max) * 80}px`, background: 'rgba(248,113,113,0.5)' }} />
                <div className="w-full rounded-t-sm" style={{ height: `${Math.max(0, (revenue[i] - expenses[i]) / max * 80)}px`, background: '#c8613a' }} />
              </div>
              <span className="text-[9px] text-white/30">{m}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: '#c8613a' }}/><span className="text-[9px] text-white/40">Net</span></div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(248,113,113,0.5)' }}/><span className="text-[9px] text-white/40">Expenses</span></div>
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 8: Map View ─── */
function MapMock() {
  const pins = [
    { x: 48, y: 28, label: 'Woodleaf', status: 'dd', color: '#f59e0b' },
    { x: 31, y: 45, label: 'Gastonia', status: 'dd', color: '#f59e0b' },
    { x: 62, y: 72, label: 'Hope Mills', status: 'dev', color: '#8b5cf6' },
    { x: 78, y: 52, label: 'Magnolia', status: 'sales', color: '#10b981' },
    { x: 55, y: 88, label: 'Nichols', status: 'lead', color: '#3b82f6' },
    { x: 72, y: 80, label: 'Manning', status: 'lead', color: '#3b82f6' },
    { x: 85, y: 68, label: 'Camden', status: 'lead', color: '#3b82f6' },
    { x: 40, y: 62, label: 'Grummen Rd', status: 'dev', color: '#8b5cf6' },
  ];
  return (
    <BrowserChrome title="Deal Map — NC / SC Active Deals">
      <div className="p-3">
        {/* Map area */}
        <div className="relative rounded-xl overflow-hidden" style={{ height: 180, background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #172035 100%)' }}>
          {/* Grid lines */}
          {[20, 40, 60, 80].map(p => (
            <div key={p} className="absolute inset-y-0 border-l border-white/5" style={{ left: `${p}%` }} />
          ))}
          {[25, 50, 75].map(p => (
            <div key={p} className="absolute inset-x-0 border-t border-white/5" style={{ top: `${p}%` }} />
          ))}
          {/* County labels */}
          <div className="absolute text-[8px] text-white/15 font-medium" style={{ left: '20%', top: '10%' }}>Rowan Co.</div>
          <div className="absolute text-[8px] text-white/15 font-medium" style={{ left: '55%', top: '38%' }}>Duplin Co.</div>
          <div className="absolute text-[8px] text-white/15 font-medium" style={{ left: '38%', top: '72%' }}>Cumberland</div>
          {/* Pins */}
          {pins.map((p) => (
            <div key={p.label} className="absolute flex flex-col items-center" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}>
              <div className="w-3 h-3 rounded-full border-2 border-white/60 shadow-lg" style={{ background: p.color }} />
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {[{ c: '#3b82f6', l: 'Land Acq.' }, { c: '#f59e0b', l: 'Due Diligence' }, { c: '#8b5cf6', l: 'Development' }, { c: '#10b981', l: 'Sales' }].map(s => (
            <div key={s.l} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: s.c }} />
              <span className="text-[9px] text-white/45">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Mock 9: Calendar ─── */
function CalendarMock() {
  const events = [
    { day: 28, title: 'Perc Tests — Erwin Temple', type: 'milestone', color: '#3b82f6' },
    { day: 29, title: 'Septic Install — Grummen Rd', type: 'task', color: '#f59e0b' },
    { day: 30, title: 'Land Survey — Blue Newkirk', type: 'milestone', color: '#3b82f6' },
    { day: 1, title: 'Building Permits Due', type: 'deadline', color: '#ef4444' },
    { day: 2, title: 'Home Delivery — Grummen Rd', type: 'milestone', color: '#10b981' },
    { day: 5, title: 'Investor Update Call', type: 'event', color: '#8b5cf6' },
    { day: 8, title: 'CO Inspection — Manning', type: 'task', color: '#f59e0b' },
  ];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const grid = Array.from({ length: 35 }, (_, i) => i - 6);

  return (
    <BrowserChrome title="Organization Calendar — April / May 2026">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-white/70">April 2026</span>
          <div className="flex gap-2">
            {[{ c: '#3b82f6', l: 'Milestone' }, { c: '#f59e0b', l: 'Task' }, { c: '#8b5cf6', l: 'Event' }].map(s => (
              <div key={s.l} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }} />
                <span className="text-[8px] text-white/30">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {days.map(d => <div key={d} className="text-center text-[8px] text-white/25 pb-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 35 }, (_, i) => {
            const day = i - 5;
            const evts = events.filter(e => e.day === day);
            return (
              <div key={i} className="rounded-md p-0.5 min-h-[32px]" style={{ background: day > 0 && day <= 30 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                {day > 0 && day <= 30 && (
                  <>
                    <div className={`text-[8px] mb-0.5 text-right pr-0.5 ${[28, 29, 30].includes(day) ? 'font-bold text-white/80' : 'text-white/30'}`}>{day}</div>
                    {evts.map((e, ei) => (
                      <div key={ei} className="text-[7px] truncate rounded px-0.5 py-px mb-px leading-tight" style={{ background: e.color + '33', color: e.color }}>{e.title.split('—')[0].trim()}</div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* ─── Feature data — 9 sections ─── */
const FEATURES = [
  {
    icon: Kanban,
    label: 'DEAL PIPELINE',
    subtitle: 'Your entire land deal portfolio, at a glance',
    body: 'Move deals through Land Acquisition, Due Diligence, Development, and Sales with a Kanban board purpose-built for land investors in the Southeast. See every active deal, filter by owner or county, and drill into any property in one click.',
    bullets: [
      '4 pipeline stages: Land Acq. → Due Diligence → Development → Sales',
      'Drag-and-drop deal cards between stages',
      'Filter by deal owner, county, or status',
      'Instant deal detail on click',
    ],
    Mock: PipelineMock,
  },
  {
    icon: Activity,
    label: 'DEAL COMMAND CENTER',
    subtitle: 'Everything about a deal, in one place',
    body: 'Each property gets a full command center — activity feed with threaded notes, team mentions, auto-logged stage changes, document storage, e-sign envelopes, contacts, tasks, and a full cost breakdown. Every update is attributed to the team member who made it and visible to everyone in real time.',
    bullets: [
      'Activity feed with threaded notes & replies',
      'Auto-logged stage changes in activity history',
      'Notes attributed to the team member who posted them',
      'Documents, e-sign envelopes, and photos per deal',
      'Real-time updates — no refresh needed',
    ],
    Mock: DealDetailMock,
  },
  {
    icon: ClipboardList,
    label: 'DUE DILIGENCE',
    subtitle: 'Never miss a step from contract to close',
    body: 'Track every due diligence milestone — perc tests, land surveys, environmental permits, and county approvals — in a checklist pipeline tied directly to each deal. Assign the right contractor type for each stage and know exactly where every property stands.',
    bullets: [
      'Perc tests, surveys, permits tracked per deal',
      'Contractor type assigned per milestone stage',
      'Important dates auto-linked to deal calendar',
      'Stage completion logged in activity feed automatically',
    ],
    Mock: DueDiligenceMock,
  },
  {
    icon: Building2,
    label: 'DEVELOPMENT',
    subtitle: 'From land close to home delivery, tracked',
    body: 'Manage land clearing, building permits, septic, well, power, home setup, and CO — all in one development checklist. Each milestone is tied to a scheduled date, a contractor contact, and the deal\'s activity history so nothing slips through.',
    bullets: [
      'Home ordering, clearing, permits, installs — all tracked',
      'Scheduled dates linked to deal calendar',
      'Contractor assignments per milestone',
      'CO and delivery tracked to project complete',
    ],
    Mock: DevelopmentMock,
  },
  {
    icon: DollarSign,
    label: 'DEAL FINANCIALS',
    subtitle: 'Know your numbers before you commit',
    body: 'Model every cost from land purchase to home delivery with a built-in deal calculator. The cost breakdown tab shows estimated vs. actual spend in real time, so you always know your all-in, ARV, and net profit — and can catch overruns before they happen.',
    bullets: [
      'All-In, ARV, and Net Profit on every deal',
      'Estimated vs. actual cost tracking by category',
      'Built-in deal calculator for new acquisitions',
      'Cost breakdown: land, permits, construction, and more',
    ],
    Mock: CostBreakdownMock,
  },
  {
    icon: CreditCard,
    label: 'CAPITAL & INVESTORS',
    subtitle: 'Structure your raise. Give investors visibility.',
    body: 'Build financing scenarios with 1st position lenders, committed capital partners, and cash investors. Every investor gets their own portal view with deal updates, distribution history, and document access — so they stay informed and confident committing capital.',
    bullets: [
      '1st & 2nd position lender tracking',
      'Committed capital and cash investor splits',
      'Investor-facing portal with deal dashboards',
      'Distribution history and document sharing',
      'Coverage ratio and equity split modeling',
    ],
    Mock: CapitalStackMock,
  },
  {
    icon: LineChart,
    label: 'P&L & ANALYTICS',
    subtitle: 'See the full financial picture across every deal',
    body: 'The P&L dashboard rolls up revenue, expenses, and net returns across your entire portfolio by month. Analytics tracks deal velocity, stage conversion rates, and county performance — so you can make better decisions on where to buy next and how fast deals move.',
    bullets: [
      'Portfolio-wide revenue, expenses, net — monthly view',
      'Deal-level profitability per property',
      'Stage conversion and velocity metrics',
      'County-level deal performance breakdown',
    ],
    Mock: PnlMock,
  },
  {
    icon: Map,
    label: 'MARKET INTELLIGENCE',
    subtitle: 'Make offers backed by real county data',
    body: 'Every deal is pinned on an interactive map showing all active and closed properties. The market research tool surfaces county-level deal activity, flood zone overlays, and ARV comparable data — so every offer you make is grounded in facts, not guesses.',
    bullets: [
      'Interactive map with all active deals pinned',
      'County deal heat map and activity data',
      'Flood zone overlay per property',
      'ARV comparable database',
      'Contractor & builder network by county',
    ],
    Mock: MapMock,
  },
  {
    icon: CalendarCheck,
    label: 'TEAM & OPERATIONS',
    subtitle: 'Every date, contact, and contractor — organized',
    body: 'The organization-wide calendar shows every milestone, task, and event across all deals so nothing gets missed. The contacts system tracks sellers, attorneys, and investors. The contractor database stores every vendor by trade so the right crew is always one click away.',
    bullets: [
      'Deal calendar with milestones, tasks, and events',
      'Auto-populated from deal pipeline changes',
      'Contacts organized by role (seller, attorney, investor)',
      'Contractor database by trade type',
      'Team task assignment and tracking',
    ],
    Mock: CalendarMock,
  },
];

/* ─── Module grid tiles ─── */
const MODULE_TILES = [
  { label: 'Deal Pipeline',          icon: Kanban },
  { label: 'Due Diligence',         icon: ClipboardList },
  { label: 'Development Pipeline',  icon: Building2 },
  { label: 'Deal Calculator',       icon: DollarSign },
  { label: 'Cost Breakdown',        icon: BarChart2 },
  { label: 'P&L Dashboard',         icon: LineChart },
  { label: 'Capital Stack',         icon: CreditCard },
  { label: 'Investor Portal',       icon: Users },
  { label: 'Activity Feed',         icon: Activity },
  { label: 'Notes & Threads',       icon: FileText },
  { label: 'Contractor Database',   icon: Wrench },
  { label: 'Calendar & Events',     icon: CalendarCheck },
  { label: 'Map View',              icon: Map },
  { label: 'Market Research',       icon: BarChart2 },
  { label: 'E-Sign & Documents',    icon: Bell },
];

/* ─── Hero ─── */
function PageHero() {
  return (
    <section className="pt-32 pb-16 text-center" style={{ background: '#0F1117' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#E8642A' }}>Features</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">
          Built for every stage of the deal
        </h1>
        <p className="text-lg text-white/55 max-w-2xl mx-auto">
          One platform that takes your land deals from contract signed to home sold — pipeline, due diligence, development, financials, investors, and team, all connected and always in sync.
        </p>
      </div>
    </section>
  );
}

/* ─── Module grid ─── */
function ModuleGrid() {
  return (
    <section className="py-12 border-b border-gray-100" style={{ background: '#F5F3EF' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-6">Everything included</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {MODULE_TILES.map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-2 rounded-xl py-3 px-2 bg-white border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all text-center">
              <Icon size={16} className="text-gray-400" />
              <span className="text-[11px] font-medium text-gray-600 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─── */
export default function Features() {
  return (
    <MarketingLayout>
      <PageHero />
      <ModuleGrid />

      <div>
        {FEATURES.map((f, i) => {
          const isEven = i % 2 === 0;
          const Icon = f.icon;
          return (
            <div key={f.label} className={`py-20 ${isEven ? 'bg-white' : ''}`} style={isEven ? {} : { background: '#F5F3EF' }}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`grid md:grid-cols-2 gap-12 items-center ${isEven ? '' : 'md:[direction:rtl]'}`}>
                  {/* Screenshot / mock */}
                  <div className={isEven ? '' : 'md:[direction:ltr]'}>
                    <f.Mock />
                  </div>
                  {/* Copy */}
                  <div className={isEven ? '' : 'md:[direction:ltr]'}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(232,100,42,0.1)' }}>
                      <Icon size={20} style={{ color: '#E8642A' }} />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#E8642A' }}>{f.label}</span>
                    <h2 className="text-2xl md:text-3xl font-bold mt-2 mb-4" style={{ color: '#0F1117' }}>{f.subtitle}</h2>
                    <p className="text-gray-500 leading-relaxed mb-6">{f.body}</p>
                    <ul className="space-y-2.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(232,100,42,0.1)' }}>
                            <Check size={11} style={{ color: '#E8642A' }} strokeWidth={3} />
                          </span>
                          <span className="text-sm text-gray-600">{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <section className="py-20" style={{ background: '#0F1117' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to see it in action?</h2>
          <p className="text-white/50 mb-8">Start your free trial — no credit card required.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-xl hover:opacity-90 transition-opacity" style={{ background: '#E8642A', color: 'white' }}>
            Start free trial <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
