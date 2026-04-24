/**
 * JvJoinPage — /join/:token
 * Public signup page for JV partner invitation links.
 * Creates a new account + org and auto-establishes the JV partnership.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Building2, CheckCircle, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function JvJoinPage() {
  const { token } = useParams();
  const navigate  = useNavigate();

  // Invitation metadata (loaded from the token)
  const [invite,      setInvite]      = useState(null);   // { hubOrgName, inviteeEmail, notes }
  const [lookupErr,   setLookupErr]   = useState('');
  const [lookupDone,  setLookupDone]  = useState(false);

  // Form state
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [orgName,     setOrgName]     = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [formErr,     setFormErr]     = useState('');
  const [success,     setSuccess]     = useState(false);

  // ── Lookup the invitation token on mount ──────────────────────────────────
  useEffect(() => {
    if (!token) { setLookupErr('No invitation token provided.'); setLookupDone(true); return; }
    fetch(`/api/jv/invite-lookup?token=${token}`)
      .then(r => r.json().then(j => ({ ok: r.ok, json: j })))
      .then(({ ok, json }) => {
        if (ok) {
          setInvite(json);
          setFirstName('');
        } else {
          setLookupErr(json.error || 'Invalid invitation link.');
        }
      })
      .catch(() => setLookupErr('Could not load invitation. Please try again.'))
      .finally(() => setLookupDone(true));
  }, [token]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setFormErr('');
    if (!firstName.trim()) return setFormErr('First name is required.');
    if (!orgName.trim())   return setFormErr('Company / org name is required.');
    if (password.length < 8) return setFormErr('Password must be at least 8 characters.');
    if (password !== confirmPwd) return setFormErr('Passwords do not match.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/jv/invite-accept', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, firstName, lastName, orgName, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormErr(json.error || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setFormErr('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inp = 'w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors placeholder:text-gray-300';
  const lbl = 'block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide';

  const shell = 'min-h-screen w-full flex items-center justify-center px-4 py-12';
  const shellStyle = { background: '#f5f3ee' };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (!lookupDone) {
    return (
      <div className={shell} style={shellStyle}>
        <Loader2 size={28} className="animate-spin text-accent" />
      </div>
    );
  }

  // ── Invalid / expired invitation ──────────────────────────────────────────
  if (lookupErr) {
    return (
      <div className={shell} style={shellStyle}>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={26} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-[#1a2332] mb-2">Invitation Unavailable</h1>
          <p className="text-sm text-gray-500 mb-6">{lookupErr}</p>
          <Link to="/login" className="text-sm font-semibold text-accent hover:underline">
            Sign in to an existing account →
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className={shell} style={shellStyle}>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={26} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-[#1a2332] mb-2">Account Created!</h1>
          <p className="text-sm text-gray-500 mb-2">
            Your CRM workspace is ready and your JV partnership with{' '}
            <strong>{invite?.hubOrgName}</strong> is active.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Sign in with <strong>{invite?.inviteeEmail}</strong> and the password you just created.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-accent text-white text-sm font-bold rounded-xl hover:bg-accent/90 transition-colors"
          >
            Go to Login →
          </button>
        </div>
      </div>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────
  return (
    <div className={shell} style={shellStyle}>
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#1a2332] flex items-center justify-center mx-auto mb-4">
            <Building2 size={22} className="text-white" />
          </div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">LotLine Homes</p>
          <h1 className="text-2xl font-bold text-[#1a2332] mb-2">Partner Invitation</h1>
          <p className="text-sm text-gray-500">
            <strong className="text-gray-700">{invite?.hubOrgName}</strong> has invited you to join as a Joint Venture partner.
          </p>
          {invite?.notes && (
            <p className="mt-3 text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 italic">
              &ldquo;{invite.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-8">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">
            Create your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First name *</label>
                <input className={inp} value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane" autoFocus />
              </div>
              <div>
                <label className={lbl}>Last name</label>
                <input className={inp} value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Smith" />
              </div>
            </div>

            {/* Email (locked) */}
            <div>
              <label className={lbl}>Email</label>
              <input className={inp + ' opacity-50 cursor-not-allowed bg-gray-50'} value={invite?.inviteeEmail || ''} readOnly />
            </div>

            {/* Org name */}
            <div>
              <label className={lbl}>Company / organization name *</label>
              <input className={inp} value={orgName} onChange={e => setOrgName(e.target.value)}
                placeholder="Smith Land Partners LLC" />
              <p className="text-[11px] text-gray-400 mt-1.5">This will be the name of your CRM workspace.</p>
            </div>

            {/* Password */}
            <div>
              <label className={lbl}>Password *</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={inp + ' pr-10'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className={lbl}>Confirm password *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                className={inp}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            {formErr && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="flex-shrink-0" />
                {formErr}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-accent text-white text-sm font-bold rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? 'Creating your account…' : 'Create Account & Accept Partnership'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-accent font-semibold hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-5 leading-relaxed">
          By creating an account you agree to become a Joint Venture partner with{' '}
          <strong className="text-gray-500">{invite?.hubOrgName}</strong>.
        </p>
      </div>
    </div>
  );
}
