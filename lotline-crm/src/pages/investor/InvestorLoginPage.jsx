import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';

function PasswordInput({ value, onChange, show, onToggle }) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="••••••••"
        required
        className="w-full border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 bg-white/5 text-white placeholder-white/30"
      />
      <button type="button" onClick={onToggle} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
        aria-label={show ? 'Hide password' : 'Show password'}>
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

export default function InvestorLoginPage() {
  const { session, profile, signIn } = useAuth();
  const navigate = useNavigate();
  const skipNavRef = useRef(false);

  useEffect(() => {
    if (session && !skipNavRef.current) {
      const accountType = profile?.account_type
        ?? (profile?.role === 'investor' ? 'investor' : (profile ? 'operator' : null));
      if (accountType === null) return;
      if (accountType === 'investor') navigate('/investor/home', { replace: true });
      else navigate('/dashboard', { replace: true });
    }
  }, [session, profile]);

  const [mode,         setMode]         = useState('signin');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const inputCls = "w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 bg-white/5 text-white placeholder-white/30";
  const labelCls = "block text-xs font-semibold text-white/50 uppercase tracking-wide mb-1.5";

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    skipNavRef.current = true;

    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      skipNavRef.current = false;
      setError(signInError.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : signInError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profileData } = await supabase
      .from('profiles')
      .select('account_type, role')
      .eq('id', user?.id)
      .single();

    skipNavRef.current = false;
    setLoading(false);

    const accountType = profileData?.account_type
      ?? (profileData?.role === 'investor' ? 'investor' : (profileData ? 'operator' : null));

    if (accountType === 'investor' || accountType === null) {
      navigate('/investor/home', { replace: true });
    } else {
      // operator/admin/member — send to CRM dashboard
      navigate('/dashboard', { replace: true });
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/investor/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setMode('forgot-sent');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#0F1117', minHeight: '100vh' }}>
      <div className="w-full max-w-sm">

        {/* Logo + badge */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/lotline-logo.png"
            alt="LotLine"
            style={{ height: '48px', width: 'auto', filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)' }}
          />
          <span className="inline-flex items-center gap-1.5 bg-accent/15 text-accent text-xs font-semibold px-3 py-1 rounded-full border border-accent/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Investor Portal
          </span>
        </div>

        {/* ── SIGN IN ── */}
        {mode === 'signin' && (
          <>
            <h1 className="text-2xl font-bold text-white mb-1 text-center">Investor Portal Login</h1>
            <p className="text-sm text-white/40 mb-8 text-center">Sign in to view your investments</p>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className={labelCls}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls} style={{ marginBottom: 0 }}>Password</label>
                  <button type="button" onClick={() => { setMode('forgot-password'); setError(''); }} className="text-xs text-accent hover:underline">
                    Forgot password?
                  </button>
                </div>
                <PasswordInput value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(v => !v)} />
              </div>
              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: (loading || !email || !password) ? undefined : '#c9703a' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-xs text-white/30 mt-6">
              Don't have an account?{' '}
              <Link to="/investor/signup" className="text-accent hover:underline font-medium">Create investor account →</Link>
            </p>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-white/25">
                LotLine team member?{' '}
                <Link to="/login" className="text-white/40 hover:text-accent hover:underline font-medium">Sign in to the CRM →</Link>
              </p>
            </div>
          </>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot-password' && (
          <>
            <h1 className="text-2xl font-bold text-white mb-1 text-center">Reset password</h1>
            <p className="text-sm text-white/40 mb-8 text-center">We'll send a reset link to your email.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className={labelCls}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className={inputCls} />
              </div>
              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
              )}
              <button type="submit" disabled={loading || !email} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: '#c9703a' }}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <p className="text-center text-xs text-white/30 mt-6">
              <button onClick={() => { setMode('signin'); setError(''); }} className="text-accent hover:underline font-medium">Back to sign in</button>
            </p>
          </>
        )}

        {/* ── FORGOT SENT ── */}
        {mode === 'forgot-sent' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center border border-accent/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c9703a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 text-center">Check your email</h1>
            <p className="text-sm text-white/40 text-center mb-8">
              We sent a reset link to <span className="font-medium text-white/70">{email}</span>.
            </p>
            <p className="text-center text-xs text-white/30">
              <button onClick={() => { setMode('signin'); setError(''); }} className="text-accent hover:underline font-medium">Back to sign in</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
