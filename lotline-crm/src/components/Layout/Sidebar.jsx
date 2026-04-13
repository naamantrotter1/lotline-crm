import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Target, TrendingUp, BarChart2, Map, Users,
  Home, Leaf, Search, Wrench, DollarSign,
  Calculator, Building, Database, MapPin, HardHat, Archive, Settings,
  Droplets, ChevronRight, Globe, Landmark, Building2,
} from 'lucide-react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
      { icon: Target, label: 'Big Rocks', to: '/big-rocks' },
      { icon: TrendingUp, label: 'P&L Dashboard', to: '/pnl' },
      { icon: BarChart2, label: 'Analytics', to: '/analytics' },
      { icon: Users, label: 'Investor Portal', to: '/investors' },
    ],
  },
  {
    label: 'Pipelines',
    items: [
      { icon: Home, label: 'Deal Overview', to: '/pipelines/deal-overview' },
      { icon: Leaf, label: 'Land Acquisition', to: '/pipelines/land' },
      { icon: Search, label: 'Due Diligence', to: '/pipelines/due-diligence' },
      { icon: Wrench, label: 'Development', to: '/pipelines/development' },
      { icon: DollarSign, label: 'Sales', to: '/pipelines/sales' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { icon: Globe, label: 'Map Search', to: '/flood-map' },
      { icon: Map, label: 'Market Research', to: '/intelligence' },
      { icon: Home, label: 'Order Home', to: '/homes' },
      { icon: Landmark, label: 'Capital & Partnerships', to: '/lending' },
      { icon: Calculator, label: 'Deal Calculator', to: '/calculator' },
      { icon: Building, label: 'Home Models', to: '/home-models' },
      { icon: HardHat, label: 'Contractor Database', to: '/contractors' },
      { icon: Archive, label: 'Archived Deals', to: '/archived' },
      { icon: Settings, label: 'Settings', to: '/settings' },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className="flex-shrink-0 h-screen overflow-y-auto flex flex-col transition-all duration-300"
      style={{
        width: collapsed ? '64px' : '250px',
        backgroundColor: '#1a2332',
        color: 'white',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-4 border-b border-white/10">
        <img
          src="/lotline-logo.png"
          alt="LotLine Homes"
          style={{
            height: collapsed ? '28px' : '42px',
            width: 'auto',
            filter: 'brightness(0) saturate(100%) invert(55%) sepia(60%) saturate(500%) hue-rotate(330deg) brightness(105%)',
          }}
        />
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <p className="px-4 mb-1 text-xs font-semibold uppercase tracking-widest text-white/30">
                {section.label}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors relative group ${
                    isActive
                      ? 'bg-white/10 text-white font-medium border-l-2 border-accent -ml-0'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={16} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom user area */}
      {!collapsed && (
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              NT
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-medium truncate">Naaman Trotter</p>
              <p className="text-white/40 text-xs truncate">Admin</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
