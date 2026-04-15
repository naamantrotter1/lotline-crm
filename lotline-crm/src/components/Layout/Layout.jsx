import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const AUTO_COLLAPSE_ROUTES = ['/flood-map'];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setCollapsed(AUTO_COLLAPSE_ROUTES.includes(location.pathname));
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-cream dark:bg-gray-900">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main className="flex-1 overflow-auto p-6 dark:bg-gray-900 dark:text-gray-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
