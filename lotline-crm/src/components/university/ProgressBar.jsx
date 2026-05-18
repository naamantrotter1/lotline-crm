// Slim progress bar used on course cards + lesson rows.
export default function ProgressBar({ value = 0, max = 1, className = '', tone = 'accent' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fillColor = tone === 'accent'   ? '#c8613a'
                  : tone === 'success'  ? '#16a34a'
                  : tone === 'muted'    ? '#9ca3af'
                  : tone;
  return (
    <div className={`h-1.5 w-full rounded-full bg-gray-100 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: fillColor }}
      />
    </div>
  );
}
