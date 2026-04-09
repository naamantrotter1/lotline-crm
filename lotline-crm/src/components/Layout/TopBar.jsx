import { useState } from 'react';
import { Menu, Search, Bell, Moon, Sun } from 'lucide-react';

export default function TopBar({ onToggleSidebar }) {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 max-w-md relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search deals, properties, investors..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-accent/30 text-gray-700 placeholder-gray-400"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
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
