import { useState } from 'react';
import { Menu, Bell, Moon, Sun } from 'lucide-react';

export default function TopBar({ onToggleSidebar }) {
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('darkMode') === 'true'
  );

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('darkMode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-4 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
            1
          </span>
        </button>

        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold ml-1">
          NT
        </div>
      </div>
    </header>
  );
}
