import { Link } from 'react-router-dom';
import { ArrowRight, Target, Users, TrendingUp, Shield } from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';

const VALUES = [
  {
    icon: Target,
    title: 'Built for operators, not accountants',
    body: "Every feature in DealFlow Pro came from a real pain point on a real deal. We don't build for hypothetical users — we build for the person driving out to walk a lot on a Tuesday morning.",
  },
  {
    icon: Users,
    title: 'Investor trust is everything',
    body: "Your investors are your partners. DealFlow Pro is designed to give them the visibility they need to stay confident — so they wire funds faster and come back for the next deal.",
  },
  {
    icon: TrendingUp,
    title: 'Scale without adding complexity',
    body: "From 3 deals to 30, the platform scales with you. Role-based access, multi-user workspaces, and a capital stack that handles any financing structure you throw at it.",
  },
  {
    icon: Shield,
    title: 'Your data, your business',
    body: "We never sell your data or use it to train models. Your deal pipeline is proprietary intelligence — we treat it that way.",
  },
];

export default function About() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-20" style={{ background: '#1a2332' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">About</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-5">
            Built by land investors,<br className="hidden sm:block" /> for land investors.
          </h1>
          <p className="text-xl text-white/55 max-w-2xl mx-auto leading-relaxed">
            LotLine DealFlow Pro grew out of a simple frustration: there was no software built for the
            specific, gritty reality of land acquisition. So we built it ourselves.
          </p>
        </div>
      </section>

      {/* Origin story */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-gray max-w-none">
            <h2 className="text-2xl font-bold text-sidebar mb-6">The problem we lived first</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Running a land acquisition business is complicated. You're tracking dozens of deals across
              multiple stages, managing relationships with sellers, attorneys, and title companies, and
              simultaneously trying to keep a handful of investors informed about where their capital is
              deployed and when they'll see returns.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Most teams cobble together a combination of spreadsheets, shared Google Docs, and whatever
              CRM they could adapt from a different industry. It works — until it doesn't. Until a deal
              falls through because someone missed a follow-up. Until an investor stops committing because
              they didn't feel informed. Until you can't remember whether that county has been researched
              or not.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              DealFlow Pro was built to solve exactly those problems. A deal pipeline that mirrors how land
              acquisition actually flows. A capital stack builder that handles real financing structures. An
              investor portal that keeps your partners informed without you having to send another email
              update.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Everything in DealFlow Pro exists because a real land investor needed it. We're not adapting
              a generic CRM — we built this from the ground up for this industry.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-cream">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-sidebar mb-3">How we build</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Four principles that guide every feature decision.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="bg-white rounded-2xl p-7 border border-card hover:border-accent/30 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <h3 className="font-bold text-sidebar mb-2 text-lg">{v.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mission statement */}
      <section className="py-20 bg-sidebar">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-2xl md:text-3xl font-semibold text-white leading-snug">
            "Our mission is to give every land acquisition team — from a solo operator to a full development
            company — the same operational clarity and investor confidence that used to require a full back-office staff."
          </p>
          <p className="text-white/40 mt-6 text-sm">— LotLine Homes LLC</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-sidebar mb-4">Join us</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            Start your 14-day free trial and see what a purpose-built land acquisition CRM feels like.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-accent text-white font-semibold px-8 py-4 rounded-xl hover:bg-accent/90 transition-colors">
              Start free trial <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 bg-cream text-sidebar font-semibold px-8 py-4 rounded-xl hover:bg-card transition-colors border border-card">
              Get in touch
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
