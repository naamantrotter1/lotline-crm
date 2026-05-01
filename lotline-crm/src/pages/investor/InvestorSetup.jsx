/**
 * /investor-setup
 *
 * Investor account onboarding page. Landing target for invite emails.
 * Accepts tokens two ways:
 *   1. ?token_hash=…&type=invite  (our buildActivateUrl flow)
 *   2. #access_token=…            (Supabase default hash redirect)
 *
 * Collects: first name, last name, phone, password.
 * On success: redirects to /investor/home.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ── Password strength ─────────────────────────────────────────────────────────

function calcStrength(pwd) {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd))          score++;
  if (/[^A-Za-z0-9]/.test(pwd))   score++;
  if (score <= 1) return { label: 'Weak',   color: '#ef4444', pct: 20 };
  if (score <= 2) return { label: 'Fair',   color: '#f59e0b', pct: 50 };
  if (score <= 3) return { label: 'Good',   color: '#3b82f6', pct: 75 };
  return           { label: 'Strong', color: '#22c55e', pct: 100 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PasswordInput({ value, onChange, show, onToggle, placeholder = '••••••••' }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
  color: '#1a2332',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestorSetup() {
  const navigate = useNavigate();

  // phase: 'loading' | 'setup' | 'submitting' | 'success' | 'expired'
  const [phase,      setPhase]      = useState('loading');
  const [email,      setEmail]      = useState('');
  const [investorId, setInvestorId] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [showCf,    setShowCf]    = useState(false);
  const [agreed,    setAgreed]    = useState(false);
  const [error,     setError]     = useState('');

  // ── Token verification on mount ────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // Path 1: token_hash in query string (our buildActivateUrl format)
      const params    = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      const type      = params.get('type') ?? 'invite';

      if (tokenHash) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        window.history.replaceState(null, '', window.location.pathname);
        if (error || !data?.session) {
          setTokenError('This invite link has expired or has already been used.');
          setPhase('expired');
          return;
        }
        // If they already completed setup, redirect straight to portal
        const { data: profileRow1 } = await supabase
          .from('profiles').select('has_set_password').eq('id', data.session.user.id).single();
        if (profileRow1?.has_set_password) {
          navigate('/investor/home', { replace: true });
          return;
        }
        setEmail(data.session.user.email ?? '');
        setInvestorId(data.session.user.user_metadata?.investor_id ?? null);
        setPhase('setup');
        return;
      }

      // Path 2: hash-based tokens (#access_token=… — Supabase default redirect)
      // Supabase's initialize() microtask may strip the hash before this useEffect runs,
      // so we also check the sessionStorage backup saved by main.jsx before React mounted.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      let accessToken  = hash.get('access_token');
      let refreshToken = hash.get('refresh_token') ?? '';
      if (!accessToken) {
        const backup = sessionStorage.getItem('ll_invite_hash');
        if (backup) {
          sessionStorage.removeItem('ll_invite_hash');
          const b = new URLSearchParams(backup.slice(1));
          accessToken  = b.get('access_token') ?? '';
          refreshToken = b.get('refresh_token') ?? '';
        }
      }

      if (accessToken) {
        const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, '', window.location.pathname);
        if (error || !data?.session) {
          setTokenError('This invite link has expired or has already been used.');
          setPhase('expired');
          return;
        }
        // Check if already set up — send them directly to portal
        const { data: profileRow } = await supabase
          .from('profiles').select('has_set_password').eq('id', data.session.user.id).single();
        if (profileRow?.has_set_password) {
          navigate('/investor/home', { replace: true });
          return;
        }
        setEmail(data.session.user.email ?? '');
        setInvestorId(data.session.user.user_metadata?.investor_id ?? null);
        setPhase('setup');
        return;
      }

      // Last resort: Supabase may have auto-processed the hash token and already
      // established a session before useEffect ran. If a session exists and the
      // user hasn't completed setup yet, show the form using that session.
      const { data: existing } = await supabase.auth.getSession();
      if (existing?.session?.user) {
        const { data: profileRow } = await supabase
          .from('profiles').select('has_set_password').eq('id', existing.session.user.id).single();
        if (profileRow?.has_set_password) {
          navigate('/investor/home', { replace: true });
          return;
        }
        setEmail(existing.session.user.email ?? '');
        setInvestorId(existing.session.user.user_metadata?.investor_id ?? null);
        setPhase('setup');
        return;
      }

      // No token — show the expired/invalid state
      setTokenError('No invite token found. Please use the link from your invitation email.');
      setPhase('expired');
    }
    init();
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    setPhase('submitting');

    // 1. Set password
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setError(pwError.message);
      setPhase('setup');
      return;
    }

    // 2. Upsert profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').upsert({
        id:               user.id,
        email:            user.email,
        first_name:       firstName.trim(),
        last_name:        lastName.trim(),
        name:             `${firstName.trim()} ${lastName.trim()}`,
        phone:            phone.trim(),
        account_type:     'investor',
        role:             'investor',
        has_set_password: true,
      }, { onConflict: 'id' });
    }

    // 3. Activate investor record (links auth_user_id, sets status='active')
    if (investorId) {
      const { error: rpcError } = await supabase.rpc('activate_investor_account', {
        p_investor_id: investorId,
      });
      if (rpcError) console.warn('activate_investor_account:', rpcError.message);
    }

    // 4. Show success then redirect
    setPhase('success');
    setTimeout(() => navigate('/investor/home', { replace: true }), 2200);
  };

  const strength = calcStrength(password);

  // ── Shared shell ───────────────────────────────────────────────────────────
  const Shell = ({ children }) => (
    <div style={{ background: '#0F1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      {children}
    </div>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <img
          src="/lotline-logo.png"
          alt="LotLine"
          style={{ height: 48, width: 'auto', filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)' }}
        />
        <div style={{ width: 32, height: 32, border: '3px solid rgba(232,100,42,0.25)', borderTopColor: '#E8642A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Verifying your invite link…</p>
      </div>
    </Shell>
  );

  // ── Expired / invalid ──────────────────────────────────────────────────────
  if (phase === 'expired') return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2332', marginBottom: 10 }}>Link Expired</h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 20 }}>
          {tokenError || 'This invite link has expired or has already been used.'}
        </p>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
          Please contact your LotLine investment manager to request a new invite.
          <br />
          <a href="mailto:naaman@lotlinehomes.com" style={{ color: '#E8642A', textDecoration: 'none', fontWeight: 600 }}>naaman@lotlinehomes.com</a>
        </p>
        <button
          onClick={() => navigate('/investor/login')}
          style={{ background: '#E8642A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}
        >
          ← Back to Investor Login
        </button>
      </div>
    </Shell>
  );

  // ── Success ────────────────────────────────────────────────────────────────
  if (phase === 'success') return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', border: '3px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2332', marginBottom: 8 }}>Account Created!</h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>Taking you to your portal…</p>
        <div style={{ marginTop: 20, width: 32, height: 32, border: '3px solid rgba(232,100,42,0.25)', borderTopColor: '#E8642A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '20px auto 0' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Shell>
  );

  // ── Setup form ─────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 480, width: '100%' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/lotline-logo.png"
            alt="LotLine"
            style={{ height: 48, width: 'auto', filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)' }}
          />
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(232,100,42,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
            Investor Portal
          </p>
        </div>

        {/* Header */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2332', marginBottom: 6 }}>
          Welcome to LotLine Investor Portal
        </h1>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 13, color: '#6b7280' }}>
          Setting up account for: <span style={{ fontWeight: 600, color: '#1a2332' }}>{email}</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Smith"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Create Password *</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              show={showPw}
              onToggle={() => setShowPw(v => !v)}
              placeholder="Min. 8 characters"
            />
            {/* Strength bar */}
            {strength && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, background: '#e5e7eb', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, borderRadius: 99, transition: 'width 0.3s, background 0.3s' }} />
                </div>
                <p style={{ fontSize: 11, color: strength.color, marginTop: 4, fontWeight: 600 }}>{strength.label}</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label style={labelStyle}>Confirm Password *</label>
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              show={showCf}
              onToggle={() => setShowCf(v => !v)}
            />
            {confirm && password !== confirm && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords do not match</p>
            )}
          </div>

          {/* Terms */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingTop: 4 }}>
            <input
              id="tos"
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 2, cursor: 'pointer', accentColor: '#E8642A' }}
            />
            <label htmlFor="tos" style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, cursor: 'pointer' }}>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#E8642A', textDecoration: 'none', fontWeight: 600 }}>Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#E8642A', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={phase === 'submitting' || !firstName || !lastName || !password || !confirm || !agreed}
            style={{
              background: (phase === 'submitting' || !firstName || !lastName || !password || !confirm || !agreed) ? '#94a3b8' : '#E8642A',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '13px 20px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%',
              marginTop: 4,
              opacity: phase === 'submitting' ? 0.8 : 1,
            }}
          >
            {phase === 'submitting' ? 'Setting up your account…' : 'Set Up My Account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
          Already have an account?{' '}
          <a href="/investor/login" style={{ color: '#E8642A', textDecoration: 'none', fontWeight: 600 }}>Sign in →</a>
        </p>
      </div>
    </Shell>
  );
}
