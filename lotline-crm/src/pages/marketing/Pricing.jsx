import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus, ArrowRight } from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';
import { marketing } from '../../content/marketing';

/* ─── Comparison table data ─── */
const TABLE_SECTIONS = [
  {
    heading: 'Deals & Pipeline',
    rows: [
      { label: 'Active deals',          starter: '10',         pro: 'Unlimited',    scale: 'Unlimited' },
      { label: 'Deal pipeline (Kanban)',  starter: true,        pro: true,           scale: true },
      { label: 'Deal detail pages',      starter: true,        pro: true,           scale: true },
      { label: 'Archived deal history',  starter: true,        pro: true,           scale: true },
      { label: 'Custom pipeline stages', starter: false,       pro: false,          scale: true },
    ],
  },
  {
    heading: 'Capital & Investors',
    rows: [
      { label: 'Capital stack builder',  starter: 'Basic',     pro: 'Full',         scale: 'Full' },
      { label: 'Investor portal',        starter: false,       pro: true,           scale: true },
      { label: 'Draw schedules',         starter: false,       pro: true,           scale: true },
      { label: 'Distribution tracking',  starter: false,       pro: true,           scale: true },
      { label: 'White-label investor portal', starter: false,  pro: false,          scale: true },
    ],
  },
  {
    heading: 'Intelligence & Tools',
    rows: [
      { label: 'Market research heat map', starter: false,    pro: true,           scale: true },
      { label: 'ARV comparable database', starter: false,     pro: true,           scale: true },
      { label: 'Deal calculator',         starter: true,      pro: true,           scale: true },
      { label: 'Flood map overlay',       starter: true,      pro: true,           scale: true },
      { label: 'P&L dashboard',           starter: false,     pro: true,           scale: true },
    ],
  },
  {
    heading: 'Team & Access',
    rows: [
      { label: 'User seats',             starter: '1',        pro: '5',            scale: 'Unlimited' },
      { label: 'Role-based permissions', starter: false,      pro: true,           scale: true },
      { label: 'API access',             starter: false,      pro: false,          scale: true },
    ],
  },
  {
    heading: 'Support',
    rows: [
      { label: 'Support type',           starter: 'Email',    pro: 'Priority',     scale: 'Dedicated' },
      { label: 'Onboarding assistance',  starter: false,      pro: true,           scale: 'Dedicated' },
    ],
  },
];

const ANNUAL_DISCOUNT = 0.83; // ~2 months free

function annualPrice(monthly) {
  return Math.round(monthly * ANNUAL_DISCOUNT);
}

/* ─── Cell renderer ─── */
function Cell({ value }) {
  if (value === true)  return <Check size={17} className="text-accent mx-auto" strokeWidth={2.5} />;
  if (value === false) return <Minus size={14} className="text-gray-300 mx-auto" />;
  return <span className="text-sm text-gray-700 font-medium">{value}</span>;
}

/* ─── Billing FAQ ─── */
const BILLING_FAQ = [
  { q: 'When does my trial start?', a: 'Your 14-day trial starts immediately when you create your account. No credit card needed to begin.' },
  { q: 'Can I switch plans later?', a: 'Yes — upgrade or downgrade anytime. Changes take effect at the start of your next billing cycle.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex, Discover). Annual plans can be invoiced.' },
  { q: 'Is there a setup fee?', a: 'No setup fees, ever. You only pay the monthly or annual plan price.' },
  { q: 'Do you offer discounts for nonprofits or small teams?', a: 'Contact us at support@lotlinehomes.com and we\'ll work something out.' },
];

function BillingFAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button className="w-full flex items-center justify-between py-4 text-left gap-4" onClick={() => setOpen(v => !v)}>
        <span className="text-sm font-semibold text-sidebar">{q}</span>
        <span className={`text-accent text-lg font-light flex-shrink-0 transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="pb-4 -mt-1 text-sm text-gray-500 leading-relaxed">{a}</p>}
    </div>
  );
}

/* ─── Page ─── */
export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-16 text-center" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Pricing</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-white/55 mb-8">Start free. Upgrade when you're ready. No long-term contracts.</p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-white/10 rounded-xl p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${!annual ? 'bg-white text-sidebar' : 'text-white/60 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${annual ? 'bg-white text-sidebar' : 'text-white/60 hover:text-white'}`}
            >
              Annual
              <span className="text-xs font-bold text-accent bg-accent/20 px-1.5 py-0.5 rounded">Save 17%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="py-16 bg-cream">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-6">
            {marketing.pricing.map((p) => {
              const displayPrice = annual ? annualPrice(p.monthlyPrice) : p.monthlyPrice;
              return (
                <div
                  key={p.name}
                  className={`rounded-2xl p-7 flex flex-col ${
                    p.highlighted
                      ? 'bg-sidebar text-white ring-2 ring-accent shadow-xl'
                      : 'bg-white border border-card shadow-sm'
                  }`}
                >
                  {p.highlighted && (
                    <div className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/15 px-2.5 py-1 rounded-full self-start mb-3">
                      Most popular
                    </div>
                  )}
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: p.highlighted ? 'rgba(255,255,255,0.45)' : '#6b7280' }}>
                    {p.name}
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-4xl font-bold ${p.highlighted ? 'text-white' : 'text-sidebar'}`}>${displayPrice}</span>
                    <span className={`text-sm mb-1.5 ${p.highlighted ? 'text-white/50' : 'text-gray-400'}`}>/mo</span>
                  </div>
                  {annual && (
                    <p className={`text-xs mb-1 ${p.highlighted ? 'text-white/40' : 'text-gray-400'}`}>
                      billed ${displayPrice * 12}/yr
                    </p>
                  )}
                  <p className={`text-sm mb-6 ${p.highlighted ? 'text-white/55' : 'text-gray-500'}`}>{p.tagline}</p>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {p.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5 text-sm">
                        <Check size={14} className={p.highlighted ? 'text-accent' : 'text-accent'} strokeWidth={2.5} />
                        <span className={p.highlighted ? 'text-white/80' : 'text-gray-600'}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={p.name === 'Scale' ? '/contact' : `/signup?plan=${p.name.toLowerCase()}`}
                    className={`text-center text-sm font-semibold py-3 rounded-xl transition-colors ${
                      p.highlighted
                        ? 'bg-accent text-white hover:bg-accent/90'
                        : 'bg-sidebar text-white hover:bg-sidebar/90'
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-gray-400 mt-6">14-day free trial on all plans · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sidebar text-center mb-10">Full feature comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sidebar text-white">
                  <th className="text-left px-5 py-4 font-semibold text-white/60 w-1/2">Feature</th>
                  <th className="text-center px-4 py-4 font-bold">Starter</th>
                  <th className="text-center px-4 py-4 font-bold text-accent">Pro</th>
                  <th className="text-center px-4 py-4 font-bold">Scale</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_SECTIONS.map((section) => (
                  <Fragment key={section.heading}>
                    <tr className="bg-cream">
                      <td colSpan={4} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-400">{section.heading}</td>
                    </tr>
                    {section.rows.map((row, i) => (
                      <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-5 py-3 text-gray-700">{row.label}</td>
                        <td className="px-4 py-3 text-center"><Cell value={row.starter} /></td>
                        <td className="px-4 py-3 text-center bg-accent/5"><Cell value={row.pro} /></td>
                        <td className="px-4 py-3 text-center"><Cell value={row.scale} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Billing FAQ */}
      <section className="py-16 bg-cream">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sidebar text-center mb-8">Billing questions</h2>
          <div className="bg-white rounded-2xl border border-card px-6 shadow-sm">
            {BILLING_FAQ.map((item) => (
              <BillingFAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start your free trial today</h2>
          <p className="text-white/50 mb-8">No credit card. Full access for 14 days. Cancel anytime.</p>
          <Link to="/signup?plan=pro" className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors">
            Get started free <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
