/**
 * Middle column of the HubSpot-style deal detail layout.
 * "Activity" — unified feed with tabs: Overview, Notes, Tasks, Files, DD, Development, Realized.
 * PR 1 scaffold: renders existing tab content in the new columnar shell.
 * Full activity feed, threads, inline composer land in PR 3.
 */
import { useState } from 'react';
import {
  StickyNote, CheckSquare, Paperclip, FileText, Hammer, TrendingUp, LayoutGrid, MessageSquare,
} from 'lucide-react';

const TABS = [
  { key: 'overview',    label: 'Overview',     icon: LayoutGrid  },
  { key: 'notes',       label: 'Notes',        icon: StickyNote  },
  { key: 'tasks',       label: 'Tasks',        icon: CheckSquare },
  { key: 'dd',          label: 'Due Diligence',icon: FileText    },
  { key: 'dev',         label: 'Development',  icon: Hammer      },
  { key: 'realized',    label: 'Realized',     icon: TrendingUp  },
  { key: 'files',       label: 'Files',        icon: Paperclip   },
];

export default function DealMiddleColumn({
  deal,
  activeTab,
  setActiveTab,
  // slot-rendered content
  children,
  tabsToShow,
}) {
  const visibleTabs = tabsToShow
    ? TABS.filter(t => tabsToShow.includes(t.key))
    : TABS;

  return (
    <div className="h-full flex flex-col bg-gray-50/50 min-w-0">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex overflow-x-auto">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {children}
      </div>
    </div>
  );
}
