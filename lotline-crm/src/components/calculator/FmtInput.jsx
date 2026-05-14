/**
 * FmtInput — number input that displays with comma separators (e.g. 78,000)
 * when not focused, and lets the user edit the raw number while focused.
 *
 * Shared between the legacy DealCalculator inputs and the state-aware
 * CostInputs grid so both paths feel identical to type into.
 */
import { useState, useRef, useEffect } from 'react';

export default function FmtInput({ value, onChange, className, placeholder = '0' }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef(null);

  const handleFocus = () => {
    setDraft(value === 0 ? '' : String(value));
    setFocused(true);
  };

  useEffect(() => { if (focused) ref.current?.select(); }, [focused]);

  const handleBlur = () => {
    setFocused(false);
    onChange(parseFloat(draft) || 0);
  };

  return (
    <input
      ref={ref}
      type={focused ? 'number' : 'text'}
      inputMode="decimal"
      value={focused ? draft : (value === 0 || value == null ? '' : Number(value).toLocaleString())}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); } }}
      className={className}
    />
  );
}
