import { Link } from 'react-router-dom';
import { Check, ArrowRight, Kanban, DollarSign, CalendarCheck, BarChart2, LineChart, Users } from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';

/* ─── Mock UIs ─── */
function PipelineMock() {
  const stages = [
    { label: 'Land Acq.', cards: ['47 Oak Ave', '112 Ridge Rd'], color: '#3b82f6' },
    { label: 'Due Diligence', cards: ['Swanson Rd', 'Marion Rd'], color: '#f59e0b' },
    { label: 'Development', cards: ['Elm Park Lot'], color: '#8b5cf6' },
    { label: 'Sales', cards: ['Cedar Cove'], color: '#10b981' },
  ];
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" /><span className="w-3 h-3 rounded-full bg-yellow-400/60" /><span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Deal Pipeline</span>
      </div>
      <div className="flex gap-3 p-4">
        {stages.map((s) => (
          <div key={s.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-xs font-semibold text-white/70 truncate">{s.label}</span>
            </div>
            <div className="space-y-1.5">
              {s.cards.map((c) => (
                <div key={c} className="rounded-lg px-2.5 py-2 text-xs text-white/80 font-medium" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>{c}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CapitalStackMock() {
  const rows = [
    { label: '1st Position Lender', pct: '60%', amount: '$540k', color: '#3b82f6' },
    { label: 'Committed Capital', pct: '25%', amount: '$225k', color: '#8b5cf6' },
    { label: 'Cash Investor', pct: '15%', amount: '$135k', color: '#10b981' },
  ];
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" /><span className="w-3 h-3 rounded-full bg-yellow-400/60" /><span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Capital Stack — Swanson Rd</span>
      </div>
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
          <span>Total raise</span><span className="text-white/80">$900,000</span>
        </div>
      </div>
    </div>
  );
}

function DrawScheduleMock() {
  const milestones = [
    { label: 'Foundation', pct: 20, amount: '$48k', status: 'paid', date: 'Feb 12' },
    { label: 'Framing', pct: 25, amount: '$60k', status: 'paid', date: 'Mar 18' },
    { label: 'Rough-in MEP', pct: 20, amount: '$48k', status: 'pending', date: 'Apr 30' },
    { label: 'Drywall', pct: 20, amount: '$48k', status: 'upcoming', date: 'Jun 15' },
    { label: 'Completion', pct: 15, amount: '$36k', status: 'upcoming', date: 'Aug 1' },
  ];
  const statusStyle = (s) =>
    s === 'paid' ? { bg: 'rgba(16,185,129,0.15)', color: '#34d399' }
    : s === 'pending' ? { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' }
    : { bg: 'rgba(255,255,255,0.06)', color: '#6b7280' };

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" /><span className="w-3 h-3 rounded-full bg-yellow-400/60" /><span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Draw Schedule — Marion Rd</span>
      </div>
      <div className="p-4 space-y-2">
        {milestones.map((m) => {
          const s = statusStyle(m.status);
          return (
            <div key={m.label} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-medium text-white/70 w-28">{m.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full bg-accent/60" style={{ width: `${m.pct * 4}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-xs text-white/40">{m.date}</span>
                <span className="text-xs font-semibold" style={{ color: s.color }}>{m.amount}</span>
                <span className="text-xs px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: s.bg, color: s.color }}>{m.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InvestorPortalMock() {
  const deals = [
    { name: 'Swanson Rd', status: 'Active', committed: '$150k', return: '12%' },
    { name: 'Marion Rd', status: 'Funded', committed: '$75k', return: '16%' },
    { name: 'Cedar Cove', status: 'Closing', committed: '$200k', return: '10%' },
  ];
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" /><span className="w-3 h-3 rounded-full bg-yellow-400/60" /><span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Investor Portal</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[{ label: 'Committed', val: '$425k' }, { label: 'Distributions', val: '$48k' }, { label: 'Avg Return', val: '12.7%' }].map((m) => (
            <div key={m.label} className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="text-sm font-bold text-white/90">{m.val}</div>
              <div className="text-xs text-white/35 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {deals.map((d) => (
            <div key={d.name} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="text-xs font-medium text-white/75">{d.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/50">{d.committed}</span>
                <span className="text-xs font-semibold text-green-400">{d.return}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketResearchMock() {
  const counties = [
    { name: 'Paulding', deals: 8, heat: 90, color: '#c8613a' },
    { name: 'Cherokee', deals: 6, heat: 72, color: '#e07a5f' },
    { name: 'Bartow', deals: 4, heat: 55, color: '#3d405b' },
    { name: 'Pickens', deals: 2, heat: 30, color: '#2a3147' },
    { name: 'Gordon', deals: 1, heat: 18, color: '#1e2639' },
  ];
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" /><span className="w-3 h-3 rounded-full bg-yellow-400/60" /><span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Market Intelligence</span>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-xs text-white/40 mb-3">Deal activity by county</div>
        {counties.map((c) => (
          <div key={c.name} className="flex items-center gap-3">
            <span className="text-xs text-white/60 w-20">{c.name}</span>
            <div className="flex-1 h-5 rounded-md overflow-hidden bg-white/5">
              <div className="h-full rounded-md flex items-center px-2" style={{ width: `${c.heat}%`, background: c.color }}>
                <span className="text-xs text-white/80 font-medium">{c.deals} deals</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PnlMock() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const revenue = [85, 120, 95, 160, 140, 195];
  const max = 200;
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#1a2332' }}>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" /><span className="w-3 h-3 rounded-full bg-yellow-400/60" /><span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">P&L Dashboard</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[{ label: 'Revenue', val: '$795k' }, { label: 'Expenses', val: '$312k' }, { label: 'Net', val: '$483k' }].map((m) => (
            <div key={m.label} className="rounded-lg px-2.5 py-2 text-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="text-sm font-bold text-white/90">{m.val}</div>
              <div className="text-xs text-white/35 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        {/* Simple bar chart */}
        <div className="flex items-end gap-2 h-20">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm"
                style={{ height: `${(revenue[i] / max) * 64}px`, background: i === 5 ? '#c8613a' : 'rgba(200,97,58,0.4)' }}
              />
              <span className="text-xs text-white/30">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature data ─── */
const FEATURES = [
  {
    icon: Kanban,
    title: "Deal Pipeline",
    subtitle: "Your entire acquisition process, visualized",
    body: "Move deals through Land Acquisition, Due Diligence, Development, and Sales with a Kanban board built for land investors. See every deal at every stage, filter by status or assignee, and drill into any deal in seconds.",
    bullets: ["Drag-and-drop Kanban board", "Multiple pipeline stages", "Deal detail pages with photos & docs", "Archived deal history", "Search and filter by any field"],
    Mock: PipelineMock,
  },
  {
    icon: DollarSign,
    title: "Capital Stack",
    subtitle: "Structure your investor financing with precision",
    body: "Build financing scenarios with first and second position lenders, committed capital partners, and cash investors. See real-time equity splits, coverage ratios, and commitment summaries — before you sign anything.",
    bullets: ["Multiple financing scenarios per deal", "1st & 2nd position tracking", "Investor commitment summaries", "Coverage ratio calculations", "Equity split modeling"],
    Mock: CapitalStackMock,
  },
  {
    icon: CalendarCheck,
    title: "Draw Schedules",
    subtitle: "Track every draw from foundation to finish",
    body: "Manage construction draws with milestone-based scheduling. Mark draws as pending, paid, or upcoming, track amounts, and see the full draw history for any deal at a glance.",
    bullets: ["Milestone-based draw scheduling", "Paid / pending / upcoming statuses", "Draw amount tracking", "Per-deal draw history", "Automatic totals and summaries"],
    Mock: DrawScheduleMock,
  },
  {
    icon: Users,
    title: "Investor Portal",
    subtitle: "Give investors the transparency they expect",
    body: "Every investor gets their own portal view with deal updates, distribution history, and document access. You control visibility on a per-deal basis — investors gain the confidence to commit capital.",
    bullets: ["Investor-facing deal dashboards", "Distribution history tracking", "Secure document sharing", "Real-time deal status updates", "Role-based access control"],
    Mock: InvestorPortalMock,
  },
  {
    icon: BarChart2,
    title: "Market Intelligence",
    subtitle: "Make offers grounded in real data",
    body: "County-level deal heat maps show where your acquisition activity is concentrated. Pair with the ARV database and built-in deal calculator to ensure every offer is backed by comparable data.",
    bullets: ["County heat map visualization", "ARV comparable database", "Built-in deal calculator", "Flood map overlay", "Contractor & builder network"],
    Mock: MarketResearchMock,
  },
  {
    icon: LineChart,
    title: "P&L Dashboard",
    subtitle: "See the full financial picture",
    body: "Track revenue, expenses, and net returns across your entire portfolio. The P&L dashboard rolls up deal-level financials so you always know where your business stands.",
    bullets: ["Portfolio-wide P&L view", "Revenue vs expense tracking", "Monthly trend charts", "Per-deal profitability", "Export-ready financials"],
    Mock: PnlMock,
  },
];

/* ─── Page hero ─── */
function PageHero() {
  return (
    <section className="pt-32 pb-16 text-center" style={{ background: '#1a2332' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">Features</span>
        <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">
          Built for every stage of the deal
        </h1>
        <p className="text-lg text-white/55 max-w-xl mx-auto">
          Six purpose-built modules that work together to move land deals from first contact to final close.
        </p>
      </div>
    </section>
  );
}

/* ─── Page ─── */
export default function Features() {
  return (
    <MarketingLayout>
      <PageHero />

      <div>
        {FEATURES.map((f, i) => {
          const isEven = i % 2 === 0;
          const Icon = f.icon;
          return (
            <div key={f.title} className={`py-20 ${isEven ? 'bg-white' : 'bg-cream'}`}>
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`grid md:grid-cols-2 gap-12 items-center ${isEven ? '' : 'md:[direction:rtl]'}`}>
                  <div className={isEven ? '' : 'md:[direction:ltr]'}>
                    <f.Mock />
                  </div>
                  <div className={isEven ? '' : 'md:[direction:ltr]'}>
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                      <Icon size={20} className="text-accent" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-accent">{f.title}</span>
                    <h2 className="text-2xl md:text-3xl font-bold text-sidebar mt-2 mb-4">{f.subtitle}</h2>
                    <p className="text-gray-500 leading-relaxed mb-6">{f.body}</p>
                    <ul className="space-y-2.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <Check size={11} className="text-accent" strokeWidth={3} />
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

      {/* CTA band */}
      <section className="py-20" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to see it in action?</h2>
          <p className="text-white/50 mb-8">Start your 14-day free trial — no credit card required.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors">
            Start free trial <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
