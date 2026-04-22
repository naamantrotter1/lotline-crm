import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, Bell, DollarSign,
  TrendingUp, MessageSquare, LogOut, Menu, X,
  Eye, EyeOff, ChevronDown,
} from 'lucide-react';
import { useAuth, useImpersonation } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { logImpersonationEnd, fetchAllInvestors, fetchInvestorNamesFromDeals } from '../lib/investorPortalData';
import NotificationsBell from './investor/NotificationsBell';

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
  const { canEdit, canAdmin }                = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [investors, setInvestors]       = useState([]);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [pickerOpen, setPickerOpen]     = useState(false);

  const isOperator = canEdit || canAdmin;

  // Operators: fetch investor list for the picker — try investors table first, fall back to deal data
  useEffect(() => {
    if (!isOperator || investorRecord) return;
    fetchAllInvestors().then(({ investors: list }) => {
      if (list.length > 0) {
        setInvestors(list);
      } else {
        fetchInvestorNamesFromDeals().then(({ investors: fallback }) => setInvestors(fallback));
      }
    });
  }, [isOperator, investorRecord]);

  // The investor we're viewing as — impersonated > selected (operator picker) > linked record
  const activeInvestor = impersonating?.investor ?? selectedInvestor ?? investorRecord;
  const displayName    = activeInvestor?.name ?? (isOperator ? 'Select Investor' : 'Investor');

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
        <div className="flex items-center gap-2">
          <NotificationsBell investorId={activeInvestor?.id} />
          <button onClick={() => setSidebarOpen(v => !v)} className="text-gray-400 hover:text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-20 w-64 bg-[#161b22] border-r border-white/10
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        pt-14 md:pt-0
      `}>
        {/* Logo / Investor picker */}
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mb-1">Investor Portal</p>

          {isOperator && !impersonating ? (
            <div className="relative">
              <button
                onClick={() => setPickerOpen(v => !v)}
                className="flex items-center justify-between w-full text-sm font-bold text-white hover:text-accent transition-colors"
              >
                <span className="truncate">{displayName}</span>
                <ChevronDown size={14} className={`flex-shrink-0 ml-1 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
              </button>
              {pickerOpen && (
                <div className="absolute left-0 top-full mt-1 w-full bg-[#0f1117] border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                  {investors.length === 0 ? (
                    <p className="text-xs text-gray-500 px-3 py-2">No investors found</p>
                  ) : investors.map(inv => (
                    <button
                      key={inv.id}
                      onClick={() => { setSelectedInvestor(inv); setPickerOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                        selectedInvestor?.id === inv.id ? 'text-accent' : 'text-gray-300'
                      }`}
                    >
                      {inv.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-white leading-snug">{displayName}</p>
          )}

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
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-16 md:pb-0">
        <Outlet context={{ investor: activeInvestor }} />
      </main>

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#161b22] border-t border-white/10 flex items-center">
        {[
          { to: '/investor/home',          icon: LayoutDashboard, label: 'Home'    },
          { to: '/investor/deals',         icon: Briefcase,       label: 'Deals'   },
          { to: '/investor/distributions', icon: DollarSign,      label: 'Returns' },
          { to: '/investor/updates',       icon: Bell,            label: 'Updates' },
          { to: '/investor/messages',      icon: MessageSquare,   label: 'Inbox'   },
        ].map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-center transition-colors ${
                isActive ? 'text-accent' : 'text-gray-500'
              }`
            }
          >
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
