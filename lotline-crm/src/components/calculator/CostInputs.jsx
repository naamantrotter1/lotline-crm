/**
 * CostInputs — renders ONLY the visible_fields whitelisted by the resolved
 * state's states_config row, in the same single-column label-left / dollar-
 * input-right layout the legacy (non-state-aware) calculator uses. The three
 * supported states share the construction-cost field list; Florida adds two
 * extras (wetlandSurvey, impactFee) via its states_config.visible_fields.
 *
 * Props:
 *   stateConfig:   states_config row (has visible_fields)
 *   values:        controlled input values keyed by field
 *   onChange(k,v): setter
 *   autoValues:    kept for backwards-compat — no longer rendered, but the
 *                  caller still passes it.
 */

// Human labels for every field referenced in any state's visible_fields.
// Keys not listed fall back to a humanised version of the key.
const LABELS = {
  land:               'Land / Purchase Price',
  percTest:           'Perc Test / Permit',
  survey:             'Land Survey',
  constructionAuth:   'Construction Authorization',
  improvementPermit:  'Improvement Permit',
  wellPermit:         'Well Permit',
  mobileHome:         'Manufactured Home',
  landClearing:       'Land Clearing',
  roughGrade:         'Rough Grade',
  septic:             'Septic',
  water:              'Well',
  waterSewer:         'Public Water',
  publicSewer:        'Public Sewer',
  electric:           'Utility Power Connection',
  footers:            'Foundation / Footers',
  setup:              'Set Up',
  trimOut:            'Trim Out (Interior / Exterior)',
  hvac:               'HVAC',
  electrical:         'Electrical',
  plumbingConnection: 'Plumbing Connection',
  septicConnection:   'Septic Connection',
  underpinning:       'Skirting',
  driveway:           'Driveway',
  landscaping:        'Final Grade',
  decks:              'Decks Installed',
  hudEngineer:        'HUD Engineer',
  mailbox:            'Mailbox',
  mobileTax:          'Miscellaneous',
  // Florida-only extras
  wetlandSurvey:      'Wetland Survey',
  impactFee:          'Impact Fee',
};

function humanize(key) {
  return LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

const fmt$ = (n) => {
  if (n === '' || n == null || n === 0) return '';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString();
};

export default function CostInputs({ stateConfig, values, onChange }) {
  if (!stateConfig) return null;
  const fields = stateConfig.visible_fields || [];

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-semibold text-sidebar mb-3">Cost Inputs</h3>
      <div className="space-y-2">
        {fields.map(key => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label className="text-sm text-gray-600 flex-1">{humanize(key)}</label>
            <div className="relative w-32">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={fmt$(values?.[key])}
                placeholder="0"
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d.]/g, '');
                  onChange(key, raw === '' ? 0 : Number(raw));
                }}
                className="w-full pl-5 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
