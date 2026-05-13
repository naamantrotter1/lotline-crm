/**
 * CalculatorSettingsDrawer — Supabase-backed admin surface for the
 * state-aware Deal Calculator. Surfaces three blocks per county:
 *
 *   1. ZIP list (add / remove / mark primary) — drives the resolver
 *   2. Default-cost overrides (per states_config.visible_fields) —
 *      county-level values that beat the state default
 *   3. Heat-map metrics summary (read-only for now; Phase F deferred)
 *
 * Opens from the County Database page top bar. Auth + RLS gate edits to
 * org owner/admin; non-admins see the form in read-only mode.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Star, StarOff, RefreshCw, Lock, AlertCircle } from 'lucide-react';
import {
  fetchStatesConfig,
  fetchCounties,
  fetchZipsForCounty,
  addZipToCounty,
  removeZipFromCounty,
  setZipPrimary,
  updateCountyDefaults,
} from '../../lib/statesConfig';
import { usePermissions } from '../../hooks/usePermissions';

// Rate-key entries live in tax_formulas, not visible_fields. The override
// editor lets admins set per-county rate overrides too — they go into the
// same default_costs jsonb (Miami-Dade docStampsDeedRate: 0.006 lives here).
const RATE_FIELDS = {
  NC: [],
  SC: [],
  FL: [
    { key: 'docStampsDeedRate', label: 'Doc Stamps – Deed Rate', isRate: true },
    { key: 'intangibleTaxRate', label: 'Intangible Tax Rate',    isRate: true },
  ],
};

const FIELD_LABELS = {
  purchasePrice:      'Purchase Price',
  closingCosts:       'Closing Costs',
  percTest:           'Perc Test',
  septicPermit:       'Septic Permit',
  surveying:          'Land Survey',
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
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

export default function CalculatorSettingsDrawer({ open, countyName, stateCode, onClose }) {
  const { can } = usePermissions();
  const canEdit = can?.('counties.edit') ?? false;

  const [county, setCounty] = useState(null);
  const [stateConfig, setStateConfig] = useState(null);
  const [zips, setZips] = useState([]);
  const [newZip, setNewZip] = useState('');
  const [costOverrides, setCostOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // ── Load county + state config + zips when the drawer opens ──────────────
  useEffect(() => {
    if (!open || !countyName || !stateCode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [statesAll, countiesAll] = await Promise.all([fetchStatesConfig(), fetchCounties()]);
      if (cancelled) return;
      const cfg = statesAll[stateCode] || null;
      const match = (countiesAll || []).find(c => c.state === stateCode && c.county_name === countyName) || null;
      setStateConfig(cfg);
      setCounty(match);
      if (match) {
        setCostOverrides({ ...(match.default_costs || {}) });
        const zipRows = await fetchZipsForCounty(match.id);
        if (!cancelled) setZips(zipRows);
      } else {
        setCostOverrides({});
        setZips([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, countyName, stateCode]);

  const overrideableFields = useMemo(() => {
    if (!stateConfig) return [];
    const base = (stateConfig.visible_fields || []).map(k => ({ key: k, label: humanize(k), isRate: false }));
    return base.concat(RATE_FIELDS[stateCode] || []);
  }, [stateConfig, stateCode]);

  // ── ZIP CRUD ─────────────────────────────────────────────────────────────
  const handleAddZip = async () => {
    if (!county || !canEdit) return;
    const clean = newZip.trim().slice(0, 5);
    if (!/^\d{5}$/.test(clean)) { setError('ZIP must be 5 digits'); return; }
    setError(null);
    setSaving(true);
    const { error: err } = await addZipToCounty(county.id, clean, stateCode, { isPrimary: zips.length === 0 });
    setSaving(false);
    if (err) { setError(typeof err === 'string' ? err : err.message); return; }
    setNewZip('');
    setZips(await fetchZipsForCounty(county.id));
  };

  const handleRemoveZip = async (zipCode) => {
    if (!county || !canEdit) return;
    setSaving(true);
    const { error: err } = await removeZipFromCounty(county.id, zipCode);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setZips(await fetchZipsForCounty(county.id));
  };

  const handleTogglePrimary = async (zipCode, current) => {
    if (!county || !canEdit) return;
    setSaving(true);
    const { error: err } = await setZipPrimary(county.id, zipCode, !current);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setZips(await fetchZipsForCounty(county.id));
  };

  // ── Cost overrides ───────────────────────────────────────────────────────
  const handleOverrideChange = (key, raw, isRate) => {
    if (!canEdit) return;
    setCostOverrides(prev => {
      const next = { ...prev };
      if (raw === '' || raw == null) {
        delete next[key];
      } else {
        const num = Number(raw);
        if (Number.isNaN(num)) return prev;
        next[key] = num;
      }
      return next;
    });
    void isRate;
  };

  const handleSaveOverrides = async () => {
    if (!county || !canEdit) return;
    setSaving(true);
    setError(null);
    const { error: err } = await updateCountyDefaults(county.id, costOverrides);
    setSaving(false);
    if (err) { setError(err.message); return; }
  };

  if (!open) return null;

  const heatMap = county?.heat_map_metrics || {};
  const heatMapHasData = ['medianArv','pricePerSqft','daysOnMarket','avgLotPrice','compsCount']
    .some(k => heatMap[k] != null);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-screen w-[560px] max-w-full bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-sidebar">Calculator settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {countyName ? `${countyName} County, ${stateCode}` : 'No county selected'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : !county ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 items-start">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>{countyName}, {stateCode}</strong> isn't in the Supabase
                counties table yet. State-aware calculator only supports NC,
                SC, and FL. Other counties remain in the legacy SOP-only view.
              </p>
            </div>
          ) : (
            <>
              {!canEdit && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex gap-2 items-center">
                  <Lock size={14} className="text-gray-400" />
                  <p className="text-xs text-gray-600">Read-only — owner/admin role required to edit.</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2 items-start">
                  <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              {/* ── ZIP CODES ─────────────────────────────────────────────── */}
              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  ZIP codes ({zips.length})
                </h3>
                {canEdit && (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      value={newZip}
                      onChange={e => setNewZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="Add ZIP…"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <button
                      onClick={handleAddZip}
                      disabled={saving || newZip.length !== 5}
                      className="px-3 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                )}
                {zips.length === 0 ? (
                  <p className="text-xs text-gray-400">No ZIPs mapped to this county yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {zips.map(z => (
                      <li key={z.zip_code} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50">
                        <span className="font-mono text-sm flex-1">{z.zip_code}</span>
                        {z.is_primary && (
                          <span className="text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">PRIMARY</span>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleTogglePrimary(z.zip_code, z.is_primary)}
                              className="text-gray-400 hover:text-accent"
                              title={z.is_primary ? 'Unmark primary' : 'Mark as primary'}
                            >
                              {z.is_primary ? <StarOff size={13} /> : <Star size={13} />}
                            </button>
                            <button
                              onClick={() => handleRemoveZip(z.zip_code)}
                              className="text-gray-400 hover:text-red-500"
                              title="Remove"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ── COST OVERRIDES ──────────────────────────────────────────── */}
              <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Cost overrides
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  County-level values beat the {stateCode} state defaults. Leave a field blank to
                  fall back to state. Rate fields (e.g. Miami-Dade <code className="bg-gray-100 px-1 rounded">docStampsDeedRate</code> = 0.006)
                  are decimals — 0.007 means 0.7%.
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {overrideableFields.map(({ key, label, isRate }) => {
                    if (AUTO_FIELDS.has(key)) return null;          // computed, not overridable
                    if (key === 'purchasePrice') return null;       // user input, not a default
                    const value = costOverrides[key];
                    return (
                      <div key={key}>
                        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
                          {label}{isRate ? ' (rate)' : ''}
                        </label>
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <span className="px-2 py-1.5 text-xs text-gray-400 border-r border-gray-200">
                            {isRate ? '%' : '$'}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={value == null ? '' : String(value)}
                            onChange={e => handleOverrideChange(key, e.target.value, isRate)}
                            placeholder="—"
                            readOnly={!canEdit}
                            className="flex-1 px-2 py-1.5 text-sm outline-none w-0 min-w-0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {canEdit && (
                  <button
                    onClick={handleSaveOverrides}
                    disabled={saving}
                    className="mt-3 px-4 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : 'Save overrides'}
                  </button>
                )}
              </section>

              {/* ── HEAT-MAP METRICS ─────────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Heat map metrics
                  </h3>
                  <button
                    disabled
                    title="Heat-map data feed not yet wired (Phase F)"
                    className="text-[11px] text-gray-300 flex items-center gap-1 cursor-not-allowed"
                  >
                    <RefreshCw size={11} /> Refresh now
                  </button>
                </div>
                {!heatMapHasData ? (
                  <p className="text-xs text-gray-400">
                    No market data collected for this county yet.
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(heatMap).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-gray-500">{humanize(k)}</dt>
                        <dd className="font-medium text-gray-800">
                          {v == null ? '—' : typeof v === 'number' ? v.toLocaleString() : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
