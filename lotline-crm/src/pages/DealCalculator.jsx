import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calculator, X, PlusCircle, Save, CheckCircle2 } from 'lucide-react';
import { buildScenarios } from '../lib/dealCalculator/scenarios';
import InfoTooltip from '../components/investor/InfoTooltip';
import { saveToLS, flushToSupabaseAsync } from '../lib/dealsSync';
import { updateCostLinesFromCalc } from '../lib/costBreakdownData';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useLocationResolver } from '../hooks/useLocationResolver';
import { fetchCounties } from '../lib/statesConfig';
import { resolveAutoDefaults, computeAutoField } from '../lib/taxes';
import { supabase } from '../lib/supabase';
import StatePicker     from '../components/calculator/StatePicker';
import CostInputs      from '../components/calculator/CostInputs';
import FmtInput        from '../components/calculator/FmtInput';

const STAGES = ['New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract'];
const LEAD_SOURCE_OPTIONS = ['Direct Mail', 'Driving for Dollars', 'Wholesaler', 'MLS', 'Referral', 'Cold Call', 'Online/Website', 'FB Market Place', 'Other'];
const OWNER_TYPE_OPTIONS  = ['Owner', 'Wholesaler', 'Realtor'];
const UTILITY_OPTIONS     = ['All Utilities Available', 'Well Needed', 'Septic Needed', 'Well & Septic Needed', 'Existing Well', 'Existing Septic', 'Existing Well & Septic'];

