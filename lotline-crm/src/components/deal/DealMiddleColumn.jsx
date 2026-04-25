/**
 * Middle column of the HubSpot-style deal detail layout.
 * "Activity" — wraps existing tab content with a clean tab bar.
 * Full unified feed + inline composer + month-grouped timeline land in PR 3.
 */
import { LayoutGrid, FileText, Hammer, TrendingUp, Layers } from 'lucide-react';

const ALL_TABS = [
  { key: 'overview',  label: 'Activity',      icon: LayoutGrid },
  { key: 'details',   label: 'Deal Details',  icon: Layers     },
  { key: 'dd',        label: 'Due Diligence', icon: FileText   },
  { key: 'dev',       label: 'Development',   icon: Hammer     },
  { key: 'realized',  label: 'Realized',      icon: TrendingUp },
];

export default function DealMiddleColumn({
  deal,
  activeTab,
  setActiveTab,
  children,
  tabsToShow,
  ddCount,
  ddTotal,
  devCount,
  devTotal,
}) {
  const visibleTabs = tabsToShow
    ? ALL_TABS.filter(t => tabsToShow.includes(t.key))
    : ALL_TABS;

  const getLabel = (tab) => {
    if (tab.key === 'dd'  && ddCount  != null) return `DD (${ddCount}/${ddTotal})`;
    if (tab.key === 'dev' && devCount != null) return `Dev (${devCount}/${devTotal})`;
    return tab.label;
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f7f4] min-w-0">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex overflow-x-auto px-2">
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <Icon size={13} className={active ? 'text-accent' : 'text-gray-400'} />
                {getLabel(tab)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        {children}
      </div>
    </div>
  );
}
