/**
 * /investor
 * Public landing page for the Investor Portal.
 * Accessible without authentication — serves as the entry point for investors.
 */
import { Link } from 'react-router-dom';

export default function InvestorLanding() {
  return (
    <div
      className="flex items-center justify-center p-8"
      style={{ background: '#f5f3ee', minHeight: '100vh' }}
    >
      <div className="w-full max-w-sm text-center">

        {/* Logo */}
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
          <span className="text-xs font-semibold text-accent/70 uppercase tracking-widest">
            Investor Portal
          </span>
        </div>

        <h1 className="text-3xl font-bold text-[#1a2332] mb-3">
          Your investment hub
        </h1>
        <p className="text-sm text-gray-500 mb-10 leading-relaxed">
          Track your deals, distributions, and performance — all in one place.
        </p>

        <div className="space-y-3">
          <Link
            to="/investor/login"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-white text-center"
            style={{ backgroundColor: '#c9703a' }}
          >
            Sign in to your account
          </Link>
          <Link
            to="/investor/signup"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-[#1a2332] text-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Create investor account
          </Link>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            LotLine operator?{' '}
            <Link to="/login" className="text-gray-500 hover:text-accent hover:underline font-medium">
              Sign in to the CRM
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
