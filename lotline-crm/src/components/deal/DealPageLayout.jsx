/**
 * 3-column resizable layout shell for the deal detail page.
 * Uses react-resizable-panels v4. Column widths auto-persist to localStorage
 * via autoSaveId (user+deal scoped). Upgrading to Supabase persistence is PR 6.
 *
 * Default widths: left 22%, middle 52%, right 26%.
 * Collapses to mobile tab-switcher at < 1024px.
 */
import { useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useAuth } from '../../lib/AuthContext';

const DEFAULT_L = 22;
const DEFAULT_R = 26;

export default function DealPageLayout({ left, middle, right, dealId }) {
  const { profile } = useAuth();
  const autoSaveId = `deal-layout-${profile?.id || 'anon'}-${dealId || 'x'}`;

  return (
    <>
      {/* Desktop: 3-column resizable */}
      <div className="hidden lg:block" style={{ height: 'calc(100vh - 56px - 148px)', minHeight: '480px' }}>
        <PanelGroup
          direction="horizontal"
          autoSaveId={autoSaveId}
          style={{ height: '100%' }}
        >
          {/* Left — Information */}
          <Panel
            id="left"
            order={1}
            defaultSize={DEFAULT_L}
            minSize={15}
            maxSize={40}
            style={{ overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}
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
          />

          {/* Middle — Activity */}
          <Panel
            id="middle"
            order={2}
            defaultSize={100 - DEFAULT_L - DEFAULT_R}
            minSize={30}
            style={{ overflow: 'hidden' }}
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
          />

          {/* Right — Associations */}
          <Panel
            id="right"
            order={3}
            defaultSize={DEFAULT_R}
            minSize={15}
            maxSize={40}
            style={{ overflow: 'hidden', borderLeft: '1px solid #e5e7eb' }}
          >
            {right}
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile (< 1024px): tab-based single column */}
      <MobileLayout left={left} middle={middle} right={right} />
    </>
  );
}

function MobileLayout({ left, middle, right }) {
  const TABS = [
    { key: 'info',  label: 'Info'     },
    { key: 'feed',  label: 'Activity' },
    { key: 'assoc', label: 'Links'    },
  ];
  const [active, setActive] = useState('feed');
  const content = active === 'info' ? left : active === 'feed' ? middle : right;

  return (
    <div className="flex flex-col lg:hidden" style={{ height: 'calc(100vh - 56px - 148px)', minHeight: '480px' }}>
      {/* Mobile column tabs */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              active === t.key ? 'border-accent text-accent' : 'border-transparent text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );
}
