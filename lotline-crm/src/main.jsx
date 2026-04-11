import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply dark mode from localStorage before first render to avoid flash
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}

// Expose CRM user for Homes iframe pre-fill
localStorage.setItem('crm_user', JSON.stringify({ name: 'Naaman Trotter', email: '' }));

createRoot(document.getElementById('root')).render(<App />)
