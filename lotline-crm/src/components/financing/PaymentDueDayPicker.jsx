import { useMemo } from 'react';

const OPTIONS = [
  { value: 'same_as_closing', label: 'Same day as closing' },
  { value: 'one_month_after_closing', label: '1 month after closing' },
  { value: '1', label: '1st of month' },
  { value: '5', label: '5th of month' },
  { value: '10', label: '10th of month' },
  { value: '15', label: '15th of month' },
  { value: 'last_day', label: 'Last day of month' },
  { value: 'custom', label: 'Custom day…' },
];

const PRESET_VALUES = new Set(OPTIONS.map((o) => o.value));

function applyDueDay(date, dueDay) {
  if (!dueDay || dueDay === 'same_as_closing' || dueDay === 'one_month_after_closing') return date;
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

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(yyyymmdd) {
  if (!yyyymmdd) return null;
  const [y, m, d] = String(yyyymmdd).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function PaymentDueDayPicker({
  value,
  onChange,
  capitalDeployedDate,
  firstPaymentDate,
  onFirstPaymentDateChange,
  readOnly = false,
}) {
  const effectiveValue = value || 'same_as_closing';
  const isCustom = !PRESET_VALUES.has(effectiveValue) && /^\d+$/.test(String(effectiveValue));
  const selectValue = isCustom ? 'custom' : effectiveValue;

  // Derived default: capital deployed + 1 month, adjusted for the dueDay rule.
  // For 'one_month_after_closing': first payment = closing date + exactly 1 calendar month.
  const computedFirstPayment = useMemo(() => {
    const start = parseLocalDate(capitalDeployedDate);
    if (!start) return '';
    if (effectiveValue === 'one_month_after_closing') {
      const next = new Date(start);
      next.setMonth(next.getMonth() + 1);
      return toIsoDate(next);
    }
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    return toIsoDate(applyDueDay(next, effectiveValue));
  }, [capitalDeployedDate, effectiveValue]);

  const firstPaymentValue = firstPaymentDate || computedFirstPayment;
  const noDeployedHelper = !capitalDeployedDate && value
    ? 'Set capital deployed date to calculate payment dates'
    : '';

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
      {noDeployedHelper && (
        <p className="text-[11px] text-gray-400 mt-1">{noDeployedHelper}</p>
      )}
      {capitalDeployedDate && (
        <div className="mt-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">
            First Payment Date
          </p>
          <input
            type="date"
            value={firstPaymentValue || ''}
            onChange={(e) => onFirstPaymentDateChange?.(e.target.value || null)}
            disabled={readOnly}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}
