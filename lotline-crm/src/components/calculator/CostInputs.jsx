/**
 * CostInputs — renders ONLY the visible_fields whitelisted by the resolved
 * state's states_config row. Auto-tax fields are shown read-only (computed
 * from purchasePrice / loanAmount) so users can see the rate landing.
 *
 * Props:
 *   stateConfig:   states_config row (has visible_fields)
 *   values:        controlled input values keyed by field
 *   onChange(k,v): setter
 *   autoValues:    { fieldKey → computed dollar amount } from lib/taxes
 */
import { Lock } from 'lucide-react';

// Human labels for every field referenced in any state's visible_fields.
// Keys not listed fall back to a humanised version of the key.
const LABELS = {
  purchasePrice:      'Purchase Price',
  closingCosts:       'Closing Costs',
  percTest:           'Perc Test',
  septicPermit:       'Septic Permit',
  surveying:          'Land Survey',
  wetlandSurvey:      'Wetland Survey',
  attorneyClosing:    'Attorney / Closing',
  ncExciseTax:        'NC Excise Tax (auto)',
  scDeedStamps:       'SC Deed Stamps (auto)',
  docStampsDeed:      'FL Doc Stamps – Deed (auto)',
  intangibleTax:      'FL Intangible Tax (auto)',
  platRecording:      'Plat Recording',
  recordingFees:      'Recording Fees',
  impactFee:          'Impact Fee',
  windInsurance:      'Wind Insurance',
  floodInsurance:     'Flood Insurance',
  hoaTransfer:        'HOA Transfer',
  holdingCosts:       'Holding Costs',
  rehabBudget:        'Rehab Budget',
  contingency:        'Contingency',
  subdivisionCost:    'Subdivision Cost',
  permitting:         'Permitting',
  utilityConnection:  'Utility Connection',
};

const AUTO_FIELDS = new Set(['ncExciseTax', 'scDeedStamps', 'docStampsDeed', 'intangibleTax']);

function humanize(key) {
  return LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

const fmt$ = (n) => {
  if (n === '' || n == null) return '';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString();
};

export default function CostInputs({ stateConfig, values, onChange, autoValues }) {
  if (!stateConfig) return null;
  const fields = stateConfig.visible_fields || [];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-sidebar mb-3">Cost inputs</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {fields.map(key => {
          const isAuto = AUTO_FIELDS.has(key);
          const displayValue = isAuto ? (autoValues?.[key] ?? 0) : (values?.[key] ?? '');
          return (
            <div key={key} className="py-1">
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                {humanize(key)}
              </label>
              <div className={`flex items-center border rounded-lg overflow-hidden ${isAuto ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
                <span className="px-2 py-2 text-sm text-gray-400 border-r border-gray-200">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  readOnly={isAuto}
                  value={fmt$(displayValue)}
                  onChange={e => {
                    if (isAuto) return;
                    const raw = e.target.value.replace(/[^\d.]/g, '');
                    onChange(key, raw === '' ? '' : Number(raw));
                  }}
                  placeholder="0"
                  className="flex-1 px-2 py-2 text-sm text-gray-800 outline-none w-0 min-w-0 bg-transparent disabled:opacity-60"
                />
                {isAuto && (
                  <span className="px-2 text-gray-400" title="Auto-calculated from rates">
                    <Lock size={12} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
