import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateToSupabase } from './lib/migrate.js'

// Apply dark mode from localStorage before first render to avoid flash
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}

// Rescue Supabase invite/recovery tokens that land on / instead of /investor-setup.
// This must run before React mounts — Supabase's implicit-flow client strips the hash
// from the URL on initialization, so by the time any component renders it's already gone.
if (window.location.pathname === '/') {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const token = hashParams.get('access_token');
  const type  = hashParams.get('type');
  if (token && (type === 'invite' || type === 'recovery')) {
    window.history.replaceState(null, '', '/investor-setup' + window.location.hash);
  }
}

// crm_user is now set by AuthContext after login (based on the user's profile)
// Run one-time migration to Supabase (no-op if already done or Supabase not configured)
migrateToSupabase();

createRoot(document.getElementById('root')).render(<App />)
