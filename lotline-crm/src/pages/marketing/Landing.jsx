import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Kanban,
  DollarSign,
  CalendarCheck,
  BarChart2,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';
import { marketing } from '../../content/marketing';

/* ─── Icon resolver ─── */
const ICON_MAP = { Kanban, DollarSign, CalendarCheck, BarChart2 };
function Icon({ name, ...props }) {
  const C = ICON_MAP[name] ?? Kanban;
  return <C {...props} />;
}

/* ─── Mock CRM screens (used until real screenshots are ready) ─── */
function PipelineMock() {
  const stages = [
    { label: 'Land Acq.', cards: ['47 Oak Ave', '112 Ridge Rd'], color: '#3b82f6' },
    { label: 'Due Diligence', cards: ['Swanson Rd', 'Marion Rd'], color: '#f59e0b' },
    { label: 'Development', cards: ['Elm Park Lot'], color: '#8b5cf6' },
    { label: 'Sales', cards: ['Cedar Cove'], color: '#10b981' },
  ];
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      style={{ background: '#1a2332' }}
    >
      {/* Fake top bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
        <span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Deal Pipeline</span>
      </div>
      <div className="flex gap-3 p-4 overflow-hidden">
        {stages.map((s) => (
          <div key={s.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-xs font-semibold text-white/70 truncate">{s.label}</span>
            </div>
            <div className="space-y-1.5">
              {s.cards.map((c) => (
                <div
                  key={c}
                  className="rounded-lg px-2.5 py-2 text-xs text-white/80 font-medium"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {c}
                </div>
              ))}
              <div
                className="rounded-lg px-2.5 py-1.5 text-xs text-white/25 border-dashed"
                style={{ border: '1px dashed rgba(255,255,255,0.12)' }}
              >
                + Add deal
              </div>
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
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      style={{ background: '#1a2332' }}
    >
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
        <span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Capital Stack</span>
      </div>
      <div className="p-4 space-y-3">
        {/* Bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          <div className="bg-blue-500" style={{ width: '60%' }} />
          <div className="bg-purple-500" style={{ width: '25%' }} />
          <div className="bg-green-500" style={{ width: '15%' }} />
        </div>
        {/* Rows */}
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded-lg px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
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
        <div
          className="rounded-lg px-3 py-2 text-xs font-semibold text-white/50 flex justify-between"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <span>Total raise</span>
          <span className="text-white/80">$900,000</span>
        </div>
      </div>
    </div>
  );
}

function InvestorPortalMock() {
  const deals = [
    { name: 'Swanson Rd', status: 'Active', position: '1st', committed: '$150k', return: '12%' },
    { name: 'Marion Rd', status: 'Funded', position: '2nd', committed: '$75k', return: '16%' },
    { name: 'Cedar Cove', status: 'Closing', position: '1st', committed: '$200k', return: '10%' },
  ];
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      style={{ background: '#1a2332' }}
    >
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-400/60" />
        <span className="w-3 h-3 rounded-full bg-yellow-400/60" />
        <span className="w-3 h-3 rounded-full bg-green-400/60" />
        <span className="ml-3 text-xs text-white/30 font-mono">Investor Portal</span>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Committed', val: '$425k' },
            { label: 'Distributions', val: '$48k' },
            { label: 'Avg Return', val: '12.7%' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-lg px-2.5 py-2 text-center"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <div className="text-sm font-bold text-white/90">{m.val}</div>
              <div className="text-xs text-white/35 mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {deals.map((d) => (
            <div
              key={d.name}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs font-medium text-white/75">{d.name}</span>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                  style={{
                    background:
                      d.status === 'Active'
                        ? 'rgba(16,185,129,0.15)'
                        : d.status === 'Funded'
                        ? 'rgba(59,130,246,0.15)'
                        : 'rgba(200,97,58,0.2)',
                    color:
                      d.status === 'Active' ? '#34d399' : d.status === 'Funded' ? '#60a5fa' : '#f97316',
                  }}
                >
                  {d.status}
                </span>
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

const MOCK_MAP = {
  0: PipelineMock,
  1: CapitalStackMock,
  2: InvestorPortalMock,
};

