import { useState } from 'react';
import { Mail, Phone, MapPin, ArrowRight, CheckCircle } from 'lucide-react';
import MarketingLayout from '../../components/marketing/MarketingLayout';

const SUBJECTS = [
  'General inquiry',
  'Sales / pricing question',
  'Technical support',
  'Feature request',
  'Partnership opportunity',
  'Other',
];

const inputCls =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white text-gray-800 placeholder-gray-400';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: SUBJECTS[0], message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // TODO: wire to your preferred email service (Formspree, EmailJS, Resend, etc.)
    // Example Formspree: await fetch('https://formspree.io/f/YOUR_FORM_ID', { method: 'POST', body: JSON.stringify(form), headers: { 'Content-Type': 'application/json' } })
    // For now, simulate a 1-second send and show success
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  };

  const ready = form.name && form.email && form.message;

  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="pt-32 pb-16" style={{ background: '#1a2332' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-accent">Contact</span>
          <h1 className="text-4xl font-bold text-white mt-3 mb-4">Get in touch</h1>
          <p className="text-lg text-white/55">Questions about pricing, features, or your account? We're here.</p>
        </div>
      </section>

      <section className="py-16 bg-cream">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-10">
            {/* Info panel */}
            <div className="md:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-sidebar mb-4">Contact info</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mail size={16} className="text-accent" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Email</div>
                      <a href="mailto:support@lotlinehomes.com" className="text-sm text-sidebar hover:text-accent transition-colors font-medium">
                        support@lotlinehomes.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone size={16} className="text-accent" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Phone</div>
                      <span className="text-sm text-sidebar font-medium">Available on request</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin size={16} className="text-accent" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Based in</div>
                      <span className="text-sm text-sidebar font-medium">Southeast United States</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-card">
                <div className="text-sm font-bold text-sidebar mb-1">Response time</div>
                <p className="text-sm text-gray-500">
                  We typically respond within 1 business day. For urgent issues, email us directly at{' '}
                  <a href="mailto:support@lotlinehomes.com" className="text-accent hover:underline">
                    support@lotlinehomes.com
                  </a>
                  .
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-card">
                <div className="text-sm font-bold text-sidebar mb-1">Want a demo?</div>
                <p className="text-sm text-gray-500 mb-3">
                  See DealFlow Pro with your own deals and workflow. We'll walk you through it in 20 minutes.
                </p>
                <a
                  href="mailto:support@lotlinehomes.com?subject=Demo Request"
                  className="text-sm font-semibold text-accent hover:underline inline-flex items-center gap-1"
                >
                  Request a demo <ArrowRight size={13} />
                </a>
              </div>
            </div>

            {/* Form */}
            <div className="md:col-span-3">
              {submitted ? (
                <div className="bg-white rounded-2xl p-10 border border-card shadow-sm text-center">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={28} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-sidebar mb-2">Message sent</h3>
                  <p className="text-gray-500 text-sm">
                    Thanks for reaching out. We'll get back to you within 1 business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-card shadow-sm space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name *</label>
                      <input type="text" required placeholder="Jane Smith" className={inputCls} value={form.name} onChange={set('name')} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email *</label>
                      <input type="email" required placeholder="jane@company.com" className={inputCls} value={form.email} onChange={set('email')} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company</label>
                    <input type="text" placeholder="Acme Land LLC" className={inputCls} value={form.company} onChange={set('company')} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
                    <select className={inputCls} value={form.subject} onChange={set('subject')}>
                      {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message *</label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Tell us how we can help…"
                      className={inputCls}
                      value={form.message}
                      onChange={set('message')}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !ready}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: loading || !ready ? '#94a3b8' : '#c8613a' }}
                  >
                    {loading ? 'Sending…' : 'Send message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
