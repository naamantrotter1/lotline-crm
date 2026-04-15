import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
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

  return (
    <div className="min-h-screen flex" style={{ background: '#f5f3ee' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-80 p-10 flex-shrink-0"
        style={{ backgroundColor: '#1a2332' }}
      >
        <div>
          <img
            src="/lotline-logo.png"
            alt="LotLine Homes"
            style={{
              height: '40px',
              width: 'auto',
              filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)',
            }}
          />
          <p className="text-white/40 text-sm mt-3">Deal Flow Pro</p>
        </div>

        <div className="space-y-6">
          {[
            { label: 'Land Acquisition', desc: 'Track every lead from first contact to contract.' },
            { label: 'Real-Time Sync',   desc: 'Changes appear instantly across all devices and teammates.' },
            { label: 'Role-Based Access',desc: 'Control exactly who can view or edit deal data.' },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{f.label}</p>
                <p className="text-white/40 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-white/20 text-xs">© 2025 LotLine Homes</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <img
              src="/lotline-logo.png"
              alt="LotLine Homes"
              style={{
                height: '36px',
                width: 'auto',
                filter: 'brightness(0) saturate(100%) sepia(60%) saturate(600%) hue-rotate(330deg) brightness(100%)',
              }}
            />
          </div>

          <h1 className="text-2xl font-bold text-[#1a2332] mb-1">Welcome back</h1>
          <p className="text-sm text-gray-400 mb-8">Sign in to your LotLine account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: loading || !email || !password ? '#94a3b8' : '#c9703a' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Don't have an account? Contact your admin to get access.
          </p>
        </div>
      </div>
    </div>
  );
}
