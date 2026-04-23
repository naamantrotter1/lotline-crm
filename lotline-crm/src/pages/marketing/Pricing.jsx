import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Users, Trophy, Check, Minus, ArrowRight,
  Kanban, LayoutDashboard, DollarSign, Map, Mail,
  Building2, BarChart2, Database, TrendingUp, Zap,
  Settings, Code, Globe, Infinity, HeadphonesIcon,
  Fragment,
} from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';
import { marketing } from '../../content/marketing';

const ANNUAL_DISCOUNT = 0.83;

function annualPrice(monthly) {
  return Math.round(monthly * ANNUAL_DISCOUNT);
}

const ICON_MAP = {
  User, Users, Trophy, Check, Minus, Kanban, LayoutDashboard,
  DollarSign, Map, Mail, Building2, BarChart2, Database,
  TrendingUp, Zap, Settings, Code, Globe, Infinity, HeadphonesIcon,
};

function PlanIcon({ name, size = 28, className = '' }) {
  const Icon = ICON_MAP[name] || Users;
  return <Icon size={size} className={className} />;
}

/* ── Comparison table ── */
const TABLE_SECTIONS = [
  {
    heading: 'Deals & Pipeline',
    rows: [
      { label: 'Active deals',              starter: '10',     pro: 'Unlimited', scale: 'Unlimited' },
      { label: 'Deal pipeline (Kanban)',     starter: true,     pro: true,        scale: true },
      { label: 'Deal detail pages',         starter: true,     pro: true,        scale: true },
      { label: 'Archived deal history',     starter: true,     pro: true,        scale: true },
      { label: 'Custom pipeline stages',    starter: false,    pro: false,       scale: true },
    ],
  },
  {
    heading: 'Capital & Investors',
    rows: [
      { label: 'Capital stack builder',     starter: 'Basic',  pro: 'Full',      scale: 'Full' },
      { label: 'Investor portal',           starter: false,    pro: true,        scale: true },
      { label: 'Draw schedules',            starter: false,    pro: true,        scale: true },
      { label: 'Distribution tracking',     starter: false,    pro: true,        scale: true },
      { label: 'White-label investor portal', starter: false,  pro: false,       scale: true },
    ],
  },
  {
    heading: 'Intelligence & Tools',
    rows: [
      { label: 'Market research heat map',  starter: false,    pro: true,        scale: true },
      { label: 'ARV comparable database',   starter: false,    pro: true,        scale: true },
      { label: 'Deal calculator',           starter: true,     pro: true,        scale: true },
      { label: 'Flood map overlay',         starter: true,     pro: true,        scale: true },
      { label: 'P&L dashboard',             starter: false,    pro: true,        scale: true },
    ],
  },
  {
    heading: 'Team & Access',
    rows: [
      { label: 'User seats',                starter: '1',      pro: '6',         scale: 'Unlimited' },
      { label: 'Role-based permissions',    starter: false,    pro: true,        scale: true },
      { label: 'API access',                starter: false,    pro: false,       scale: true },
    ],
  },
  {
    heading: 'Support',
    rows: [
      { label: 'Support type',              starter: 'Email',  pro: 'Priority',  scale: 'Dedicated' },
      { label: 'Onboarding assistance',     starter: false,    pro: true,        scale: 'Dedicated' },
    ],
  },
];

function Cell({ value }) {
  if (value === true)  return <Check size={16} className="text-accent mx-auto" strokeWidth={2.5} />;
  if (value === false) return <Minus size={13} className="text-gray-300 mx-auto" />;
  return <span className="text-sm text-gray-700 font-medium">{value}</span>;
}

function BillingFAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button className="w-full flex items-center justify-between py-4 text-left gap-4" onClick={() => setOpen(v => !v)}>
        <span className="text-sm font-semibold text-sidebar">{q}</span>
        <span className={`text-accent text-lg font-light flex-shrink-0 transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="pb-4 -mt-1 text-sm text-gray-500 leading-relaxed">{a}</p>}
    </div>
  );
}

const FAQ_ITEMS = [
  { q: 'Does my free trial require a credit card?', a: 'No credit card needed. Your 14-day trial starts the moment you create your account.' },
  { q: 'Can I switch plans later?', a: 'Yes — upgrade or downgrade anytime. Changes take effect at the start of your next billing cycle.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit and debit cards. Annual plans can be invoiced.' },
  { q: 'Is there a setup fee?', a: 'No setup fees, ever. You only pay the monthly or annual plan price.' },
  { q: 'Do you offer discounts for small teams?', a: "Contact us at support@lotlinehomes.com and we'll work something out." },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-6 text-center" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Pricing</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-4">
            Your Premium Source For Deal Management.
          </h1>
          <p className="text-lg text-white/55 mb-8">
            Whether you're just starting out or running a high-volume operation, our plans are designed to
            help you close more deals — all risk-free with a <strong className="text-white/80">14-Day Free Trial.</strong>
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!annual ? 'bg-white text-sidebar shadow' : 'text-white/60 hover:text-white'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${annual ? 'bg-white text-sidebar shadow' : 'text-white/60 hover:text-white'}`}
            >
              Annual
              <span className="text-[10px] font-bold text-accent bg-accent/20 px-1.5 py-0.5 rounded-full">3 months free</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="pb-16 pt-12" style={{ background: '#f5f3ee' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {marketing.pricing.map((plan) => {
              const displayPrice = plan.monthlyPrice
                ? (annual ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice)
                : null;
              const isHighlighted = plan.highlighted;
              const isContact = plan.cta === 'Contact sales';
              const href = isContact ? '/contact' : `/cart?plan=${plan.name.toLowerCase()}`;

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl overflow-hidden flex flex-col ${
                    isHighlighted
                      ? 'shadow-2xl ring-2 ring-accent'
                      : 'bg-white border border-gray-200 shadow-sm'
                  }`}
                  style={isHighlighted ? { background: '#1a2332' } : {}}
                >
                  {/* "Most Popular" diagonal ribbon */}
                  {plan.badge && (
                    <div className="absolute top-4 right-0 bg-accent text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-l-full shadow-md">
                      {plan.badge}
                    </div>
                  )}

                  <div className="p-7 flex flex-col flex-1">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
                      isHighlighted ? 'bg-accent/20' : 'bg-accent/10'
                    }`}>
                      <PlanIcon name={plan.icon} size={22} className={isHighlighted ? 'text-accent' : 'text-accent'} />
                    </div>

                    {/* Name + tagline */}
                    <h2 className={`text-2xl font-bold mb-0.5 ${isHighlighted ? 'text-white' : 'text-sidebar'}`}>
                      {plan.name}
                    </h2>
                    <p className={`text-sm mb-5 ${isHighlighted ? 'text-white/50' : 'text-gray-400'}`}>
                      {plan.tagline}
                    </p>

                    {/* Price */}
                    {displayPrice !== null ? (
                      <div className="mb-1">
                        <div className="flex items-end gap-1">
                          <span className={`text-4xl font-bold ${isHighlighted ? 'text-white' : 'text-sidebar'}`}>
                            ${displayPrice}
                          </span>
                          <span className={`text-sm mb-1.5 ${isHighlighted ? 'text-white/40' : 'text-gray-400'}`}>/mo</span>
                        </div>
                        {annual && (
                          <p className={`text-xs ${isHighlighted ? 'text-white/35' : 'text-gray-400'}`}>
                            ${displayPrice * 12} billed annually
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mb-1">
                        <p className={`text-2xl font-bold ${isHighlighted ? 'text-white' : 'text-sidebar'}`}>
                          Starts at<br /><span className="text-4xl">${annual ? annualPrice(plan.monthlyPrice) : plan.monthlyPrice}</span>
                        </p>
                      </div>
                    )}

                    {/* CTA */}
                    <Link
                      to={href}
                      className={`mt-5 mb-6 text-center py-3 rounded-xl text-sm font-bold transition-all block ${
                        plan.ctaStyle === 'accent'
                          ? 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/30'
                          : plan.ctaStyle === 'muted'
                            ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                            : 'border-2 border-accent text-accent hover:bg-accent/10'
                      }`}
                    >
                      {plan.cta}
                    </Link>

                    {/* Divider */}
                    <div className={`border-t mb-5 ${isHighlighted ? 'border-white/10' : 'border-gray-100'}`} />

                    {/* Feature list */}
                    <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isHighlighted ? 'text-white/40' : 'text-gray-400'}`}>
                      {plan.name} includes:
                    </p>
                    <ul className="space-y-2.5 flex-1">
                      {plan.features.map((feat) => (
                        <li key={feat.text} className="flex items-start gap-2.5">
                          <div className={`flex-shrink-0 mt-0.5 ${isHighlighted ? 'text-accent' : 'text-accent'}`}>
                            <PlanIcon name={feat.icon} size={13} />
                          </div>
                          <span className={`text-sm leading-snug ${isHighlighted ? 'text-white/75' : 'text-gray-600'}`}>
                            {feat.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            14-day free trial on all plans · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Full comparison table */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sidebar text-center mb-10">Full feature comparison</h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#1a2332' }}>
                  <th className="text-left px-5 py-4 font-semibold text-white/50 w-1/2">Feature</th>
                  <th className="text-center px-4 py-4 font-bold text-white">Starter</th>
                  <th className="text-center px-4 py-4 font-bold text-accent">Pro</th>
                  <th className="text-center px-4 py-4 font-bold text-white">Scale</th>
                </tr>
              </thead>
              <tbody>
                {TABLE_SECTIONS.map((section) => (
                  <Fragment key={section.heading}>
                    <tr style={{ background: '#f5f3ee' }}>
                      <td colSpan={4} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-400">
                        {section.heading}
                      </td>
                    </tr>
                    {section.rows.map((row, i) => (
                      <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
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

      {/* FAQ */}
      <section className="py-16" style={{ background: '#f5f3ee' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-sidebar text-center mb-8">Billing questions</h2>
          <div className="bg-white rounded-2xl border border-gray-100 px-6 shadow-sm">
            {FAQ_ITEMS.map((item) => (
              <BillingFAQ key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Start your free trial today</h2>
          <p className="text-white/50 mb-8">14 days free. No credit card. Cancel anytime.</p>
          <Link
            to="/signup?plan=pro"
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors"
          >
            Get started free <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
