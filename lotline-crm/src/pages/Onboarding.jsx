import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white';

function ErrorBox({ children }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
      {children}
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────
function Steps({ current, total }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`w-6 h-1.5 rounded-full ${
              i < current ? 'bg-accent' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-400">
        Step {current} of {total}
      </span>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { refreshProfile, session } = useAuth();
  const navigate = useNavigate();

  // step: 1 = company name, 2 = slug review, 3 = done
  const [step, setStep] = useState(1);

  const [orgName,  setOrgName]  = useState('');
  const [slug,     setSlug]     = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Auto-derive slug from name until user edits it manually
  function handleNameChange(val) {
    setOrgName(val);
    if (!slugTouched) setSlug(slugify(val));
  }

  function handleSlugChange(val) {
    setSlugTouched(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  // Step 1 → Step 2: just validate locally
  function handleStep1(e) {
    e.preventDefault();
    setError('');
    if (!orgName.trim()) return;
    if (!slug || slug.length < 3) {
      setError('Workspace URL must be at least 3 characters.');
      return;
    }
    setStep(2);
  }

  // Step 2 → create org
  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: rpcError } = await supabase.rpc('create_organization', {
      p_name: orgName.trim(),
      p_slug: slug,
    });

    if (rpcError) {
      // Friendly messages for common violations
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

    // Refresh the profile so active_organization_id is set in AuthContext
    if (session?.user?.id) {
      await refreshProfile(session.user.id);
    }

    setStep(3);
    setLoading(false);
  }

  function handleFinish() {
    navigate('/dashboard', { replace: true });
  }

  return (
    <div
      className="flex-1 flex items-center justify-center p-8"
      style={{ background: '#f5f3ee', minHeight: '100vh' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="/lotline-logo.png"
            alt="LotLine"
            style={{
              height: '64px',
              width: 'auto',
              filter:
                'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)',
            }}
          />
        </div>

        {/* ── Step 1: Name your workspace ── */}
        {step === 1 && (
          <>
            <Steps current={1} total={2} />
            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">
              Set up your workspace
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              This is your organization's home in LotLine. You can change these
              details later in Settings.
            </p>

            <form onSubmit={handleStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Company / Organization name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Acme Land Holdings"
                  required
                  autoFocus
                  className={inputClass}
                />
              </div>

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
                <p className="text-xs text-gray-400 mt-1">
                  Lowercase letters, numbers, and hyphens only.
                </p>
              </div>

              {error && <ErrorBox>{error}</ErrorBox>}

              <button
                type="submit"
                disabled={!orgName.trim() || !slug}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: !orgName.trim() || !slug ? '#94a3b8' : '#c9703a' }}
              >
                Continue
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Confirm and create ── */}
        {step === 2 && (
          <>
            <Steps current={2} total={2} />
            <h1 className="text-2xl font-bold text-[#1a2332] mb-1">
              Confirm your workspace
            </h1>
            <p className="text-sm text-gray-400 mb-8">
              Everything looks good? Hit Create to launch your workspace.
            </p>

            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 mb-6">
              <div className="px-4 py-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                  Organization
                </p>
                <p className="text-sm font-semibold text-gray-900">{orgName}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                  Workspace URL
                </p>
                <p className="text-sm font-medium text-gray-700">
                  lotline.app/<span className="font-semibold text-gray-900">{slug}</span>
                </p>
              </div>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <form onSubmit={handleCreate} className="space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: loading ? '#94a3b8' : '#c9703a' }}
              >
                {loading ? 'Creating workspace…' : 'Create workspace'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="w-full py-3 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
            </form>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c9703a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#1a2332] mb-2 text-center">
              Workspace ready!
            </h1>
            <p className="text-sm text-gray-500 text-center mb-8">
              <span className="font-semibold text-gray-700">{orgName}</span> is all
              set. You can invite team members and configure your workspace from
              Settings.
            </p>
            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: '#c9703a' }}
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
