/**
 * Cost-breakdown Export button.
 *
 * Renders a small button with a 3-format dropdown (Excel / CSV / PDF).
 * Click handler delegates to src/lib/dealExport.js exporters which
 * build a normalized payload and trigger a client-side download.
 *
 * Operator-only — investor surfaces render InvestorDealDetail.jsx instead
 * and never mount this component.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { exportToXlsx, exportToCsv, exportToPdf } from '../../lib/dealExport';

export default function ExportButton({ deal, costLines }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  const run = async (fn) => {
    setOpen(false);
    try {
      await fn(deal || {}, costLines || []);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[dealExport] failed', err);
      alert('Export failed — see console for details.');
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
        title="Export cost breakdown"
      >
        <Download size={13} />
        Export
        <ChevronDown size={12} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 bg-white border border-gray-200 rounded shadow-lg py-1">
          <DropdownItem onClick={() => run(exportToXlsx)} label="Excel (.xlsx)" hint="Default" />
          <DropdownItem onClick={() => run(exportToCsv)}  label="CSV" />
          <DropdownItem onClick={() => run(exportToPdf)}  label="PDF" />
        </div>
      )}
    </div>
  );
}

function DropdownItem({ onClick, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 text-left"
    >
      <span>{label}</span>
      {hint ? <span className="text-[10px] text-gray-400 uppercase tracking-widest">{hint}</span> : null}
    </button>
  );
}
