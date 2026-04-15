import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateToSupabase } from './lib/migrate.js'

// Apply dark mode from localStorage before first render to avoid flash
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}

// crm_user is now set by AuthContext after login (based on the user's profile)
// Run one-time migration to Supabase (no-op if already done or Supabase not configured)
migrateToSupabase();

createRoot(document.getElementById('root')).render(<App />)
