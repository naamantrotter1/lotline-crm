import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Loader2, CheckCircle, AlertCircle, ArrowRight, Building2 } from 'lucide-react';

async function fetchInvite(token) {
  // Look up by token (RLS: anyone can read by token — handled in migration 011 policy)
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

/* ── Loading / error states ── */
function StatusCard({ icon, title, message, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f5f3ee' }}>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-sidebar mb-2">{title}</h1>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        {children}
      </div>
    </div>
  );
}

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate  = useNavigate();
  const { session, refreshProfile } = useAuth();

  const [invite,   setInvite]   = useState(null);
  const [phase,    setPhase]    = useState('loading'); // loading | invalid | expired | accepted | confirm | signing-up | joining | done | error
  const [error,    setError]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');

  // 1. Fetch invite on mount
  useEffect(() => {
    if (!token) { setPhase('invalid'); return; }
    fetchInvite(token).then(({ data, error }) => {
      if (error || !data) { setPhase('invalid'); return; }
      if (data.status === 'accepted') { setPhase('accepted'); return; }
      if (data.status === 'canceled') { setPhase('invalid'); return; }
      if (new Date(data.expires_at) < new Date()) { setPhase('expired'); return; }
      setInvite(data);
      setEmail(data.email || '');
      setPhase(session ? 'confirm' : 'sign-in');
    });
  }, [token]);

  // 2. When session appears while in sign-in phase (e.g. after sign-up), re-check
  useEffect(() => {
    if (session && phase === 'sign-in') setPhase('confirm');
  }, [session]);

  // Accept — called when the logged-in user clicks "Join workspace"
  async function handleAccept() {
    setPhase('joining');
    try {
      const { data: { session: sess } } = await supabase.auth.getSession();
      const accessToken = sess?.access_token;
      if (!accessToken) throw new Error('Not logged in');

      await callAcceptApi(token, accessToken);
      await refreshProfile(sess.user.id);
      setPhase('done');
      setTimeout(() => navigate('/'), 2000);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  // Sign up with invitation email, then accept
  async function handleSignUp(e) {
    e.preventDefault();
    setPhase('signing-up');
    try {
      // Sign up the user
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email:    email.trim(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (signUpErr) throw signUpErr;
      if (!data.session) {
        // Email confirmation required — unlikely in most setups but handle it
        setPhase('check-email');
        return;
      }

      // Wait for DB trigger to create profile
      await new Promise(r => setTimeout(r, 800));

      // Update name in profile
      if (name.trim()) {
        await supabase.from('profiles').update({
          name:       name.trim(),
          first_name: name.trim().split(' ')[0],
          last_name:  name.trim().split(' ').slice(1).join(' ') || '',
        }).eq('id', data.user.id);
      }

      // Accept the invite
      await callAcceptApi(token, data.session.access_token);
      setPhase('done');
      setTimeout(() => navigate('/'), 2000);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  // Sign in with existing account
  async function handleSignIn(e) {
    e.preventDefault();
    setPhase('signing-up'); // re-use loading state
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInErr) {
      setError(signInErr.message);
      setPhase('sign-in');
      return;
    }
    // onAuthStateChange will fire → session appears → useEffect sets phase='confirm'
  }

  /* ── Render ── */

  if (phase === 'loading') {
    return (
      <StatusCard
        icon={<Loader2 size={36} className="text-accent animate-spin" />}
        title="Loading invitation…"
        message=""
      />
    );
  }

  if (phase === 'invalid') {
    return (
      <StatusCard
        icon={<AlertCircle size={36} className="text-red-400" />}
        title="Invalid invitation"
        message="This invitation link is not valid or has been canceled."
      >
        <Link to="/" className="text-sm font-semibold text-accent hover:underline">Go to LotLine →</Link>
      </StatusCard>
    );
  }

  if (phase === 'expired') {
    return (
      <StatusCard
        icon={<AlertCircle size={36} className="text-amber-400" />}
        title="Invitation expired"
        message="This invitation link expired after 7 days. Ask your team admin to send a new one."
      >
        <Link to="/" className="text-sm font-semibold text-accent hover:underline">Go to LotLine →</Link>
      </StatusCard>
    );
  }

  if (phase === 'accepted') {
    return (
      <StatusCard
        icon={<CheckCircle size={36} className="text-green-500" />}
        title="Already accepted"
        message="This invitation has already been used."
      >
        <Link to="/" className="text-sm font-semibold text-accent hover:underline">Go to your workspace →</Link>
      </StatusCard>
    );
  }

  if (phase === 'done') {
    return (
      <StatusCard
        icon={<CheckCircle size={36} className="text-green-500" />}
        title="You're in!"
        message={`Welcome to ${invite?.organizations?.name ?? 'the workspace'}. Redirecting…`}
      />
    );
  }

  if (phase === 'joining') {
    return (
      <StatusCard
        icon={<Loader2 size={36} className="text-accent animate-spin" />}
        title="Joining workspace…"
        message=""
      />
    );
  }

  if (phase === 'signing-up') {
    return (
      <StatusCard
        icon={<Loader2 size={36} className="text-accent animate-spin" />}
        title="Creating your account…"
        message=""
      />
    );
  }

  if (phase === 'check-email') {
    return (
      <StatusCard
        icon={<CheckCircle size={36} className="text-green-500" />}
        title="Check your email"
        message="We sent a confirmation link to your email. Click it to verify, then return here to join the workspace."
      />
    );
  }

  if (phase === 'error') {
    return (
      <StatusCard
        icon={<AlertCircle size={36} className="text-red-400" />}
        title="Something went wrong"
        message={error}
      >
        <button
          onClick={() => setPhase(session ? 'confirm' : 'sign-in')}
          className="text-sm font-semibold text-accent hover:underline"
        >
          Try again
        </button>
      </StatusCard>
    );
  }

  /* ── Confirmed invitation card (header shared across confirm/sign-in/sign-up) ── */
  const orgName  = invite?.organizations?.name ?? 'a workspace';
  const roleLabel = { admin: 'Admin', operator: 'Operator', viewer: 'Viewer' }[invite?.role] ?? invite?.role;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f5f3ee' }}>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100" style={{ background: '#1a2332' }}>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-white/10">
              <Building2 size={28} className="text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-1">You're invited!</h1>
          <p className="text-white/60 text-sm">
            Join <span className="text-white font-semibold">{orgName}</span> as <span className="text-accent font-semibold">{roleLabel}</span>
          </p>
        </div>

        <div className="px-8 py-6">
          {/* Confirmed: user is already logged in */}
          {phase === 'confirm' && (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">Signed in as</p>
              <p className="font-semibold text-sidebar mb-6">{session?.user?.email}</p>
              {session?.user?.email?.toLowerCase() !== invite?.email?.toLowerCase() && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 mb-4 text-left">
                  <strong>Note:</strong> This invitation was sent to <strong>{invite?.email}</strong>.
                  If you continue, the join will fail. Please sign in with the correct account.
                </div>
              )}
              <button
                onClick={handleAccept}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#c8613a' }}
              >
                Join {orgName} <ArrowRight size={15} />
              </button>
              <button
                onClick={async () => { await supabase.auth.signOut(); setPhase('sign-in'); }}
                className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600"
              >
                Use a different account
              </button>
            </div>
          )}

          {/* Not logged in: show sign-in + sign-up tabs */}
          {(phase === 'sign-in' || phase === 'sign-up') && (
            <>
              <div className="flex bg-gray-100 rounded-lg p-1 mb-5">
                {['sign-in', 'sign-up'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPhase(p)}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${phase === p ? 'bg-white text-sidebar shadow-sm' : 'text-gray-500'}`}
                  >
                    {p === 'sign-in' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {phase === 'sign-in' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: '#c8613a' }}
                  >
                    Sign in &amp; Join
                  </button>
                </form>
              )}

              {phase === 'sign-up' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    {invite?.email && email.toLowerCase() !== invite.email.toLowerCase() && (
                      <p className="text-xs text-amber-600 mt-1">Must match the invited email: {invite.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      required
                      minLength={6}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: '#c8613a' }}
                  >
                    Create account &amp; Join
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