function ImportModal({ vals, buildCost, projectedProfit, onClose, onDealSaved, currentUserName }) {
  const { activeOrgId } = useAuth();
  const [address,     setAddress]     = useState('');
  const [county,      setCounty]      = useState('');
  const [dealState,   setDealState]   = useState('NC');
  const [zip,         setZip]         = useState('');
  const [acreage,     setAcreage]     = useState('');
  const [ownerName,   setOwnerName]   = useState('');
  const [sellerName,  setSellerName]  = useState('');
  const [phone,       setPhone]       = useState('');
  const [email,       setEmail]       = useState('');
  const [leadSource,  setLeadSource]  = useState('');
  const [ownerType,   setOwnerType]   = useState('Owner');
  const [utility,     setUtility]     = useState('All Utilities Available');
  const [listingUrl,  setListingUrl]  = useState('');
  const [stage,       setStage]       = useState('New Lead');
  const [saved,       setSaved]       = useState(false);

  const handleSave = async () => {
    if (!address.trim()) return;
    const id = 'custom-' + Date.now();

    // Build costs mapped from calculator keys to deal keys
    const deal = {
      id,
      pipeline: 'land-acquisition',
      stage,
      dealOwner: currentUserName,
      address: address.trim(),
      county: county.trim(),
      state: dealState,
      zip: zip.trim(),
      acreage: parseFloat(acreage) || undefined,
      ownerName: ownerName.trim(),
      sellerName: sellerName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      leadSource,
      ownerType,
      utilityScenario: utility,
      arv: vals.arv,
      listingUrl: listingUrl.trim() || undefined,
      financing: 'Cash',
      holdingMonths: vals.holdingMonths,
      holdingPerMonth: vals.holdingPerMonth,
      netProfit: Math.round(projectedProfit),
      // Cost fields
      land: vals.land,
      mobileHome:   vals.mobileHome,
      hudEngineer:  vals.hudEngineer,
      percTest:     vals.percTest,
      survey:       vals.survey,
      footers:      vals.footers,
      setup:        vals.setup,
      clearLand:    vals.landClearing,
      water:        vals.water,
      septic:       vals.septic,
      electric:     vals.electric,
      hvac:         vals.hvac,
      underpinning: vals.underpinning,
      decks:        vals.decks,
      driveway:     vals.driveway,
      landscaping:  vals.landscaping,
      waterSewer:   vals.waterSewer,
      mailbox:      vals.mailbox,
      gutters:      0,
      photos:       0,
      mobileTax:    vals.mobileTax,
      staging:      0,
    };

    saveToLS(deal, activeOrgId);
    onDealSaved(deal);
    setSaved(true);
    setTimeout(onClose, 1200);
    // Await Supabase insert so the DB trigger fn_seed_deal_cost_lines fires first,
    // then overwrite the seeded default amounts with the actual calculator values.
    const { error } = await flushToSupabaseAsync(deal, activeOrgId);
    if (!error) {
      await updateCostLinesFromCalc(id, {
        land_purchase_price:      vals.land,
        perc_test:                vals.percTest,
        land_survey:              vals.survey,
        'environmental_permits.construction_authorization': vals.constructionAuth,
        'environmental_permits.improvement_permit':         vals.improvementPermit,
        'environmental_permits.well_permit':                vals.wellPermit,
        mobile_home:              vals.mobileHome,
        land_clearing:            vals.landClearing,
        rough_grade:              vals.roughGrade,
        septic:                   vals.septic,
        well:                     vals.water,
        public_water:             vals.waterSewer,
        public_sewer:             vals.publicSewer,
        utility_power_connection: vals.electric,
        foundation_footers:       vals.footers,
        set_up:                   vals.setup,
        trim_out:                 vals.trimOut,
        hvac:                     vals.hvac,
        electrical:               vals.electrical,
        plumbing_connection:      vals.plumbingConnection,
        septic_connection:        vals.septicConnection,
        skirting:                 vals.underpinning,
        driveway:                 vals.driveway,
        final_grade:              vals.landscaping,
        decks_installed:          vals.decks,
        hud_engineer:             vals.hudEngineer,
        mailbox:                  vals.mailbox,
        miscellaneous:            vals.mobileTax,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PlusCircle size={18} className="text-accent" />
            <h2 className="text-base font-bold text-sidebar">Import to Land Acquisition</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Pre-filled summary */}
          <div className="bg-sidebar/5 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ARV</p>
              <p className="text-sm font-bold text-sidebar">${vals.arv.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Build Cost</p>
              <p className="text-sm font-bold text-sidebar">${Math.round(buildCost).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Net Profit</p>
              <p className={`text-sm font-bold ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>${Math.round(projectedProfit).toLocaleString()}</p>
            </div>
          </div>

          {/* Stage */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Pipeline Stage</label>
            <select value={stage} onChange={e => setStage(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Property Info */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Property Information</label>
            <div className="space-y-2">
              <input placeholder="Address *" value={address} onChange={e => setAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="County" value={county} onChange={e => setCounty(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                <select value={dealState} onChange={e => setDealState(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="NC">NC</option>
                  <option value="SC">SC</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Zip Code" value={zip} onChange={e => setZip(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                <input placeholder="Acreage" type="number" value={acreage} onChange={e => setAcreage(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <select value={utility} onChange={e => setUtility(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                {UTILITY_OPTIONS.map(u => <option key={u}>{u}</option>)}
              </select>
              <input placeholder="Listing URL (optional)" type="url" value={listingUrl} onChange={e => setListingUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>

          {/* Seller Info */}
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Seller Information</label>
            <div className="space-y-2">
              <input placeholder="Owner Name" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <input placeholder="Seller Name" value={sellerName} onChange={e => setSellerName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <div className="grid grid-cols-2 gap-2">
                <select value={leadSource} onChange={e => setLeadSource(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                  <option value="">Lead Source</option>
                  {LEAD_SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={ownerType} onChange={e => setOwnerType(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                  {OWNER_TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">Cost breakdown will be pre-filled from the calculator</p>
          <button
            onClick={handleSave}
            disabled={!address.trim() || saved}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              saved ? 'bg-green-500 text-white' : !address.trim() ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-accent text-white hover:bg-accent/90'
            }`}
          >
            {saved ? '✓ Added!' : 'Add to Pipeline'}
          </button>
        </div>
      </div>
    </div>
  );
}

const defaultValues = {
  land: 0,
  percTest: 2500,
  survey: 1500,
  constructionAuth: 400,
  improvementPermit: 400,
  wellPermit: 400,
  mobileHome: 78000,
  landClearing: 0,
  roughGrade: 1500,
  septic: 7500,
  water: 10000,
  waterSewer: 0,
  publicSewer: 0,
  electric: 2000,
  footers: 1500,
  setup: 9000,
  trimOut: 2800,
  hvac: 4500,
  electrical: 2500,
  plumbingConnection: 1750,
  septicConnection: 1750,
  underpinning: 4000,
  driveway: 1200,
  landscaping: 2500,
  decks: 4200,
  hudEngineer: 500,
  mailbox: 170,
  mobileTax: 0,
  arv: 230000,
  sellingCostPct: 3.5,
  holdingPerMonth: 250,
  holdingMonths: 4,
  desiredProfitPct: 23,
};

const costFields = [
  { key: 'land',              label: 'Land / Purchase Price' },
  { key: 'percTest',          label: 'Perc Test / Permit' },
  { key: 'survey',            label: 'Land Survey' },
  { key: 'constructionAuth',  label: 'Construction Authorization' },
  { key: 'improvementPermit', label: 'Improvement Permit' },
  { key: 'wellPermit',        label: 'Well Permit' },
  { key: 'mobileHome',        label: 'Manufactured Home' },
  { key: 'landClearing',      label: 'Land Clearing' },
  { key: 'roughGrade',        label: 'Rough Grade' },
  { key: 'septic',            label: 'Septic' },
  { key: 'water',             label: 'Well' },
  { key: 'waterSewer',        label: 'Public Water' },
  { key: 'publicSewer',       label: 'Public Sewer' },
  { key: 'electric',          label: 'Utility Power Connection' },
  { key: 'footers',           label: 'Foundation / Footers' },
  { key: 'setup',             label: 'Set Up' },
  { key: 'trimOut',           label: 'Trim Out (Interior / Exterior)' },
  { key: 'hvac',              label: 'HVAC' },
  { key: 'electrical',        label: 'Electrical' },
  { key: 'plumbingConnection',label: 'Plumbing Connection' },
  { key: 'septicConnection',  label: 'Septic Connection' },
  { key: 'underpinning',      label: 'Skirting' },
  { key: 'driveway',          label: 'Driveway' },
  { key: 'landscaping',       label: 'Final Grade' },
  { key: 'decks',             label: 'Decks Installed' },
  { key: 'hudEngineer',       label: 'HUD Engineer' },
  { key: 'mailbox',           label: 'Mailbox' },
  { key: 'mobileTax',         label: 'Miscellaneous' },
];

function fmt(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

export default function DealCalculator() {
  const [vals, setVals] = useState(defaultValues);
  const [showImport, setShowImport] = useState(false);
  const { canEdit } = usePermissions();
  const { deals, setDeals } = useDeals();
  const { profile, activeOrgId } = useAuth();

  // ── Per-deal mode ────────────────────────────────────────────────────────
  // /calculator?dealId=<id> hydrates the calculator from deal.scenario_data.calculator
  // and auto-saves edits back to that slot. Standalone mode (no query param)
  // works exactly like before — no DB writes until "Import to Pipeline".
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('dealId');
  const dealForCalc = useMemo(
    () => (dealId ? deals.find(d => String(d.id) === String(dealId)) : null),
    [dealId, deals]
  );
  const hydratedRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  const set = (key, val) => setVals((prev) => ({ ...prev, [key]: typeof val === 'number' ? val : (parseFloat(val) || 0) }));

  // ── State-aware mode (NC/SC/FL) ─────────────────────────────────────────────
  // When the user enters a ZIP or picks a county, the resolver tells us which
  // state's config to apply. The state-aware view replaces the hardcoded
  // cost-inputs grid above; the rest of the page (Deal Parameters / Results
  // / Scenarios) reads from the same `vals` bag plus state-aware overlays.
  const [zip, setZip] = useState('');
  const [countySelection, setCountySelection] = useState(null);
  const [manualState, setManualState] = useState(null); // 'NC' | 'SC' | 'FL' | null
  const [stateVals, setStateVals] = useState({});       // state-aware input values
  const [countiesAll, setCountiesAll] = useState([]);
  const resolved = useLocationResolver(zip, countySelection, manualState);

  // Clicking a state quick-pick clears any ZIP/county so the manualState
  // override actually takes effect (an explicit ZIP/county wins inside
  // useLocationResolver). Clicking the active state again clears it.
  const handleStatePick = (code) => {
    setManualState(prev => prev === code ? null : code);
    setZip('');
    setCountySelection(null);
    setStateVals({});
  };

  // Pre-load counties for the dropdown
  useEffect(() => {
    let cancelled = false;
    fetchCounties().then(c => { if (!cancelled) setCountiesAll(c); });
    return () => { cancelled = true; };
  }, []);

  // Whenever the resolved state or county changes, reset cost inputs to that
  // state/county's defaults.
  useEffect(() => {
    if (resolved.status !== 'ok' || !resolved.mergedDefaults) return;
    setStateVals(prev => resolveAutoDefaults(resolved.mergedDefaults, {
      purchasePrice: prev.purchasePrice ?? 0,
      loanAmount: prev.loanAmount ?? 0,
      rates: resolved.mergedRates,
    }));
  }, [resolved.status, resolved.state, resolved.county?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute auto-tax fields whenever inputs that drive them change.
  const autoValues = useMemo(() => {
    if (resolved.status !== 'ok') return {};
    const ctx = {
      purchasePrice: Number(stateVals.purchasePrice) || 0,
      loanAmount:    Number(stateVals.loanAmount)    || 0,
      rates:         resolved.mergedRates,
    };
    const out = {};
    for (const [k, v] of Object.entries(resolved.mergedDefaults || {})) {
      if (v === 'auto') {
        const computed = computeAutoField(k, ctx);
        if (computed != null) out[k] = computed;
      }
    }
    return out;
  }, [stateVals, resolved.status, resolved.mergedDefaults, resolved.mergedRates]);

  // ── Hydrate from deal.scenario_data.calculator (per-deal mode) ──────────
  // Runs once when the deal first arrives in context. We deliberately do NOT
  // re-hydrate on every deal change so the realtime echo of our own
  // autosave can't clobber an in-flight user edit.
  useEffect(() => {
    if (!dealForCalc || hydratedRef.current) return;
    const calc = dealForCalc.scenarioData?.calculator || dealForCalc.scenario_data?.calculator;
    if (calc) {
      if (calc.zip != null)             setZip(String(calc.zip));
      if (calc.countyId)                setCountySelection({ countyId: calc.countyId });
      if (calc.stateVals && typeof calc.stateVals === 'object') setStateVals(calc.stateVals);
      if (calc.vals && typeof calc.vals === 'object')           setVals(prev => ({ ...prev, ...calc.vals }));
    }
    hydratedRef.current = true;
  }, [dealForCalc]);

  // ── Autosave per-deal calculator state (debounced) ──────────────────────
  // Only fires when we're in per-deal mode AND we've already hydrated, so the
  // hydration pass itself never triggers a write.
  useEffect(() => {
    if (!dealId || !dealForCalc || !hydratedRef.current || !supabase) return;
    const handle = setTimeout(async () => {
      setSaveStatus('saving');
      const existing = (dealForCalc.scenarioData || dealForCalc.scenario_data || {});
      const nextScenario = {
        ...existing,
        calculator: {
          zip: zip || null,
          countyId: countySelection?.countyId || resolved.county?.id || null,
          state: resolved.state || null,
          stateVals,
          vals,
          updatedAt: new Date().toISOString(),
        },
      };
      const { error } = await supabase
        .from('deals')
        .update({ scenario_data: nextScenario, updated_at: new Date().toISOString() })
        .eq('id', String(dealId));
      if (error) {
        console.error('[DealCalculator] save scenario_data.calculator failed:', error.message);
        setSaveStatus('error');
      } else {
        // Mirror into context so subsequent renders see the new state
        setDeals(prev => prev.map(d =>
          String(d.id) === String(dealId) ? { ...d, scenarioData: nextScenario } : d
        ));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 800); // 800ms debounce
    return () => clearTimeout(handle);
  }, [
    dealId, dealForCalc, zip, countySelection, stateVals, vals,
    resolved.state, resolved.county?.id, setDeals,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStateValChange = (key, val) => {
    setStateVals(prev => ({ ...prev, [key]: val }));
  };

  const stateAwareActive = resolved.status === 'ok';
  const stateAwareUnsupported = resolved.status === 'unsupported';

  // When state-aware is active, cost inputs live in stateVals keyed by the
  // resolved state's visible_fields. Otherwise we read the legacy costFields
  // array against the local `vals` bag. Deal parameters (arv, holding etc.)
  // always come from `vals` — they aren't state-specific.
  const activeCostKeys = stateAwareActive
    ? (resolved.stateConfig?.visible_fields || [])
    : costFields.map(f => f.key);
  const activeCostBag = stateAwareActive ? stateVals : vals;
  const buildCost = activeCostKeys.reduce((sum, k) => sum + (Number(activeCostBag[k]) || 0), 0);
  const sellingCosts = vals.arv * (vals.sellingCostPct / 100);
  const holdingCosts = vals.holdingMonths * vals.holdingPerMonth;
  const totalAllIn = buildCost + sellingCosts + holdingCosts;
  const projectedProfit = vals.arv - totalAllIn;
  const projectedROI = totalAllIn > 0 ? ((projectedProfit / totalAllIn) * 100).toFixed(1) : '0';
  const landValue = Number(activeCostBag.land) || 0;
  const nonLandBuildCost = activeCostKeys
    .filter(k => k !== 'land')
    .reduce((sum, k) => sum + (Number(activeCostBag[k]) || 0), 0);
  const desiredProfit = vals.arv * (vals.desiredProfitPct / 100);
  const maxOffer = vals.arv - nonLandBuildCost - sellingCosts - holdingCosts - desiredProfit;
  const landOverMax = landValue > 0 && landValue > maxOffer;
  const landUnderMax = landValue > 0 && landValue <= maxOffer;

  // Scenarios
  const scenarios = buildScenarios({
    buildCost,
    totalAllIn,
    baseProfit:    projectedProfit,
    holdingMonths: vals.holdingMonths,
    landCost:      activeCostBag.land,
    mobileHomeCost: activeCostBag.mobile_home,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent rounded-lg">
          <Calculator size={20} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sidebar">Deal Calculator</h1>
            {dealForCalc && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                Editing: {dealForCalc.address || 'Untitled'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Real-time deal analysis and scenario comparison</p>
        </div>
        {dealId && (
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === 'saving' && (
              <><Save size={12} className="text-gray-400 animate-pulse" /><span className="text-gray-500">Saving…</span></>
            )}
            {saveStatus === 'saved' && (
              <><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-emerald-600 font-medium">Saved</span></>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-500 font-medium">Save failed — retry on next edit</span>
            )}
          </div>
        )}
      </div>

      {/* State quick-pick — click NC/SC/FL to load that state's calculator
          directly without typing a ZIP. The active button highlights; clicking
          it again clears the override. */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            State calculator
          </span>
          <div className="flex gap-2">
            {['NC', 'SC', 'FL'].map(code => {
              const active = resolved.state === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleStatePick(code)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${
                    active
                      ? 'bg-accent text-white border-accent shadow-sm'
                      : 'bg-white text-sidebar border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <StatePicker
        zip={zip}
        onZipChange={setZip}
        countySelection={countySelection}
        onCountySelectionChange={setCountySelection}
        counties={countiesAll}
        resolved={resolved}
      />

      {stateAwareUnsupported ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">
            Enter a ZIP code or pick a county in NC, SC, or FL to load the
            state-aware calculator.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="space-y-4">
          {stateAwareActive ? (
            <CostInputs
              stateConfig={resolved.stateConfig}
              values={stateVals}
              onChange={handleStateValChange}
              autoValues={autoValues}
            />
          ) : (
          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">Cost Inputs</h3>
            <div className="space-y-2">
              {costFields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-600 flex-1">{f.label}</label>
                  <div className="relative w-32">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <FmtInput
                      value={vals[f.key]}
                      onChange={(v) => set(f.key, v)}
                      className="w-full pl-5 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">Deal Parameters</h3>
            <div className="space-y-2">
              {[
                { key: 'arv', label: 'Estimated ARV', prefix: '$', fmt: true },
                { key: 'sellingCostPct', label: 'Selling Costs %', suffix: '%' },
                { key: 'holdingPerMonth', label: 'Holding Cost / Month', prefix: '$', fmt: true },
                { key: 'holdingMonths', label: 'Est. Months to Sell', suffix: 'mo' },
                { key: 'desiredProfitPct', label: 'Desired Profit Margin %', suffix: '%' },
              ].map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-600 flex-1">{f.label}</label>
                  <div className="relative w-32">
                    {f.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{f.prefix}</span>}
                    {f.fmt ? (
                      <FmtInput
                        value={vals[f.key]}
                        onChange={(v) => set(f.key, v)}
                        className={`w-full py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right ${f.prefix ? 'pl-5 pr-2' : 'pl-2 pr-6'}`}
                      />
                    ) : (
                      <input
                        type="number"
                        value={vals[f.key] === 0 ? '' : vals[f.key]}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder="0"
                        className={`w-full py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 text-right ${f.prefix ? 'pl-5 pr-2' : 'pl-2 pr-6'}`}
                      />
                    )}
                    {f.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{f.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          <div className="bg-sidebar rounded-xl shadow-sm p-5 text-white">
            <h3 className="font-semibold mb-4 text-white/80 text-sm uppercase tracking-wide">Results</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Build Cost', value: fmt(buildCost) },
                { label: 'Selling Costs', value: fmt(sellingCosts) },
                { label: 'Holding Costs', value: fmt(holdingCosts) },
                { label: 'Total All-In Cost', value: fmt(totalAllIn), highlight: true },
                { label: 'Max Offer for Land', value: fmt(maxOffer), highlight: true, maxOffer: true },
                { label: 'Projected Profit', value: fmt(projectedProfit), profit: true },
                { label: 'Projected ROI', value: `${projectedROI}%`, profit: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex justify-between items-center ${item.highlight ? 'pt-2 border-t border-white/20 font-semibold' : ''}`}
                >
                  <span className="text-white/70 text-sm">{item.label}</span>
                  <span className={`text-base font-bold ${
                    item.profit ? 'text-green-400' :
                    item.maxOffer ? (landOverMax ? 'text-red-400' : landUnderMax ? 'text-green-400' : 'text-accent') :
                    'text-white'
                  }`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario Comparison */}
          <div className="bg-card rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-sidebar mb-3">Financing Scenario Comparison</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="text-left pb-2">Scenario</th>
                  <th className="text-right pb-2">Capital In</th>
                  <th className="text-right pb-2">Profit</th>
                  <th className="text-right pb-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.label} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 font-medium text-gray-700">
                      <span className="inline-flex items-center gap-0.5">
                        {s.label}
                        {s.tooltip && <InfoTooltip text={s.tooltip} side="top" />}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-600">{fmt(s.capital)}</td>
                    <td className={`py-2 text-right font-semibold ${s.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmt(s.profit)}
                    </td>
                    <td className="py-2 text-right text-accent font-semibold">
                      {s.roi === '—' ? '—' : `${s.roi}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
      )}

      {canEdit && (
        <button
          onClick={() => setShowImport(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-accent text-white px-5 py-3 rounded-xl text-sm font-semibold shadow-lg hover:bg-accent/90 transition-colors z-40"
        >
          <PlusCircle size={16} />
          Import to Pipeline
        </button>
      )}

      {showImport && (
        <ImportModal
          vals={vals}
          buildCost={buildCost}
          projectedProfit={projectedProfit}
          onClose={() => setShowImport(false)}
          onDealSaved={deal => setDeals(prev => [...prev, deal])}
          currentUserName={profile?.name || ''}
        />
      )}
    </div>
  );
}
