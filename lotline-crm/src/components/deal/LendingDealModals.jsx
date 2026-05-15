/**
 * LendingDealModals
 *
 * Two modals triggered from a deal's left column:
 *   • 'financing'   → Apply for Financing  (createLendingRequest)
 *   • 'partnership' → Submit a Deal to Partner (createLendingPartnership)
 *
 * The cost breakdown mirrors CostBreakdownTab exactly:
 *   - lines fetched from deal_cost_resolved_view via fetchCostLines
 *   - grouped by group_name (Land / Build / Sitework / Finishing / Other)
 *   - estimated_amount pre-filled, editable before submit
 */
import { useState, useEffect } from 'react';
import { CheckCircle, X, Send, ChevronRight, Handshake, Landmark } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { createLendingRequest, createLendingPartnership } from '../../lib/lendingData';
import { fetchCostLines } from '../../lib/costBreakdownData';

// Must stay in sync with CostBreakdownTab
const GROUP_ORDER  = ['Land', 'Build', 'Sitework', 'Finishing', 'Other'];
const HIDDEN_KEYS  = new Set([
  'environmental_permits', 'gutters', 'professional_photos', 'staging', 'water_sewer',
]);

const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-colors';
const fmt = n => `$${Math.abs(Math.round(n)).toLocaleString()}`;

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{hint && <span className="normal-case font-normal text-gray-400 ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeading({ children }) {
  return <p className="text-xs font-bold text-accent uppercase tracking-widest pt-2 pb-1 border-t border-gray-100 mt-2">{children}</p>;
}

