import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import TermsOfService from '../components/TermsOfService';

export default function Login() {
  const { signIn, session, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session]);

  // Mode: 'signin' | 'signup-step1' | 'signup-step2' | 'forgot-password' | 'forgot-sent'
  const [mode,         setMode]         = useState('signin');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 fields
  const [firstName,    setFirstName]    = useState('');
  const [lastName,     setLastName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [company,      setCompany]      = useState('');
  const [agreedToTos,  setAgreedToTos]  = useState(false);
  const [showTos,      setShowTos]      = useState(false);

  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  // Step 1: just validate locally and advance — no API call yet
  const handleStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setMode('signup-step2');
  };

  // Step 2: create the account AND save profile together
  const handleStep2 = async (e) => {
    e.preventDefault();
    if (!agreedToTos) { setError('You must agree to the Terms of Service to continue.'); return; }
    setError('');
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

    // Create the auth account
    const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    // Wait briefly for the DB trigger to create the profile row
    await new Promise(r => setTimeout(r, 800));

    // Save profile details
    if (userId) {
      await supabase.from('profiles').update({
        first_name:    firstName.trim(),
        last_name:     lastName.trim(),
        name:          fullName,
        phone:         phone.trim(),
        company:       company.trim(),
        agreed_to_tos: true,
      }).eq('id', userId);
      // Re-fetch profile so the display name is correct immediately after redirect
      await refreshProfile(userId);
    }

    // session is now set → useEffect will navigate to /
    setLoading(false);
  };

  // Sign-in handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : error.message);
    }
    setLoading(false);
  };

  const switchToSignin = () => { setMode('signin'); setError(''); setEmail(''); setPassword(''); };
  const switchToSignup = () => { setMode('signup-step1'); setError(''); };

  // Forgot password handler
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMode('forgot-sent');
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";
  const btnStyle   = (disabled) => ({ backgroundColor: disabled ? '#94a3b8' : '#c9703a' });

  return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#f5f3ee', minHeight: '100vh' }}>
      {showTos && <TermsOfService onClose={() => setShowTos(false)} />}

      <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img src="/lotline-logo.png" alt="LotLine Homes" style={{ height: '64px', width: 'auto', filter: 'brightness(0) saturate(100%) sepia(60%) saturate(600%) hue-rotate(330deg) brightness(100%)' }} />
          </div>

          {/* ── SIGN IN ── */}
          {mode === 'signin' && (
            <>
              <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Welcome back</h1>
              <p className="text-sm text-gray-400 mb-8">Sign in to your LotLine account</p>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className={inputClass} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</label>
                    <button type="button" onClick={() => { setMode('forgot-password'); setError(''); }} className="text-xs text-accent hover:underline">Forgot password?</button>
                  </div>
                  <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading || !email || !password} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed" style={btnStyle(loading || !email || !password)}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-6">
                No account yet?{' '}
                <button onClick={switchToSignup} className="text-accent hover:underline font-medium">Create one</button>
              </p>
            </>
          )}

          {/* ── SIGNUP STEP 1: Email + Password ── */}
          {mode === 'signup-step1' && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-1.5">
                  <span className="w-6 h-1.5 rounded-full bg-accent" />
                  <span className="w-6 h-1.5 rounded-full bg-gray-200" />
                </div>
                <span className="text-xs text-gray-400">Step 1 of 2</span>
              </div>
              <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Create account</h1>
              <p className="text-sm text-gray-400 mb-8">Set up your LotLine login</p>
              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Password</label>
                  <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading || !email || !password} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed" style={btnStyle(loading || !email || !password)}>
                  {loading ? 'Creating…' : 'Continue'}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-6">
                Already have an account?{' '}
                <button onClick={switchToSignin} className="text-accent hover:underline font-medium">Sign in</button>
              </p>
            </>
          )}

          {/* ── SIGNUP STEP 2: Profile Info ── */}
          {mode === 'signup-step2' && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-1.5">
                  <span className="w-6 h-1.5 rounded-full bg-accent" />
                  <span className="w-6 h-1.5 rounded-full bg-accent" />
                </div>
                <span className="text-xs text-gray-400">Step 2 of 2</span>
              </div>
              <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Tell us about you</h1>
              <p className="text-sm text-gray-400 mb-8">Fill in your details to complete setup</p>
              <form onSubmit={handleStep2} className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">First Name</label>
                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" required className={inputClass} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Last Name</label>
                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" required className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Phone Number</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className={inputClass} />
                  <p className="text-xs text-gray-400 mt-1">Must be able to receive text messages.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Company Name</label>
                  <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="LotLine Homes" className={inputClass} />
                </div>

                {/* Terms of Service */}
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
                    <button
                      type="button"
                      onClick={() => setShowTos(true)}
                      className="text-accent hover:underline font-medium"
                    >
                      Terms of Service
                    </button>
                  </label>
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <button type="submit" disabled={loading || !firstName || !lastName || !agreedToTos} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed" style={btnStyle(loading || !firstName || !lastName || !agreedToTos)}>
                  {loading ? 'Saving…' : 'Complete Setup'}
                </button>
              </form>
            </>
          )}
          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot-password' && (
            <>
              <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Reset password</h1>
              <p className="text-sm text-gray-400 mb-8">Enter your email and we'll send you a link to reset your password.</p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className={inputClass} />
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <button type="submit" disabled={loading || !email} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed" style={btnStyle(loading || !email)}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="text-center text-xs text-gray-400 mt-6">
                <button onClick={switchToSignin} className="text-accent hover:underline font-medium">Back to sign in</button>
              </p>
            </>
          )}

          {/* ── FORGOT PASSWORD SENT ── */}
          {mode === 'forgot-sent' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9703a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-[#1a2332] mb-2 text-center">Check your email</h1>
              <p className="text-sm text-gray-500 text-center mb-8">
                We sent a password reset link to <span className="font-medium text-gray-700">{email}</span>. Click the link in the email to set a new password.
              </p>
              <p className="text-center text-xs text-gray-400">
                <button onClick={switchToSignin} className="text-accent hover:underline font-medium">Back to sign in</button>
              </p>
            </>
          )}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle }) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        required
        className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
      />
      <button type="button" onClick={onToggle} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? (
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
  );
}

function ErrorBox({ children }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{children}</div>
  );
}
