import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { marketing } from '../../content/marketing';

/* ─── Nav ─── */
function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const navBase =
    'fixed top-0 left-0 right-0 z-50 transition-all duration-200';
  const navBg = scrolled
    ? 'bg-white/95 backdrop-blur shadow-sm'
    : 'bg-transparent';

  const linkCls = (href) => {
    const active = location.pathname === href;
    return `text-sm font-medium transition-colors ${
      active
        ? 'text-accent'
        : scrolled
        ? 'text-sidebar hover:text-accent'
        : 'text-white/90 hover:text-white'
    }`;
  };

  return (
    <nav className={`${navBase} ${navBg}`}>
      <div className="w-full px-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img
              src="/lotline-logo.png"
              alt="LotLine"
              className="h-8 w-auto"
              style={{
                filter: scrolled
                  ? 'brightness(0) saturate(100%) invert(28%) sepia(15%) saturate(900%) hue-rotate(185deg) brightness(90%)'
                  : 'brightness(0) invert(1)',
              }}
            />
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                scrolled ? 'bg-accent/10 text-accent' : 'bg-white/20 text-white'
              }`}
            >
              DealFlow Pro
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {marketing.nav.links.map((l) => (
              <Link key={l.href} to={l.href} className={linkCls(l.href)}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                scrolled
                  ? 'text-sidebar hover:text-accent'
                  : 'text-white/90 hover:text-white'
              }`}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Start free trial
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${
              scrolled ? 'text-sidebar hover:bg-gray-100' : 'text-white hover:bg-white/10'
            }`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {marketing.nav.links.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className="text-sm font-medium text-sidebar py-2.5 px-3 rounded-lg hover:bg-cream hover:text-accent transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 pt-3 mt-2 flex flex-col gap-2">
              <Link
                to="/login"
                className="text-sm font-medium text-sidebar py-2.5 px-3 rounded-lg hover:bg-cream text-center"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-sm font-semibold bg-accent text-white py-2.5 px-3 rounded-lg text-center hover:bg-accent/90 transition-colors"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Footer ─── */
function MarketingFooter() {
  const { footer } = marketing;
  return (
    <footer className="bg-sidebar text-white/70">
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <img
              src="/lotline-logo.png"
              alt="LotLine"
              className="h-8 w-auto mb-3"
              style={{ filter: 'brightness(0) invert(1) opacity(0.9)' }}
            />
            <p className="text-sm leading-relaxed text-white/50">
              The deal management platform built for land acquisition professionals.
            </p>
          </div>

          {/* Link columns */}
          {footer.columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.href}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/35">{footer.copyright}</p>
          <p className="text-xs text-white/35">
            Built for land investors, by land investors.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Layout wrapper ─── */
export default function MarketingLayout({ children }) {
  return (
    <div className="flex-1 min-h-screen flex flex-col font-sans">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
