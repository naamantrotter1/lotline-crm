/**
 * HelpModal.jsx
 * Phase 8: Keyboard shortcuts + quick-links reference modal.
 */
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SHORTCUTS = [
  { key: '/',         desc: 'Focus global search' },
  { key: 'Esc',       desc: 'Close modal / clear search' },
  { key: 'C',         desc: 'Quick-add contact (TopBar button)' },
  { key: 'T',         desc: 'Quick-add task (TopBar button)' },
  { key: '⌘ K',      desc: 'Open command palette (browser)' },
];

const QUICK_LINKS = [
  { label: 'Pipeline — Land Acquisition',  path: '/pipelines/land' },
  { label: 'Pipeline — Deal Overview',     path: '/pipelines/deal-overview' },
  { label: 'Contacts',                     path: '/contacts' },
  { label: 'Tasks',                        path: '/tasks' },
  { label: 'Team Settings',               path: '/settings?tab=team' },
  { label: 'Custom Fields',               path: '/settings?tab=custom-fields' },
  { label: 'Security (2FA)',              path: '/settings?tab=security' },
  { label: 'Import CSV',                  path: '/contacts' },
];

export default function HelpModal({ onClose }) {
  const navigate = useNavigate();

  const go = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-96 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Help & Shortcuts</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Keyboard shortcuts */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Keyboard Shortcuts</p>
            <ul className="space-y-2.5">
              {SHORTCUTS.map(s => (
                <li key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{s.desc}</span>
                  <kbd className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-mono border border-gray-200 flex-shrink-0 ml-2">
                    {s.key}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Navigation</p>
            <ul className="grid grid-cols-2 gap-1">
              {QUICK_LINKS.map(l => (
                <li key={l.path}>
                  <button
                    onClick={() => go(l.path)}
                    className="w-full text-left text-sm text-accent hover:underline py-0.5"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer tip */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700">
            Press <kbd className="bg-orange-100 px-1 rounded font-mono">?</kbd> anywhere to open this panel.
          </div>
        </div>
      </div>
    </div>
  );
}
