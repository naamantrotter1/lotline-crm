import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, CheckCircle, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

async function fetchInvite(token) {
  const { data, error } = await supabase
    .from('organization_invitations')
    .select('*, organizations(name, slug)')
    .eq('token', token)
    .maybeSingle();
  return { data, error };
}

async function callAcceptApi(token, accessToken) {
  const res = await fetch('/api/team/accept-invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ token }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to accept invitation');
  return json;
}

/* ── Shared page shell ── */
function Shell({ children }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: '#f5f3ee' }}
    >
      {children}
    </div>
  );
}

/* ── Status-only card (loading, errors, success) ── */
function StatusCard({ icon, title, message, children }) {
  return (
    <Shell>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 w-full max-w-sm text-center">
        <div className="flex justify-center mb-5">{icon}</div>
        <h1 className="text-xl font-bold mb-2" style={{ color: '#1a2332' }}>{title}</h1>
        {message && <p className="text-sm text-gray-500 leading-relaxed mb-6">{message}</p>}
        {children}
      </div>
    </Shell>
  );
}

/* ── Password input with show/hide toggle ── */
function PasswordInput({ value, onChange, placeholder = 'Password', ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm pr-11 focus:outline-none focus:ring-2 focus:border-transparent"
        style={{ '--tw-ring-color': 'rgba(200,97,58,0.3)' }}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const { session, refreshProfile } = useAuth();

  const [invite,    setInvite]    = useState(null);
  const [phase,     setPhase]     = useState('loading');
  const [error,     setError]     = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');

  useEffect(() => {
    if (!token) { setPhase('invalid'); return; }
    fetchInvite(token).then(({ data, error }) => {
      if (error || !data)                        { setPhase('invalid');  return; }
      if (data.status === 'accepted')            { setPhase('accepted'); return; }
      if (data.status === 'canceled')            { setPhase('invalid');  return; }
      if (new Date(data.expires_at) < new Date()) { setPhase('expired'); return; }
      setInvite(data);
      setEmail(data.email || '');
      setPhase(session ? 'confirm' : 'sign-up');
    });
  }, [token]);

  useEffect(() => {
    if (session && phase === 'sign-up') setPhase('confirm');
  }, [session]);

  async function handleAccept() {
    setPhase('joining');
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (!sess?.access_token) throw new Error('Not logged in');
      await callAcceptApi(token, sess.access_token);
      await refreshProfile(sess.user.id);
      setPhase('done');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setPhase('signing-up');
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { name: fullName, first_name: firstName.trim(), last_name: lastName.trim() } },
      });
      if (signUpErr) throw signUpErr;
      if (!data.session) { setPhase('check-email'); return; }
      await new Promise(r => setTimeout(r, 800));
      if (fullName) {
        await supabase.from('profiles').update({
          name:       fullName,
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
        }).eq('id', data.user.id);
      }
      await callAcceptApi(token, data.session.access_token);
      await refreshProfile(data.user.id);
      setPhase('done');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  /* ── Status screens ── */
  if (phase === 'loading') return (
    <StatusCard icon={<Loader2 size={40} className="text-accent animate-spin" />} title="Loading invitation…" message="" />
  );
  if (phase === 'invalid') return (
    <StatusCard icon={<AlertCircle size={40} className="text-red-400" />} title="Invalid invitation" message="This invitation link is not valid or has been canceled.">
      <Link to="/" className="text-sm font-semibold text-accent hover:underline">Go to LotLine →</Link>
    </StatusCard>
  );
  if (phase === 'expired') return (
    <StatusCard icon={<AlertCircle size={40} className="text-amber-400" />} title="Invitation expired" message="This link expired after 7 days. Ask your team admin to send a new one.">
      <Link to="/" className="text-sm font-semibold text-accent hover:underline">Go to LotLine →</Link>
    </StatusCard>
  );
  if (phase === 'accepted') return (
    <StatusCard icon={<CheckCircle size={40} className="text-green-500" />} title="Already accepted" message="This invitation has already been used.">
      <Link to="/" className="text-sm font-semibold text-accent hover:underline">Go to your workspace →</Link>
    </StatusCard>
  );
  if (phase === 'done') return (
    <StatusCard icon={<CheckCircle size={40} className="text-green-500" />} title="You're in!" message={`Welcome to ${invite?.organizations?.name ?? 'the workspace'}. Taking you there now…`} />
  );
  if (phase === 'joining' || phase === 'signing-up') return (
    <StatusCard icon={<Loader2 size={40} className="text-accent animate-spin" />} title={phase === 'joining' ? 'Joining workspace…' : 'Setting up your account…'} message="" />
  );
  if (phase === 'check-email') return (
    <StatusCard icon={<CheckCircle size={40} className="text-green-500" />} title="Check your email" message="We sent a confirmation link to your inbox. Click it to verify, then return here to join." />
  );
  if (phase === 'error') return (
    <StatusCard icon={<AlertCircle size={40} className="text-red-400" />} title="Something went wrong" message={error}>
      <button onClick={() => { setError(''); setPhase(session ? 'confirm' : 'sign-up'); }} className="text-sm font-semibold text-accent hover:underline">
        Try again
      </button>
    </StatusCard>
  );

  /* ── Main invite card ── */
  const orgName   = invite?.organizations?.name ?? 'a workspace';
  const roleLabel = { admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }[invite?.role] ?? invite?.role;
  const ROLE_COLOR = { admin: '#7c3aed', operator: '#c8613a', viewer: '#0ea5e9' };
  const roleColor = ROLE_COLOR[invite?.role] ?? '#c8613a';

  return (
    <Shell>
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

          {/* Header */}
          <div className="relative px-8 pt-10 pb-8 text-center" style={{ background: '#1a2332' }}>
            {/* Logo mark */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <rect x="4" y="14" width="24" height="14" rx="2" fill="white" fillOpacity="0.9"/>
                  <polygon points="0,16 16,2 32,16" fill="white"/>
                  <rect x="12" y="20" width="8" height="8" rx="1" fill="#1a2332"/>
                </svg>
              </div>
            </div>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-2">LotLine Homes</p>
            <h1 className="text-2xl font-bold text-white mb-3">You're invited!</h1>

            {/* Org + role pill */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-white/70 text-sm">Join</span>
              <span className="text-white font-semibold text-sm">{orgName}</span>
              <span className="text-white/70 text-sm">as</span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: `${roleColor}25`, color: roleColor, border: `1px solid ${roleColor}40` }}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-7">

            {/* ── Confirm: already signed in ── */}
            {phase === 'confirm' && (
              <div className="text-center">
                <div className="bg-gray-50 rounded-2xl px-5 py-4 mb-5">
                  <p className="text-xs text-gray-400 mb-0.5">Signed in as</p>
                  <p className="font-semibold text-sm" style={{ color: '#1a2332' }}>{session?.user?.email}</p>
                </div>

                {session?.user?.email?.toLowerCase() !== invite?.email?.toLowerCase() && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-5 text-left">
                    <strong>Heads up:</strong> This invite was sent to <strong>{invite?.email}</strong>.
                    Please sign in with that account to continue.
                  </div>
                )}

                <button
                  onClick={handleAccept}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#c8613a' }}
                >
                  Join {orgName} <ArrowRight size={16} />
                </button>
                <button
                  onClick={async () => { await supabase.auth.signOut(); setPhase('sign-in'); }}
                  className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Use a different account
                </button>
              </div>
            )}

            {/* ── Create account form ── */}
            {phase === 'sign-up' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Jane"
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Smith"
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  {invite?.email && email.toLowerCase() !== invite.email.toLowerCase() && (
                    <p className="text-xs text-amber-600 mt-1.5">Must match the invited email: {invite.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
                  <PasswordInput
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                  <PasswordInput
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={6}
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#c8613a' }}
                >
                  Create account &amp; Join
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-5">
          By joining you agree to LotLine's{' '}
          <Link to="/terms" className="hover:underline text-gray-500">Terms</Link>
          {' & '}
          <Link to="/privacy" className="hover:underline text-gray-500">Privacy Policy</Link>
        </p>
      </div>
    </Shell>
  );
}
