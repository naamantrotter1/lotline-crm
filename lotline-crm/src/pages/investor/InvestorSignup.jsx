import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';

function passwordScore(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}
const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'];

const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white';

function ErrorBox({ children }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{children}</div>
  );
}

function Steps({ current, total }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`w-6 h-1.5 rounded-full ${i < current ? 'bg-accent' : 'bg-gray-200'}`} />
        ))}
      </div>
      <span className="text-xs text-gray-400">Step {current} of {total}</span>
    </div>
  );
}

export default function InvestorSignup() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const inviteEmail = searchParams.get('email') || '';

  const [step,            setStep]            = useState(1);
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  useEffect(() => {
    if (inviteEmail) setEmail(inviteEmail);
  }, [inviteEmail]);

  const score = passwordScore(password);

  function handleStep1(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (score < 1) { setError('Please choose a stronger password.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setStep(2);
  }

  async function handleStep2(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    // 1. Create Supabase auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      let msg = signUpError.message;
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('unique')) {
        msg = 'An account with this email already exists. Try signing in instead.';
      }
      setError(msg);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;

    // 2. Wait for the DB profile trigger
    await new Promise(r => setTimeout(r, 900));

    // 3. Provision investor account: sets account_type=investor, creates investors row + link
    const { error: rpcError } = await supabase.rpc('provision_investor_account', {
      p_email:     email.trim().toLowerCase(),
      p_full_name: fullName,
    });

    if (rpcError) {
      // Non-fatal: profile + investor record creation failed, but auth user was created.
      // The operator can manually link them. Log and continue.
      console.error('[InvestorSignup] provision_investor_account error:', rpcError.message);
    }

    // 4. Refresh auth context so accountType is set before redirect
    if (userId) await refreshProfile(userId);

    setLoading(false);
    navigate('/investor/home', { replace: true });
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#f5f3ee', minHeight: '100vh' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <img src="/lotline-logo.png" alt="LotLine" style={{ height: '56px', width: 'auto', filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)' }} />
          <span className="text-xs font-semibold text-accent/70 uppercase tracking-widest">Investor Portal</span>
        </div>

        {/* ── Step 1: Credentials ── */}
        {step === 1 && (
          <>
            <Steps current={1} total={2} />
            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Create investor account</h1>
            <p className="text-sm text-gray-400 mb-8">Free access to your investment portfolio</p>

            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => !inviteEmail && setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus={!inviteEmail}
                  readOnly={!!inviteEmail}
                  className={`${inputClass} ${inviteEmail ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                />
                {inviteEmail && (
                  <p className="text-xs text-gray-400 mt-1">Email pre-filled from your invite link.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    autoFocus={!!inviteEmail}
                    className={`${inputClass} pr-11`}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? STRENGTH_COLORS[score] : 'bg-gray-200'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>
                      {STRENGTH_LABELS[score]}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className={`${inputClass} ${confirmPassword && confirmPassword !== password ? 'border-red-300 focus:ring-red-200' : ''}`}
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500 mt-1">Passwords don't match.</p>
                )}
                {confirmPassword && confirmPassword === password && (
                  <p className="text-xs text-green-600 mt-1">Passwords match.</p>
                )}
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button type="submit" disabled={!email || !password || !confirmPassword || password !== confirmPassword} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: (!email || !password || !confirmPassword || password !== confirmPassword) ? '#94a3b8' : '#c9703a' }}>
                Continue
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Already have an account?{' '}
              <Link to="/investor/login" className="text-accent hover:underline font-medium">Sign in →</Link>
            </p>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">
                LotLine operator?{' '}
                <Link to="/signup" className="text-gray-500 hover:text-accent hover:underline font-medium">Sign up for the CRM →</Link>
              </p>
            </div>
          </>
        )}

        {/* ── Step 2: Name ── */}
        {step === 2 && (
          <>
            <Steps current={2} total={2} />
            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Tell us your name</h1>
            <p className="text-sm text-gray-400 mb-8">This is how operators will identify you</p>

            <form onSubmit={handleStep2} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" required autoFocus className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" required className={inputClass} />
                </div>
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button type="submit" disabled={loading || !firstName || !lastName} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: loading || !firstName || !lastName ? '#94a3b8' : '#c9703a' }}>
                {loading ? 'Creating account…' : 'Create investor account'}
              </button>

              <button type="button" onClick={() => { setStep(1); setError(''); }} className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
