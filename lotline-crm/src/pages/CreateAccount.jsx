import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { PLAN_SEAT_LIMITS } from '../lib/permissions';

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
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'];

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white';

function ErrorBox({ children }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
      {children}
    </div>
  );
}

export default function CreateAccount() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const planKey    = searchParams.get('plan') || 'pro';
  const emailParam = searchParams.get('email') || '';
  const firstParam = searchParams.get('firstName') || '';
  const lastParam  = searchParams.get('lastName') || '';

  const [orgName,      setOrgName]      = useState('');
  const [slug,         setSlug]         = useState('');
  const [slugTouched,  setSlugTouched]  = useState(false);
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [agreedToTos,  setAgreedToTos]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [done,         setDone]         = useState(false);

  const score = passwordScore(password);

  function handleOrgNameChange(val) {
    setOrgName(val);
    if (!slugTouched) setSlug(slugify(val));
  }

  function handleSlugChange(val) {
    setSlugTouched(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  async function handleSubmit(e) {
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
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreedToTos) {
      setError('You must agree to the Terms of Service to continue.');
      return;
    }
    if (!slug || slug.length < 3) {
      setError('Workspace URL must be at least 3 characters.');
      return;
    }

    setLoading(true);

    const fullName = `${firstParam} ${lastParam}`.trim();

    // 1. Create the auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: emailParam.trim(),
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      let msg = signUpError.message;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('unique')) {
        msg = 'An account with this email already exists. Try logging in instead.';
      }
      setError(msg);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;

    // 2. Wait for DB profile trigger
    await new Promise(r => setTimeout(r, 800));

    // 3. Save name to profile
    if (userId) {
      await supabase.from('profiles').update({
        first_name:    firstParam.trim(),
        last_name:     lastParam.trim(),
        name:          fullName,
        agreed_to_tos: true,
      }).eq('id', userId);
    }

    // 4. Create organization (plan set atomically inside the RPC)
    const { data: orgId, error: rpcError } = await supabase.rpc('create_organization', {
      p_name:       orgName.trim(),
      p_slug:       slug,
      p_plan:       planKey,
      p_seat_limit: PLAN_SEAT_LIMITS[planKey] ?? 1,
    });

    if (rpcError) {
      let msg = rpcError.message;
      if (msg.includes('organizations_slug_key') || msg.includes('unique') || msg.includes('duplicate')) {
        msg = 'That workspace URL is already taken — please choose a different one.';
      } else if (msg.includes('Invalid slug')) {
        msg = 'Workspace URL can only contain lowercase letters, numbers, and hyphens.';
      }
      setError(msg);
      setLoading(false);
      return;
    }

    // 6. Refresh auth context
    if (userId) {
      await refreshProfile(userId);
    }

    setDone(true);
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center p-8" style={{ background: '#f5f3ee', minHeight: '100vh' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="/lotline-logo.png"
            alt="LotLine"
            style={{
              height: '64px',
              width: 'auto',
              filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)',
            }}
          />
        </div>

        {done ? (
          /* ── Success state ── */
          <>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
                  fill="none" stroke="#c9703a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#1a2332] mb-2 text-center">You're in!</h1>
            <p className="text-sm text-gray-500 text-center mb-8">
              <span className="font-semibold text-gray-700">{orgName}</span> is ready.
              You're on a 14-day free trial — no credit card needed.
            </p>
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#c9703a' }}
            >
              Go to dashboard
            </button>
          </>
        ) : (
          /* ── Create password form ── */
          <>
            {/* Confirmation banner */}
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-6">
              <CheckCircle size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Registration received!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Create a password below to access your CRM.
                </p>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Set up your account</h1>
            <p className="text-sm text-gray-400 mb-6">14 days free · No credit card required</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email — read only */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={emailParam}
                  readOnly
                  className={`${inputClass} bg-gray-50 text-gray-500 cursor-default`}
                />
              </div>

              {/* Company name */}
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
                  autoFocus
                  className={inputClass}
                />
              </div>

              {/* Workspace URL */}
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

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 12 characters"
                    required
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? (
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
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? STRENGTH_COLORS[score] : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {STRENGTH_LABELS[score]}
                      {score < 2 && ' — add uppercase, numbers, or symbols'}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    className={`${inputClass} pr-11 ${confirm && confirm !== password ? 'border-red-300 focus:ring-red-200' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? (
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
                {confirm && confirm !== password && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {confirm && confirm === password && (
                  <p className="text-xs text-green-600 mt-1">Passwords match</p>
                )}
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
                disabled={loading || !orgName || !slug || !password || !confirm || !agreedToTos}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor:
                    loading || !orgName || !slug || !password || !confirm || !agreedToTos
                      ? '#94a3b8'
                      : '#c9703a',
                }}
              >
                {loading ? 'Creating your account…' : 'Create account & go to dashboard'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
