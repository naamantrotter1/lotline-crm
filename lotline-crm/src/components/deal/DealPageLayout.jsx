/**
 * 3-column resizable layout shell for the deal detail page.
 * Uses react-resizable-panels v4. Column widths auto-persist to localStorage
 * via autoSaveId (user+deal scoped).
 *
 * Default widths: left 22%, middle 52%, right 26%.
 * Collapses to mobile tab-switcher at < 1024px.
 *
 * headerHeight: measured dynamically by DealDetail via ResizeObserver.
 * Falls back to 148px if not provided.
 */
import { useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useAuth } from '../../lib/AuthContext';

const DEFAULT_L = 22;
const DEFAULT_R = 26;
// TopBar height (h-14 = 56px). Used in the calc when no dynamic measurement.
const TOPBAR_H = 56;

export default function DealPageLayout({ left, middle, right, dealId, headerHeight = 148 }) {
  const { profile } = useAuth();
  // v2 prefix busts the old localStorage cache that caused narrow columns
  const autoSaveId = `deal-layout-v2-${profile?.id || 'anon'}-${dealId || 'x'}`;
  // Use 100dvh (dynamic viewport units) for better mobile browser support
  const layoutH = `calc(100dvh - ${TOPBAR_H}px - ${headerHeight}px)`;

  return (
    <>
      {/* Desktop: 3-column resizable */}
      <div className="hidden lg:block" style={{ height: layoutH, minHeight: '480px', width: '100%' }}>
        <PanelGroup
          direction="horizontal"
          autoSaveId={autoSaveId}
          style={{ height: '100%', width: '100%' }}
          aria-label="Deal detail columns"
        >
          {/* Left — Information */}
          <Panel
            id="left"
            order={1}
            defaultSize={DEFAULT_L}
            minSize={15}
            maxSize={40}
            style={{ overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}
            aria-label="Deal information"
          >
            {left}
          </Panel>

          <PanelResizeHandle
            style={{
              width: '4px',
              background: '#e5e7eb',
              cursor: 'col-resize',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            className="hover:!bg-accent/40"
            aria-label="Resize left column"
          />

          {/* Middle — Activity */}
          <Panel
            id="middle"
            order={2}
            defaultSize={100 - DEFAULT_L - DEFAULT_R}
            minSize={30}
            style={{ overflow: 'hidden' }}
            aria-label="Deal activity"
          >
            {middle}
          </Panel>

          <PanelResizeHandle
            style={{
              width: '4px',
              background: '#e5e7eb',
              cursor: 'col-resize',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            className="hover:!bg-accent/40"
            aria-label="Resize right column"
          />

          {/* Right — Associations */}
          <Panel
            id="right"
            order={3}
            defaultSize={DEFAULT_R}
            minSize={15}
            maxSize={40}
            style={{ overflow: 'hidden', borderLeft: '1px solid #e5e7eb' }}
            aria-label="Deal associations"
          >
            {right}
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile (< 1024px): tab-based single column */}
      <MobileLayout left={left} middle={middle} right={right} layoutH={layoutH} />
    </>
  );
}

function MobileLayout({ left, middle, right, layoutH }) {
  const TABS = [
    { key: 'info',  label: 'Info'     },
    { key: 'feed',  label: 'Activity' },
    { key: 'assoc', label: 'Links'    },
  ];
  const [active, setActive] = useState('feed');
  const content = active === 'info' ? left : active === 'feed' ? middle : right;

  return (
    <div className="flex flex-col lg:hidden" style={{ height: layoutH, minHeight: '480px' }}>
      {/* Mobile column tabs */}
      <div
        className="flex border-b border-gray-200 bg-white flex-shrink-0"
        role="tablist"
        aria-label="Deal sections"
        aria-orientation="horizontal"
      >
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            id={`mobile-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`mobile-panel-${t.key}`}
            onClick={() => setActive(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              active === t.key ? 'border-accent text-accent' : 'border-transparent text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`mobile-panel-${active}`}
        aria-labelledby={`mobile-tab-${active}`}
        className="flex-1 overflow-hidden"
      >
        {content}
      </div>
    </div>
  );
}
