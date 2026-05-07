import { useMemo } from 'react';

const OPTIONS = [
  { value: 'same_as_closing', label: 'Same day as closing' },
  { value: '1', label: '1st of month' },
  { value: '5', label: '5th of month' },
  { value: '10', label: '10th of month' },
  { value: '15', label: '15th of month' },
  { value: 'last_day', label: 'Last day of month' },
  { value: 'custom', label: 'Custom day…' },
];

const PRESET_VALUES = new Set(OPTIONS.map((o) => o.value));

function applyDueDay(date, dueDay) {
  if (!dueDay || dueDay === 'same_as_closing') return date;
  const d = new Date(date);
  if (dueDay === 'last_day') {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d;
  }
  const day = parseInt(dueDay, 10);
  if (!Number.isFinite(day) || day < 1) return date;
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PaymentDueDayPicker({
  value,
  onChange,
  capitalDeployedDate,
  readOnly = false,
}) {
  const effectiveValue = value || 'same_as_closing';
  const isCustom = !PRESET_VALUES.has(effectiveValue) && /^\d+$/.test(String(effectiveValue));
  const selectValue = isCustom ? 'custom' : effectiveValue;

  const helper = useMemo(() => {
    if (!capitalDeployedDate) {
      return value ? 'Set capital deployed date to calculate payment dates' : '';
    }
    const start = new Date(capitalDeployedDate);
    if (Number.isNaN(start.getTime())) return '';
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    const adjusted = applyDueDay(next, effectiveValue);
    return `First payment due: ${formatDate(adjusted)}`;
  }, [capitalDeployedDate, effectiveValue, value]);

  const handleSelectChange = (e) => {
    const v = e.target.value;
    if (v === 'custom') {
      onChange?.(isCustom ? String(effectiveValue) : '15');
    } else {
      onChange?.(v);
    }
  };

  const handleCustomChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') {
      onChange?.('custom');
      return;
    }
    const n = Math.max(1, Math.min(28, parseInt(raw, 10)));
    onChange?.(String(n));
  };

  const inputCls =
    'w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30';

  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">
        Payment Due Day
      </p>
      <div className="flex gap-2 items-center">
        <select
          value={selectValue}
          onChange={handleSelectChange}
          disabled={readOnly}
          className={inputCls}
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {selectValue === 'custom' && (
          <input
            type="number"
            min={1}
            max={28}
            value={isCustom ? effectiveValue : ''}
            onChange={handleCustomChange}
            placeholder="1–28"
            disabled={readOnly}
            className={`${inputCls} w-24`}
          />
        )}
      </div>
      {helper && <p className="text-[11px] text-gray-500 mt-1">{helper}</p>}
    </div>
  );
}
