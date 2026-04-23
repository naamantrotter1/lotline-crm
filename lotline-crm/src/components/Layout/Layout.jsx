import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import JvScopeBanner from '../JV/JvScopeBanner';

const AUTO_COLLAPSE_ROUTES = ['/flood-map'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function Layout() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Auto-collapse on certain routes (desktop only)
  useEffect(() => {
    if (!isMobile) {
      setCollapsed(AUTO_COLLAPSE_ROUTES.includes(location.pathname));
    }
  }, [location.pathname, isMobile]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleToggle = () => {
    if (isMobile) setMobileOpen(o => !o);
    else setCollapsed(o => !o);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-cream dark:bg-gray-900">
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={closeMobile}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onMobileClose={closeMobile}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onToggleSidebar={handleToggle} />
        <JvScopeBanner />
        <main className="flex-1 overflow-auto p-4 md:p-6 dark:bg-gray-900 dark:text-gray-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
