/**
 * /investor/activate
 *
 * Landing page for invite-email links. Supabase appends either:
 *   ?token_hash=…&type=invite   (invite flow)
 *   ?token_hash=…&type=magiclink (OTP fallback for existing users)
 *   #access_token=…             (legacy hash-based flow)
 *
 * Steps:
 *   1. Parse URL params and verify the token to establish a session
 *   2. Show email (read-only) + new password + confirm password
 *   3. On submit: updateUser(password) → activate_investor_account RPC
 *   4. Redirect to /investor/home
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function Logo() {
  return (
    <div className="mb-8 flex flex-col items-center gap-2">
      <img
        src="/lotline-logo.png"
        alt="LotLine"
        style={{
          height: '56px',
          width: 'auto',
          filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)',
        }}
      />
      <span className="text-xs font-semibold text-accent/70 uppercase tracking-widest">Investor Portal</span>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder = '••••••••' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
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

export default function InvestorActivate() {
  const navigate = useNavigate();

  // phase: 'verifying' | 'set-password' | 'submitting' | 'done' | 'error'
  const [phase,      setPhase]      = useState('verifying');
  const [email,      setEmail]      = useState('');
  const [investorId, setInvestorId] = useState(null);
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [error,      setError]      = useState('');
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    async function verify() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type      = params.get('type') ?? 'invite';

      // ── Path 1: token_hash in query string (standard Supabase invite / OTP) ──
      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error || !data?.session) {
          setTokenError('This activation link has expired or is invalid. Please request a new invite.');
          setPhase('error');
          return;
        }
        setEmail(data.session.user.email ?? '');
        setInvestorId(
          data.session.user.user_metadata?.investor_id ??
          params.get('investor_id') ??
          null,
        );
        setPhase('set-password');
        return;
      }

      // ── Path 2: hash-based tokens (legacy Supabase flow) ─────────────────────
      const hash        = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const hashType    = hash.get('type');

      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken ?? '',
        });
        if (error || !data?.session) {
          setTokenError('This activation link has expired or is invalid. Please request a new invite.');
          setPhase('error');
          return;
        }
        setEmail(data.session.user.email ?? '');
        setInvestorId(data.session.user.user_metadata?.investor_id ?? null);
        setPhase('set-password');
        return;
      }

      // ── No token found ────────────────────────────────────────────────────────
      setTokenError('No activation token found. This link may be incomplete.');
      setPhase('error');
    }

    verify();
  }, []);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setPhase('submitting');

    // 1. Set the user's password
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setError(pwError.message);
      setPhase('set-password');
      return;
    }

    // 2. Activate the investor account (link auth_user_id, set status=active, upsert profile)
    if (investorId) {
      const { error: rpcError } = await supabase.rpc('activate_investor_account', {
        p_investor_id: investorId,
      });
      if (rpcError) {
        // Non-fatal: the account is still created; just log and continue
        console.warn('activate_investor_account RPC error:', rpcError.message);
      }
    } else {
      // No investor_id in metadata — try to resolve by email
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ensure profile is marked as investor
        await supabase.from('profiles').upsert({
          id:           user.id,
          email:        user.email,
          account_type: 'investor',
          role:         'investor',
        }, { onConflict: 'id' });
      }
    }

    setPhase('done');
    navigate('/investor/home', { replace: true });
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";

  return (
    <div
      className="flex items-center justify-center p-8"
      style={{ background: '#f5f3ee', minHeight: '100vh' }}
    >
      <div className="w-full max-w-sm">
        <Logo />

        {/* ── Verifying ── */}
        {phase === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Verifying your invitation…</p>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#1a2332] mb-2 text-center">Link expired</h1>
            <p className="text-sm text-gray-500 text-center mb-6">{tokenError}</p>
            <Link
              to="/investor/login"
              className="block w-full py-3 rounded-xl text-sm font-semibold text-white text-center"
              style={{ backgroundColor: '#c9703a' }}
            >
              Go to investor login
            </Link>
          </>
        )}

        {/* ── Set password ── */}
        {(phase === 'set-password' || phase === 'submitting') && (
          <>
            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Activate your account</h1>
            <p className="text-sm text-gray-400 mb-8">Set a password to access your investor portal.</p>

            <form onSubmit={handleSetPassword} className="space-y-4">
              {/* Email — read-only */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className={`${inputClass} bg-gray-50 text-gray-500 cursor-default`}
                />
              </div>

              {/* New password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  New password
                </label>
                <PasswordInput value={password} onChange={setPassword} placeholder="Min. 8 characters" />
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Confirm password
                </label>
                <PasswordInput value={confirm} onChange={setConfirm} />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={phase === 'submitting' || !password || !confirm}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: phase === 'submitting' || !password || !confirm ? '#94a3b8' : '#c9703a' }}
              >
                {phase === 'submitting' ? 'Activating…' : 'Activate account'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">
                Already activated?{' '}
                <Link to="/investor/login" className="text-gray-500 hover:text-accent hover:underline font-medium">
                  Sign in →
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
