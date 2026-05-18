// Top-nav wrapper shared by /university, /feed, /events, /leaderboard. Sits
// INSIDE the main app Layout (so the global Sidebar is still present).
import { NavLink, Outlet } from 'react-router-dom';
import { GraduationCap, Newspaper, Calendar, Trophy, Settings } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const TABS = [
  { to: '/university/feed',        label: 'Feed',        icon: Newspaper },
  { to: '/university/classroom',   label: 'Classroom',   icon: GraduationCap },
  { to: '/university/events',      label: 'Events',      icon: Calendar },
  { to: '/university/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export default function UniversityLayout() {
  const { orgIsUniversityPublisher } = useAuth();
  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <nav className="flex items-center">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to} to={to} end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`
                }
              >
                <Icon size={14} /> {label}
              </NavLink>
            ))}
          </nav>
          {orgIsUniversityPublisher && (
            <NavLink
              to="/university/admin"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  isActive ? 'border-accent text-accent bg-orange-50' : 'border-gray-200 text-gray-600 hover:border-accent/40'}`
              }
            >
              <Settings size={11} /> Publisher tools
            </NavLink>
          )}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
