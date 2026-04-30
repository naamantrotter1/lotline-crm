/**
 * /investor/reset-password
 * Landing page for password-reset emails sent from /investor/login forgot-password.
 * Supabase appends ?token_hash=…&type=recovery or #access_token=… to the URL.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

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
      <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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

export default function InvestorResetPassword() {
  const navigate = useNavigate();
  const [phase,    setPhase]    = useState('verifying'); // verifying | set-password | submitting | error
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [tokenErr, setTokenErr] = useState('');

  useEffect(() => {
    async function verify() {
      const params    = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type      = params.get('type') ?? 'recovery';

      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error || !data?.session) {
          setTokenErr('This reset link has expired or is invalid.');
          setPhase('error');
          return;
        }
        setEmail(data.session.user.email ?? '');
        setPhase('set-password');
        return;
      }

      // Hash-based flow
      const hash         = new URLSearchParams(window.location.hash.slice(1));
      const accessToken  = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken ?? '',
        });
        if (error || !data?.session) {
          setTokenErr('This reset link has expired or is invalid.');
          setPhase('error');
          return;
        }
        setEmail(data.session.user.email ?? '');
        setPhase('set-password');
        return;
      }

      setTokenErr('No reset token found. The link may be incomplete.');
      setPhase('error');
    }
    verify();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setPhase('submitting');
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setError(pwError.message);
      setPhase('set-password');
      return;
    }
    await supabase.auth.signOut();
    navigate('/investor/login', { replace: true });
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white";

  return (
    <div className="flex items-center justify-center p-8" style={{ background: '#f5f3ee', minHeight: '100vh' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <img src="/lotline-logo.png" alt="LotLine" style={{ height: '56px', width: 'auto', filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)' }} />
          <span className="text-xs font-semibold text-accent/70 uppercase tracking-widest">Investor Portal</span>
        </div>

        {phase === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Verifying reset link…</p>
          </div>
        )}

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
            <p className="text-sm text-gray-500 text-center mb-6">{tokenErr}</p>
            <Link to="/investor/login" className="block w-full py-3 rounded-xl text-sm font-semibold text-white text-center" style={{ backgroundColor: '#c9703a' }}>
              Back to investor login
            </Link>
          </>
        )}

        {(phase === 'set-password' || phase === 'submitting') && (
          <>
            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Set new password</h1>
            <p className="text-sm text-gray-400 mb-8">
              Choose a new password for <span className="text-gray-600 font-medium">{email}</span>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">New password</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Confirm password</label>
                <PasswordInput value={confirm} onChange={setConfirm} />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
              )}
              <button
                type="submit"
                disabled={phase === 'submitting' || !password || !confirm}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: phase === 'submitting' || !password || !confirm ? '#94a3b8' : '#c9703a' }}
              >
                {phase === 'submitting' ? 'Saving…' : 'Set new password'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              <Link to="/investor/login" className="text-accent hover:underline font-medium">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
