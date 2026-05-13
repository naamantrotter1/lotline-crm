/**
 * StatePicker — top-of-calculator location selector.
 *
 * Renders two inputs (ZIP code + County dropdown) and surfaces a small
 * "State: NC/SC/FL" badge once a location resolves. When a ZIP maps to
 * multiple counties (border ZIPs spanning state lines), a "Which county
 * applies?" picker appears.
 *
 * Owns no calculator state — it's purely a controlled set of inputs that
 * lifts (zip, countySelection) up to the page.
 */
import { useMemo } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';

const STATE_BADGE = {
  NC: 'bg-blue-100 text-blue-700',
  SC: 'bg-amber-100 text-amber-700',
  FL: 'bg-emerald-100 text-emerald-700',
};

export default function StatePicker({
  zip, onZipChange,
  countySelection, onCountySelectionChange,
  counties,
  resolved,
}) {
  // counties scoped to the resolved state (or all when nothing resolved yet)
  const optionGroups = useMemo(() => {
    const list = counties || [];
    const groups = { NC: [], SC: [], FL: [] };
    for (const c of list) {
      if (groups[c.state]) groups[c.state].push(c);
    }
    return groups;
  }, [counties]);

  const stateCode = resolved?.state;
  const isMulti = resolved?.status === 'multi';
  const isUnsupported = resolved?.status === 'unsupported';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-sidebar">Location</h2>
        {stateCode && (
          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATE_BADGE[stateCode] || 'bg-gray-100 text-gray-600'}`}>
            State: {stateCode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            ZIP code
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zip || ''}
            onChange={e => onZipChange(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="27514"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            County
          </label>
          <select
            value={countySelection?.countyId || ''}
            onChange={e => {
              const id = e.target.value;
              onCountySelectionChange(id ? { countyId: id } : null);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">— Select county —</option>
            {['NC', 'SC', 'FL'].map(s => (
              optionGroups[s].length > 0 && (
                <optgroup key={s} label={s}>
                  {optionGroups[s].map(c => (
                    <option key={c.id} value={c.id}>{c.county_name}</option>
                  ))}
                </optgroup>
              )
            ))}
          </select>
        </div>
      </div>

      {isMulti && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 items-start">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              This ZIP spans counties in different states. Pick one:
            </p>
            <div className="flex flex-wrap gap-2">
              {resolved.candidates.map(cand => (
                <button
                  key={cand.countyId}
                  onClick={() => onCountySelectionChange({ countyId: cand.countyId })}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 rounded-lg hover:bg-amber-100"
                >
                  {cand.county?.county_name} ({cand.state})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isUnsupported && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            Deal calculator currently supports <strong>NC, SC, and FL only</strong>.
            Enter a ZIP or county in one of those states to continue.
          </p>
        </div>
      )}
    </div>
  );
}
