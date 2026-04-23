import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Star, Archive, ChevronRight, MapPin, ExternalLink,
  CheckSquare, Square, FileText, Upload, AlertCircle, Check,
  ChevronDown, ChevronUp, User, Calendar, Building, Phone, Mail, SplitSquareHorizontal, TreePine,
  CheckCircle2, Zap, Scale, LayoutGrid, Briefcase, Layers, Droplets, Paperclip, X as XIcon,
  Landmark, Handshake,
} from 'lucide-react';
import { calcNetProfit } from '../data/deals';
import { saveDeal, flushToSupabase } from '../lib/dealsSync';
import { fetchActiveCommitmentsForModal, addAllocation, updateAllocation } from '../lib/capitalStackData';
import { notifyPipelineChange, notifyStageChange } from '../lib/notify';
import { useDeals } from '../lib/DealsContext';
import { useAuth } from '../lib/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabase } from '../lib/supabase';
import { loadInvestors, addInvestor } from '../lib/investorsStore';
import { HOME_MODELS } from '../data/homeModels';
import { COUNTY_DATA } from '../data/counties';
import { GradeBadge, Tag } from '../components/UI/Badge';
import FloodMap from './FloodMap';
import CapitalStackModule from '../components/CapitalStackModule';

// ── DD tasks ─────────────────────────────────────────────────────────────────
const DD_COLS = [
  { key: 'survey',       label: 'Survey / Boundary Review',        icon: Layers    },
  { key: 'zoning',       label: 'Zoning & Land Use Verification',  icon: MapPin    },
  { key: 'hoa',          label: 'HOA / Deed Restrictions Review',  icon: LayoutGrid },
  { key: 'perc_test',    label: 'Perc Test',                       icon: Droplets  },
  { key: 'flood_zone',   label: 'Flood Zone & Environmental Check',icon: AlertCircle },
  { key: 'utilities',    label: 'Utilities & Access Confirmation', icon: Zap       },
];
const DD_LS_INIT_MAP = {
  'Perk Test': 'perc_test', 'Perc Test / Soil Report': 'perc_test',
  'Survey': 'survey', 'Title Search': 'title_search',
  'Zoning Verification': 'zoning', 'Flood Zone Check': 'flood_zone',
  'Utility Check': 'utilities', 'HOA Check': 'hoa',
  'Final DD Review': 'attorney',
};

// ── Development task groups ───────────────────────────────────────────────────
const DEV_GROUPS = [
  { name: 'Land Clearing', tasks: ['Land cleared'] },
  { name: 'Environmental Permits', tasks: ['Septic Permit', 'Well Permit', 'Construction Authorization Permit'] },
  { name: 'Mobile Home Order', tasks: ['Order mobile home', 'MH ordered'] },
  { name: 'Construction Permits', tasks: ['Building Permit', 'Electrical Permit', 'Plumbing Permit', 'Mechanical Permit'] },
  { name: 'Set-Up Crew', tasks: ['Schedule set-up crew', 'Set-up crew scheduled', 'Set-up crew complete (home set)', 'De-title home (after set)'] },
  { name: 'Septic', tasks: ['Schedule septic', 'Septic scheduled', 'Septic complete'] },
  { name: 'Well', tasks: ['Schedule well', 'Well scheduled', 'Well complete'] },
  { name: 'Electrical', tasks: ['Schedule electrical', 'Electrical scheduled', 'Electrical complete'] },
  { name: 'Plumbing', tasks: ['Schedule plumbing hook-up (well/septic)', 'Plumbing scheduled', 'Plumbing complete'] },
  { name: 'HVAC', tasks: ['Schedule HVAC', 'HVAC scheduled', 'HVAC complete'] },
  { name: 'Skirting', tasks: ['Schedule skirting', 'Skirting scheduled', 'Skirting complete'] },
  { name: 'Steps / Entry', tasks: ['Order steps (front & back)', 'Steps ordered', 'Steps delivery date', 'Schedule steps install', 'Steps installed'] },
  { name: 'Final Grade', tasks: ['Final grade scheduled', 'Final grade complete'] },
  { name: 'Final Inspection & CO', tasks: ['Schedule final building inspection', 'Final building inspection scheduled', 'Final building inspection passed', 'Certificate of Occupancy (CO) received'] },
  { name: 'List Home', tasks: ['List home'] },
];

const REQUIRED_DOCS = [
  'Purchase Agreement', 'Verification of Zoning Letter', 'Plat Map', 'Survey',
  'Perc Test Report', 'Septic Permit', 'Manufactured Home Placement Permit',
  'Building Permit', 'Electrical Permit', 'Mechanical Permit', 'Well Permit',
  'Land Clearing Permit', 'Driveway Permit', 'Address Assignment Documentation',
  'Manufactured Home Transportation Permit', 'Certificate of Occupancy',
];

const SWANSON_DOCS = [
  { category: 'Purchase Agreement', file: 'Image_4821.pdf', date: '3/20/2026' },
  { category: 'Verification of Zoning Letter', file: 'Zoning Verification-15301_Swanson Rd.pdf', date: '3/19/2026', linkedDD: true },
  { category: 'Survey', file: '26007_Signed_2026-01-24.pdf', date: '3/20/2026', linkedDD: true },
  { category: 'Perc Test Report', file: 'SwansonRdSepticIP.pdf', date: '3/20/2026', linkedDD: true },
];

const COST_FIELDS = [
  { key: 'land', label: 'Land / Purchase Price' },
  { key: 'mobileHome', label: 'Mobile Home' },
  { key: 'hudEngineer', label: 'HUD Engineer' },
  { key: 'percTest', label: 'Perc Test / Permit' },
  { key: 'survey', label: 'Land Survey' },
  { key: 'footers', label: 'Footers' },
  { key: 'setup', label: 'Setup' },
  { key: 'clearLand', label: 'Clear Land' },
  { key: 'water', label: 'Water' },
  { key: 'septic', label: 'Septic' },
  { key: 'electric', label: 'Electric / Power Pole' },
  { key: 'hvac', label: 'HVAC' },
  { key: 'underpinning', label: 'Skirting' },
  { key: 'decks', label: 'Decks Installed' },
  { key: 'driveway', label: 'Driveway' },
  { key: 'landscaping', label: 'Landscaping / Final Grading' },
  { key: 'waterSewer', label: 'Water / Sewer Hook Up' },
  { key: 'mailbox', label: 'Mailbox' },
  { key: 'gutters', label: 'Gutters' },
  { key: 'photos', label: 'Professional Photos' },
  { key: 'mobileTax', label: 'Mobile Home Tax' },
  { key: 'staging', label: 'Staging' },
];

function calcAllIn(deal) {
  return COST_FIELDS.reduce((sum, f) => sum + (deal[f.key] || 0), 0);
}

function SectionHeader({ children }) {
  return (
    <h3 className="text-sm font-semibold text-[#1a2332] uppercase tracking-wide mb-3 pb-1.5 border-b border-gray-200">
      {children}
    </h3>
  );
}

function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{label}</p>
      <span className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function SelectRow({ label, value, onChange, options, readOnly }) {
  if (readOnly && !value) return null;
  return (
    <div className="py-2">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{label}</p>
      {readOnly
        ? <span className="text-sm font-medium text-gray-800">{value}</span>
        : <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
          >
            <option value="">— Select —</option>
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
      }
    </div>
  );
}

function InputRow({ label, value, onChange, type = 'text', mono, readOnly }) {
  if (readOnly && !value) return null;
  return (
    <div className="py-2">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{label}</p>
      {readOnly
        ? <span className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
        : <input
            type={type}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className={`text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full ${mono ? 'font-mono' : ''}`}
          />
      }
    </div>
  );
}

const LEAD_SOURCE_OPTIONS = ['Direct Mail', 'Driving for Dollars', 'Wholesaler', 'MLS', 'Referral', 'Cold Call', 'Online/Website', 'FB Market Place', 'Other'];
const OWNER_TYPE_OPTIONS = ['Owner', 'Wholesaler', 'Realtor'];
const UTILITY_SCENARIO_OPTIONS = ['All Utilities Available', 'Well Needed', 'Septic Needed', 'Well & Septic Needed', 'Existing Well', 'Existing Septic', 'Existing Well & Septic'];
const LAND_ACQ_STAGES = ['New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract', 'Contract Signed'];
const DEAL_OVERVIEW_STAGES = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];
const FINANCING_OPTIONS = ['Hard Money (Land + Home)', 'Hard Money', 'Cash', 'Line of Credit', 'Conventional'];

