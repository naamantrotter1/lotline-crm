/**
 * 3-column resizable layout shell for the deal detail page.
 * Custom drag-resize — no react-resizable-panels dependency.
 *
 * Default widths: left 22%, middle fills, right 26%.
 * Persists sizes to localStorage (versioned key, minSize enforced on load).
 * Collapses to mobile tab-switcher at < 1024px.
 *
 * headerHeight: measured dynamically by DealDetail via ResizeObserver.
 */
import { useState, useRef, useCallback } from 'react';

const MIN_L  = 15;   // % minimum for left column
const MAX_L  = 40;
const MIN_R  = 15;   // % minimum for right column
const MAX_R  = 40;
const MIN_M  = 30;   // % minimum for middle column
const DEF_L  = 22;   // default left %
const DEF_R  = 26;   // default right %
const TOPBAR_H = 56;

// ── Resize handle ─────────────────────────────────────────────────────────────
function ResizeHandle({ onDragStart, side }) {
  return (
    <div
      onMouseDown={e => onDragStart(e, side)}
      aria-label={`Resize ${side} column`}
      role="separator"
      aria-orientation="vertical"
      className="flex-shrink-0 w-1 cursor-col-resize bg-gray-200 hover:bg-accent/50 transition-colors active:bg-accent"
      style={{ touchAction: 'none' }}
    />
  );
}

// ── Desktop 3-column layout ───────────────────────────────────────────────────
export default function DealPageLayout({ left, middle, right, dealId, headerHeight = 148 }) {
  const layoutH = `calc(100dvh - ${TOPBAR_H}px - ${headerHeight}px)`;

  // Always start at 22/52/26% — no localStorage persistence
  const [leftPct,  setLeftPct]  = useState(DEF_L);
  const [rightPct, setRightPct] = useState(DEF_R);
  const containerRef = useRef(null);
  const dragState    = useRef(null);

  const onDragStart = useCallback((e, side) => {
    e.preventDefault();
    const containerW = containerRef.current?.getBoundingClientRect().width ?? 1;
    dragState.current = { side, startX: e.clientX, startLeft: leftPct, startRight: rightPct, containerW };

    const onMove = (ev) => {
      if (!dragState.current) return;
      const { side, startX, startLeft, startRight, containerW } = dragState.current;
      const deltaPct = ((ev.clientX - startX) / containerW) * 100;

      if (side === 'left') {
        const newLeft = Math.max(MIN_L, Math.min(MAX_L, startLeft + deltaPct));
        // Ensure middle doesn't get crushed
        setLeftPct(prev => {
          const middle = 100 - newLeft - rightPct;
          return middle >= MIN_M ? newLeft : prev;
        });
      } else {
        const newRight = Math.max(MIN_R, Math.min(MAX_R, startRight - deltaPct));
        setRightPct(prev => {
          const middle = 100 - leftPct - newRight;
          return middle >= MIN_M ? newRight : prev;
        });
      }
    };

    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [leftPct, rightPct]);

  const middlePct = Math.max(MIN_M, 100 - leftPct - rightPct);

  return (
    <>
      {/* Desktop: 3-column drag-resize */}
      <div
        ref={containerRef}
        className="hidden lg:flex flex-row"
        style={{ height: layoutH, minHeight: '480px', width: '100%', overflow: 'hidden' }}
        aria-label="Deal detail columns"
      >
        {/* Left — Information */}
        <div
          style={{ width: `${leftPct}%`, overflow: 'hidden', borderRight: '1px solid #e5e7eb', flexShrink: 0 }}
          aria-label="Deal information"
        >
          {left}
        </div>

        <ResizeHandle onDragStart={onDragStart} side="left" />

        {/* Middle — Activity */}
        <div
          style={{ flex: 1, overflow: 'hidden', minWidth: `${MIN_M}%` }}
          aria-label="Deal activity"
        >
          {middle}
        </div>

        <ResizeHandle onDragStart={onDragStart} side="right" />

        {/* Right — Associations */}
        <div
          style={{ width: `${rightPct}%`, overflow: 'hidden', borderLeft: '1px solid #e5e7eb', flexShrink: 0 }}
          aria-label="Deal associations"
        >
          {right}
        </div>
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
