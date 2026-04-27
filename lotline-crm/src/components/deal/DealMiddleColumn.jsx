/**
 * Middle column of the HubSpot-style deal detail layout.
 * "Activity" — wraps existing tab content with a clean tab bar.
 * Full unified feed + inline composer + month-grouped timeline land in PR 3.
 */
import { LayoutGrid, FileText, Hammer, DollarSign, Layers, MessageSquare, CreditCard, CalendarDays } from 'lucide-react';

const ALL_TABS = [
  { key: 'overview',   label: 'Activity',        icon: LayoutGrid   },
  { key: 'events',     label: 'Events',          icon: CalendarDays },
  { key: 'threads',    label: 'Threads',         icon: MessageSquare },
  { key: 'details',    label: 'Deal Details',    icon: Layers       },
  { key: 'dd',         label: 'Due Diligence',   icon: FileText     },
  { key: 'dev',        label: 'Development',     icon: Hammer       },
  { key: 'realized',   label: 'Cost Breakdown',  icon: DollarSign   },
  { key: 'financing',  label: 'Financing',       icon: CreditCard   },
];

// Tabs that manage their own internal scroll (no outer padding/scroll wrapper)
const SELF_SCROLL_TABS = new Set(['threads']);

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
  costOverrideCount,
  costLineCount,
}) {
  const selfScroll = SELF_SCROLL_TABS.has(activeTab);
  const visibleTabs = tabsToShow
    ? ALL_TABS.filter(t => tabsToShow.includes(t.key))
    : ALL_TABS;

  const getLabel = (tab) => {
    if (tab.key === 'dd'       && ddCount  != null) return `DD (${ddCount}/${ddTotal})`;
    if (tab.key === 'dev'      && devCount != null) return `Dev (${devCount}/${devTotal})`;
    if (tab.key === 'realized' && costOverrideCount != null) {
      return `Cost Breakdown${costOverrideCount > 0 ? ` (${costOverrideCount})` : ''}`;
    }
    return tab.label;
  };

  const getTitle = (tab) => {
    if (tab.key === 'realized' && costOverrideCount != null && costLineCount != null) {
      return `${costOverrideCount} manually-entered actuals out of ${costLineCount} line items`;
    }
    return undefined;
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f7f4] min-w-0">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div
          className="flex overflow-x-auto px-2"
          role="tablist"
          aria-label="Deal activity sections"
          aria-orientation="horizontal"
        >
          {visibleTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                id={`deal-tab-${tab.key}`}
                aria-selected={active}
                aria-controls={`deal-panel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                title={getTitle(tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <Icon size={13} className={active ? 'text-accent' : 'text-gray-400'} aria-hidden="true" />
                {getLabel(tab)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area — self-scrolling tabs get no outer scroll/padding */}
      {selfScroll
        ? <div role="tabpanel" id={`deal-panel-${activeTab}`} aria-labelledby={`deal-tab-${activeTab}`} className="flex-1 overflow-hidden">{children}</div>
        : <div role="tabpanel" id={`deal-panel-${activeTab}`} aria-labelledby={`deal-tab-${activeTab}`} className="flex-1 overflow-y-auto p-4 md:p-5">{children}</div>
      }
    </div>
  );
}