// ── Decimal input — keeps "13." in display while typing ───────────────────────
function DecimalInput({ value, onChange, className }) {
  const [display, setDisplay] = useState(() => value === 0 ? '' : String(value));
  const committed = useRef(value);
  if (committed.current !== value) {
    committed.current = value;
    // only resync if not in the middle of decimal entry
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={e => e.target.select()}
      onChange={e => {
        const raw = e.target.value;
        if (raw !== '' && !/^-?\d*\.?\d*$/.test(raw)) return;
        setDisplay(raw);
        if (raw === '') { onChange(0); return; }
        if (!raw.endsWith('.')) { const n = parseFloat(raw); if (!isNaN(n)) onChange(n); }
      }}
      onBlur={() => {
        const n = parseFloat(display) || 0;
        onChange(n);
        committed.current = n;
        setDisplay(n === 0 ? '' : String(n));
      }}
      className={className}
    />
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────
function OverviewTab({
  deal, costs, setCosts, notes, setNotes,
  arv, setArv,
  listingUrl, setListingUrl,
  address, setAddress, county, setCounty, dealState, setDealState, zip, setZip, acreage, setAcreage,
  sellerName, setSellerName, ownerName, setOwnerName, phone, setPhone, email, setEmail, investor, setInvestor, financing, setFinancing,
  leadSource, setLeadSource, ownerType, setOwnerType, utilityScenario, setUtilityScenario,
  waterCompany, setWaterCompany, sewerCompany, setSewerCompany, electricCompany, setElectricCompany, homeModel, setHomeModel,
  subdividable, setSubdividable, landClearing, setLandClearing,
  parcelId, setParcelId, closingAttorney, setClosingAttorney, closingAttorneyPhone, setClosingAttorneyPhone,
  closingAttorneyAddress, setClosingAttorneyAddress, closeDate, setCloseDate, contractDate, setContractDate,
  manufacturer, setManufacturer, deliveryDate, setDeliveryDate,
  interestRate, setInterestRate,
  originationFeeType, setOriginationFeeType,
  originationFeePct, setOriginationFeePct,
  originationFeeFlat, setOriginationFeeFlat,
  servicingFeeType, setServicingFeeType,
  servicingFeeFlat, setServicingFeeFlat,
  servicingFeePct, setServicingFeePct,
  balloonTerm, setBalloonTerm,
  holdPeriod, setHoldPeriod,
  monthlyHoldCost, setMonthlyHoldCost,
  profitSharePct, setProfitSharePct,
  capitalDeployedDate, setCapitalDeployedDate,
  capitalReturnedDate, setCapitalReturnedDate,
  investorCapitalContributed, setInvestorCapitalContributed,
  investorEquityPct, setInvestorEquityPct,
  projectedPayoutDate, setProjectedPayoutDate,
  selectedScenario, applyScenario,
  ltcPct, setLtcPct,
  originationPoints, setOriginationPoints,
  creditLimit, setCreditLimit,
  drawPct, setDrawPct,
  annualFeePct, setAnnualFeePct,
  investorProfitSplitPct, setInvestorProfitSplitPct,
  loanAmountOverride, setLoanAmountOverride,
  realtor, setRealtor,
  dateListed, setDateListed,
  agentUsers,
  navigate,
  onOpenMapSearch,
  investorList,
  onAddInvestor,
  readOnly,
  isAgent,
  saveNow,
  ccpInvestorId, setCcpInvestorId,
  ccpCommitmentId, setCcpCommitmentId,
  ccpAllocationAmount, setCcpAllocationAmount,
  ccpPrefReturnPct, setCcpPrefReturnPct,
  ccpProfitSharePct, setCcpProfitSharePct,
  ccpPrefPaymentTiming, setCcpPrefPaymentTiming,
  ccpPosition, setCcpPosition,
  ccpTranches, setCcpTranches,
}) {
  const activeFinancing = selectedScenario
    ? FINANCING_SCENARIOS.find(s => s.id === selectedScenario)?.financingType
    : deal.financing;
  const allIn = COST_FIELDS.reduce((s, f) => s + (costs[f.key] || 0), 0);
  const arvVal = arv ?? deal.arv ?? 0;
  const sellingCosts = arvVal * 0.045 + 4000;
  const holdingCosts = (deal.holdingMonths || 4) * (deal.holdingPerMonth || 250);

  // Financing calculations (computed before netProfit so we can deduct them)
  const totalLent = (costs.mobileHome || 0) + (costs.land || 0);
  const effectiveLoanAmount = loanAmountOverride || totalLent;
  const monthlyInterest = effectiveLoanAmount * (interestRate / 100) / 12;
  const originationFee = originationFeeType === 'percentage'
    ? effectiveLoanAmount * (originationFeePct / 100)
    : originationFeeFlat;
  const servicingFee = servicingFeeType === 'percentage'
    ? effectiveLoanAmount * (servicingFeePct / 100)
    : servicingFeeFlat;
  const totalCostOfCapital = (monthlyInterest * holdPeriod) + originationFee + servicingFee;

  // Deduct financing costs from net profit when a scenario is active
  const hasFinancing = !!selectedScenario && activeFinancing !== 'Cash';
  const profitBeforeShare = arvVal - allIn - sellingCosts - holdingCosts - (hasFinancing ? totalCostOfCapital : 0);
  const profitShareAmount = hasFinancing ? profitBeforeShare * (profitSharePct / 100) : 0;
  const netProfit = profitBeforeShare - profitShareAmount;
  const roi = allIn > 0 ? ((netProfit / allIn) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-5 min-w-0">

        {/* Notes */}
        <div>
          <SectionHeader>General Notes</SectionHeader>
          <textarea
            value={notes}
            onChange={e => { if (!readOnly) { setNotes(e.target.value); saveNow?.({ notes: e.target.value }); } }}
            readOnly={readOnly}
            rows={3}
            placeholder={!readOnly ? "Add notes about this deal..." : ""}
            className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white ${readOnly ? 'cursor-default' : ''}`}
          />
        </div>

        {/* Property Information */}
        <div>
          <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-[#1a2332] uppercase tracking-wide">Property Information</h3>
            <a
              href={COUNTY_DATA[county]?.gisPortalUrl || `https://www.google.com/search?q=${encodeURIComponent((county || deal.county) + ' County GIS parcel map')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <MapPin size={11} /> GIS Map
            </a>
          </div>
          <fieldset disabled={readOnly} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="grid grid-cols-2 gap-x-6 divide-y-0">
            <InputRow label="Parcel ID" value={parcelId} onChange={v => { setParcelId(v); saveNow?.({ parcelId: v }); }} mono />
            <InputRow label="Address" value={address} onChange={v => { setAddress(v); saveNow?.({ address: v }); }} />
            <InputRow label="County" value={county} onChange={v => { setCounty(v); saveNow?.({ county: v }); }} />
            <InputRow label="State" value={dealState} onChange={v => { setDealState(v); saveNow?.({ state: v }); }} />
            <InputRow label="Zip Code" value={zip} onChange={v => { setZip(v); saveNow?.({ zip: v }); }} />
            <InputRow label="Acreage" value={acreage} onChange={v => { setAcreage(v); saveNow?.({ acreage: v }); }} type="number" />
            </div>
            {/* Listing URL */}
            <div className="py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Listing URL</p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={listingUrl || ''}
                  onChange={e => { setListingUrl(e.target.value); saveNow?.({ listingUrl: e.target.value }); }}
                  readOnly={readOnly}
                  placeholder={readOnly ? '' : 'https://...'}
                  className="flex-1 text-xs text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:opacity-60"
                />
                {listingUrl && (
                  <a href={listingUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline flex-shrink-0">
                    Open <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            <div className="py-2 flex items-center gap-4">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <MapPin size={12} /> Open in Maps <ExternalLink size={10} />
              </a>
              <button
                onClick={onOpenMapSearch}
                className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
              >
                <MapPin size={12} /> Open in Map Search
              </button>
            </div>
          </fieldset>
        </div>

        {/* Seller Information */}
        {!isAgent && (
          <div>
            <SectionHeader>Seller Information</SectionHeader>
            <fieldset disabled={readOnly} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-x-6">
              <InputRow label="Seller Name" value={sellerName} onChange={setSellerName} />
              <InputRow label="Owner Name" value={ownerName} onChange={setOwnerName} />
              <InputRow label="Phone" value={phone} onChange={setPhone} />
              <InputRow label="Email" value={email} onChange={setEmail} />
              <SelectRow label="Lead Source" value={leadSource} onChange={setLeadSource} options={LEAD_SOURCE_OPTIONS} />
              <SelectRow label="Seller Type" value={ownerType} onChange={setOwnerType} options={OWNER_TYPE_OPTIONS} />
              </div>
            </fieldset>
          </div>
        )}

        {/* Deal Evaluation */}
        <div>
          <SectionHeader>Deal Evaluation</SectionHeader>
          <fieldset disabled={readOnly} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="grid grid-cols-2 gap-x-6">
            <SelectRow label="Utility Scenario" value={utilityScenario} onChange={v => { setUtilityScenario(v); saveNow?.({ utilityScenario: v }); }} options={UTILITY_SCENARIO_OPTIONS} readOnly={readOnly} />
            {(!readOnly || homeModel) && (
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Home Model</p>
                {readOnly
                  ? <span className="text-sm font-medium text-gray-800">{homeModel}</span>
                  : <select
                      value={homeModel || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const selected = HOME_MODELS.find(m => `${m.manufacturer} - ${m.model}` === val);
                        setHomeModel(val);
                        if (selected) setCosts(prev => ({ ...prev, mobileHome: selected.price }));
                        saveNow?.({ homeModel: val, ...(selected ? { mobileHome: selected.price } : {}) });
                      }}
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full disabled:opacity-60 disabled:cursor-default"
                    >
                      <option value="">— Select Model —</option>
                      {HOME_MODELS.map(m => (
                        <option key={m.id} value={`${m.manufacturer} - ${m.model}`}>
                          {m.manufacturer} – {m.model} ({m.beds}bd/{m.baths}ba, {m.sqft} sqft) — ${m.price.toLocaleString()}
                        </option>
                      ))}
                    </select>
                }
              </div>
            )}
            <InputRow label="Water" value={waterCompany} onChange={v => { setWaterCompany(v); saveNow?.({ waterCompany: v }); }} readOnly={readOnly} />
            <InputRow label="Sewer" value={sewerCompany} onChange={v => { setSewerCompany(v); saveNow?.({ sewerCompany: v }); }} readOnly={readOnly} />
            <InputRow label="Electric" value={electricCompany} onChange={v => { setElectricCompany(v); saveNow?.({ electricCompany: v }); }} readOnly={readOnly} />
            <SelectRow label="Subdividable" value={subdividable} onChange={setSubdividable} options={['Yes', 'No']} readOnly={readOnly} />
            <SelectRow label="Land Clearing" value={landClearing} onChange={setLandClearing} options={['Yes', 'No']} readOnly={readOnly} />
            </div>
          </fieldset>
        </div>

        {/* Cost Breakdown — hidden for agents */}
        {!isAgent && (
          <div>
            <SectionHeader>Cost Breakdown</SectionHeader>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <fieldset disabled={readOnly} className="p-4">
                <div className="grid grid-cols-2 gap-x-6">
                  {COST_FIELDS.filter(({ key }) => !readOnly || (costs[key] || 0) > 0).map(({ key, label }) => (
                    <div key={key} className="py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{label}</p>
                      {readOnly
                        ? <span className="text-sm font-medium text-gray-800">${(costs[key] || 0).toLocaleString()}</span>
                        : <input
                            type="number"
                            value={costs[key] || ''}
                            onChange={e => setCosts(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                            placeholder="0"
                            className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                          />
                      }
                    </div>
                  ))}
                </div>
              </fieldset>
              <div className="bg-[#1a2332] text-white px-4 py-2.5 flex justify-between">
                <span className="text-sm font-semibold">Total Build Cost</span>
                <span className="text-sm font-bold">${allIn.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Estimated ARV / Profit Summary */}
        <div>
          {isAgent && <SectionHeader>Estimated ARV</SectionHeader>}
          <div className={`${!isAgent ? 'mt-3' : ''} bg-white rounded-xl border border-gray-100 px-4 py-3`}>
            <div className="grid grid-cols-2 gap-x-6">
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Estimated ARV</p>
                {!readOnly
                  ? <input
                      type="number"
                      value={arv ?? ''}
                      onChange={e => { const v = Number(e.target.value) || 0; setArv(v); saveNow?.({ arv: v }); }}
                      placeholder="0"
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                    />
                  : <span className="text-sm font-medium text-gray-800">${arvVal.toLocaleString()}</span>
                }
              </div>
              {!isAgent && (
                <>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Selling Costs (4.5% + $4,000)</p>
                    <span className="text-sm font-medium text-red-500">-${Math.round(sellingCosts).toLocaleString()}</span>
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Holding Costs ({deal.holdingMonths || 4} mo × ${deal.holdingPerMonth || 250}/mo)</p>
                    <span className="text-sm font-medium text-red-500">-${holdingCosts.toLocaleString()}</span>
                  </div>
                  {hasFinancing && (
                    <div className="py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Financing Costs</p>
                      <span className="text-sm font-medium text-red-500">-${Math.round(totalCostOfCapital + profitShareAmount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Net Profit {activeFinancing ? `(${activeFinancing})` : deal.financing ? `(${deal.financing})` : ''}</p>
                    <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ${Math.round(netProfit).toLocaleString()}
                    </span>
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">ROI</p>
                    <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{roi}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Closing Details — hidden for agents */}
        {!isAgent && (
          <div>
            <SectionHeader>Closing Details</SectionHeader>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-x-6">
              {/* Investor dropdown */}
              <div className="py-2 border-b border-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400 font-medium">Investor</span>
                  {!readOnly && (
                    <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-medium flex items-center gap-0.5">
                      <span>+ Add Investor</span>
                    </button>
                  )}
                </div>
                {readOnly ? (
                  <p className="text-sm font-medium text-gray-800">{investor || '—'}</p>
                ) : (
                  <select
                    value={investor}
                    onChange={e => { setInvestor(e.target.value); saveNow?.({ investor: e.target.value }); }}
                    className="w-full text-sm font-medium text-gray-800 bg-transparent border-0 outline-none p-0 cursor-pointer"
                  >
                    <option value="">— Select investor —</option>
                    {(investorList || []).map(inv => (
                      <option key={inv.id} value={inv.name}>{inv.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <InputRow label="Closing Attorney" value={closingAttorney} onChange={v => { setClosingAttorney(v); saveNow?.({ closingAttorney: v }); }} readOnly={readOnly} />
              <InputRow label="Attorney Phone" value={closingAttorneyPhone} onChange={v => { setClosingAttorneyPhone(v); saveNow?.({ closingAttorneyPhone: v }); }} readOnly={readOnly} />
              <InputRow label="Attorney Address" value={closingAttorneyAddress} onChange={v => { setClosingAttorneyAddress(v); saveNow?.({ closingAttorneyAddress: v }); }} readOnly={readOnly} />
              <InputRow label="Closing Date" value={closeDate} onChange={v => { setCloseDate(v); saveNow?.({ closeDate: v }); }} type="date" readOnly={readOnly} />
              <InputRow label="Contract Signed Date" value={contractDate} onChange={v => { setContractDate(v); saveNow?.({ contractDate: v }); }} type="date" readOnly={readOnly} />
              </div>
            </div>
          </div>
        )}

        {/* Sales */}
        {!isAgent && (
          <div>
            <SectionHeader>Sales</SectionHeader>
            <fieldset disabled={readOnly} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="grid grid-cols-2 gap-x-6">
                <SelectRow label="Realtor" value={realtor} onChange={v => { setRealtor(v); saveNow?.({ realtor: v }); }} options={agentUsers} readOnly={readOnly} />
                <InputRow label="Date Listed" value={dateListed} onChange={v => { setDateListed(v); saveNow?.({ dateListed: v }); }} type="date" readOnly={readOnly} />
              </div>
            </fieldset>
          </div>
        )}

        {/* Financing Scenario — hidden for agents */}
        {!isAgent && <div>
          <SectionHeader>Financing Scenario</SectionHeader>

          {/* Scenario selector */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Scenario</p>
            <select
              value={selectedScenario}
              onChange={e => applyScenario(e.target.value)}
              className="w-full text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">— Choose a financing scenario —</option>
              {FINANCING_SCENARIOS.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* ── Hard Money Loan / Hard Money (Land + Home) ──── */}
          {!!selectedScenario && (activeFinancing === 'Hard Money Loan' || activeFinancing === 'Hard Money (Land + Home)') && (
            <div className="space-y-4">

              {/* Loan Amount */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Loan Amount</p>
                <div className="grid grid-cols-2 gap-x-6">
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Cost of Manufactured Home</p>
                    <span className="text-sm font-medium text-gray-800">${(costs.mobileHome || 0).toLocaleString()}</span>
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Cost of Land</p>
                    <span className="text-sm font-medium text-gray-800">${(costs.land || 0).toLocaleString()}</span>
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Total Amount Lent</p>
                    <input
                      type="number"
                      value={loanAmountOverride || totalLent}
                      onChange={e => setLoanAmountOverride(Number(e.target.value) || 0)}
                      onFocus={e => e.target.select()} type="number"
                      className="text-sm font-semibold text-accent bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Interest · Origination · Servicing · Profit Share · Terms — 2-col layout */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-0 divide-x divide-gray-100">

                  {/* Left column: Interest + Origination Fee + Servicing Fee */}
                  <div className="pr-6 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Interest</p>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Annual Interest Rate (%)</p>
                        <DecimalInput value={interestRate} onChange={setInterestRate} className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Monthly Interest Payment</p>
                        <span className="text-sm font-medium text-gray-800">${Math.round(monthlyInterest).toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Origination Fee</p>
                        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                          <button onClick={() => setOriginationFeeType('percentage')} className={`px-2 py-0.5 transition-colors ${originationFeeType === 'percentage' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>%</button>
                          <button onClick={() => setOriginationFeeType('flat')} className={`px-2 py-0.5 transition-colors ${originationFeeType === 'flat' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>$</button>
                        </div>
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{originationFeeType === 'percentage' ? 'Fee Percentage (%)' : 'Flat Amount ($)'}</p>
                        <DecimalInput
                          value={originationFeeType === 'percentage' ? originationFeePct : originationFeeFlat}
                          onChange={v => originationFeeType === 'percentage' ? setOriginationFeePct(v) : setOriginationFeeFlat(v)}
                          className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Calculated Fee</p>
                        <span className="text-sm font-medium text-gray-800">${Math.round(originationFee).toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicing Fee</p>
                        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                          <button onClick={() => setServicingFeeType('percentage')} className={`px-2 py-0.5 transition-colors ${servicingFeeType === 'percentage' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>%</button>
                          <button onClick={() => setServicingFeeType('flat')} className={`px-2 py-0.5 transition-colors ${servicingFeeType === 'flat' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>$</button>
                        </div>
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{servicingFeeType === 'percentage' ? 'Fee Percentage (%)' : 'Flat Amount ($)'}</p>
                        <DecimalInput
                          value={servicingFeeType === 'percentage' ? servicingFeePct : servicingFeeFlat}
                          onChange={v => servicingFeeType === 'percentage' ? setServicingFeePct(v) : setServicingFeeFlat(v)}
                          className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Calculated Fee</p>
                        <span className="text-sm font-medium text-gray-800">${Math.round(servicingFee).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right column: Profit Share & Terms */}
                  <div className="pl-6 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Profit Share & Terms</p>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Profit Share (%)</p>
                        <DecimalInput value={profitSharePct} onChange={setProfitSharePct} className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Profit Share Amount</p>
                        <span className="text-sm font-medium text-gray-800">${Math.round(profitShareAmount).toLocaleString()}</span>
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Balloon Term (months)</p>
                        <input type="text" inputMode="numeric" value={balloonTerm || ''} onChange={e => setBalloonTerm(Number(e.target.value) || 0)}
                          onFocus={e => e.target.select()} className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Hold Period (months)</p>
                        <input type="text" inputMode="numeric" value={holdPeriod || ''} onChange={e => setHoldPeriod(Number(e.target.value) || 0)}
                          onFocus={e => e.target.select()} className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                      <div className="py-2">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Monthly Holding Costs ($)</p>
                        <DecimalInput value={monthlyHoldCost} onChange={setMonthlyHoldCost} className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Summary */}
              <div className="bg-[#1a2332] rounded-xl px-4 py-3 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-300 mb-2">Cost of Capital Summary</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Total Amount Lent</span>
                    <span className="font-medium">${effectiveLoanAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Monthly Interest × {holdPeriod} mo</span>
                    <span className="font-medium">${Math.round(monthlyInterest * holdPeriod).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Origination Fee</span>
                    <span className="font-medium">${Math.round(originationFee).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Servicing Fee</span>
                    <span className="font-medium">${Math.round(servicingFee).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Profit Share</span>
                    <span className="font-medium">${Math.round(profitShareAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-white/20 pt-1.5 mt-1">
                    <span className="font-semibold text-white">Total Cost of Capital</span>
                    <span className="font-bold text-accent">${Math.round(totalCostOfCapital + profitShareAmount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Capital Tracking */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Capital Tracking</p>
                <div className="grid grid-cols-2 gap-x-6">
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Deployed Date</p>
                    <input
                      type="date"
                      value={capitalDeployedDate}
                      onChange={e => setCapitalDeployedDate(e.target.value)}
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                    />
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Returned Date</p>
                    <input
                      type="date"
                      value={capitalReturnedDate}
                      onChange={e => setCapitalReturnedDate(e.target.value)}
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── Investor Portal Position (always visible) ────── */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Investor Portal — Position Data</p>
            <div className="grid grid-cols-2 gap-x-6">
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Contributed ($)</p>
                <input
                  type="number"
                  value={investorCapitalContributed ?? ''}
                  onChange={e => setInvestorCapitalContributed(e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 50000"
                  className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Equity % (Pro-Rata)</p>
                <input
                  type="number"
                  value={investorEquityPct ?? ''}
                  onChange={e => setInvestorEquityPct(e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 25"
                  className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                />
              </div>
              <div className="py-2 col-span-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Projected Payout Date</p>
                <input
                  type="date"
                  value={projectedPayoutDate ?? ''}
                  onChange={e => setProjectedPayoutDate(e.target.value || null)}
                  className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full md:w-1/2"
                />
              </div>
            </div>
          </div>

          {/* ── Line of Credit ──────────────────────────────── */}
          {!!selectedScenario && activeFinancing === 'Line of Credit' && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line of Credit Terms</p>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Credit Limit ($)</p>
                  <input type="number" value={creditLimit} onChange={e => setCreditLimit(Number(e.target.value) || 0)}
                    className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                </div>
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Draw % (of Credit Limit)</p>
                  <input type="number" value={drawPct} onChange={e => setDrawPct(Number(e.target.value) || 0)}
                    className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                </div>
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Draw Amount</p>
                  <span className="text-sm font-medium text-accent">${Math.round(creditLimit * drawPct / 100).toLocaleString()}</span>
                </div>
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Annual Interest Rate (%)</p>
                  <input type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value) || 0)}
                    className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                </div>
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Annual Fee (%)</p>
                  <input type="number" value={annualFeePct} onChange={e => setAnnualFeePct(Number(e.target.value) || 0)}
                    className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                </div>
              </div>
            </div>
          )}

          {/* ── Profit Split ─────────────────────────────────── */}
          {!!selectedScenario && activeFinancing === 'Profit Split' && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Profit Split Terms</p>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Investor Profit Split (%)</p>
                  <input type="number" value={investorProfitSplitPct} onChange={e => setInvestorProfitSplitPct(Number(e.target.value) || 0)}
                    className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full" />
                </div>
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Investor Split Amount</p>
                  <span className="text-sm font-medium text-accent">${Math.round(netProfit * investorProfitSplitPct / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Committed Capital Partner ────────────────────── */}
          {!!selectedScenario && activeFinancing === 'Committed Capital Partner' && (
            <CommittedCapitalPartnerPanel
              deal={deal}
              netProfit={netProfit}
              ccpInvestorId={ccpInvestorId} setCcpInvestorId={setCcpInvestorId}
              ccpCommitmentId={ccpCommitmentId} setCcpCommitmentId={setCcpCommitmentId}
              ccpAllocationAmount={ccpAllocationAmount} setCcpAllocationAmount={setCcpAllocationAmount}
              ccpPrefReturnPct={ccpPrefReturnPct} setCcpPrefReturnPct={setCcpPrefReturnPct}
              ccpProfitSharePct={ccpProfitSharePct} setCcpProfitSharePct={setCcpProfitSharePct}
              ccpPrefPaymentTiming={ccpPrefPaymentTiming} setCcpPrefPaymentTiming={setCcpPrefPaymentTiming}
              ccpPosition={ccpPosition} setCcpPosition={setCcpPosition}
              ccpTranches={ccpTranches} setCcpTranches={setCcpTranches}
            />
          )}

          {/* ── Capital Stack ─────────────────────────────────── */}
          <CapitalStackModule deal={deal} readOnly={readOnly} />

        </div>}

        {/* Scenario Comparison — hidden for agents and when no scenario selected */}
        {!isAgent && !!selectedScenario && <div>
          <SectionHeader>Scenario Comparison</SectionHeader>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Scenario</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Capital</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Profit</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { label: 'Cash', capital: allIn, profit: netProfit, interest: 0 },
                  { label: 'Hard Money', capital: allIn * 0.2, profit: netProfit - (allIn * 0.8 * 0.12 / 12 * 4), interest: allIn * 0.8 * 0.12 / 12 * 4 },
                  { label: 'HM (Land + Home)', capital: allIn * 0.1, profit: netProfit - (allIn * 0.9 * 0.12 / 12 * 4), interest: allIn * 0.9 * 0.12 / 12 * 4 },
                  { label: 'Line of Credit', capital: allIn * 0.1, profit: netProfit - (allIn * 0.9 * 0.08 / 12 * 4), interest: allIn * 0.9 * 0.08 / 12 * 4 },
                ].map(row => {
                  const roi = row.capital > 0 ? ((row.profit / row.capital) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{row.label}</td>
                      <td className="px-4 py-2 text-right text-gray-600">${Math.round(row.capital).toLocaleString()}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>${Math.round(row.profit).toLocaleString()}</td>
                      <td className={`px-4 py-2 text-right font-bold ${row.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{roi}%</td>
                    </tr>
                  );
                })}
                {/* Committed Capital Partner row — only when amount is set */}
                {ccpAllocationAmount > 0 && (() => {
                  const holdMo = (deal?.holdingMonths || 6);
                  const ccpPref = ccpAllocationAmount * ((ccpPrefReturnPct || 0) / 100) * (holdMo / 12);
                  const ccpShare = (ccpProfitSharePct != null && ccpProfitSharePct > 0)
                    ? netProfit * (ccpProfitSharePct / 100)
                    : 0;
                  const ccpCost = ccpPref + ccpShare;
                  const ccpProfit = netProfit - ccpCost;
                  const ccpRoi = ccpAllocationAmount > 0 ? ((ccpProfit / ccpAllocationAmount) * 100).toFixed(1) : '0.0';
                  return (
                    <tr className="hover:bg-gray-50 bg-accent/5">
                      <td className="px-4 py-2 font-medium text-gray-700">
                        Committed Capital Partner
                        <span className="ml-1 text-[10px] text-accent font-semibold">★ active</span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">${Math.round(ccpAllocationAmount).toLocaleString()}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${ccpProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>${Math.round(ccpProfit).toLocaleString()}</td>
                      <td className={`px-4 py-2 text-right font-bold ${ccpProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{ccpRoi}%</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>}
      </div>

      {/* Right sidebar — documents — hidden for agents */}
      {!isAgent && <div className="hidden lg:block w-64 flex-shrink-0 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-[#1a2332] mb-3">Project Files</h3>
          <button className="w-full flex items-center justify-center gap-2 bg-accent text-white text-xs font-medium py-2 px-3 rounded-lg hover:bg-accent/90 transition-colors mb-3">
            <Upload size={13} /> Upload Document
          </button>
          <div className="space-y-1.5">
            {REQUIRED_DOCS.map(doc => {
              const uploaded = (deal.id === 'deal-020' ? SWANSON_DOCS : []).find(d => d.category === doc);
              return (
                <div key={doc} className="flex items-start gap-2">
                  {uploaded ? (
                    <Check size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={13} className="text-orange-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs leading-tight ${uploaded ? 'text-gray-700' : 'text-gray-400'}`}>{doc}</p>
                    {uploaded && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{uploaded.file}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auto-save indicator */}
        <p className="text-[11px] text-gray-400 text-center">Auto-saving changes...</p>
      </div>}
    </div>
  );
}

// ── Add Investor Modal ────────────────────────────────────────────────────────
function AddInvestorModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState('Private Lender');
  const [standardTerms, setStandardTerms] = useState('');

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent';
  const labelCls = 'text-xs font-medium text-gray-500 mb-1 block';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-sidebar">Add Investor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div>
            <label className={labelCls}>Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Investor name" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="First Last" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className={inputCls + ' bg-white'}>
                {['Hard Money Lender', 'Private Lender', 'Line of Credit', 'Internal'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(000) 000-0000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Standard Terms</label>
            <input value={standardTerms} onChange={e => setStandardTerms(e.target.value)} placeholder="e.g. 3 and 13" className={inputCls} />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => { if (name.trim()) onSave({ name: name.trim(), contact, phone, email, type, standardTerms }); }}
            disabled={!name.trim()}
            className="flex-1 bg-accent text-white text-sm font-medium py-2 rounded-lg hover:bg-accent/90 disabled:opacity-40"
          >
            Save Investor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Due Diligence ────────────────────────────────────────────────────────
const DD_STATUS_CONFIG = {
  not_started: { label: 'Not Started', bg: 'bg-gray-100',    text: 'text-gray-500'   },
  in_progress:  { label: 'In Progress', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  complete:     { label: 'Complete',    bg: 'bg-orange-100', text: 'text-orange-600' },
};
const STATUS_CYCLE = { not_started: 'in_progress', in_progress: 'complete', complete: 'not_started' };

function DDTaskRow({ dealId, col, readOnly, onCountChange }) {
  const lk = `dd_${dealId}_${col.key}`;
  const [status, setStatus]   = useState(() => localStorage.getItem(lk) || 'not_started');
  const [expanded, setExpanded] = useState(false);
  const [cName,    setCName]   = useState(() => localStorage.getItem(`${lk}_cont`)    || '');
  const [cPhone,   setCPhone]  = useState(() => localStorage.getItem(`${lk}_phone`)   || '');
  const [cEmail,   setCEmail]  = useState(() => localStorage.getItem(`${lk}_email`)   || '');
  const [cCompany, setCCompany]= useState(() => localStorage.getItem(`${lk}_company`) || '');
  const [taskNotes, setTaskNotes] = useState(() => localStorage.getItem(`${lk}_notes`) || '');
  const [files, setFiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`${lk}_files`) || '[]'); } catch { return []; }
  });

  const save = (suffix, val) => localStorage.setItem(`${lk}_${suffix}`, val);

  const cycleStatus = (e) => {
    e.stopPropagation();
    if (readOnly) return;
    const next = STATUS_CYCLE[status];
    localStorage.setItem(lk, next);
    setStatus(next);
    onCountChange();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const updated = [...files, { name: file.name, url: ev.target.result }];
      setFiles(updated);
      localStorage.setItem(`${lk}_files`, JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (idx) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    localStorage.setItem(`${lk}_files`, JSON.stringify(updated));
  };

  const sc = DD_STATUS_CONFIG[status];
  const Icon = col.icon;
  const isComplete = status === 'complete';

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <Icon size={15} className={`flex-shrink-0 ${isComplete ? 'text-gray-300' : 'text-gray-400'}`} />
        <span className={`flex-1 text-sm font-medium ${isComplete ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {col.label}
        </span>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text} cursor-pointer`}
          onClick={cycleStatus}
        >
          {sc.label}
        </span>
        {expanded
          ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" />
          : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
        }
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-4">
          {/* Status action row */}
          <div className="flex items-center gap-3">
            {isComplete ? (
              <button
                onClick={(e) => { e.stopPropagation(); if (!readOnly) { localStorage.setItem(lk, 'not_started'); setStatus('not_started'); onCountChange(); } }}
                disabled={readOnly}
                className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Reopen Task
              </button>
            ) : (
              <button
                onClick={cycleStatus}
                disabled={readOnly}
                className="text-xs font-medium border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                {status === 'not_started' ? 'Mark In Progress' : 'Mark Complete'}
              </button>
            )}
            <span className="text-xs text-gray-400">Click to cycle: Not Started → In Progress → Complete</span>
          </div>

          {/* Contractor fields */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Contractor</p>
            <div className="space-y-2">
              {[
                { icon: User,     val: cName,    set: setCName,    sfx: 'cont',    ph: 'Contractor name' },
                { icon: Phone,    val: cPhone,   set: setCPhone,   sfx: 'phone',   ph: 'Phone' },
                { icon: Mail,     val: cEmail,   set: setCEmail,   sfx: 'email',   ph: 'Email' },
                { icon: Building, val: cCompany, set: setCCompany, sfx: 'company', ph: 'Company (optional)' },
              ].map(({ icon: FieldIcon, val, set, sfx, ph }) => (
                <div key={sfx} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <FieldIcon size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={val}
                    onChange={e => { set(e.target.value); save(sfx, e.target.value); }}
                    placeholder={ph}
                    disabled={readOnly}
                    className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={14} className="text-gray-400" />
              <p className="text-xs font-semibold text-gray-500">Notes</p>
            </div>
            <textarea
              value={taskNotes}
              onChange={e => { setTaskNotes(e.target.value); save('notes', e.target.value); }}
              placeholder="Add notes for this task..."
              disabled={readOnly}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-accent"
            />
          </div>

          {/* Files */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Paperclip size={14} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-500">Files & Photos</p>
              </div>
              {!readOnly && (
                <label className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 cursor-pointer">
                  <Upload size={12} />
                  Upload
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
            {files.length > 0 && (
              <div className="space-y-1.5">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <Paperclip size={12} className="text-gray-400 flex-shrink-0" />
                    <a href={f.url} download={f.name} className="flex-1 text-xs text-blue-600 hover:underline truncate">{f.name}</a>
                    {!readOnly && (
                      <button onClick={() => removeFile(idx)} className="text-gray-400 hover:text-red-400 flex-shrink-0">
                        <XIcon size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DDTab({ deal, readOnly, onStatusChange }) {
  const [completeCount, setCompleteCount] = useState(() =>
    DD_COLS.filter(c => localStorage.getItem(`dd_${deal.id}_${c.key}`) === 'complete').length
  );

  // Seed legacy ddTasksCompleted on first render
  useEffect(() => {
    for (const name of (deal.ddTasksCompleted || [])) {
      const k = DD_LS_INIT_MAP[name];
      if (k) {
        const lk = `dd_${deal.id}_${k}`;
        if (!localStorage.getItem(lk)) localStorage.setItem(lk, 'complete');
      }
    }
    setCompleteCount(DD_COLS.filter(c => localStorage.getItem(`dd_${deal.id}_${c.key}`) === 'complete').length);
  }, [deal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCountChange = () => {
    const count = DD_COLS.filter(c => localStorage.getItem(`dd_${deal.id}_${c.key}`) === 'complete').length;
    setCompleteCount(count);
    onStatusChange?.(count);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1a2332]">Due Diligence Tasks</h3>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">{completeCount} / {DD_COLS.length} Complete</span>
        </div>
      </div>
      <div className="space-y-2">
        {DD_COLS.map(col => (
          <DDTaskRow key={col.key} dealId={deal.id} col={col} readOnly={readOnly} onCountChange={handleCountChange} />
        ))}
      </div>
    </div>
  );
}

// ── Tab: Development ──────────────────────────────────────────────────────────
function DevTab({ devTasks, setDevTasks, readOnly }) {
  const allTasks = DEV_GROUPS.flatMap(g => g.tasks);
  const complete = devTasks.filter(Boolean).length;
  let taskIndex = 0;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1a2332]">Development Tasks</h3>
        <span className="text-sm text-gray-500">{complete} / {allTasks.length} Complete</span>
      </div>
      <div className="space-y-3">
        {DEV_GROUPS.map(group => {
          const groupStart = taskIndex;
          taskIndex += group.tasks.length;
          const groupComplete = group.tasks.filter((_, i) => devTasks[groupStart + i]).length;
          return (
            <div key={group.name} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{group.name}</span>
                <span className="text-xs text-gray-400">{groupComplete}/{group.tasks.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {group.tasks.map((task, i) => {
                  const idx = groupStart + i;
                  return (
                    <div
                      key={task}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${readOnly ? 'cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
                      onClick={readOnly ? undefined : () => setDevTasks(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; })}
                    >
                      {devTasks[idx]
                        ? <CheckSquare size={16} className="text-green-500 flex-shrink-0" />
                        : <Square size={16} className="text-gray-300 flex-shrink-0" />
                      }
                      <span className={`text-sm ${devTasks[idx] ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-blue-700">Overall Progress</span>
          <span className="text-sm font-bold text-blue-700">{complete}/{allTasks.length}</span>
        </div>
        <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${(complete / allTasks.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Tab: Realized Expenses ────────────────────────────────────────────────────
function RealizedTab({ realized, setRealized, readOnly }) {
  const total = COST_FIELDS.reduce((s, f) => s + (realized[f.key] || 0), 0);
  const visibleFields = readOnly
    ? COST_FIELDS.filter(({ key }) => (realized[key] || 0) !== 0)
    : COST_FIELDS;
  return (
    <div className="max-w-lg">
      <h3 className="font-semibold text-[#1a2332] mb-4">Realized Expenses</h3>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-x-6">
            {visibleFields.map(({ key, label }) => (
              <div key={key} className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">{label}</p>
                {readOnly
                  ? <span className="text-sm font-medium text-gray-800">${(realized[key] || 0).toLocaleString()}</span>
                  : <input
                      type="number"
                      value={realized[key] || ''}
                      onChange={e => setRealized(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                    />
                }
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#1a2332] text-white px-4 py-2.5 flex justify-between">
          <span className="text-sm font-semibold">Total Realized</span>
          <span className="text-sm font-bold">${total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Committed Capital Partner Panel ──────────────────────────────────────────
const CCP_TRIGGER_LABELS = { date: 'Date', milestone: 'Milestone', manual_call: 'Manual Call' };
const CCP_POSITION_OPTIONS = [
  { value: 'senior',      label: 'Senior' },
  { value: 'pari_passu',  label: 'Pari-passu' },
  { value: 'subordinate', label: 'Subordinate' },
];
const CCP_TIMING_OPTIONS = [
  { value: 'at_exit', label: 'At Exit' },
  { value: 'monthly', label: 'Monthly Current-Pay' },
  { value: 'deferred', label: 'Deferred' },
];
const CONSTRUCTION_PRESET = (total) => [
  { sequence: 1, pct: 0.25, notes: 'Contract / Closing',  triggerType: 'manual_call' },
  { sequence: 2, pct: 0.25, notes: 'Foundation / Permits', triggerType: 'milestone' },
  { sequence: 3, pct: 0.30, notes: 'Framing / Set-up',    triggerType: 'milestone' },
  { sequence: 4, pct: 0.20, notes: 'Drywall / Finishing',  triggerType: 'manual_call' },
].map(t => ({ ...t, amount: Math.round(total * t.pct), triggerDate: null, triggerMilestoneKey: null, dueDate: null }));

function newTranche(sequence) {
  return { sequence, amount: 0, triggerType: 'manual_call', triggerDate: null, triggerMilestoneKey: null, dueDate: null, notes: '' };
}

function CommittedCapitalPartnerPanel({
  deal,
  netProfit,
  ccpInvestorId, setCcpInvestorId,
  ccpCommitmentId, setCcpCommitmentId,
  ccpAllocationAmount, setCcpAllocationAmount,
  ccpPrefReturnPct, setCcpPrefReturnPct,
  ccpProfitSharePct, setCcpProfitSharePct,
  ccpPrefPaymentTiming, setCcpPrefPaymentTiming,
  ccpPosition, setCcpPosition,
  ccpTranches, setCcpTranches,
  ccpAllocationId,
  onSaveToStack,
  ccpSaving,
  ccpSaved,
}) {
  const [commitments, setCommitments] = useState([]);
  const [amountInput, setAmountInput] = useState(ccpAllocationAmount > 0 ? String(ccpAllocationAmount) : '');
  const [evenMonthsN, setEvenMonthsN] = useState(4);

  useEffect(() => {
    fetchActiveCommitmentsForModal().then(data => setCommitments(data ?? []));
  }, []);

  // Derive investor list from commitment summaries
  const investorMap = {};
  commitments.forEach(c => { investorMap[c.investor_id] = c.investor_name; });
  const investors = Object.entries(investorMap).map(([id, name]) => ({ id, name }));

  const investorCommitments = commitments.filter(c => c.investor_id === ccpInvestorId);
  const selectedCommitment = commitments.find(c => c.commitment_id === ccpCommitmentId);

  const amountNum = parseFloat(amountInput.replace(/,/g, '')) || 0;
  const headroom = selectedCommitment?.remaining_headroom ?? null;
  const dealRequired = deal?.totalCapitalRequired ?? null;
  const exceedsHeadroom = headroom != null && amountNum > headroom;
  const exceedsDealCap = dealRequired != null && amountNum > dealRequired;

  const handleAmountBlur = () => {
    const n = parseFloat(amountInput.replace(/,/g, '')) || 0;
    setCcpAllocationAmount(n);
    setAmountInput(n > 0 ? n.toLocaleString() : '');
  };

  const fmt = n => `$${Number(n || 0).toLocaleString()}`;

  // Tranche helpers
  const trancheSum = ccpTranches.reduce((s, t) => s + Number(t.amount || 0), 0);
  const trancheGap = amountNum - trancheSum;
  const tranchesOk = amountNum > 0 && Math.abs(trancheGap) < 0.01;

  const setTranche = (idx, field, value) => {
    setCcpTranches(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };
  const addTrancheRow = () => setCcpTranches(prev => [...prev, newTranche(prev.length + 1)]);
  const removeTranche = (idx) => setCcpTranches(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, sequence: i + 1 })));

  const loadPreset = (preset) => setCcpTranches(preset(amountNum));
  const loadEvenMonthly = () => {
    const n = Math.max(1, evenMonthsN);
    const baseAmt = Math.floor(amountNum / n);
    const remainder = amountNum - baseAmt * n;
    setCcpTranches(Array.from({ length: n }, (_, i) => ({
      sequence: i + 1,
      amount: i === n - 1 ? baseAmt + remainder : baseAmt,
      triggerType: 'date',
      triggerDate: null, triggerMilestoneKey: null, dueDate: null,
      notes: `Month ${i + 1}`,
    })));
  };

  // Projected cost of capital (simplified: full amount × pref rate × hold period)
  const holdMonths = deal?.holdingMonths || 6;
  const projectedPref = amountNum * (ccpPrefReturnPct / 100) * (holdMonths / 12);
  const projectedShare = ccpProfitSharePct != null && ccpProfitSharePct > 0
    ? netProfit * (ccpProfitSharePct / 100)
    : 0;
  const projectedTotalCost = projectedPref + projectedShare;
  const projectedPayout = amountNum + projectedTotalCost;

  const inputCls = 'text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full';
  const labelCls = 'text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium';

  return (
    <div className="space-y-4">

      {/* ── Section 1: Commitment Link ── */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Link to Commitment</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">

          {/* Investor selector */}
          <div className="py-2">
            <p className={labelCls}>Investor</p>
            <select
              value={ccpInvestorId}
              onChange={e => { setCcpInvestorId(e.target.value); setCcpCommitmentId(''); }}
              className={inputCls}
            >
              <option value="">— Select investor —</option>
              {investors.map(inv => <option key={inv.id} value={inv.id}>{inv.name}</option>)}
            </select>
            {investors.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">No investors with active commitments. Run migration 008 or add commitments.</p>
            )}
          </div>

          {/* Commitment selector */}
          <div className="py-2">
            <p className={labelCls}>Commitment</p>
            <select
              value={ccpCommitmentId}
              onChange={e => setCcpCommitmentId(e.target.value)}
              disabled={!ccpInvestorId}
              className={inputCls}
            >
              <option value="">— Select commitment —</option>
              {investorCommitments.map(c => (
                <option key={c.commitment_id} value={c.commitment_id}>
                  {c.commitment_name}
                  {c.remaining_headroom != null ? ` — ${fmt(c.remaining_headroom)} remaining` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Allocation amount */}
          <div className="py-2 col-span-2">
            <p className={labelCls}>Allocation Amount ($)</p>
            <input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              onFocus={e => { setAmountInput(String(amountNum || '')); e.target.select(); }}
              onBlur={handleAmountBlur}
              placeholder="e.g. 173,450"
              className={`${inputCls} ${exceedsHeadroom || exceedsDealCap ? 'border-red-400 focus:ring-red-300' : ''}`}
            />
            {exceedsHeadroom && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> Exceeds commitment headroom ({fmt(headroom)} remaining)
              </p>
            )}
            {!exceedsHeadroom && exceedsDealCap && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> Exceeds deal capital requirement ({fmt(dealRequired)})
              </p>
            )}
            {ccpCommitmentId && amountNum > 0 && !exceedsHeadroom && !exceedsDealCap && (
              <p className="text-[11px] text-gray-500 mt-1">
                Allocating {fmt(amountNum)} from {selectedCommitment?.commitment_name}
                {headroom != null ? ` — ${fmt(headroom - amountNum)} will remain on the commitment` : ''}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: Capital Terms ── */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Capital Terms</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0">
          <div className="py-2">
            <p className={labelCls}>Preferred Return % (annualized)</p>
            <input type="number" min="0" step="0.1" value={ccpPrefReturnPct}
              onChange={e => setCcpPrefReturnPct(parseFloat(e.target.value) || 0)}
              className={inputCls} />
          </div>
          <div className="py-2">
            <p className={labelCls}>Profit Share % (blank = pro-rata)</p>
            <input type="number" min="0" step="0.1"
              value={ccpProfitSharePct ?? ''}
              onChange={e => setCcpProfitSharePct(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
              placeholder="Pro-rata by allocation %"
              className={inputCls} />
          </div>
          <div className="py-2">
            <p className={labelCls}>Pref Payment Timing</p>
            <select value={ccpPrefPaymentTiming} onChange={e => setCcpPrefPaymentTiming(e.target.value)} className={inputCls}>
              {CCP_TIMING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="py-2">
            <p className={labelCls}>Position</p>
            <select value={ccpPosition} onChange={e => setCcpPosition(e.target.value)} className={inputCls}>
              {CCP_POSITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Draw Schedule ── */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Draw Schedule</p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => loadPreset(CONSTRUCTION_PRESET)}
              disabled={amountNum <= 0}
              className="text-[10px] font-medium px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              4-tranche construction
            </button>
            <button
              onClick={() => setCcpTranches([{ sequence: 1, amount: amountNum, triggerType: 'manual_call', triggerDate: null, triggerMilestoneKey: null, dueDate: null, notes: 'Single upfront fund' }])}
              disabled={amountNum <= 0}
              className="text-[10px] font-medium px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Single upfront
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={loadEvenMonthly}
                disabled={amountNum <= 0}
                className="text-[10px] font-medium px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Even monthly over
              </button>
              <input
                type="number" min="1" max="24" value={evenMonthsN}
                onChange={e => setEvenMonthsN(Number(e.target.value) || 1)}
                className="w-12 text-xs text-center border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <span className="text-[10px] text-gray-400">mo</span>
            </div>
          </div>
        </div>

        {/* Tranche table */}
        {ccpTranches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 font-medium w-8">#</th>
                  <th className="text-right pb-1.5 font-medium">Amount</th>
                  <th className="text-left pb-1.5 font-medium px-2">Trigger</th>
                  <th className="text-left pb-1.5 font-medium px-2">Date / Key</th>
                  <th className="text-left pb-1.5 font-medium px-2">Due Date</th>
                  <th className="text-left pb-1.5 font-medium px-2">Notes</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ccpTranches.map((t, i) => (
                  <tr key={i}>
                    <td className="py-1.5 text-gray-500">{t.sequence}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number" value={t.amount || ''}
                        onChange={e => setTranche(i, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <select value={t.triggerType} onChange={e => setTranche(i, 'triggerType', e.target.value)}
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30">
                        {Object.entries(CCP_TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-2">
                      {t.triggerType === 'date' ? (
                        <input type="date" value={t.triggerDate || ''} onChange={e => setTranche(i, 'triggerDate', e.target.value)}
                          className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30" />
                      ) : t.triggerType === 'milestone' ? (
                        <input type="text" value={t.triggerMilestoneKey || ''} placeholder="milestone key"
                          onChange={e => setTranche(i, 'triggerMilestoneKey', e.target.value)}
                          className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30 w-28" />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="date" value={t.dueDate || ''} onChange={e => setTranche(i, 'dueDate', e.target.value)}
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30" />
                    </td>
                    <td className="py-1.5 px-2">
                      <input type="text" value={t.notes || ''} placeholder="notes"
                        onChange={e => setTranche(i, 'notes', e.target.value)}
                        className="border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent/30 w-28" />
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => removeTranche(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <XIcon size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-2">No tranches yet. Use a preset or add rows manually.</p>
        )}

        {/* Tranche validation bar */}
        {ccpTranches.length > 0 && (
          <div className={`text-xs px-3 py-2 rounded-lg mb-2 ${tranchesOk ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {tranchesOk
              ? `✓ Tranches total ${fmt(trancheSum)} — matches allocation`
              : `Tranches total ${fmt(trancheSum)} of ${fmt(amountNum)} — ${trancheGap > 0 ? `${fmt(trancheGap)} unscheduled` : `${fmt(-trancheGap)} over allocation`}`}
          </div>
        )}

        <button onClick={addTrancheRow} className="text-xs text-accent font-medium hover:underline">+ Add tranche</button>
      </div>

      {/* ── Save to Capital Stack ── */}
      {ccpInvestorId && ccpCommitmentId && amountNum > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={onSaveToStack}
            disabled={ccpSaving || exceedsHeadroom || exceedsDealCap}
            className="flex-1 text-sm font-medium bg-accent text-white rounded-xl py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {ccpSaving ? 'Saving…' : ccpAllocationId ? 'Update in Capital Stack' : 'Save to Capital Stack'}
          </button>
          {ccpSaved && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
          {ccpAllocationId && !ccpSaved && (
            <span className="text-xs text-gray-400 italic">Allocation on stack</span>
          )}
        </div>
      )}

      {/* ── Section 4: Committed Capital Cost Summary ── */}
      {amountNum > 0 && (
        <div className="bg-[#1a2332] rounded-xl px-4 py-3 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-300 mb-2">Committed Capital Cost Summary</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Allocation on this deal</span>
              <span className="font-medium">{fmt(amountNum)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Projected hold period</span>
              <span className="font-medium">{holdMonths} mo</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">
                Projected pref return ({ccpPrefReturnPct}% × {holdMonths} mo)
                {ccpTranches.length > 0 && <span className="ml-1 text-gray-500" title="Simplified: full allocation × rate × hold period. Tranche-by-tranche accrual in PR 2.">*</span>}
              </span>
              <span className="font-medium">{fmt(Math.round(projectedPref))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">
                Projected profit share
                {ccpProfitSharePct == null ? ' (pro-rata — set % above to override)' : ` (${ccpProfitSharePct}% of projected profit)`}
              </span>
              <span className="font-medium">{fmt(Math.round(projectedShare))}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/20 pt-1.5 mt-1">
              <span className="text-gray-400">Total projected investor payout</span>
              <span className="font-medium">{fmt(Math.round(projectedPayout))}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/20 pt-1.5 mt-1">
              <span className="font-semibold text-white">Total cost of capital to deal</span>
              <span className="font-bold text-accent">{fmt(Math.round(projectedTotalCost))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Financing scenario types (matching Lovable CRM) ──────────────────────────
const FINANCING_SCENARIOS = [
  { id: 'cash',                    label: 'Cash',                                         financingType: 'Cash',                       dbType: 'cash' },
  { id: 'hard-money-loan',         label: 'Hard Money Loan',                              financingType: 'Hard Money Loan',            dbType: 'hard_money_loan' },
  { id: 'hard-money-land-home',    label: 'Hard Money (Land + Home)',                     financingType: 'Hard Money (Land + Home)',   dbType: 'hard_money_land_home' },
  { id: 'loc',                     label: 'Line of Credit',                               financingType: 'Line of Credit',             dbType: 'line_of_credit' },
  { id: 'profit-split',            label: 'Profit Split',                                 financingType: 'Profit Split',               dbType: 'profit_split' },
  { id: 'committed-capital-partner', label: 'Committed Capital Partner (Multi-Deal, Tranched)', financingType: 'Committed Capital Partner', dbType: 'committed_capital_partner' },
];

// ── Per-investor default terms ────────────────────────────────────────────────
function getDefaultRate(investor) {
  if (investor === 'Atium Build Group LLC') return 13;
  if (investor === 'Louis Isom') return 13;
  if (investor === 'Blue Bay Capital') return 14;
  if (investor === 'Windstone') return 14;
  return 12;
}

// ── Main DealDetail (inner) ───────────────────────────────────────────────────
// Receives deal as a guaranteed non-null prop so useState initializers are correct
function DealDetailContent({ deal }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromInvestorPortal = location.state?.from === 'investor-portal';
  const { canEdit, isAgent, canAdmin } = usePermissions();
  const { setDeals } = useDeals();
  const { profile, activeOrgId, orgSlug } = useAuth();
  const [agentUsers, setAgentUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('profiles').select('name').eq('role', 'realtor').then(({ data }) => {
      if (data) setAgentUsers(data.map(u => u.name).filter(Boolean));
    });
  }, []);

  useEffect(() => {
    if (!supabase || !canAdmin) return;
    supabase.from('profiles').select('name').then(({ data }) => {
      if (data) setAllUsers(data.map(u => u.name).filter(Boolean));
    });
  }, [canAdmin]);

  // Refs always hold the latest deal + state values — used by saveNow for synchronous saves
  const dealRef        = useRef(deal);
  const stateRef       = useRef({});
  dealRef.current      = deal; // updated every render

  // Stable callback: saves current state to localStorage + Supabase immediately
  const saveNow = useCallback((overrides = {}) => {
    if (!canEdit && !isAgent) return;
    const s = stateRef.current;
    const d = {
      ...dealRef.current,
      stage: s.stage, address: s.address, county: s.county, state: s.dealState, zip: s.zip,
      acreage: s.acreage, ownerName: s.ownerName, sellerName: s.sellerName,
      phone: s.phone, email: s.email,
      investor: s.investor, financing: s.financing, notes: s.notes,
      leadSource: s.leadSource, ownerType: s.ownerType, utilityScenario: s.utilityScenario,
      homeModel: s.homeModel, waterCompany: s.waterCompany, sewerCompany: s.sewerCompany,
      electricCompany: s.electricCompany, parcelId: s.parcelId,
      closingAttorney: s.closingAttorney, closingAttorneyPhone: s.closingAttorneyPhone,
      closingAttorneyAddress: s.closingAttorneyAddress, closeDate: s.closeDate,
      contractDate: s.contractDate, manufacturer: s.manufacturer, deliveryDate: s.deliveryDate,
      holdingMonths: s.holdPeriod, holdingPerMonth: s.monthlyHoldCost,
      arv: s.arv, listingUrl: s.listingUrl, ...s.costs,
      ...overrides,
    };
    // Save to localStorage + context immediately, and fire Supabase write
    saveDeal(d, activeOrgId);
    setDeals(prev => {
      const idx = prev.findIndex(x => String(x.id) === String(d.id));
      if (idx >= 0) { const next = [...prev]; next[idx] = d; return next; }
      return [...prev, d];
    });
  }, [canEdit, isAgent, setDeals]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial costs from deal data
  const initCosts = {};
  COST_FIELDS.forEach(f => { initCosts[f.key] = deal?.[f.key] || 0; });

  // DD complete count for tab label (updated via callback from DDTab)
  const [ddCompleteCount, setDdCompleteCount] = useState(() =>
    DD_COLS.filter(c => localStorage.getItem(`dd_${deal.id}_${c.key}`) === 'complete').length
  );

  // Initial dev tasks — Swanson has 1/38 complete (land cleared)
  const totalDevTasks = DEV_GROUPS.flatMap(g => g.tasks).length;
  const initDev = Array(totalDevTasks).fill(false).map((_, i) =>
    deal?.id === 'deal-020' ? i === 0 : false
  );

  const [activeTab, setActiveTab] = useState('overview');
  const [costs, setCosts] = useState(initCosts);
  const [notes, setNotes] = useState(deal?.notes || '');
  const [arv,   setArv]   = useState(deal?.arv ?? 0);
  const [listingUrl, setListingUrl] = useState(deal?.listingUrl || '');
  const [devTasks, setDevTasks] = useState(initDev);
  const [realized, setRealized] = useState({});
  const [starred, setStarred] = useState(false);
  const DEAL_OVERVIEW_ONLY = new Set(['Contract Signed', 'Due Diligence', 'Development', 'Complete']);
  const currentStageVal = localStorage.getItem(`lotline_deal_stage_${deal.id}`) || deal?.stage || '';
  const fromDealOverview = location.state?.pipeline === 'deal-overview' || DEAL_OVERVIEW_ONLY.has(currentStageVal);
  const isLandAcq = !fromDealOverview;
  const STAGE_OPTIONS = isLandAcq ? LAND_ACQ_STAGES : DEAL_OVERVIEW_STAGES;
  const [stage, setStage] = useState(() => {
    const val = currentStageVal || (isLandAcq ? 'New Lead' : 'Contract Signed');
    return STAGE_OPTIONS.includes(val) ? val : STAGE_OPTIONS[0];
  });
  const [showMapModal, setShowMapModal] = useState(false);
  const [leadSource, setLeadSource] = useState(deal?.leadSource || '');
  const [ownerType, setOwnerType] = useState(deal?.ownerType || '');
  const [utilityScenario, setUtilityScenario] = useState(deal?.utilityScenario || '');

  // Property Information
  const [address, setAddress] = useState(deal?.address || '');
  const [county, setCounty] = useState(deal?.county || '');
  const [dealState, setDealState] = useState(deal?.state || '');
  const [zip, setZip] = useState(deal?.zip || '');
  const [acreage, setAcreage] = useState(deal?.acreage?.toString() || '');

  // Deal Owner
  const [dealOwner, setDealOwner] = useState(deal?.dealOwner || profile?.name || '');

  // Seller Information
  const [sellerName, setSellerName] = useState(deal?.sellerName || '');
  const [ownerName, setOwnerName] = useState(deal?.ownerName || '');
  const [phone, setPhone] = useState(deal?.phone || '');
  const [email, setEmail] = useState(deal?.email || '');
  const [investor, setInvestor] = useState(deal?.investor || '');
  const [investorList, setInvestorList] = useState(() => loadInvestors(activeOrgId, orgSlug));
  const [showAddInvestor, setShowAddInvestor] = useState(false);
  const [financing, setFinancing] = useState(deal?.financing || '');

  // Deal Evaluation
  const [waterCompany, setWaterCompany] = useState(deal?.waterCompany || '');
  const [sewerCompany, setSewerCompany] = useState(deal?.sewerCompany || '');
  const [electricCompany, setElectricCompany] = useState(deal?.electricCompany || '');
  const [homeModel, setHomeModel] = useState(deal?.homeModel || '');
  const [subdividable, setSubdividable] = useState(() => {
    const saved = localStorage.getItem(`lotline_subdivide_${deal?.id}`);
    if (saved !== null) return saved;
    return (deal?.tags || []).includes('Subdivide') ? 'Yes' : 'No';
  });
  const [landClearing, setLandClearing] = useState(() => {
    const saved = localStorage.getItem(`lotline_land_clearing_${deal?.id}`);
    if (saved !== null) return saved;
    return (deal?.tags || []).includes('Land Clearing') ? 'Yes' : 'No';
  });

  // Persist subdivide state so the kanban card reflects it
  const handleSetSubdividable = (val) => {
    setSubdividable(val);
    if (deal?.id) localStorage.setItem(`lotline_subdivide_${deal.id}`, val);
  };

  const handleSetLandClearing = (val) => {
    setLandClearing(val);
    if (deal?.id) localStorage.setItem(`lotline_land_clearing_${deal.id}`, val);
  };

  const handleSendToLandAcq = () => {
    if (!deal?.id) return;
    const updated = {
      ...deal,
      pipeline: 'land-acquisition',
      stage: 'Waiting on Contract',
      contractSignedAt: null,
    };
    localStorage.setItem(`lotline_deal_stage_${deal.id}`, 'Waiting on Contract');
    saveDeal(updated, activeOrgId);
    setDeals(prev => {
      const idx = prev.findIndex(x => String(x.id) === String(updated.id));
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    navigate('/pipelines/land');
  };

  const handleSetStage = (val) => {
    setStage(val);
    if (deal?.id) {
      localStorage.setItem(`lotline_deal_stage_${deal.id}`, val);
      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const isMovingToContractSigned = val === 'Contract Signed';
      // Auto-fill Contract Signed Date when moving to Deal Overview
      if (isMovingToContractSigned && !deal.contractDate) {
        setContractDate(todayStr);
      }
      const updated = {
        ...deal,
        stage: val,
        // Auto-fill contractDate if not already set
        ...(isMovingToContractSigned && !deal.contractDate
          ? { contractDate: todayStr }
          : {}),
        // Stamp the moment this deal moves into Deal Overview (only set once)
        ...(isMovingToContractSigned && !deal.contractSignedAt
          ? { contractSignedAt: new Date().toISOString() }
          : {}),
        // Clear the timestamp if moved back to a Land Acq stage
        ...(val !== 'Contract Signed' && !['Due Diligence', 'Development', 'Complete'].includes(val)
          ? { contractSignedAt: null }
          : {}),
      };
      saveDeal(updated, activeOrgId);
      notifyPipelineChange(deal, val);
      notifyStageChange(deal, val);
      setDeals(prev => {
        const idx = prev.findIndex(x => String(x.id) === String(updated.id));
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [...prev, updated];
      });
    }
  };

  // Development Details
  const [parcelId, setParcelId] = useState(deal?.parcelId || '');
  const [closingAttorney, setClosingAttorney] = useState(deal?.closingAttorney || '');
  const [closingAttorneyPhone, setClosingAttorneyPhone] = useState(deal?.closingAttorneyPhone || '');
  const [closingAttorneyAddress, setClosingAttorneyAddress] = useState(deal?.closingAttorneyAddress || '');
  const [closeDate, setCloseDate] = useState(deal?.closeDate || '');
  const [contractDate, setContractDate] = useState(deal?.contractDate || '');
  const [manufacturer, setManufacturer] = useState(deal?.manufacturer || '');
  const [deliveryDate, setDeliveryDate] = useState(deal?.deliveryDate || '');
  const [realtor, setRealtor] = useState(deal?.realtor || '');
  const [dateListed, setDateListed] = useState(deal?.dateListed || '');

  // Financing scenario state — restored from scenarioData if available
  const sd = deal?.scenarioData || {};
  const [selectedScenario, setSelectedScenario] = useState(
    FINANCING_SCENARIOS.find(s => s.financingType === (deal?.financing || ''))?.id || ''
  );
  const [interestRate, setInterestRate] = useState(sd.interestRate ?? getDefaultRate(deal?.investor));
  const [originationFeeType, setOriginationFeeType] = useState(sd.originationFeeType ?? 'percentage');
  const [originationFeePct, setOriginationFeePct] = useState(
    sd.originationFeePct ?? (deal?.investor === 'Louis Isom' || deal?.investor === 'Blue Bay Capital' || deal?.investor === 'Windstone' ? 3 : 0)
  );
  const [originationFeeFlat, setOriginationFeeFlat] = useState(sd.originationFeeFlat ?? 0);
  const [servicingFeeType, setServicingFeeType] = useState(sd.servicingFeeType ?? 'flat');
  const [servicingFeeFlat, setServicingFeeFlat] = useState(sd.servicingFeeFlat ?? (deal?.investor === 'Louis Isom' ? 750 : 0));
  const [servicingFeePct, setServicingFeePct] = useState(sd.servicingFeePct ?? 0);
  const [balloonTerm, setBalloonTerm] = useState(sd.balloonTerm ?? 12);
  const [holdPeriod, setHoldPeriod] = useState(sd.holdPeriod ?? deal?.holdingMonths ?? 6);
  const [monthlyHoldCost, setMonthlyHoldCost] = useState(sd.monthlyHoldCost ?? deal?.holdingPerMonth ?? 250);
  const [profitSharePct, setProfitSharePct] = useState(sd.profitSharePct ?? (deal?.investor === 'Atium Build Group LLC' ? 5 : 0));
  const [capitalDeployedDate, setCapitalDeployedDate] = useState('');
  const [capitalReturnedDate, setCapitalReturnedDate] = useState('');
  const [investorCapitalContributed, setInvestorCapitalContributed] = useState(deal?.investorCapitalContributed ?? null);
  const [investorEquityPct, setInvestorEquityPct] = useState(deal?.investorEquityPct ?? null);
  const [projectedPayoutDate, setProjectedPayoutDate] = useState(deal?.projectedPayoutDate ?? null);

  // Hard Money Loan specific
  const [ltcPct, setLtcPct] = useState(sd.ltcPct ?? 0);
  const [originationPoints, setOriginationPoints] = useState(sd.originationPoints ?? 0);
  // Line of Credit specific
  const [creditLimit, setCreditLimit] = useState(sd.creditLimit ?? 0);
  const [drawPct, setDrawPct] = useState(sd.drawPct ?? 0);
  const [annualFeePct, setAnnualFeePct] = useState(sd.annualFeePct ?? 0);
  // Profit Split specific
  const [investorProfitSplitPct, setInvestorProfitSplitPct] = useState(sd.investorProfitSplitPct ?? 0);
  const [loanAmountOverride, setLoanAmountOverride] = useState(sd.loanAmountOverride ?? 0);

  // Committed Capital Partner specific
  const [ccpInvestorId, setCcpInvestorId] = useState(sd.ccpInvestorId ?? '');
  const [ccpCommitmentId, setCcpCommitmentId] = useState(sd.ccpCommitmentId ?? '');
  const [ccpAllocationAmount, setCcpAllocationAmount] = useState(sd.ccpAllocationAmount ?? 0);
  const [ccpPrefReturnPct, setCcpPrefReturnPct] = useState(sd.ccpPrefReturnPct ?? 0);
  const [ccpProfitSharePct, setCcpProfitSharePct] = useState(sd.ccpProfitSharePct ?? null);
  const [ccpPrefPaymentTiming, setCcpPrefPaymentTiming] = useState(sd.ccpPrefPaymentTiming ?? 'at_exit');
  const [ccpPosition, setCcpPosition] = useState(sd.ccpPosition ?? 'pari_passu');
  const [ccpTranches, setCcpTranches] = useState(sd.ccpTranches ?? []);
  const [ccpAllocationId, setCcpAllocationId] = useState(sd.ccpAllocationId ?? null);
  const [ccpScheduleId, setCcpScheduleId] = useState(sd.ccpScheduleId ?? null);
  const [financingScenarioType, setFinancingScenarioType] = useState(deal?.financingScenarioType ?? null);
  const [ccpSaving, setCcpSaving] = useState(false);
  const [ccpSaved, setCcpSaved] = useState(false);

  // Compute active financing type from selected scenario (used by auto-save)
  const activeFinancingForSave = selectedScenario
    ? FINANCING_SCENARIOS.find(s => s.id === selectedScenario)?.financingType
    : financing;

  function applyScenario(scenarioId) {
    // If switching away from CCP and an allocation exists, orphan it
    if (selectedScenario === 'committed-capital-partner' && scenarioId !== 'committed-capital-partner' && ccpAllocationId) {
      updateAllocation(ccpAllocationId, { status: 'orphaned_scenario_change' }).catch(console.warn);
      setCcpAllocationId(null);
    }
    setSelectedScenario(scenarioId);
    const scenario = FINANCING_SCENARIOS.find(s => s.id === scenarioId);
    setFinancing(scenario?.financingType || '');
    setFinancingScenarioType(scenario?.dbType || null);
  }

  async function saveCCPToStack() {
    if (!ccpInvestorId || !ccpCommitmentId || !ccpAllocationAmount) return;
    setCcpSaving(true);
    try {
      if (ccpAllocationId) {
        await updateAllocation(ccpAllocationId, {
          amount: ccpAllocationAmount,
          position: ccpPosition,
          preferred_return_pct: ccpPrefReturnPct || null,
          profit_share_pct: ccpProfitSharePct ?? null,
          pref_payment_timing: ccpPrefPaymentTiming,
          source_scenario: 'committed_capital_partner',
          status: 'planned',
        });
      } else {
        const { allocation, error, blocked } = await addAllocation({
          dealId: deal.id,
          commitmentId: ccpCommitmentId,
          investorId: ccpInvestorId,
          amount: ccpAllocationAmount,
          position: ccpPosition,
          preferredReturnPct: ccpPrefReturnPct || null,
          profitSharePct: ccpProfitSharePct ?? null,
          prefPaymentTiming: ccpPrefPaymentTiming,
          sourceScenario: 'committed_capital_partner',
          status: 'planned',
        });
        if (!blocked && !error && allocation) {
          setCcpAllocationId(allocation.id);
        }
      }
      setCcpSaved(true);
      setTimeout(() => setCcpSaved(false), 3000);
    } catch (e) {
      console.error('[saveCCPToStack]', e);
    } finally {
      setCcpSaving(false);
    }
  }

  // Keep stateRef in sync with latest state values every render (used by saveNow)
  stateRef.current = {
    stage, address, county, dealState, zip, acreage, ownerName, sellerName, phone, email, investor, financing,
    notes, leadSource, ownerType, utilityScenario, homeModel, waterCompany, sewerCompany,
    electricCompany, parcelId, closingAttorney, closingAttorneyPhone, closingAttorneyAddress,
    closeDate, contractDate, manufacturer, deliveryDate, holdPeriod, monthlyHoldCost, arv, listingUrl, costs,
    realtor, dateListed, dealOwner,
  };

  // ── One-time hydration save: push investor position to DB on mount when scenario active ─
  useEffect(() => {
    if (!selectedScenario || !deal?.id || (!canEdit && !isAgent)) return;
    const capital =
      (selectedScenario === 'hard-money-loan' || selectedScenario === 'hard-money-land-home')
        ? (loanAmountOverride || (costs.mobileHome || 0) + (costs.land || 0))
        : (deal.investorCapitalContributed ?? null);
    const equity =
      selectedScenario === 'profit-split'
        ? investorProfitSplitPct
        : (deal.investorEquityPct ?? null);
    // Always flush to DB — local state may already be correct but DB could be stale
    flushToSupabase({ ...deal, investorCapitalContributed: capital, investorEquityPct: equity });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save: fires immediately on every field change ───────────────────────
  const autoSaveMounted = useRef(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    if (!autoSaveMounted.current) { autoSaveMounted.current = true; return; }
    if (!deal?.id) return;
    if (!canEdit && !isAgent) return;

    const updatedDeal = {
      ...deal,
      stage, address, county, state: dealState, zip, acreage,
      ownerName, sellerName, phone, email, investor, financing, notes,
      leadSource, ownerType, utilityScenario, homeModel,
      waterCompany, sewerCompany, electricCompany,
      parcelId, closingAttorney, closingAttorneyPhone,
      closingAttorneyAddress, closeDate, contractDate,
      manufacturer, deliveryDate,
      holdingMonths: holdPeriod, holdingPerMonth: monthlyHoldCost,
      arv, listingUrl,
      realtor, dateListed, dealOwner,
      // Derive investor position fields from scenario — only when a scenario is explicitly active
      investorCapitalContributed:
        (selectedScenario === 'hard-money-loan' || selectedScenario === 'hard-money-land-home')
          ? (loanAmountOverride || (costs.mobileHome || 0) + (costs.land || 0))
          : investorCapitalContributed,
      investorEquityPct:
        selectedScenario === 'profit-split'
          ? investorProfitSplitPct
          : investorEquityPct,
      projectedPayoutDate,
      financingScenarioType,
      // Pack all scenario-specific inputs so they survive page reload
      scenarioData: {
        interestRate, originationFeeType, originationFeePct, originationFeeFlat,
        servicingFeeType, servicingFeeFlat, servicingFeePct, balloonTerm,
        holdPeriod, monthlyHoldCost, profitSharePct, investorProfitSplitPct,
        loanAmountOverride, ltcPct, originationPoints, creditLimit, drawPct, annualFeePct,
        // Committed Capital Partner
        ccpInvestorId, ccpCommitmentId, ccpAllocationAmount,
        ccpPrefReturnPct, ccpProfitSharePct, ccpPrefPaymentTiming,
        ccpPosition, ccpTranches, ccpAllocationId, ccpScheduleId,
      },
      ...costs,
    };

    // Save immediately — localStorage, context, and Supabase all at once
    saveDeal(updatedDeal, activeOrgId);
    setSaveStatus('saved');
    setDeals(prev => {
      const idx = prev.findIndex(x => String(x.id) === String(updatedDeal.id));
      if (idx >= 0) { const next = [...prev]; next[idx] = updatedDeal; return next; }
      return [...prev, updatedDeal];
    });
    const t = setTimeout(() => setSaveStatus('idle'), 2000);
    return () => clearTimeout(t);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    stage, address, county, dealState, zip, acreage,
    ownerName, sellerName, phone, email, investor, financing, notes,
    leadSource, ownerType, utilityScenario, homeModel,
    waterCompany, sewerCompany, electricCompany,
    parcelId, closingAttorney, closingAttorneyPhone,
    closingAttorneyAddress, closeDate, contractDate,
    manufacturer, deliveryDate, holdPeriod, monthlyHoldCost, arv, listingUrl, costs,
    realtor, dateListed, dealOwner,
    investorCapitalContributed, investorEquityPct, projectedPayoutDate,
    loanAmountOverride, investorProfitSplitPct, selectedScenario,
    interestRate, originationFeeType, originationFeePct, originationFeeFlat,
    servicingFeeType, servicingFeeFlat, servicingFeePct, balloonTerm,
    profitSharePct, ltcPct, originationPoints, creditLimit, drawPct, annualFeePct,
    ccpInvestorId, ccpCommitmentId, ccpAllocationAmount,
    ccpPrefReturnPct, ccpProfitSharePct, ccpPrefPaymentTiming,
    ccpPosition, ccpTranches, ccpAllocationId, ccpScheduleId,
    financingScenarioType,
  ]);

  const allIn = COST_FIELDS.reduce((s, f) => s + (costs[f.key] || 0), 0);
  const sellingCosts = (arv || 0) * 0.045 + 4000;
  const holdingCosts = (holdPeriod || 4) * (monthlyHoldCost || 250);
  const netProfit = (arv || 0) - allIn - sellingCosts - holdingCosts;
  const devComplete = devTasks.filter(Boolean).length;
  const devTotal = DEV_GROUPS.flatMap(g => g.tasks).length;

  const ALL_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'dd', label: `Due Diligence (${ddCompleteCount}/${DD_COLS.length})` },
    { key: 'dev', label: `Development (${devComplete}/${devTotal})` },
    { key: 'realized', label: 'Realized Expenses' },
  ];
  // Agents only see the Overview tab
  const TABS = isAgent ? ALL_TABS.filter(t => t.key === 'overview') : ALL_TABS;

  const STAGE_ORDER = STAGE_OPTIONS;
  const currentStageIdx = STAGE_ORDER.indexOf(stage);
  const nextStage = STAGE_ORDER[currentStageIdx + 1];

  return (
    <>
    <div className="min-h-screen" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={16} /> <span className="hidden sm:inline">{fromInvestorPortal ? 'Back to Investor Portal' : 'Back to Pipeline'}</span>
          </button>
          <ChevronRight size={14} className="text-gray-300 hidden sm:block" />
          <span className="text-sm text-gray-400 hidden sm:block">{fromInvestorPortal ? 'Investor Portal' : isLandAcq ? 'Land Acquisition' : 'Deal Overview'}</span>
          <ChevronRight size={14} className="text-gray-300 hidden sm:block" />
          <span className="text-sm text-gray-600 font-medium truncate max-w-[200px] md:max-w-xs">{deal.address}</span>
        </div>

        <div className="flex items-start justify-between mt-3">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#1a2332]">{deal.address}</h1>
            <GradeBadge grade={deal.grade} />
            {(deal.tags || []).filter(t => t !== 'Subdivide' && t !== 'Land Clearing').map(t => <Tag key={t} type={t}>{t}</Tag>)}
            {!fromInvestorPortal && <>
              <button
                onClick={() => canEdit && handleSetLandClearing(landClearing === 'Yes' ? 'No' : 'Yes')}
                disabled={!canEdit}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:cursor-default ${
                  landClearing === 'Yes'
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : canEdit
                      ? 'bg-gray-100 text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                }`}
              >
                <TreePine size={11} />
                Land Clearing
              </button>
              <button
                onClick={() => canEdit && handleSetSubdividable(subdividable === 'Yes' ? 'No' : 'Yes')}
                disabled={!canEdit}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:cursor-default ${
                  subdividable === 'Yes'
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : canEdit
                      ? 'bg-gray-100 text-gray-400 border-gray-200 hover:border-amber-300 hover:text-amber-600'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                }`}
              >
                <SplitSquareHorizontal size={11} />
                Subdivide
              </button>
            </>}
            {fromInvestorPortal && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                View Only
              </span>
            )}
          </div>
          {!fromInvestorPortal && (
            <div className="flex items-center gap-2">
              {/* Auto-save indicator */}
              {(canEdit || isAgent) && saveStatus === 'saving' && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" /> Saving…
                </span>
              )}
              {(canEdit || isAgent) && saveStatus === 'saved' && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Saved
                </span>
              )}
              {isAgent && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200">
                  Agent View
                </span>
              )}
              {!canEdit && !isAgent && (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  View Only
                </span>
              )}
              <button
                onClick={() => setStarred(s => !s)}
                className={`p-2 rounded-lg transition-colors ${starred ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-500'}`}
              >
                <Star size={18} fill={starred ? 'currentColor' : 'none'} />
              </button>
              {canEdit && (
                <button
                  onClick={() => {
                    saveDeal({ ...deal, isArchived: true, archivedAt: new Date().toISOString(), lastStage: stage }, activeOrgId);
                    // Remove from active localStorage list (org-scoped key)
                    try {
                      const lsKey = activeOrgId ? `lotline_deals_${activeOrgId}` : 'lotline_custom_deals';
                      const all = JSON.parse(localStorage.getItem(lsKey) || '[]');
                      localStorage.setItem(lsKey, JSON.stringify(all.filter(d => String(d.id) !== String(deal.id))));
                    } catch {}
                    // Navigate back
                    if (fromInvestorPortal) navigate('/investor-portal');
                    else if (deal.pipeline === 'land-acquisition') navigate('/pipelines/land');
                    else navigate('/deal-overview');
                  }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Archive size={14} /> Archive
                </button>
              )}
            </div>
          )}
        </div>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">ARV</p>
            <p className="text-sm font-bold text-[#1a2332]">${(deal.arv || 0).toLocaleString()}</p>
          </div>
          {!isAgent && <><div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Net Profit</p>
            <p className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              ${Math.round(netProfit).toLocaleString()}
            </p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Financing</p>
            <p className="text-sm font-bold text-[#1a2332]">{deal.financing}</p>
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Investor</p>
            <p className="text-sm font-bold text-[#1a2332]">{deal.investor || 'TBD'}</p>
          </div></>}
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Stage</p>
            {(fromInvestorPortal || !canEdit)
              ? <p className="text-sm font-semibold text-[#1a2332]">{stage}</p>
              : <select
                  value={stage}
                  onChange={e => handleSetStage(e.target.value)}
                  className="text-sm font-semibold text-[#1a2332] bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            }
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Deal Owner</p>
            {canAdmin
              ? <select
                  value={dealOwner}
                  onChange={e => setDealOwner(e.target.value)}
                  className="text-sm font-semibold text-[#1a2332] bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="">Unassigned</option>
                  {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              : <p className="text-sm font-semibold text-[#1a2332]">{dealOwner || 'Unassigned'}</p>
            }
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!isLandAcq && !fromInvestorPortal && canEdit && (
              <button
                onClick={handleSendToLandAcq}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← Land Acquisition
              </button>
            )}
            {nextStage && !fromInvestorPortal && canEdit && (
              <button
                onClick={() => handleSetStage(nextStage)}
                className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
              >
                → {nextStage}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className={`p-4 md:p-6 ${fromInvestorPortal ? '[&_input]:!border-0 [&_input]:!bg-transparent [&_input]:!shadow-none [&_input]:pointer-events-none [&_select]:!border-0 [&_select]:!bg-transparent [&_select]:!shadow-none [&_select]:pointer-events-none [&_select]:appearance-none [&_textarea]:!border-0 [&_textarea]:!bg-transparent [&_textarea]:!shadow-none [&_textarea]:pointer-events-none [&_textarea]:resize-none' : ''}`}>
        {activeTab === 'overview' && (
          <OverviewTab
            deal={deal} costs={costs} setCosts={setCosts} notes={notes} setNotes={setNotes}
            arv={arv} setArv={setArv}
            listingUrl={listingUrl} setListingUrl={setListingUrl}
            address={address} setAddress={setAddress} county={county} setCounty={setCounty}
            dealState={dealState} setDealState={setDealState} zip={zip} setZip={setZip}
            acreage={acreage} setAcreage={setAcreage}
            sellerName={sellerName} setSellerName={setSellerName}
            ownerName={ownerName} setOwnerName={setOwnerName}
            phone={phone} setPhone={setPhone}
            email={email} setEmail={setEmail}
            investor={investor} setInvestor={setInvestor}
            financing={financing} setFinancing={setFinancing}
            leadSource={leadSource} setLeadSource={setLeadSource}
            ownerType={ownerType} setOwnerType={setOwnerType}
            utilityScenario={utilityScenario} setUtilityScenario={setUtilityScenario}
            waterCompany={waterCompany} setWaterCompany={setWaterCompany}
            sewerCompany={sewerCompany} setSewerCompany={setSewerCompany}
            electricCompany={electricCompany} setElectricCompany={setElectricCompany}
            homeModel={homeModel} setHomeModel={setHomeModel}
            subdividable={subdividable} setSubdividable={handleSetSubdividable}
            landClearing={landClearing} setLandClearing={handleSetLandClearing}
            parcelId={parcelId} setParcelId={setParcelId}
            closingAttorney={closingAttorney} setClosingAttorney={setClosingAttorney}
            closingAttorneyPhone={closingAttorneyPhone} setClosingAttorneyPhone={setClosingAttorneyPhone}
            closingAttorneyAddress={closingAttorneyAddress} setClosingAttorneyAddress={setClosingAttorneyAddress}
            closeDate={closeDate} setCloseDate={setCloseDate}
            contractDate={contractDate} setContractDate={setContractDate}
            manufacturer={manufacturer} setManufacturer={setManufacturer}
            deliveryDate={deliveryDate} setDeliveryDate={setDeliveryDate}
            interestRate={interestRate} setInterestRate={setInterestRate}
            originationFeeType={originationFeeType} setOriginationFeeType={setOriginationFeeType}
            originationFeePct={originationFeePct} setOriginationFeePct={setOriginationFeePct}
            originationFeeFlat={originationFeeFlat} setOriginationFeeFlat={setOriginationFeeFlat}
            servicingFeeType={servicingFeeType} setServicingFeeType={setServicingFeeType}
            servicingFeeFlat={servicingFeeFlat} setServicingFeeFlat={setServicingFeeFlat}
            servicingFeePct={servicingFeePct} setServicingFeePct={setServicingFeePct}
            balloonTerm={balloonTerm} setBalloonTerm={setBalloonTerm}
            holdPeriod={holdPeriod} setHoldPeriod={setHoldPeriod}
            monthlyHoldCost={monthlyHoldCost} setMonthlyHoldCost={setMonthlyHoldCost}
            profitSharePct={profitSharePct} setProfitSharePct={setProfitSharePct}
            capitalDeployedDate={capitalDeployedDate} setCapitalDeployedDate={setCapitalDeployedDate}
            capitalReturnedDate={capitalReturnedDate} setCapitalReturnedDate={setCapitalReturnedDate}
            investorCapitalContributed={investorCapitalContributed} setInvestorCapitalContributed={setInvestorCapitalContributed}
            investorEquityPct={investorEquityPct} setInvestorEquityPct={setInvestorEquityPct}
            projectedPayoutDate={projectedPayoutDate} setProjectedPayoutDate={setProjectedPayoutDate}
            selectedScenario={selectedScenario} applyScenario={applyScenario}
            ltcPct={ltcPct} setLtcPct={setLtcPct}
            originationPoints={originationPoints} setOriginationPoints={setOriginationPoints}
            creditLimit={creditLimit} setCreditLimit={setCreditLimit}
            drawPct={drawPct} setDrawPct={setDrawPct}
            annualFeePct={annualFeePct} setAnnualFeePct={setAnnualFeePct}
            investorProfitSplitPct={investorProfitSplitPct} setInvestorProfitSplitPct={setInvestorProfitSplitPct}
            loanAmountOverride={loanAmountOverride} setLoanAmountOverride={setLoanAmountOverride}
            realtor={realtor} setRealtor={setRealtor}
            dateListed={dateListed} setDateListed={setDateListed}
            agentUsers={agentUsers}
            navigate={navigate}
            onOpenMapSearch={() => setShowMapModal(true)}
            investorList={investorList}
            onAddInvestor={() => setShowAddInvestor(true)}
            readOnly={fromInvestorPortal || (!canEdit && !isAgent)}
            isAgent={isAgent}
            saveNow={saveNow}
            ccpInvestorId={ccpInvestorId} setCcpInvestorId={setCcpInvestorId}
            ccpCommitmentId={ccpCommitmentId} setCcpCommitmentId={setCcpCommitmentId}
            ccpAllocationAmount={ccpAllocationAmount} setCcpAllocationAmount={setCcpAllocationAmount}
            ccpPrefReturnPct={ccpPrefReturnPct} setCcpPrefReturnPct={setCcpPrefReturnPct}
            ccpProfitSharePct={ccpProfitSharePct} setCcpProfitSharePct={setCcpProfitSharePct}
            ccpPrefPaymentTiming={ccpPrefPaymentTiming} setCcpPrefPaymentTiming={setCcpPrefPaymentTiming}
            ccpPosition={ccpPosition} setCcpPosition={setCcpPosition}
            ccpTranches={ccpTranches} setCcpTranches={setCcpTranches}
            ccpAllocationId={ccpAllocationId}
            onSaveToStack={saveCCPToStack}
            ccpSaving={ccpSaving}
            ccpSaved={ccpSaved}
          />
        )}
        {activeTab === 'dd' && (
          <DDTab deal={deal} readOnly={fromInvestorPortal || !canEdit} onStatusChange={setDdCompleteCount} />
        )}
        {activeTab === 'dev' && (
          <DevTab devTasks={devTasks} setDevTasks={setDevTasks} readOnly={fromInvestorPortal || !canEdit} />
        )}
        {activeTab === 'realized' && (
          <RealizedTab realized={realized} setRealized={setRealized} readOnly={fromInvestorPortal || !canEdit} />
        )}
      </div>

      {/* Capital & Partnerships shortcuts */}
      {!fromInvestorPortal && !isAgent && (
        <div className="px-4 md:px-6 pb-8 pt-2">
          <div className="border-t border-gray-200 pt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Capital &amp; Partnerships</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/lending', { state: { prefillLoan: {
                  address: deal.address || '',
                  purchasePrice: String(costs.land || 0),
                  loanAmount: String((costs.mobileHome || 0) + (costs.land || 0)),
                  arv: String(arv || deal.arv || 0),
                  loanType: 'Land + Home Package',
                  propertyType: 'Manufactured Home',
                  exitStrategy: 'Sell',
                  notes: `Deal ID: ${deal.id}. Financing: ${deal.financing || ''}. Investor: ${investor || ''}.`.trim(),
                }}})}
                className="flex items-center gap-2.5 px-5 py-3 bg-[#1a2332] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2332]/90 transition-colors shadow-sm"
              >
                <Landmark size={16} className="text-accent flex-shrink-0" />
                Apply for Financing
              </button>
              <button
                onClick={() => navigate('/lending', { state: { prefillPartner: {
                  address: deal.address || '',
                  arv: String(arv || deal.arv || 0),
                  projectedProfit: String(Math.max(0, Math.round(netProfit))),
                  dealType: 'Land + Home Package',
                  propertyType: 'Manufactured',
                  purchasePrice: String(costs.land || 0),
                  repairCosts: String(COST_FIELDS.filter(f => f.key !== 'land').reduce((s, f) => s + (costs[f.key] || 0), 0)),
                }}})}
                className="flex items-center gap-2.5 px-5 py-3 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent/90 transition-colors shadow-sm"
              >
                <Handshake size={16} className="flex-shrink-0" />
                Submit a Deal for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Add Investor Modal */}
    {showAddInvestor && (
      <AddInvestorModal
        onClose={() => setShowAddInvestor(false)}
        onSave={(newInv) => {
          const updated = addInvestor(newInv, activeOrgId, orgSlug);
          setInvestorList(updated);
          setInvestor(newInv.name);
          saveNow?.({ investor: newInv.name });
          setShowAddInvestor(false);
        }}
      />
    )}

    {/* Map Search Modal */}
    {showMapModal && (
      <div className="fixed inset-0 z-[3000] bg-black/60 flex items-center justify-center p-4">
        <div className="relative w-full h-full max-w-6xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl">
          <FloodMap
            initialAddress={deal?.address || undefined}
            initialParcelId={deal?.parcelId || undefined}
            initialState={deal?.state || 'NC'}
            initialCounty={deal?.county || undefined}
            onClose={() => setShowMapModal(false)}
          />
        </div>
      </div>
    )}
    </>
  );
}

// ── Outer wrapper — handles loading + deal lookup ─────────────────────────────
export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deals: customDeals, dealsLoading } = useDeals();

  // Prefer localStorage (updated synchronously on every edit via saveToLS) over context
  const lsDeals = (() => { try { return JSON.parse(localStorage.getItem('lotline_custom_deals') || '[]'); } catch { return []; } })();
  const deal = lsDeals.find(d => String(d.id) === String(id))
    || customDeals.find(d => String(d.id) === String(id));

  if (dealsLoading && !deal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">Deal not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-accent underline text-sm">Go Back</button>
      </div>
    );
  }

  // key={deal.id} ensures DealDetailContent remounts fresh with correct state
  return <DealDetailContent key={deal.id} deal={deal} />;
}