/* ─── Accordion item ─── */
function AccordionItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left gap-4"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-base font-semibold text-sidebar">{question}</span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-accent transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-5 -mt-1">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Section: Hero ─── */
function Hero() {
  const { hero } = marketing;
  return (
    <section className="relative overflow-hidden" style={{ background: '#1a2332' }}>
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Gradient blob */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle,#c8613a 0%,transparent 70%)' }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Land acquisition CRM
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
              {hero.headline.split('\n').map((line, i) => (
                <span key={i}>
                  {i === 0 ? line : <><br /><span className={i === 1 ? 'text-accent' : ''}>{line}</span></>}
                </span>
              ))}
            </h1>
            <p className="text-lg text-white/60 leading-relaxed mb-8 max-w-lg">{hero.subhead}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-6 py-3 rounded-xl hover:bg-accent/90 transition-colors"
              >
                {hero.cta1}
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/15 transition-colors"
              >
                Log in
              </Link>
            </div>
            {/* Metric badges */}
            <div className="flex flex-wrap gap-5 mt-10">
              {hero.metrics.map((m) => (
                <div key={m.label}>
                  <div className="text-2xl font-bold text-white">{m.value}</div>
                  <div className="text-xs text-white/45 mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: mock dashboard */}
          <div className="hidden md:block">
            <PipelineMock />
          </div>
        </div>

        {/* Trust strip */}
        <div className="border-t border-white/10 mt-16 pt-8 text-center">
          <p className="text-xs font-medium text-white/35 uppercase tracking-widest">{hero.trust}</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Advantages ─── */
function Advantages() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-sidebar mb-3">
            Everything your acquisition team needs
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Stop juggling spreadsheets, email chains, and disconnected tools. DealFlow Pro brings
            your whole pipeline into one purpose-built platform.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {marketing.advantages.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl p-6 border border-card hover:border-accent/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <Icon name={a.icon} size={20} className="text-accent" />
              </div>
              <h3 className="font-semibold text-sidebar mb-2">{a.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: How It Works ─── */
function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20" style={{ background: '#f5f3ee' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-sidebar mb-3">How it works</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Up and running in minutes. No consultant required.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {marketing.howItWorks.map((s, i) => (
            <div key={s.step} className="relative">
              {i < marketing.howItWorks.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gray-200 z-0" style={{ width: 'calc(100% - 24px)' }} />
              )}
              <div className="relative z-10">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-accent mb-4"
                  style={{ background: 'rgba(200,97,58,0.1)' }}
                >
                  {s.step}
                </div>
                <h3 className="font-semibold text-sidebar mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Feature deep-dives ─── */
function Features() {
  return (
    <section className="py-4 bg-white">
      {marketing.features.map((f, i) => {
        const MockUI = MOCK_MAP[i];
        const isEven = i % 2 === 0;
        return (
          <div
            key={f.title}
            className={`py-16 ${i % 2 !== 0 ? 'bg-cream' : 'bg-white'}`}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                className={`grid md:grid-cols-2 gap-12 items-center ${
                  isEven ? '' : 'md:[direction:rtl]'
                }`}
              >
                {/* Mock UI */}
                <div className={isEven ? '' : 'md:[direction:ltr]'}>
                  {MockUI && <MockUI />}
                </div>

                {/* Text */}
                <div className={isEven ? '' : 'md:[direction:ltr]'}>
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">
                    {f.title}
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold text-sidebar mt-2 mb-4">
                    {f.subtitle}
                  </h2>
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
    </section>
  );
}

/* ─── Section: Pricing preview ─── */
function PricingPreview() {
  return (
    <section className="py-20" style={{ background: '#1a2332' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-white/50 max-w-md mx-auto">
            Start free. Upgrade when you're ready. No long-term contracts.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {marketing.pricing.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-6 flex flex-col ${
                p.highlighted
                  ? 'bg-accent text-white ring-4 ring-accent/40'
                  : 'bg-white/8 text-white border border-white/10'
              }`}
              style={p.highlighted ? {} : { background: 'rgba(255,255,255,0.06)' }}
            >
              <div className="mb-1">
                <span className={`text-xs font-semibold uppercase tracking-widest ${p.highlighted ? 'text-white/70' : 'text-white/40'}`}>
                  {p.name}
                </span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-3xl font-bold">${p.monthlyPrice}</span>
                <span className={`text-sm mb-1 ${p.highlighted ? 'text-white/70' : 'text-white/40'}`}>/mo</span>
              </div>
              <p className={`text-xs mb-5 ${p.highlighted ? 'text-white/75' : 'text-white/40'}`}>{p.tagline}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((feat) => {
                  const label = typeof feat === 'string' ? feat : feat.text;
                  return (
                    <li key={label} className="flex items-center gap-2 text-sm">
                      <Check size={13} className={p.highlighted ? 'text-white/80' : 'text-accent'} strokeWidth={2.5} />
                      <span className={p.highlighted ? 'text-white/85' : 'text-white/60'}>{label}</span>
                    </li>
                  );
                })}
              </ul>
              <Link
                to={p.name === 'Scale' ? '/contact' : `/cart?plan=${p.name.toLowerCase()}`}
                className={`text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                  p.highlighted
                    ? 'bg-white text-accent hover:bg-white/95'
                    : 'bg-white/10 text-white hover:bg-white/15 border border-white/20'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
            See full feature comparison <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Testimonials ─── */
function Testimonials() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-sidebar mb-3">
            What land investors are saying
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {marketing.testimonials.map((t) => (
            <div
              key={t.author}
              className="rounded-2xl p-6 border border-card"
              style={{ background: '#f5f3ee' }}
            >
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#c8613a">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-5 italic">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-sidebar">{t.author}</div>
                  <div className="text-xs text-gray-400">{t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: FAQ ─── */
function FAQ() {
  return (
    <section className="py-20" style={{ background: '#f5f3ee' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-sidebar mb-3">Frequently asked questions</h2>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-card px-6">
          {marketing.faq.map((item) => (
            <AccordionItem key={item.question} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section: Final CTA ─── */
function FinalCTA() {
  return (
    <section className="py-24" style={{ background: '#1a2332' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Ready to close more deals?
        </h2>
        <p className="text-white/55 text-lg mb-10 max-w-lg mx-auto">
          Join land acquisition teams already using DealFlow Pro. Start your 14-day free trial —
          no credit card required.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 bg-accent text-white font-semibold px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors text-base"
          >
            Start free trial
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/15 transition-colors text-base border border-white/15"
          >
            Talk to sales
          </Link>
        </div>
        <p className="text-white/30 text-sm mt-6">
          14-day free trial · No credit card · Cancel anytime
        </p>
      </div>
    </section>
  );
}

/* ─── Page ─── */
export default function Landing() {
  return (
    <MarketingLayout>
      <Hero />
      <Advantages />
      <HowItWorks />
      <Features />
      <PricingPreview />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </MarketingLayout>
  );
}
