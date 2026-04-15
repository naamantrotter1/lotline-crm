import { useState, useEffect, useRef } from 'react';
import { Menu, Bell, Moon, Sun, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ALL_DEALS } from '../../data/deals';
import { useAuth } from '../../lib/AuthContext';

function GlobalSearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // "/" shortcut to focus
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setResults([]); setOpen(false); return; }

    const seen = new Set();
    const deals = ALL_DEALS.filter(d => {
      const text = [d.address, d.county, d.state, d.investor, d.financing, d.ownerName, d.sellerName, d.parcelId, d.zip, ...(d.tags || [])].filter(Boolean).join(' ').toLowerCase();
      return text.includes(q);
    }).slice(0, 6).map(d => ({ type: 'deal', id: d.id, label: d.address, sub: [d.county, d.state].filter(Boolean).join(', '), pipeline: d.pipeline, stage: d.stage }));

    // Unique investors
    const investors = ALL_DEALS.filter(d => d.investor && d.investor.toLowerCase().includes(q) && !seen.has(d.investor) && seen.add(d.investor))
      .slice(0, 3).map(d => ({ type: 'investor', id: d.investor, label: d.investor, sub: `${ALL_DEALS.filter(x => x.investor === d.investor).length} deals` }));

    // Unique counties
    const countySet = new Set();
    const counties = ALL_DEALS.filter(d => d.county && d.county.toLowerCase().includes(q) && !countySet.has(d.county) && countySet.add(d.county))
      .slice(0, 3).map(d => ({ type: 'county', id: d.county, label: `${d.county} County`, sub: d.state }));

    setResults([...deals, ...investors, ...counties]);
    setOpen(true);
  }, [query]);

  const handleSelect = (r) => {
    setOpen(false);
    setQuery('');
    if (r.type === 'deal') {
      if (r.pipeline === 'deal-overview') navigate(`/deal/${r.id}`);
      else if (r.pipeline === 'land-acquisition') navigate('/pipelines/land');
      else navigate('/pipelines/deal-overview');
    }
  };

  const typeIcon = (t) => t === 'deal' ? '📋' : t === 'investor' ? '👤' : '📍';
  const typeColor = (t) => t === 'deal' ? 'text-blue-600' : t === 'investor' ? 'text-purple-600' : 'text-green-600';

  return (
    <div className="relative flex-1 max-w-xl mx-4">
      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search deals, contacts, investors, counties..."
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none"
        />
        {query ? (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">/</span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <span className="text-base">{typeIcon(r.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{r.label}</p>
                {r.sub && <p className="text-xs text-gray-400 truncate">{r.sub}</p>}
              </div>
              <span className={`text-xs font-medium capitalize ${typeColor(r.type)}`}>{r.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ onToggleSidebar }) {
  const { profile } = useAuth();
  const initials = profile?.name
    ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (profile?.email ? profile.email.slice(0, 2).toUpperCase() : '?');

  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  );

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
      >
        <Menu size={18} />
      </button>

      <GlobalSearch />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">1</span>
        </button>
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold ml-1">{initials}</div>
      </div>
    </header>
  );
}
