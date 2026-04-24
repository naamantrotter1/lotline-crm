import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Target, TrendingUp, BarChart2, Map, Users, Zap,
  Home, Leaf, Search, Wrench, DollarSign,
  Calculator, Building, HardHat, Archive,
  Globe, Landmark, Building2, BookUser, CheckSquare, PieChart,
} from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { useJv } from '../../lib/JvContext';
import { isEnabled } from '../../lib/featureFlags';

const BASE_NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',       to: '/'           },
      { icon: Target,          label: 'Big Rocks',       to: '/big-rocks'  },
      { icon: TrendingUp,      label: 'P&L Dashboard',   to: '/pnl'        },
      { icon: BarChart2,       label: 'Analytics',       to: '/analytics'  },
      { icon: Users,           label: 'Investor Portal', to: '/investors'  },
      { icon: BookUser,        label: 'Contacts',        to: '/contacts'   },
      { icon: CheckSquare,     label: 'Tasks',           to: '/tasks'      },
      { icon: PieChart,        label: 'Reports',         to: '/reports'    },
      { icon: Zap,             label: 'Workflows',       to: '/workflows',  flag: 'WORKFLOWS' },
    ],
  },
  {
    label: 'Pipelines',
    items: [
      { icon: Home,       label: 'Deal Overview',    to: '/pipelines/deal-overview'  },
      { icon: Leaf,       label: 'Land Acquisition', to: '/pipelines/land'           },
      { icon: Search,     label: 'Due Diligence',    to: '/pipelines/due-diligence'  },
      { icon: Wrench,     label: 'Development',      to: '/pipelines/development'    },
      { icon: DollarSign, label: 'Sales',            to: '/pipelines/sales'          },
    ],
  },
  {
    label: 'Tools',
    items: [
      { icon: Globe,      label: 'Map',                    to: '/flood-map'       },
      { icon: Map,        label: 'Market Research',        to: '/intelligence'    },
      { icon: Home,       label: 'Order Home',             to: '/homes'           },
      { icon: Landmark,   label: 'Capital & Partnerships', to: '/lending'         },
      { icon: Building2,  label: 'Joint Ventures',         to: '/settings/joint-ventures', hubOnly: true },
      { icon: Calculator, label: 'Deal Calculator',        to: '/calculator'      },
      { icon: Building,   label: 'Home Models',            to: '/home-models'     },
      { icon: HardHat,    label: 'Contractor Database',    to: '/contractors'     },
      { icon: Archive,    label: 'Archived Deals',         to: '/archived'        },
    ],
  },
];

// Routes agents are allowed to see
const AGENT_ALLOWED    = new Set(['/pipelines/deal-overview', '/pipelines/sales', '/homes', '/flood-map']);
// Routes investor-role users are allowed to see
const INVESTOR_ALLOWED = new Set(['/investors']);

export default function Sidebar({ collapsed, mobileOpen, isMobile, onMobileClose }) {
  const { isAgent, isInvestor } = usePermissions();
  const { isJvHub } = useJv();

  const filterItems = (allowed) =>
    BASE_NAV_SECTIONS
      .map(section => ({ ...section, items: section.items.filter(item => allowed.has(item.to)) }))
      .filter(section => section.items.length > 0);

  const navSections = isAgent
    ? filterItems(AGENT_ALLOWED)
    : isInvestor
    ? filterItems(INVESTOR_ALLOWED)
    : BASE_NAV_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item =>
          (!item.hubOnly || isJvHub) &&
          (!item.flag   || isEnabled(item.flag))
        ),
      }));

  const handleNavClick = () => {
    if (isMobile) onMobileClose?.();
  };

  return (
    <aside
      className="flex-shrink-0 h-screen overflow-y-auto flex flex-col transition-all duration-300"
      style={{
        width: isMobile ? '250px' : (collapsed ? '64px' : '250px'),
        backgroundColor: '#1a2332',
        color: 'white',
        ...(isMobile ? {
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 50,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        } : {
          transition: 'width 0.3s ease',
        }),
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
                onClick={handleNavClick}
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
    </aside>
  );
}