// ── Cost breakdown from deal_cost_resolved_view ───────────────────────────
function CostBreakdown({ dealId, amounts, onChange }) {
  const [lines,   setLines]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState({});

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    fetchCostLines(dealId).then(data => {
      const visible = data.filter(l => !HIDDEN_KEYS.has(l.category_key));
      setLines(visible);
      // Expand all groups by default
      const groups = [...new Set(visible.map(l => l.group_name || 'Other'))];
      setOpen(Object.fromEntries(groups.map(g => [g, true])));
      setLoading(false);
    });
  }, [dealId]);

  const grouped = GROUP_ORDER
    .map(g => ({ group: g, lines: lines.filter(l => (l.group_name || 'Other') === g) }))
    .filter(g => g.lines.length > 0);

  const total = lines.reduce((s, l) => s + (parseFloat(amounts[l.category_key]) ?? l.estimated_amount ?? 0), 0);

  if (loading) return <div className="py-4 text-center text-xs text-gray-400">Loading costs…</div>;
  if (!lines.length) return <div className="py-4 text-center text-xs text-gray-400">No cost lines found.</div>;

  return (
    <div className="space-y-2">
      {grouped.map(({ group, lines: gLines }) => (
        <div key={group} className="rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen(p => ({ ...p, [group]: !p[group] }))}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{group}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-accent">
                {fmt(gLines.reduce((s, l) => s + (parseFloat(amounts[l.category_key]) ?? l.estimated_amount ?? 0), 0))}
              </span>
              <ChevronRight size={13} className={`text-gray-400 transition-transform ${open[group] ? 'rotate-90' : ''}`} />
            </div>
          </button>
          {open[group] && (
            <div className="divide-y divide-gray-50">
              {gLines.map(l => (
                <div key={l.line_id} className="flex items-center justify-between px-4 py-2 gap-3">
                  <span className="text-xs text-gray-600 flex-1">{l.line_label}</span>
                  <div className="relative w-32 flex-shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      value={amounts[l.category_key] ?? l.estimated_amount ?? ''}
                      onChange={e => onChange(l.category_key, e.target.value)}
                      className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-xs font-bold text-gray-700">Total Estimated</span>
        <span className="text-sm font-bold text-accent">{fmt(total)}</span>
      </div>
    </div>
  );
}

// ── Financing modal ───────────────────────────────────────────────────────
function FinancingModal({ deal, prefill, onClose }) {
  const { activeOrgId } = useAuth();
  const [form, setForm] = useState({
    address:       deal?.address       || '',
    county:        prefill?.county     || '',
    state:         prefill?.state      || '',
    zip:           prefill?.zip        || '',
    parcelId:      prefill?.parcelId   || '',
    acreage:       prefill?.acreage    || '',
    closeDate:     prefill?.closeDate  || '',
    purchasePrice: prefill?.purchasePrice || '',
    loanAmount:    prefill?.loanAmount    || '',
    loanType:      prefill?.loanType      || 'Land + Home Package',
    propertyType:  prefill?.propertyType  || 'Manufactured Home',
    arv:           prefill?.arv           || '',
    creditScore:   '700+',
    exitStrategy:  prefill?.exitStrategy  || 'Sell',
    notes:         prefill?.notes         || '',
  });
  // Separate cost amounts map: { category_key: value }
  const [costAmounts, setCostAmounts] = useState({});
  const [confirm, setConfirm]         = useState(null);
  const [submitting, setSubmitting]   = useState(false);

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleCostChange = (key, val) => setCostAmounts(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await createLendingRequest(activeOrgId, { ...form, costs: costAmounts });
    setSubmitting(false);
    if (error) { alert('Submission failed: ' + (error.message || error)); return; }
    setConfirm(data?.ref ?? 'submitted');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-accent" />
            <h2 className="text-base font-bold text-sidebar">Apply for Financing</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {confirm ? (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <p className="text-lg font-bold text-sidebar">Request Submitted!</p>
            <p className="text-sm text-gray-500">Reference: <span className="font-bold text-accent">{confirm}</span></p>
            <p className="text-xs text-gray-400">Track this in <strong>My Submissions → Loan Requests</strong>.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">

              <SectionHeading>Property Details</SectionHeading>
              <Field label="Address">
                <input name="address" required value={form.address} onChange={handleChange} className={inp} placeholder="123 Main St" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="County">
                  <input name="county" value={form.county} onChange={handleChange} className={inp} placeholder="e.g. Wake" />
                </Field>
                <Field label="State">
                  <input name="state" value={form.state} onChange={handleChange} className={inp} placeholder="e.g. NC" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Zip Code">
                  <input name="zip" value={form.zip} onChange={handleChange} className={inp} placeholder="28000" />
                </Field>
                <Field label="Acreage">
                  <input name="acreage" type="number" min="0" step="0.01" value={form.acreage} onChange={handleChange} className={inp} placeholder="0.00" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Parcel ID">
                  <input name="parcelId" value={form.parcelId} onChange={handleChange} className={inp} placeholder="e.g. 0123456789" />
                </Field>
                <Field label="Anticipated Close Date">
                  <input name="closeDate" type="date" value={form.closeDate} onChange={handleChange} className={inp} />
                </Field>
              </div>

              <SectionHeading>Loan Details</SectionHeading>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Purchase Price ($)">
                  <input name="purchasePrice" type="number" min="0" value={form.purchasePrice} onChange={handleChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Loan Amount ($)">
                  <input name="loanAmount" type="number" min="0" required value={form.loanAmount} onChange={handleChange} className={inp} placeholder="0" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Loan Type">
                  <select name="loanType" value={form.loanType} onChange={handleChange} className={inp}>
                    <option>Land + Home Package</option><option>Fix &amp; Flip</option><option>DSCR</option><option>Bridge Loan</option><option>Construction</option><option>Land Loan</option>
                  </select>
                </Field>
                <Field label="Property Type">
                  <select name="propertyType" value={form.propertyType} onChange={handleChange} className={inp}>
                    <option>Manufactured Home</option><option>Single Family</option><option>Multi-Family</option><option>Land</option><option>Commercial</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estimated ARV ($)">
                  <input name="arv" type="number" min="0" value={form.arv} onChange={handleChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Credit Score Range">
                  <select name="creditScore" value={form.creditScore} onChange={handleChange} className={inp}>
                    <option>700+</option><option>650–699</option><option>600–649</option><option>Below 600</option>
                  </select>
                </Field>
              </div>
              <Field label="Exit Strategy">
                <select name="exitStrategy" value={form.exitStrategy} onChange={handleChange} className={inp}>
                  <option>Sell</option><option>Rent</option><option>Refinance</option>
                </select>
              </Field>

              <SectionHeading>Estimated Cost Breakdown</SectionHeading>
              <CostBreakdown dealId={deal?.id} amounts={costAmounts} onChange={handleCostChange} />

              <Field label="Additional Notes" hint="optional">
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className={inp + ' resize-none'} placeholder="Any context that may help us process your request..." />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1a2332] hover:bg-[#1a2332]/90 rounded-lg disabled:opacity-50">
                <Send size={13} />{submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Partnership modal ─────────────────────────────────────────────────────
function PartnershipModal({ deal, prefill, onClose }) {
  const { activeOrgId } = useAuth();
  const [form, setForm] = useState({
    address:         deal?.address           || '',
    county:          prefill?.county         || '',
    state:           prefill?.state          || '',
    zip:             prefill?.zip            || '',
    parcelId:        prefill?.parcelId       || '',
    acreage:         prefill?.acreage        || '',
    closeDate:       prefill?.closeDate      || '',
    propertyType:    prefill?.propertyType   || 'Manufactured',
    dealType:        prefill?.dealType       || 'Land + Home Package',
    purchasePrice:   prefill?.purchasePrice  || '',
    repairCosts:     prefill?.repairCosts    || '',
    arv:             prefill?.arv            || '',
    projectedProfit: prefill?.projectedProfit || '',
    needs:           [],
    split:           '',
    yourRole:        'Deal Finder',
    summary:         '',
  });
  const [costAmounts, setCostAmounts] = useState({});
  const [confirm, setConfirm]         = useState(null);
  const [submitting, setSubmitting]   = useState(false);

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleCostChange = (key, val) => setCostAmounts(p => ({ ...p, [key]: val }));
  const toggleNeed = v => setForm(p => ({
    ...p, needs: p.needs.includes(v) ? p.needs.filter(n => n !== v) : [...p.needs, v],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await createLendingPartnership(activeOrgId, { ...form, costs: costAmounts });
    setSubmitting(false);
    if (error) { alert('Submission failed: ' + (error.message || error)); return; }
    setConfirm(data?.ref ?? 'submitted');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Handshake size={16} className="text-accent" />
            <h2 className="text-base font-bold text-sidebar">Submit a Deal to Partner</h2>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {confirm ? (
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <Handshake size={28} className="text-accent" />
            </div>
            <p className="text-lg font-bold text-sidebar">Deal Submitted!</p>
            <p className="text-sm text-gray-500">Reference: <span className="font-bold text-accent">{confirm}</span></p>
            <p className="text-xs text-gray-400">Track this in <strong>My Submissions → Partnership Submissions</strong>.</p>
            <button onClick={onClose} className="mt-2 px-5 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">

              <SectionHeading>Property Details</SectionHeading>
              <Field label="Property Address">
                <input name="address" required value={form.address} onChange={handleChange} className={inp} placeholder="123 Main St" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="County">
                  <input name="county" value={form.county} onChange={handleChange} className={inp} placeholder="e.g. Wake" />
                </Field>
                <Field label="State">
                  <input name="state" value={form.state} onChange={handleChange} className={inp} placeholder="e.g. NC" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Zip Code">
                  <input name="zip" value={form.zip} onChange={handleChange} className={inp} placeholder="28000" />
                </Field>
                <Field label="Acreage">
                  <input name="acreage" type="number" min="0" step="0.01" value={form.acreage} onChange={handleChange} className={inp} placeholder="0.00" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Parcel ID">
                  <input name="parcelId" value={form.parcelId} onChange={handleChange} className={inp} placeholder="e.g. 0123456789" />
                </Field>
                <Field label="Anticipated Close Date">
                  <input name="closeDate" type="date" value={form.closeDate} onChange={handleChange} className={inp} />
                </Field>
              </div>

              <SectionHeading>Deal Info</SectionHeading>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Property Type">
                  <select name="propertyType" value={form.propertyType} onChange={handleChange} className={inp}>
                    <option>Manufactured</option><option>Modular Home</option><option>Single Family</option><option>Multi-Family</option><option>Land</option><option>Commercial</option>
                  </select>
                </Field>
                <Field label="Deal Type">
                  <select name="dealType" value={form.dealType} onChange={handleChange} className={inp}>
                    <option>Land + Home Package</option><option>Wholesale</option><option>Fix &amp; Flip</option><option>Buy &amp; Hold</option><option>New Construction</option><option>Land Deal</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="After Repair Value ($)">
                  <input name="arv" type="number" min="0" value={form.arv} onChange={handleChange} className={inp} placeholder="0" />
                </Field>
                <Field label="Projected Profit ($)">
                  <input name="projectedProfit" type="number" min="0" value={form.projectedProfit} onChange={handleChange} className={inp + ' font-semibold text-accent'} placeholder="0" />
                </Field>
              </div>
              {form.dealType !== 'Land + Home Package' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Purchase Price ($)">
                    <input name="purchasePrice" type="number" min="0" value={form.purchasePrice} onChange={handleChange} className={inp} placeholder="0" />
                  </Field>
                  <Field label="Estimated Repair Costs ($)">
                    <input name="repairCosts" type="number" min="0" value={form.repairCosts} onChange={handleChange} className={inp} placeholder="0" />
                  </Field>
                </div>
              )}

              <SectionHeading>Estimated Cost Breakdown</SectionHeading>
              <CostBreakdown dealId={deal?.id} amounts={costAmounts} onChange={handleCostChange} />

              <SectionHeading>Partnership Ask</SectionHeading>
              <Field label="What do you need from LotLine?">
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {['Capital', 'Expertise', 'Connections', 'Co-Ownership', 'Other'].map(v => (
                    <label key={v} className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer text-sm transition-colors ${form.needs.includes(v) ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input type="checkbox" checked={form.needs.includes(v)} onChange={() => toggleNeed(v)} className="accent-[#f97316] w-3.5 h-3.5" />
                      {v}
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Proposed Split % for LotLine">
                  <input name="split" type="number" min="0" max="100" value={form.split} onChange={handleChange} className={inp} placeholder="e.g. 30" />
                </Field>
                <Field label="Your Role on the Deal">
                  <select name="yourRole" value={form.yourRole} onChange={handleChange} className={inp}>
                    <option>Deal Finder</option><option>Contractor</option><option>Property Manager</option><option>Equity Partner</option><option>Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Deal Summary">
                <textarea name="summary" value={form.summary} onChange={handleChange} rows={4} className={inp + ' resize-none'} placeholder="Describe the opportunity, the neighborhood, why it's a good deal..." />
              </Field>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50">
                <Send size={13} />{submitting ? 'Submitting…' : 'Submit Deal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Exported wrapper ──────────────────────────────────────────────────────
export default function LendingDealModals({ deal, modal, prefill, onClose }) {
  if (!modal) return null;
  if (modal === 'financing')   return <FinancingModal   deal={deal} prefill={prefill} onClose={onClose} />;
  if (modal === 'partnership') return <PartnershipModal deal={deal} prefill={prefill} onClose={onClose} />;
  return null;
}
