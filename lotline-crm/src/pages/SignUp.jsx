import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { PLAN_SEAT_LIMITS } from '../lib/permissions';

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function passwordScore(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4); // 0–4
}

const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'];

// ── Primitives ─────────────────────────────────────────────────────────────

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white';

function ErrorBox({ children }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
      {children}
    </div>
  );
}

function Steps({ current, total }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`w-6 h-1.5 rounded-full ${i < current ? 'bg-accent' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">Step {current} of {total}</span>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const PLAN_CONFIG = {
  starter: { label: 'Starter', color: 'bg-gray-100 text-gray-700',  seats: PLAN_SEAT_LIMITS.starter },
  pro:     { label: 'Pro',     color: 'bg-blue-100 text-blue-700',   seats: PLAN_SEAT_LIMITS.pro     },
};

export default function SignUp() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Plan selected from pricing page (?plan=starter|pro); default to pro
  const rawPlan = searchParams.get('plan');
  const selectedPlan = PLAN_CONFIG[rawPlan] ? rawPlan : 'pro';
  const planCfg = PLAN_CONFIG[selectedPlan];

  // step: 1 = credentials, 2 = profile + workspace, 3 = done
  const [step, setStep] = useState(1);

  // Step 1
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [orgName,    setOrgName]    = useState('');
  const [slug,       setSlug]       = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [agreedToTos, setAgreedToTos] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const score = passwordScore(password);

  // Step 1 → Step 2
  function handleStep1(e) {
    e.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (score < 2) {
      setError('Please choose a stronger password — add uppercase letters, numbers, or symbols.');
      return;
    }
    setStep(2);
  }

  // Derive slug from org name unless user has edited it manually
  function handleOrgNameChange(val) {
    setOrgName(val);
    if (!slugTouched) setSlug(slugify(val));
  }

  function handleSlugChange(val) {
    setSlugTouched(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  // Step 2 → create account + org
  async function handleStep2(e) {
    e.preventDefault();
    setError('');
    if (!agreedToTos) {
      setError('You must agree to the Terms of Service to continue.');
      return;
    }
    if (!slug || slug.length < 3) {
      setError('Workspace URL must be at least 3 characters.');
      return;
    }
    setLoading(true);

    // 1. Create the auth user
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      let msg = signUpError.message;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('unique')) {
        msg = 'An account with this email already exists.';
      }
      setError(msg);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;

    // 2. Wait briefly for the DB profile trigger to create the profiles row
    await new Promise(r => setTimeout(r, 800));

    // 3. Save name to profile
    if (userId) {
      await supabase.from('profiles').update({
        first_name:    firstName.trim(),
        last_name:     lastName.trim(),
        name:          fullName,
        agreed_to_tos: true,
      }).eq('id', userId);
    }

    // 4. Create organization via SECURITY DEFINER RPC
    const { data: orgId, error: rpcError } = await supabase.rpc('create_organization', {
      p_name: orgName.trim(),
      p_slug: slug,
    });

    if (rpcError) {
      let msg = rpcError.message;
      if (msg.includes('organizations_slug_key') || msg.includes('unique') || msg.includes('duplicate')) {
        msg = 'That workspace URL is already taken — please choose a different one.';
        // Let user fix the slug — go back to step 2
        setLoading(false);
        return;
      }
      if (msg.includes('Invalid slug')) {
        msg = 'Workspace URL can only contain lowercase letters, numbers, and hyphens.';
        setLoading(false);
        return;
      }
      setError(msg);
      setLoading(false);
      return;
    }

    // 5. Set plan + seat_limit on the new org based on the selected trial plan
    if (orgId) {
      await supabase
        .from('organizations')
        .update({
          plan:       selectedPlan,
          seat_limit: PLAN_SEAT_LIMITS[selectedPlan] ?? 1,
        })
        .eq('id', orgId);
    }

    // 6. Refresh profile so AuthContext has activeOrgId + orgSlug + orgPlan
    if (userId) {
      await refreshProfile(userId);
    }

    setStep(3);
    setLoading(false);
  }

  return (
    <div
      className="flex-1 flex items-center justify-center p-8"
      style={{ background: '#f5f3ee', minHeight: '100vh' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="/lotline-logo.png"
            alt="LotLine"
            style={{
              height: '64px',
              width: 'auto',
              filter:
                'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)',
            }}
          />
        </div>

        {/* ── Step 1: Email + Password ── */}
        {step === 1 && (
          <>
            <Steps current={1} total={2} />
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-[#1a2332]">Create your account</h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${planCfg.color}`}>
                {planCfg.label} trial
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-8">14 days free · No credit card required</p>

            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Work email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 12 characters"
                    required
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Strength meter */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < score ? STRENGTH_COLORS[score] : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {STRENGTH_LABELS[score]}
                      {score < 2 && ' — add uppercase, numbers, or symbols'}
                    </p>
                  </div>
                )}
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button
                type="submit"
                disabled={!email || !password}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: !email || !password ? '#94a3b8' : '#c9703a' }}
              >
                Continue
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>
            </p>
          </>
        )}

        {/* ── Step 2: Name + Workspace + ToS ── */}
        {step === 2 && (
          <>
            <Steps current={2} total={2} />
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-[#1a2332]">Set up your workspace</h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${planCfg.color}`}>
                {planCfg.label} trial
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-8">Tell us about you and your company</p>

            <form onSubmit={handleStep2} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Smith"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Company / Organization name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => handleOrgNameChange(e.target.value)}
                  placeholder="Acme Land Holdings"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Workspace URL
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-accent/30">
                  <span className="pl-4 pr-1 text-sm text-gray-400 select-none whitespace-nowrap">
                    lotline.app/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => handleSlugChange(e.target.value)}
                    placeholder="acme-land"
                    required
                    className="flex-1 py-3 pr-4 text-sm bg-transparent focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens only.</p>
              </div>

              {/* ToS */}
              <div className="flex items-start gap-3 pt-1">
                <input
                  id="tos"
                  type="checkbox"
                  checked={agreedToTos}
                  onChange={e => setAgreedToTos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-accent cursor-pointer"
                />
                <label htmlFor="tos" className="text-sm text-gray-600 leading-snug cursor-pointer">
                  I agree to the{' '}
                  <Link to="/terms" className="text-accent hover:underline font-medium">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-accent hover:underline font-medium">Privacy Policy</Link>
                </label>
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button
                type="submit"
                disabled={loading || !firstName || !lastName || !orgName || !slug || !agreedToTos}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor:
                    loading || !firstName || !lastName || !orgName || !slug || !agreedToTos
                      ? '#94a3b8'
                      : '#c9703a',
                }}
              >
                {loading ? 'Creating workspace…' : 'Create workspace'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
            </form>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c9703a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#1a2332] mb-2 text-center">
              You're in!
            </h1>
            <p className="text-sm text-gray-500 text-center mb-8">
              <span className="font-semibold text-gray-700">{orgName}</span> is ready.
              You're on a 14-day <span className="font-semibold text-gray-700">{planCfg.label}</span> trial — no credit card needed.
            </p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#c9703a' }}
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
