import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Tag, ArrowRight, X } from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';

/* ── Plan data ── */
const PLANS = {
  starter: { name: 'Starter', monthly: 49,  annual: 41,  seats: 1  },
  pro:     { name: 'Pro',     monthly: 199, annual: 165, seats: 6  },
  scale:   { name: 'Scale',   monthly: 499, annual: 414, seats: 999 },
};

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function Cart() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const planKey = searchParams.get('plan') || 'pro';
  const plan = PLANS[planKey] || PLANS.pro;

  const [annual,  setAnnual]  = useState(false);
  const [coupon,  setCoupon]  = useState('');
  const [applied, setApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  const price = annual ? plan.annual : plan.monthly;
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  function handleApplyCoupon() {
    if (!coupon.trim()) return;
    // Placeholder — real coupon validation goes here
    setCouponError('Invalid coupon code.');
  }

  function handleProceed() {
    navigate(`/checkout?plan=${planKey}&billing=${annual ? 'annual' : 'monthly'}`);
  }

  return (
    <MarketingLayout>
      <div className="min-h-screen pt-28 pb-20" style={{ background: '#f5f3ee' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-sidebar mb-8">Cart</h1>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* ── Left: cart table ── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Billing toggle */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Billing period</p>
                <div className="flex gap-3">
                  {[
                    { label: 'Monthly',             key: false },
                    { label: 'Annual — save 17%',   key: true  },
                  ].map(({ label, key }) => (
                    <button
                      key={label}
                      onClick={() => setAnnual(key)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                        annual === key
                          ? 'border-accent text-accent bg-accent/5'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] bg-gray-50 border-b border-gray-100">
                  <div className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest">Product</div>
                  <div className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Qty</div>
                  <div className="px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Subtotal</div>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] items-center border-b border-gray-50">
                  <div className="px-5 py-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-accent font-bold text-xs">{plan.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sidebar">{plan.name} Plan</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          ${price}/month · {annual ? 'billed annually' : 'billed monthly'} · 14-day free trial
                        </p>
                        <Link
                          to="/pricing"
                          className="text-xs text-accent hover:underline mt-1 inline-block"
                        >
                          Change plan
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-5 text-center">
                    <span className="text-sm font-medium text-gray-600">1</span>
                  </div>
                  <div className="px-5 py-5 text-right">
                    <span className="text-sm font-semibold text-sidebar">${price}/mo</span>
                  </div>
                </div>

                {/* Coupon row */}
                <div className="px-5 py-4 flex gap-3">
                  <input
                    type="text"
                    value={coupon}
                    onChange={e => { setCoupon(e.target.value); setCouponError(''); setApplied(false); }}
                    placeholder="Coupon code"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-accent text-accent hover:bg-accent/5 transition-colors"
                  >
                    Apply coupon
                  </button>
                </div>
                {couponError && (
                  <p className="px-5 pb-4 text-xs text-red-500">{couponError}</p>
                )}
                {applied && (
                  <p className="px-5 pb-4 text-xs text-green-600 font-medium">Coupon applied!</p>
                )}
              </div>
            </div>

            {/* ── Right: cart totals ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-bold text-sidebar">Cart totals</h2>
                </div>

                <div className="divide-y divide-gray-50">
                  <div className="px-6 py-4 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Subtotal</span>
                    <span className="text-sm font-semibold text-sidebar">${price}/mo</span>
                  </div>

                  <div className="px-6 py-4 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-700">Total today</span>
                    <span className="text-lg font-bold text-green-600">$0.00</span>
                  </div>

                  <div className="px-6 py-4 bg-gray-50/50">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">After free trial</p>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-gray-600">Recurring total</span>
                      <span className="text-sm font-semibold text-sidebar">${price}/mo</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      First renewal: <span className="font-medium text-gray-600">{formatDate(trialEnd)}</span>
                    </p>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <button
                    onClick={handleProceed}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-colors"
                    style={{ backgroundColor: '#c8613a' }}
                  >
                    Proceed to checkout
                    <ArrowRight size={15} />
                  </button>
                  <p className="text-center text-xs text-gray-400 mt-3">
                    No credit card required to start your trial
                  </p>
                </div>
              </div>

              {/* Trust badges */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                {[
                  '14-day free trial, no commitment',
                  'Cancel anytime before trial ends',
                  'Secure data — SOC 2 compliant infrastructure',
                ].map(t => (
                  <div key={t} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs text-gray-500">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
