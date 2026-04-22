import { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * Small ⓘ button that shows a plain-English definition on hover/tap.
 * side: 'top' | 'bottom'
 */
export default function InfoTooltip({ text, side = 'top' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className="text-gray-600 hover:text-gray-400 transition-colors ml-1 flex-shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
        aria-label="More information"
      >
        <HelpCircle size={11} />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`
            absolute z-50 w-56 bg-[#0f1117] border border-white/15 rounded-xl
            px-3 py-2.5 text-[11px] text-gray-300 leading-relaxed shadow-2xl
            pointer-events-none whitespace-normal
            ${side === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
              : 'top-full left-1/2 -translate-x-1/2 mt-2'}
          `}
        >
          {text}
          <span className={`
            absolute left-1/2 -translate-x-1/2 border-4 border-transparent
            ${side === 'top'
              ? 'top-full border-t-[#0f1117]'
              : 'bottom-full border-b-[#0f1117]'}
          `} />
        </span>
      )}
    </span>
  );
}
