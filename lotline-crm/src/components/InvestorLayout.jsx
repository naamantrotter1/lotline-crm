import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, Bell, DollarSign,
  TrendingUp, MessageSquare, LogOut, Menu, X, ChevronRight,
  Eye, EyeOff,
} from 'lucide-react';
import { useAuth, useImpersonation } from '../lib/AuthContext';
import { logImpersonationEnd } from '../lib/investorPortalData';

const NAV = [
  { to: '/investor/home',           icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/investor/deals',          icon: Briefcase,       label: 'My Deals'        },
  { to: '/investor/distributions',  icon: DollarSign,      label: 'Distributions'   },
  { to: '/investor/updates',        icon: Bell,            label: 'Updates'         },
  { to: '/investor/documents',      icon: FileText,        label: 'Documents'       },
  { to: '/investor/opportunities',  icon: TrendingUp,      label: 'Opportunities'   },
  { to: '/investor/messages',       icon: MessageSquare,   label: 'Messages'        },
];

export default function InvestorLayout() {
  const { profile, investorRecord, signOut } = useAuth();
  const { impersonating, setImpersonating }  = useImpersonation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The investor we're viewing as — either real (investor-role) or impersonated (operator)
  const activeInvestor = impersonating?.investor ?? investorRecord;
  const displayName    = activeInvestor?.name ?? profile?.name ?? 'Investor';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const stopImpersonating = async () => {
    if (impersonating?.logId) await logImpersonationEnd(impersonating.logId);
    setImpersonating(null);
    navigate('/investors', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-[#0f1117] text-white">
      {/* ── Mobile header ─────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#161b22] border-b border-white/10 flex items-center justify-between px-4 h-14">
        <span className="font-bold text-accent text-sm">LotLine Investor</span>
        <button onClick={() => setSidebarOpen(v => !v)} className="text-gray-400 hover:text-white">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-20 w-64 bg-[#161b22] border-r border-white/10
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        pt-14 md:pt-0
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-1">Investor Portal</p>
          <p className="text-sm font-bold text-white leading-snug">{displayName}</p>
          {impersonating && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
              <Eye size={9} /> Operator view
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {impersonating ? (
            <button
              onClick={stopImpersonating}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <EyeOff size={16} /> Exit investor view
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut size={16} /> Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Backdrop on mobile */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-10 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet context={{ investor: activeInvestor }} />
      </main>
    </div>
  );
}
