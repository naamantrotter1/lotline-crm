/**
 * Slide-over drawer for reordering and toggling visibility of record sections.
 * Renders as an absolute overlay inside the left column.
 * Uses HTML5 Drag-and-Drop API — no extra dependencies.
 */
import { useState, useRef } from 'react';
import { X, GripVertical, Eye, EyeOff, RotateCcw, Check, Loader2 } from 'lucide-react';

export default function CustomizeRecordDrawer({
  sections,        // [{ key, label, visible, order }]
  onChange,        // (newSections) => void  — live update
  onSave,          // async (sections) => void
  onReset,         // () => void
  onClose,
  saving = false,
}) {
  const [items, setItems] = useState(() =>
    [...sections].sort((a, b) => a.order - b.order)
  );

  // ── Drag state ──────────────────────────────────────────────────────────────
  const dragIdx  = useRef(null);
  const dragOver = useRef(null);

  const onDragStart = (e, idx) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Minimal ghost — browser default is fine
  };

  const onDragEnter = (_, idx) => {
    if (dragIdx.current === idx) return;
    dragOver.current = idx;
    setItems(prev => {
      const next = [...prev];
      const [dragged] = next.splice(dragIdx.current, 1);
      next.splice(idx, 0, dragged);
      dragIdx.current = idx;
      return next;
    });
  };

  const onDragEnd = () => {
    const reordered = items.map((s, i) => ({ ...s, order: i }));
    setItems(reordered);
    onChange(reordered);
    dragIdx.current  = null;
    dragOver.current = null;
  };

  // ── Visibility toggle ───────────────────────────────────────────────────────
  const toggleVisible = (key) => {
    setItems(prev => {
      const next = prev.map(s => s.key === key ? { ...s, visible: !s.visible } : s);
      onChange(next);
      return next;
    });
  };

  const handleSave = () => {
    onSave(items.map((s, i) => ({ ...s, order: i })));
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="absolute inset-0 z-50 flex flex-col bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div>
            <p className="text-[13px] font-bold text-[#1a2332]">Customize Sections</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Drag to reorder · toggle eye to hide</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Section list */}
        <div className="flex-1 overflow-y-auto py-2">
          {items.map((section, idx) => (
            <div
              key={section.key}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragEnter={e => onDragEnter(e, idx)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-grab active:cursor-grabbing select-none transition-colors ${
                dragIdx.current === idx ? 'bg-accent/5' : 'hover:bg-gray-50/80'
              }`}
            >
              {/* Drag handle */}
              <GripVertical size={15} className="text-gray-300 flex-shrink-0" />

              {/* Label */}
              <span className={`flex-1 text-[13px] font-medium ${section.visible ? 'text-gray-800' : 'text-gray-300'}`}>
                {section.label}
              </span>

              {/* Visibility toggle */}
              <button
                onClick={() => toggleVisible(section.key)}
                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  section.visible
                    ? 'text-accent hover:bg-accent/10'
                    : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                }`}
                title={section.visible ? 'Hide section' : 'Show section'}
              >
                {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/60 flex-shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-accent px-3 py-2 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saving
              ? <Loader2 size={13} className="animate-spin" />
              : <Check size={13} />
            }
            {saving ? 'Saving…' : 'Save Layout'}
          </button>
        </div>
      </div>
    </>
  );
}
