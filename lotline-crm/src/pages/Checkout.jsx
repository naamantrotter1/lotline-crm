import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronDown, Lock, CreditCard, CheckCircle, ArrowRight } from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';

/* ── Plan data ── */
const PLANS = {
  starter: { name: 'Starter', monthly: 49,  annual: 41  },
  pro:     { name: 'Pro',     monthly: 199, annual: 165 },
  scale:   { name: 'Scale',   monthly: 499, annual: 414 },
};

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white';

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const planKey = searchParams.get('plan') || 'pro';
  const billing = searchParams.get('billing') || 'monthly';
  const plan = PLANS[planKey] || PLANS.pro;
  const isAnnual = billing === 'annual';
  const price = isAnnual ? plan.annual : plan.monthly;
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Form state
  const [email,    setEmail]    = useState('');
  const [firstName,setFirstName]= useState('');
  const [lastName, setLastName] = useState('');
  const [country,  setCountry]  = useState('United States (US)');
  const [address,  setAddress]  = useState('');
  const [city,     setCity]     = useState('');
  const [state,    setState]    = useState('');
  const [zip,      setZip]      = useState('');
  const [phone,    setPhone]    = useState('');
  const [coupon,   setCoupon]   = useState('');

  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [errors,      setErrors]      = useState({});

  function validate() {
    const e = {};
    if (!email.trim())     e.email     = 'Email is required';
    if (!firstName.trim()) e.firstName = 'First name is required';
    if (!lastName.trim())  e.lastName  = 'Last name is required';
    if (!address.trim())   e.address   = 'Address is required';
    if (!city.trim())      e.city      = 'City is required';
    if (!state)            e.state     = 'State is required';
    if (!zip.trim())       e.zip       = 'ZIP code is required';
    if (!phone.trim())     e.phone     = 'Phone is required';
    return e;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      const params = new URLSearchParams({
        plan:      planKey,
        email:     email.trim(),
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
      });
      navigate(`/create-account?${params.toString()}`);
    }, 800);
  }

  return (
    <MarketingLayout>
      <div className="min-h-screen pt-28 pb-20" style={{ background: '#f5f3ee' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-sidebar mb-2">Finalize Registration &amp; Checkout</h1>
          <p className="text-sm text-gray-500 mb-8">
            Start your 14-day free trial — no payment needed today.
          </p>

          <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
            {/* ── Left: form ── */}
            <div className="space-y-5">
              {/* Email address */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-sidebar">Email address</h2>
                </div>
                <div className="px-6 py-5">
                  <Field label="Email address" required>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={inputClass}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </Field>
                </div>
              </div>

              {/* Billing information */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-sidebar">Billing information</h2>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4" id="checkout-form">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name" required>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Jane"
                        className={inputClass}
                      />
                      {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                    </Field>
                    <Field label="Last name" required>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Smith"
                        className={inputClass}
                      />
                      {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                    </Field>
                  </div>

                  <Field label="Country / Region">
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      className={inputClass}
                    >
                      <option>United States (US)</option>
                      <option>Canada</option>
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Field label="Street address" required>
                        <input
                          type="text"
                          value={address}
                          onChange={e => setAddress(e.target.value)}
                          placeholder="123 Main St"
                          className={inputClass}
                        />
                        {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                      </Field>
                    </div>
                    <Field label="Town / City" required>
                      <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Atlanta"
                        className={inputClass}
                      />
                      {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                    </Field>
                    <Field label="State" required>
                      <select
                        value={state}
                        onChange={e => setState(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select state</option>
                        {US_STATES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                    </Field>
                    <Field label="ZIP Code" required>
                      <input
                        type="text"
                        value={zip}
                        onChange={e => setZip(e.target.value)}
                        placeholder="30301"
                        className={inputClass}
                      />
                      {errors.zip && <p className="text-xs text-red-500 mt-1">{errors.zip}</p>}
                    </Field>
                    <Field label="Phone" required>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                        className={inputClass}
                      />
                      {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </Field>
                  </div>

                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#c8613a' }}
                  >
                    {submitting ? 'Processing…' : (
                      <>Create account &amp; start trial <ArrowRight size={15} /></>
                    )}
                  </button>
                </form>
              </div>

              {/* Payment section — placeholder for future Stripe integration */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden opacity-60 select-none">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className="text-gray-400" />
                    <h2 className="font-bold text-gray-400">Credit card information</h2>
                  </div>
                  <span className="text-xs font-semibold text-gray-300 bg-gray-100 px-2 py-1 rounded-full">
                    Coming soon
                  </span>
                </div>
                <div className="px-6 py-8 text-center">
                  <Lock size={24} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 font-medium">Secure payment processing</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Payment integration is being set up. Your trial starts immediately — no card needed today.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Right: order summary ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-sidebar">Summary</h2>
                </div>

                <div className="px-6 py-4 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Subscription</p>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-accent">{plan.name}</span>
                    <Link to="/pricing" className="text-xs text-gray-400 hover:text-sidebar underline underline-offset-2">
                      Change plan
                    </Link>
                  </div>
                </div>

                <div className="px-6 py-4 border-b border-gray-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{plan.name} × 1</span>
                    <span className="text-gray-700 font-medium">${price}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Billing</span>
                    <span className="text-gray-700 font-medium capitalize">{billing}</span>
                  </div>
                </div>

                {/* Coupon */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={coupon}
                      onChange={e => setCoupon(e.target.value)}
                      placeholder="Coupon code"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <button className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                      Apply
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">Total today</span>
                    <span className="text-xl font-bold text-green-600">$0.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Recurring total</span>
                    <span className="text-sm font-semibold text-sidebar">${price}/mo</span>
                  </div>
                  <p className="text-xs text-gray-400 pt-1">
                    First renewal: <span className="font-medium text-gray-600">{formatDate(trialEnd)}</span>
                  </p>
                </div>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <Lock size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your information is encrypted and secure. We never store credit card details.
                </p>
              </div>

              {/* Free trial reminder */}
              <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={15} className="text-accent" />
                  <p className="text-sm font-bold text-sidebar">14-day free trial</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  You won't be charged until your trial ends on <strong>{formatDate(trialEnd)}</strong>.
                  Cancel anytime before then.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
