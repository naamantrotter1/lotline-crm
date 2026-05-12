import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateToSupabase } from './lib/migrate.js'

// Apply dark mode from localStorage before first render to avoid flash
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}

// Rescue Supabase invite/recovery tokens that land on / instead of /investor-setup.
// Must run before React mounts — Supabase's implicit-flow client runs initialize() as
// a microtask and strips the hash BEFORE useEffect (a macrotask) can read it.
// We save the hash to sessionStorage here so InvestorSetup can recover it either way.
if (window.location.pathname === '/') {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const token = hashParams.get('access_token');
  const type  = hashParams.get('type');
  if (token && (type === 'invite' || type === 'recovery' || type === 'magiclink')) {
    sessionStorage.setItem('ll_invite_hash', window.location.hash);
    window.history.replaceState(null, '', '/investor-setup' + window.location.hash);
  }
}

// User profile lives in AuthContext (sourced from the `profiles` table) — no
// localStorage copy needed.
// Run one-time migration to Supabase (no-op if already done or Supabase not configured)
migrateToSupabase();

createRoot(document.getElementById('root')).render(<App />)
