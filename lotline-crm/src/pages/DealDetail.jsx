import React, { Component, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Star, Archive, ChevronRight, MapPin, ExternalLink,
  CheckSquare, Square, FileText, Upload, AlertCircle, Check,
  ChevronDown, ChevronUp, User, Calendar, Building, Phone, Mail, SplitSquareHorizontal, TreePine,
  CheckCircle2, Zap, Scale, LayoutGrid, Briefcase, Layers, Droplets, Paperclip, X as XIcon,
  Landmark, Handshake, XCircle, Info,
} from 'lucide-react';
import { calcNetProfit } from '../data/deals';
import { saveDeal, flushToSupabase, flushToSupabaseAsync } from '../lib/dealsSync';
import { lookupInvestorByName, savePaymentSchedule } from '../lib/paymentScheduleData';
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
import DealPageLayout from '../components/deal/DealPageLayout';
import DealLeftColumn from '../components/deal/DealLeftColumn';
import DealMiddleColumn from '../components/deal/DealMiddleColumn';
import DealRightColumn from '../components/deal/DealRightColumn';
import DealActivityFeed from '../components/deal/DealActivityFeed';
import DealThreads from '../components/deal/DealThreads';
import CostBreakdownTab from '../components/deal/CostBreakdownTab';
import SubmitForFundingButton from '../components/deal/SubmitForFundingButton';
import CreateTaskModal from '../components/Tasks/CreateTaskModal';
import ComposeEmailModal from '../components/Email/ComposeEmailModal';
import { fetchCostSummary } from '../lib/costBreakdownData';
import { logTaskActivity } from '../lib/tasksData';
import { notifyTaskAssigned } from '../lib/notify';
import { fetchPooledLoansForDeal, monthlyInterest as pooledMonthlyInterest, totalAllocated } from '../lib/pooledLoanData';
import HMCBPanel, { HMCB_DEFAULTS } from '../components/financing/HMCBPanel';
import PaymentDueDayPicker from '../components/financing/PaymentDueDayPicker';
import PaymentScheduleSection from '../components/financing/PaymentScheduleSection';
import { fetchAllInvestors, upsertInvestor } from '../lib/investorPortalData';

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
  // Water / Sewer Hook Up retired — it duplicated Public Water + Public Sewer.
  // Excluded from the cost breakdown UI and totals (see CostBreakdownTab
  // HIDDEN_KEYS + migration 125).
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

// ── Financing Scenario Panel ──────────────────────────────────────────────────
// Normalise an investor record to camelCase term fields.
// Accepts both the InvestorPortal-mapped shape (camelCase) and the raw Supabase
// shape (snake_case from fetchAllInvestors). This makes auto-populate work
// regardless of which loader produced the list.
function normaliseInvestorTerms(inv) {
  if (!inv) return null;
  return {
    name:                      inv.name,
    defaultScenarioType:       inv.defaultScenarioType       ?? inv.default_scenario_type       ?? null,
    defaultInterestRate:       inv.defaultInterestRate       ?? inv.default_interest_rate       ?? null,
    defaultHoldPeriodMonths:   inv.defaultHoldPeriodMonths   ?? inv.default_hold_period_months  ?? null,
    defaultTermMonths:         inv.defaultTermMonths         ?? inv.default_term_months         ?? null,
    defaultOriginationFeePct:  inv.defaultOriginationFeePct  ?? inv.default_origination_fee_pct ?? null,
    defaultOriginationFeeType: inv.defaultOriginationFeeType ?? inv.default_origination_fee_type ?? 'percentage',
    defaultDrawFee:            inv.defaultDrawFee            ?? inv.default_draw_fee            ?? null,
    defaultServicingFee:       inv.defaultServicingFee       ?? inv.default_servicing_fee       ?? null,
    defaultExtensionAvailable: inv.defaultExtensionAvailable ?? inv.default_extension_available ?? false,
    defaultExtensionMonths:    inv.defaultExtensionMonths    ?? inv.default_extension_months    ?? null,
    defaultExtensionFeePoints: inv.defaultExtensionFeePoints ?? inv.default_extension_fee_points ?? null,
    defaultPaymentDueDay:      inv.defaultPaymentDueDay      ?? inv.default_payment_due_day     ?? null,
    defaultProfitSharePct:     inv.defaultProfitSharePct     ?? inv.default_profit_share_pct    ?? null,
    defaultPosition:           inv.defaultPosition           ?? inv.default_position            ?? null,
  };
}

// Detects whether an investor has any structured standard-terms set.
function hasStandardTermsLocal(inv) {
  const n = normaliseInvestorTerms(inv);
  if (!n) return false;
  return Boolean(
    n.defaultScenarioType ||
    n.defaultInterestRate ||
    n.defaultHoldPeriodMonths ||
    n.defaultTermMonths ||
    n.defaultOriginationFeePct ||
    n.defaultDrawFee ||
    n.defaultServicingFee ||
    n.defaultExtensionAvailable ||
    n.defaultProfitSharePct
  );
}

// Renders the "✓ Standard terms applied" indicator below the lender dropdown.
function StandardTermsIndicator({ investor, fields, onClear }) {
  if (!investor || !fields?.length) return null;
  return (
    <div className="mt-1 flex items-center gap-2 text-[11px]">
      <span className="inline-flex items-center gap-1 text-accent font-semibold">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd"/></svg>
        Standard terms applied
      </span>
      <span className="text-gray-400">— {fields.join(', ')}</span>
      <button type="button" onClick={onClear} className="text-gray-400 hover:text-red-500 underline">Clear & reset</button>
    </div>
  );
}

// Apply an investor's standard terms to the current deal financing state.
// Only fills empty/zero fields by default — never overwrites user-entered values.
// Returns the list of field labels that were actually filled (for the toast/indicator).
function applyInvestorStandardTerms(inv, ctx) {
  const n = normaliseInvestorTerms(inv);
  if (!n) return [];
  const filled = [];
  const shouldFill = (cur) => cur === null || cur === undefined || cur === '' || cur === 0;

  // Switch scenario if investor has one set and current is empty
  if (n.defaultScenarioType && !ctx.selectedScenario) {
    ctx.applyScenario?.(n.defaultScenarioType);
    filled.push('scenario');
  }

  if (n.defaultInterestRate != null && shouldFill(ctx.interestRate)) {
    ctx.setInterestRate?.(Number(n.defaultInterestRate));
    filled.push('rate');
  }
  if (n.defaultHoldPeriodMonths != null && shouldFill(ctx.holdPeriod)) {
    ctx.setHoldPeriod?.(Number(n.defaultHoldPeriodMonths));
    filled.push('hold period');
  } else if (n.defaultTermMonths != null && shouldFill(ctx.holdPeriod)) {
    ctx.setHoldPeriod?.(Number(n.defaultTermMonths));
    filled.push('term');
  }
  if (n.defaultOriginationFeePct != null && shouldFill(ctx.originationFeePct)) {
    ctx.setOriginationFeePct?.(Number(n.defaultOriginationFeePct));
    filled.push('origination');
  }
  if (n.defaultDrawFee != null && shouldFill(ctx.drawFeeHm)) {
    ctx.setDrawFeeHm?.(Number(n.defaultDrawFee));
    filled.push('draw fee');
  }
  if (n.defaultServicingFee != null && shouldFill(ctx.servicingFeeFlat)) {
    ctx.setServicingFeeFlat?.(Number(n.defaultServicingFee));
    filled.push('servicing fee');
  }
  if (n.defaultExtensionAvailable && !ctx.extensionAvailable) {
    ctx.setExtensionAvailable?.(true);
    if (n.defaultExtensionMonths != null) ctx.setExtensionMonths?.(Number(n.defaultExtensionMonths));
    if (n.defaultExtensionFeePoints != null) ctx.setExtensionFee?.(Number(n.defaultExtensionFeePoints));
    filled.push('extension');
  }
  if (n.defaultPaymentDueDay && (ctx.paymentDueDay === 'same_as_closing' || !ctx.paymentDueDay)) {
    ctx.setPaymentDueDay?.(n.defaultPaymentDueDay);
    filled.push('due day');
  }
  if (n.defaultProfitSharePct != null && shouldFill(ctx.investorProfitSplitPct)) {
    ctx.setInvestorProfitSplitPct?.(Number(n.defaultProfitSharePct));
    filled.push('profit share');
  }
  return filled;
}

function FinancingScenarioPanel({
  deal, costs, arv, allIn, netProfit: netProfitFromParent,
  selectedScenario, applyScenario,
  // General loan terms
  lenderName, setLenderName,
  interestRate, setInterestRate,
  holdPeriod, setHoldPeriod,
  loanAmountOverride, setLoanAmountOverride,
  // Origination & fees (HM)
  originationFeePct, setOriginationFeePct,
  servicingFeeFlat, setServicingFeeFlat,
  drawFeeHm, setDrawFeeHm,
  underwritingFee, setUnderwritingFee,
  attorneyDocFee, setAttorneyDocFee,
  // Extension (HM)
  extensionAvailable, setExtensionAvailable,
  extensionFee, setExtensionFee,
  extensionMonths, setExtensionMonths,
  // Line of Credit
  creditLimit, setCreditLimit,
  drawAmount, setDrawAmount,
  annualFeePct, setAnnualFeePct,
  // Profit Split
  profitSharePct,
  investorProfitSplitPct, setInvestorProfitSplitPct,
  // CCP
  ccpInvestorId, setCcpInvestorId,
  ccpCommitmentId, setCcpCommitmentId,
  ccpAllocationAmount, setCcpAllocationAmount,
  ccpPrefReturnPct, setCcpPrefReturnPct,
  ccpProfitSharePct, setCcpProfitSharePct,
  ccpPrefPaymentTiming, setCcpPrefPaymentTiming,
  ccpPosition, setCcpPosition,
  ccpTranches, setCcpTranches,
  // Capital tracking (all non-cash scenarios)
  capitalDeployedDate, setCapitalDeployedDate,
  capitalReturnedDate, setCapitalReturnedDate,
  // Cash
  cashSource, setCashSource,
  // Investor Assignment
  investor, setInvestor,
  investorList,
  onAddInvestor,
  investorCapitalContributed, setInvestorCapitalContributed,
  investorEquityPct, setInvestorEquityPct,
  projectedPayoutDate, setProjectedPayoutDate,
  investorReturnType, setInvestorReturnType,
  investorAssignmentStatus, setInvestorAssignmentStatus,
  // Estimated Sale Date — drives hold-based cost calcs across all scenarios
  estimatedSaleDate, setEstimatedSaleDate,
  // Payment Due Day — drives schedule/calendar dates for HM Loan, HM L+H, LoC
  paymentDueDay, setPaymentDueDay,
  firstPaymentDate, setFirstPaymentDate,
  readOnly,
}) {
  const [showScenarioInfo, setShowScenarioInfo] = useState(false);
  const [showLocAdvanced, setShowLocAdvanced] = useState(false);
  const [showHmAdvanced, setShowHmAdvanced]   = useState(false);
  // Tracks which investor's standard terms were last auto-applied,
  // so we can show a "Standard terms applied" indicator + a clear/reset action.
  const [autoFilledInvestor, setAutoFilledInvestor] = useState(null);
  const [autoFilledFields, setAutoFilledFields] = useState([]);

  // Wraps the investor dropdown onChange — applies standard terms if available.
  function handleInvestorSelect(name) {
    setInvestor(name);
    if (!name) { setAutoFilledInvestor(null); setAutoFilledFields([]); return; }
    const inv = (investorList || []).find(i => i.name === name);
    if (!inv) { setAutoFilledInvestor(null); setAutoFilledFields([]); return; }
    if (!hasStandardTermsLocal(inv)) { setAutoFilledInvestor(null); setAutoFilledFields([]); return; }
    const filled = applyInvestorStandardTerms(inv, {
      selectedScenario, applyScenario,
      interestRate, setInterestRate,
      holdPeriod, setHoldPeriod,
      originationFeePct, setOriginationFeePct,
      drawFeeHm, setDrawFeeHm,
      servicingFeeFlat, setServicingFeeFlat,
      extensionAvailable, setExtensionAvailable, setExtensionMonths, setExtensionFee,
      paymentDueDay, setPaymentDueDay,
      investorProfitSplitPct, setInvestorProfitSplitPct,
    });
    if (filled.length) {
      setAutoFilledInvestor(inv);
      setAutoFilledFields(filled);
    }
  }

  function clearAutoFilled() {
    // Reset only the fields we filled — preserve everything else the user touched
    if (autoFilledFields.includes('rate')) setInterestRate?.(0);
    if (autoFilledFields.includes('hold period') || autoFilledFields.includes('term')) setHoldPeriod?.(0);
    if (autoFilledFields.includes('origination')) setOriginationFeePct?.(0);
    if (autoFilledFields.includes('draw fee')) setDrawFeeHm?.(0);
    if (autoFilledFields.includes('servicing fee')) setServicingFeeFlat?.(0);
    if (autoFilledFields.includes('extension')) {
      setExtensionAvailable?.(false);
      setExtensionMonths?.(0);
      setExtensionFee?.(0);
    }
    if (autoFilledFields.includes('profit share')) setInvestorProfitSplitPct?.(0);
    setAutoFilledInvestor(null);
    setAutoFilledFields([]);
  }

  const activeFinancing = selectedScenario
    ? FINANCING_SCENARIOS.find(s => s.id === selectedScenario)?.financingType
    : deal.financing;

  const arvVal = arv ?? deal.arv ?? 0;

  const totalLent = (costs.mobileHome || 0) + (costs.land || 0);
  const effectiveLoanAmount = loanAmountOverride != null ? loanAmountOverride : totalLent;
  const originationFee = effectiveLoanAmount * (originationFeePct / 100);
  const totalClosingCosts = originationFee + (servicingFeeFlat || 0) + (drawFeeHm || 0) + (underwritingFee || 0) + (attorneyDocFee || 0);
  const monthlyInterestHm = effectiveLoanAmount * (interestRate / 100) / 12;
  const totalCostOfCapital = (monthlyInterestHm * holdPeriod) + totalClosingCosts;

  const locDraw = drawAmount || 0;
  const monthlyInterestLoc = locDraw * (interestRate / 100) / 12;

  // Selling-costs formula matches src/data/deals.js calcNetProfit: 3.5% of ARV + $3,500 flat.
  const sellingCosts = arvVal * ((deal.sellingCostPct || 3.5) / 100) + 3500;
  // Estimated hold (deployed → sale) drives holding-cost accrual when set.
  const effHoldMonthsForProfit = getEstimatedHoldMonths(
    capitalDeployedDate, estimatedSaleDate, holdPeriod || 4
  );
  const holdingCosts = effHoldMonthsForProfit * ((deal.holdingPerMonth || 250));
  const netProfitEst = arvVal - allIn - sellingCosts - holdingCosts;
  const profitSplitAmount = netProfitEst * (investorProfitSplitPct / 100);

  const isCash = activeFinancing === 'Cash';
  const isHardMoney = activeFinancing === 'Hard Money Loan' || activeFinancing === 'Hard Money (Land + Home)';
  const isLoC = activeFinancing === 'Line of Credit';
  const isProfitSplit = activeFinancing === 'Profit Split';
  const isCCP = activeFinancing === 'Committed Capital Partner';

  const iCls = "text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full";

  // Auto-fill: when Estimated Sale Date is set in Profit Split scenario and
  // Projected Payout Date is empty, mirror the date. User can still override.
  useEffect(() => {
    if (!estimatedSaleDate) return;
    if (!isProfitSplit) return;
    if (!projectedPayoutDate) setProjectedPayoutDate(estimatedSaleDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedSaleDate, isProfitSplit]);

  // Auto-fill: in Cash scenario, mirror Estimated Sale Date into Capital
  // Returned Date when the latter is empty.
  useEffect(() => {
    if (!estimatedSaleDate) return;
    if (!isCash) return;
    if (!capitalReturnedDate) setCapitalReturnedDate(estimatedSaleDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedSaleDate, isCash]);

  return (
    <div className="space-y-4">
      <SectionHeader>Financing Scenario</SectionHeader>

      {/* Scenario selector */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Scenario</p>
          {selectedScenario && (
            <div className="relative">
              <button
                onClick={() => setShowScenarioInfo(v => !v)}
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${showScenarioInfo ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400 hover:bg-accent/10 hover:text-accent'}`}
              >
                <Info size={11} />
              </button>
              {showScenarioInfo && (() => {
                const scenario = FINANCING_SCENARIOS.find(s => s.id === selectedScenario);
                return scenario?.description ? (
                  <div className="absolute right-0 top-7 z-20 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-bold text-sidebar">{scenario.label}</p>
                      <button onClick={() => setShowScenarioInfo(false)} className="text-gray-300 hover:text-gray-500 flex-shrink-0"><XIcon size={12} /></button>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{scenario.description}</p>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
        <select
          value={selectedScenario}
          onChange={e => { applyScenario(e.target.value); setShowScenarioInfo(false); }}
          disabled={readOnly}
          className="w-full text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-70"
        >
          <option value="">— Choose a financing scenario —</option>
          {FINANCING_SCENARIOS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* ── Capital Dates (shared across all scenarios) ──
           Both fields live here so every scenario — including HMCB and CCP
           which don't render their own date inputs — drives the estimated-
           hold calc consistently. */}
      {!!selectedScenario && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Capital Dates</p>
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Deployed Date</p>
              <input
                type="date"
                value={capitalDeployedDate || ''}
                onChange={e => setCapitalDeployedDate(e.target.value)}
                className={iCls}
                readOnly={readOnly}
              />
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Estimated Sale Date</p>
              <input
                type="date"
                value={estimatedSaleDate || ''}
                onChange={e => setEstimatedSaleDate(e.target.value)}
                className={iCls}
                readOnly={readOnly}
              />
            </div>
          </div>
          {(() => {
            const fallback = holdPeriod || 12;
            if (capitalDeployedDate && estimatedSaleDate) {
              const est = getEstimatedHoldMonths(capitalDeployedDate, estimatedSaleDate, fallback);
              return (
                <p className="text-[11px] text-gray-500 mt-2">
                  Est. hold: <span className="font-semibold text-gray-700">{formatHoldPeriod(est)}</span>
                  {fallback ? <span className="text-gray-400"> ({fallback}-month term available)</span> : null}
                </p>
              );
            }
            if (estimatedSaleDate && !capitalDeployedDate) {
              return <p className="text-[11px] text-gray-400 mt-2">Set Capital Deployed Date to calculate hold period.</p>;
            }
            return null;
          })()}
        </div>
      )}

      {/* ── Cash ── */}
      {!!selectedScenario && isCash && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cash Deal</p>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="py-2 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Investor / Funder</p>
                {!readOnly && (
                  <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-semibold">
                    + Add New Investor
                  </button>
                )}
              </div>
              <select value={investor} onChange={e => handleInvestorSelect(e.target.value)} className={iCls} disabled={readOnly}>
                <option value="">— No Investor —</option>
                {(investorList || []).map(inv => (
                  <option key={inv.id} value={inv.name}>{inv.name}</option>
                ))}
              </select>
              <StandardTermsIndicator investor={autoFilledInvestor} fields={autoFilledFields} onClear={clearAutoFilled} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Total Amount (from costs)</p>
              <span className="text-sm font-medium text-gray-800">${allIn.toLocaleString()}</span>
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Deployed Date</p>
              <input type="date" value={capitalDeployedDate} onChange={e => setCapitalDeployedDate(e.target.value)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Returned Date</p>
              <input type="date" value={capitalReturnedDate} onChange={e => setCapitalReturnedDate(e.target.value)} className={iCls} readOnly={readOnly} />
            </div>
          </div>
        </div>
      )}

      {/* ── Hard Money Loan / Hard Money (Land + Home) ── */}
      {!!selectedScenario && isHardMoney && (
        <>
          {/* Lender & Loan Terms */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Lender & Loan Terms</p>
            <div className="grid grid-cols-2 gap-x-6">
              <div className="py-2 col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Lender / Investor</p>
                  {!readOnly && (
                    <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-semibold">
                      + Add New Investor
                    </button>
                  )}
                </div>
                <select value={investor} onChange={e => handleInvestorSelect(e.target.value)} className={iCls} disabled={readOnly}>
                  <option value="">— No Investor —</option>
                  {(investorList || []).map(inv => (
                    <option key={inv.id} value={inv.name}>{inv.name}</option>
                  ))}
                </select>
                <StandardTermsIndicator investor={autoFilledInvestor} fields={autoFilledFields} onClear={clearAutoFilled} />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Cost of Land</p>
                <span className="text-sm font-medium text-gray-800">${(costs.land || 0).toLocaleString()}</span>
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Cost of Home</p>
                <span className="text-sm font-medium text-gray-800">${(costs.mobileHome || 0).toLocaleString()}</span>
              </div>
              <div className="py-2 col-span-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Total Loan Amount</p>
                <input
                  type="text"
                  inputMode="numeric"
                  value={(() => { const v = loanAmountOverride != null ? loanAmountOverride : totalLent; return v ? `$${Number(v).toLocaleString()}` : ''; })()}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setLoanAmountOverride(raw === '' ? null : Number(raw));
                  }}
                  onFocus={e => e.target.select()}
                  className="text-sm font-semibold text-accent bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30 w-full"
                  readOnly={readOnly}
                />
                {activeFinancing === 'Hard Money (Land + Home)' && (
                  <p className="text-[10px] text-gray-400 mt-1">Land cost + home cost combined</p>
                )}
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Annual Interest Rate (%)</p>
                <DecimalInput value={interestRate} onChange={setInterestRate} className={iCls} />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Monthly Interest (calc)</p>
                <span className="text-sm font-medium text-gray-800">${Math.round(monthlyInterestHm).toLocaleString()}</span>
              </div>
              <div className="py-2 col-span-2">
                <PaymentDueDayPicker
                  value={paymentDueDay}
                  onChange={setPaymentDueDay}
                  capitalDeployedDate={capitalDeployedDate}
                  firstPaymentDate={firstPaymentDate}
                  onFirstPaymentDateChange={setFirstPaymentDate}
                  readOnly={readOnly}
                />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Hold Period (months)</p>
                <input type="text" inputMode="numeric" value={holdPeriod || ''} onChange={e => setHoldPeriod(Number(e.target.value) || 0)} onFocus={e => e.target.select()} className={iCls} readOnly={readOnly} />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Deployed Date</p>
                <input type="date" value={capitalDeployedDate} onChange={e => setCapitalDeployedDate(e.target.value)} className={iCls} readOnly={readOnly} />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Loan Maturity Date</p>
                {capitalDeployedDate && holdPeriod ? (() => {
                  const d = new Date(capitalDeployedDate); d.setMonth(d.getMonth() + holdPeriod);
                  return <span className="text-sm font-medium text-gray-800">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
                })() : <span className="text-sm text-gray-400">—</span>}
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Returned Date</p>
                <input type="date" value={capitalReturnedDate} onChange={e => setCapitalReturnedDate(e.target.value)} className={iCls} readOnly={readOnly} />
              </div>
            </div>
          </div>

          {/* Fees */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fees & Closing Costs</p>
            <div className="grid grid-cols-2 gap-x-6">
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Origination Fee (%)</p>
                <DecimalInput value={originationFeePct} onChange={setOriginationFeePct} className={iCls} />
              </div>
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Origination Amount (calc)</p>
                <span className="text-sm font-medium text-gray-800">${Math.round(originationFee).toLocaleString()}</span>
              </div>
              {showHmAdvanced && (
                <>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Servicing Fee ($)</p>
                    <DecimalInput value={servicingFeeFlat || 0} onChange={setServicingFeeFlat} className={iCls} />
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Draw Fee ($ per draw)</p>
                    <DecimalInput value={drawFeeHm || 0} onChange={setDrawFeeHm} className={iCls} />
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Underwriting / Admin Fee ($)</p>
                    <DecimalInput value={underwritingFee || 0} onChange={setUnderwritingFee} className={iCls} />
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Attorney Doc Prep Fee ($)</p>
                    <DecimalInput value={attorneyDocFee || 0} onChange={setAttorneyDocFee} className={iCls} />
                  </div>
                </>
              )}
              <div className="py-2 col-span-2 border-t border-gray-100 mt-1 pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowHmAdvanced(v => !v)}
                  className="text-[10px] text-gray-400 hover:text-accent font-medium"
                >
                  {showHmAdvanced ? '− Hide advanced fees' : '+ Show advanced fees'}
                </button>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Total Closing Costs (calc)</p>
                  <span className="text-sm font-bold text-accent">${Math.round(totalClosingCosts).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Extension */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extension Option</p>
              <button
                type="button"
                onClick={() => !readOnly && setExtensionAvailable(v => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${extensionAvailable ? 'bg-accent' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${extensionAvailable ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {extensionAvailable && (
              <div className="grid grid-cols-2 gap-x-6 mt-3">
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Extension Fee (points)</p>
                  <DecimalInput value={extensionFee || 0} onChange={setExtensionFee} className={iCls} />
                </div>
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Extension Months</p>
                  <input type="text" inputMode="numeric" value={extensionMonths || ''} onChange={e => setExtensionMonths(Number(e.target.value) || 0)} className={iCls} readOnly={readOnly} />
                </div>
              </div>
            )}
          </div>

          {/* Cost of Capital Summary (bottom) */}
          {(() => {
            const estHold        = getEstimatedHoldMonths(capitalDeployedDate, estimatedSaleDate, holdPeriod);
            const interestEst    = monthlyInterestHm * estHold;
            const interestFull   = monthlyInterestHm * holdPeriod;
            const totalCostEst   = interestEst  + totalClosingCosts;
            const totalCostFull  = interestFull + totalClosingCosts;
            const showEst        = !!(capitalDeployedDate && estimatedSaleDate) && Math.abs(estHold - holdPeriod) > 0.01;
            const holdingCostFull = holdPeriod * (deal.holdingPerMonth || 250);
            const profitBeforeFull = arvVal - allIn - sellingCosts - holdingCostFull - totalCostFull;
            const netFullTerm = profitBeforeFull - profitBeforeFull * ((profitSharePct || 0) / 100);
            // Always use parent's authoritative netProfit for the primary display (matches header exactly)
            const netEst  = netProfitFromParent ?? 0;
            const netFull = netProfitFromParent ?? 0;
            return (
              <div className="bg-[#1a2332] rounded-xl px-4 py-3 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-300 mb-2">Cost of Capital Summary</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Total Loan Amount</span>
                    <span className="font-medium">${effectiveLoanAmount.toLocaleString()}</span>
                  </div>
                  {showEst && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Monthly Interest × est. hold ({formatHoldPeriod(estHold)})</span>
                      <span className="font-medium">${Math.round(interestEst).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className={showEst ? 'text-gray-500' : 'text-gray-400'}>
                      Monthly Interest × {showEst ? 'full term' : ''} ({holdPeriod} mo)
                    </span>
                    <span className={showEst ? 'text-gray-500' : 'font-medium'}>${Math.round(interestFull).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Origination Fee</span>
                    <span className="font-medium">${Math.round(originationFee).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Other Closing Costs</span>
                    <span className="font-medium">${Math.round(totalClosingCosts - originationFee).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-white/20 pt-1.5 mt-1">
                    <span className="font-semibold text-white">
                      {showEst ? `Est. Total Cost (${formatHoldPeriod(estHold)})` : 'Total Cost of Capital'}
                    </span>
                    <span className="font-bold text-accent">${Math.round(showEst ? totalCostEst : totalCostFull).toLocaleString()}</span>
                  </div>
                  {showEst && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Full Term Cost ({holdPeriod} mo)</span>
                      <span className="text-gray-400">${Math.round(totalCostFull).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-white/20 pt-1.5 mt-1">
                    <span className="font-semibold text-white">Net Profit After Financing</span>
                    <span className="font-bold text-green-400">${Math.round(showEst ? netEst : netFull).toLocaleString()}</span>
                  </div>
                  {showEst && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">If held full term ({holdPeriod} mo)</span>
                      <span className="text-gray-400">${Math.round(netFullTerm).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Payment Schedule (hard-money / hmcb scenarios) */}
          <PaymentScheduleSection
            deal={deal}
            investorName={investor}
            capitalDeployedDateOverride={capitalDeployedDate}
            allocation={null}
            readOnly={readOnly}
          />
        </>
      )}

      {/* ── Line of Credit ── */}
      {!!selectedScenario && isLoC && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Line of Credit Terms</p>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="py-2 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Lender / Investor</p>
                {!readOnly && (
                  <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-semibold">
                    + Add New Investor
                  </button>
                )}
              </div>
              <select value={investor} onChange={e => handleInvestorSelect(e.target.value)} className={iCls} disabled={readOnly}>
                <option value="">— No Investor —</option>
                {(investorList || []).map(inv => (
                  <option key={inv.id} value={inv.name}>{inv.name}</option>
                ))}
              </select>
              <StandardTermsIndicator investor={autoFilledInvestor} fields={autoFilledFields} onClear={clearAutoFilled} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Credit Line Limit ($)</p>
              <input type="number" value={creditLimit || ''} onChange={e => setCreditLimit(Number(e.target.value) || 0)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Amount Drawn on This Deal ($)</p>
              <input type="number" value={drawAmount || ''} onChange={e => setDrawAmount(Number(e.target.value) || 0)} className={iCls} readOnly={readOnly} />
            </div>
            {creditLimit > 0 && (
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Utilization</p>
                <span className="text-sm font-medium text-gray-800">{((locDraw / creditLimit) * 100).toFixed(1)}%</span>
              </div>
            )}
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Annual Interest Rate (%)</p>
              <input type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value) || 0)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Monthly Interest on Draw (calc)</p>
              <span className="text-sm font-medium text-gray-800">${Math.round(monthlyInterestLoc).toLocaleString()}</span>
            </div>
            <div className="py-2 col-span-2">
              <PaymentDueDayPicker
                value={paymentDueDay}
                onChange={setPaymentDueDay}
                capitalDeployedDate={capitalDeployedDate}
                firstPaymentDate={firstPaymentDate}
                onFirstPaymentDateChange={setFirstPaymentDate}
                readOnly={readOnly}
              />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Deployed Date</p>
              <input type="date" value={capitalDeployedDate} onChange={e => setCapitalDeployedDate(e.target.value)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Returned Date</p>
              <input type="date" value={capitalReturnedDate || ''} onChange={e => setCapitalReturnedDate(e.target.value)} className={iCls} readOnly={readOnly} />
            </div>
            {monthlyInterestLoc > 0 && (() => {
              const fullMonths = deal.holding_months || 6;
              const estMonths  = getEstimatedHoldMonths(capitalDeployedDate, estimatedSaleDate, fullMonths);
              const interestEst  = Math.round(monthlyInterestLoc * estMonths);
              const interestFull = Math.round(monthlyInterestLoc * fullMonths);
              const showEst = !!(capitalDeployedDate && estimatedSaleDate) && Math.abs(estMonths - fullMonths) > 0.01;
              return (
                <>
                  <div className="py-2 col-span-2 border-t border-gray-100 mt-1 pt-2 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                      {showEst ? `Total Interest × est. hold (${formatHoldPeriod(estMonths)})` : 'Total Interest'}
                    </span>
                    <span className="text-sm font-semibold text-accent">
                      ${(showEst ? interestEst : interestFull).toLocaleString()}
                      {!showEst && (
                        <span className="text-[10px] text-gray-400 font-normal ml-1">(Monthly × {fullMonths} mo)</span>
                      )}
                    </span>
                  </div>
                  {showEst && (
                    <div className="py-1 col-span-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-medium">Full period ({fullMonths} mo)</span>
                      <span className="text-[11px] text-gray-400">${interestFull.toLocaleString()}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {/* Advanced fees toggle */}
          <div className="mt-2 border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => setShowLocAdvanced(v => !v)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-accent font-medium transition-colors"
            >
              {showLocAdvanced ? '− Hide advanced fees' : '+ Show advanced fees'}
            </button>
            {showLocAdvanced && (
              <div className="grid grid-cols-2 gap-x-6 mt-2">
                <div className="py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Annual Fee (%)</p>
                  <input type="number" value={annualFeePct || ''} onChange={e => setAnnualFeePct(Number(e.target.value) || 0)} className={iCls} readOnly={readOnly} />
                </div>
              </div>
            )}
          </div>

          {/* Payment Schedule (line of credit) */}
          <PaymentScheduleSection
            deal={deal}
            investorName={investor}
            capitalDeployedDateOverride={capitalDeployedDate}
            allocation={null}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* ── Profit Split ── */}
      {!!selectedScenario && isProfitSplit && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Profit Split Terms</p>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="py-2 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Investor</p>
                {!readOnly && (
                  <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-semibold">
                    + Add New Investor
                  </button>
                )}
              </div>
              <select value={investor} onChange={e => handleInvestorSelect(e.target.value)} className={iCls} disabled={readOnly}>
                <option value="">— No Investor —</option>
                {(investorList || []).map(inv => (
                  <option key={inv.id} value={inv.name}>{inv.name}</option>
                ))}
              </select>
              <StandardTermsIndicator investor={autoFilledInvestor} fields={autoFilledFields} onClear={clearAutoFilled} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Contributed</p>
              <input
                type="text"
                inputMode="numeric"
                value={investorCapitalContributed != null && investorCapitalContributed !== '' ? `$${Number(investorCapitalContributed).toLocaleString()}` : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setInvestorCapitalContributed(raw === '' ? null : Number(raw));
                }}
                placeholder="$50,000"
                className={iCls}
                readOnly={readOnly}
              />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Investor Split (%)</p>
              <input type="number" value={investorProfitSplitPct || ''} onChange={e => setInvestorProfitSplitPct(Number(e.target.value) || 0)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Investor Split Amount (calc)</p>
              <span className="text-sm font-medium text-accent">${Math.round(profitSplitAmount).toLocaleString()}</span>
            </div>
            <div className="py-2 col-span-2 border-t border-gray-100 mt-1 pt-2">
              <p className="text-[11px] text-gray-500">
                Investor receives <span className="font-semibold text-gray-700">{investorProfitSplitPct || 0}%</span> of{' '}
                <span className="font-semibold text-gray-700">${Math.round(netProfitEst).toLocaleString()}</span> net profit ={' '}
                <span className="font-semibold text-accent">${Math.round(profitSplitAmount).toLocaleString()}</span>
              </p>
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Deployed Date</p>
              <input type="date" value={capitalDeployedDate || ''} onChange={e => setCapitalDeployedDate(e.target.value)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Projected Payout Date</p>
              <input type="date" value={projectedPayoutDate ?? ''} onChange={e => setProjectedPayoutDate(e.target.value || null)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Return Type</p>
              <span className="inline-block text-[11px] font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent">Profit Share</span>
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Status</p>
              <select value={investorAssignmentStatus} onChange={e => setInvestorAssignmentStatus(e.target.value)} className={iCls} disabled={readOnly}>
                <option>Committed</option>
                <option>Funded</option>
                <option>Returned</option>
              </select>
            </div>
          </div>

          {/* Payment Schedule (profit-split scenario) */}
          <div className="mt-3">
            <PaymentScheduleSection
              deal={deal}
              investorName={investor}
              capitalDeployedDateOverride={capitalDeployedDate}
              allocation={null}
              readOnly={readOnly}
            />
          </div>
        </div>
      )}

      {/* ── Committed Capital Partner ── */}
      {!!selectedScenario && isCCP && (
        <CommittedCapitalPartnerPanel
          deal={deal}
          netProfit={netProfitEst}
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

      {/* ── Investor Assignment (non-cash, non-profit-split scenarios) ── */}
      {/* HM (Land + Home) and HMCB excluded: their own lender dropdowns cover this. */}
      {!!selectedScenario && !isCash && !isProfitSplit && activeFinancing !== 'Hard Money (Land + Home)' && selectedScenario !== 'hmcb' && (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Investor Assignment</p>
          <p className="text-[10px] text-gray-400 mb-3">Assign an investor to this deal. Once assigned, this deal will appear in their Investor Portal with the numbers below.</p>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="py-2 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Investor</p>
                {!readOnly && (
                  <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-semibold flex items-center gap-0.5">
                    + Add New Investor
                  </button>
                )}
              </div>
              <select value={investor} onChange={e => handleInvestorSelect(e.target.value)} className={iCls} disabled={readOnly}>
                <option value="">— No Investor —</option>
                {(investorList || []).map(inv => (
                  <option key={inv.id} value={inv.name}>{inv.name}</option>
                ))}
              </select>
              <StandardTermsIndicator investor={autoFilledInvestor} fields={autoFilledFields} onClear={clearAutoFilled} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Capital Contributed</p>
              <input
                type="text"
                inputMode="numeric"
                value={investorCapitalContributed != null && investorCapitalContributed !== '' ? `$${Number(investorCapitalContributed).toLocaleString()}` : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setInvestorCapitalContributed(raw === '' ? null : Number(raw));
                }}
                placeholder="$50,000"
                className={iCls}
                readOnly={readOnly}
              />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Return Type</p>
              <select value={investorReturnType} onChange={e => setInvestorReturnType(e.target.value)} className={iCls} disabled={readOnly}>
                <option>Interest Only</option>
                <option>Profit Split %</option>
                <option>Flat Fee</option>
                <option>Pooled</option>
              </select>
            </div>
            {investorReturnType === 'Profit Split %' && (
              <div className="py-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Equity % (Pro-Rata)</p>
                <input type="number" value={investorEquityPct ?? ''} onChange={e => setInvestorEquityPct(e.target.value === '' ? null : Number(e.target.value))} placeholder="e.g. 25" className={iCls} readOnly={readOnly} />
              </div>
            )}
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Projected Payout Date</p>
              <input type="date" value={projectedPayoutDate ?? ''} onChange={e => setProjectedPayoutDate(e.target.value || null)} className={iCls} readOnly={readOnly} />
            </div>
            <div className="py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Status</p>
              <select value={investorAssignmentStatus} onChange={e => setInvestorAssignmentStatus(e.target.value)} className={iCls} disabled={readOnly}>
                <option>Committed</option>
                <option>Funded</option>
                <option>Returned</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Capital Stack — only for Committed Capital Partner (multi-investor, tranched).
            Single-investor scenarios already track their lender on the scenario panel. */}
      {selectedScenario === 'committed-capital-partner' && (
        <CapitalStackModule deal={deal} readOnly={readOnly} />
      )}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────
function OverviewTab({
  deal, costs, setCosts, allIn, notes, setNotes,
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
  estimatedSaleDate, setEstimatedSaleDate,
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
  const arvVal = arv ?? deal.arv ?? 0;
  // Single source of truth — calcDealNetProfit handles all the math.
  const _np = calcDealNetProfit({
    deal, arv, allIn, costs,
    capitalDeployedDate, estimatedSaleDate,
    holdPeriod, monthlyHoldCost,
    selectedScenario, interestRate,
    originationFeeType, originationFeePct, originationFeeFlat,
    servicingFeeType,  servicingFeePct,  servicingFeeFlat,
    loanAmountOverride, profitSharePct,
  });
  const effHoldMonths      = _np.effHoldMonths;
  const sellingCosts       = _np.sellingCosts;
  const holdingCosts       = _np.holdingCosts;
  const effectiveLoanAmount = _np.effectiveLoanAmount;
  const monthlyInterest    = _np.monthlyInterest;
  const originationFee     = _np.originationFee;
  const servicingFee       = _np.servicingFee;
  const totalCostOfCapital = _np.totalCostOfCapital;
  const hasFinancing       = _np.hasFinancing;
  const profitBeforeShare  = _np.profitBeforeShare;
  const profitShareAmount  = _np.profitShareAmount;
  const netProfit          = _np.netProfit;
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
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Selling Costs (3.5% + $3,500)</p>
                    <span className="text-sm font-medium text-red-500">-${Math.round(sellingCosts).toLocaleString()}</span>
                  </div>
                  <div className="py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Holding Costs ({formatHoldPeriod(effHoldMonths)} × ${monthlyHoldCost || deal.holdingPerMonth || 250}/mo)</p>
                    <span className="text-sm font-medium text-red-500">-${holdingCosts.toLocaleString()}</span>
                  </div>
                  {hasFinancing && (
                    <div className="py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 font-medium">Financing Costs</p>
                      <span className="text-sm font-medium text-red-500">-${Math.round(totalCostOfCapital).toLocaleString()}</span>
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

      </div>

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

function DDTaskRow({ col, readOnly, milestone, onUpdate }) {
  const status   = milestone?.status         ?? 'not_started';
  const cName    = milestone?.contact_name    ?? '';
  const cPhone   = milestone?.contact_phone   ?? '';
  const cEmail   = milestone?.contact_email   ?? '';
  const cCompany = milestone?.contact_company ?? '';
  const taskNotes = milestone?.notes ?? '';
  const files    = milestone?.files          ?? [];
  const [expanded, setExpanded] = useState(false);

  const cycleStatus = (e) => {
    e.stopPropagation();
    if (readOnly) return;
    onUpdate({ status: STATUS_CYCLE[status] });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const next = [...files, { name: file.name, url: ev.target.result }];
      onUpdate({ files: next });
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (idx) => {
    const next = files.filter((_, i) => i !== idx);
    onUpdate({ files: next });
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
                onClick={(e) => { e.stopPropagation(); if (!readOnly) onUpdate({ status: 'not_started' }); }}
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
                { icon: User,     val: cName,    field: 'contact_name',    ph: 'Contractor name' },
                { icon: Phone,    val: cPhone,   field: 'contact_phone',   ph: 'Phone' },
                { icon: Mail,     val: cEmail,   field: 'contact_email',   ph: 'Email' },
                { icon: Building, val: cCompany, field: 'contact_company', ph: 'Company (optional)' },
              ].map(({ icon: FieldIcon, val, field, ph }) => (
                <div key={field} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <FieldIcon size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={val}
                    onChange={e => onUpdate({ [field]: e.target.value })}
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
              onChange={e => onUpdate({ notes: e.target.value })}
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
  // Map of milestone_key → milestone row from Supabase. Optimistic updates write
  // here immediately and the upsert happens in the background.
  const [milestones, setMilestones] = useState({});
  const orgId = deal?.organizationId;

  // ── Load milestones for this deal ───────────────────────────────────────────
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('deal_milestones')
        .select('*')
        .eq('deal_id', String(deal.id));
      if (cancelled || error) {
        if (error) console.error('[DDTab] load deal_milestones failed:', error.message);
        return;
      }
      const byKey = {};
      for (const row of data || []) byKey[row.milestone_key] = row;
      // Seed legacy ddTasksCompleted (set on some seeded deals) into Supabase the
      // first time we load — only fires when no row exists yet for that key.
      if (orgId) {
        const toSeed = [];
        for (const name of (deal.ddTasksCompleted || [])) {
          const k = DD_LS_INIT_MAP[name];
          if (k && !byKey[k]) {
            toSeed.push({
              organization_id: orgId,
              deal_id: String(deal.id),
              milestone_key: k,
              status: 'complete',
            });
          }
        }
        if (toSeed.length > 0) {
          const { data: inserted, error: insErr } = await supabase
            .from('deal_milestones')
            .upsert(toSeed, { onConflict: 'deal_id,milestone_key' })
            .select('*');
          if (!cancelled && !insErr && inserted) {
            for (const row of inserted) byKey[row.milestone_key] = row;
          }
        }
      }
      if (!cancelled) setMilestones(byKey);
    })();
    return () => { cancelled = true; };
  }, [deal?.id, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime updates for other teammates' edits ─────────────────────────────
  useEffect(() => {
    if (!supabase || !deal?.id) return;
    const channel = supabase
      .channel(`deal-milestones-${deal.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deal_milestones', filter: `deal_id=eq.${deal.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setMilestones(prev => {
              const next = { ...prev };
              if (payload.old?.milestone_key) delete next[payload.old.milestone_key];
              return next;
            });
          } else {
            setMilestones(prev => ({ ...prev, [payload.new.milestone_key]: payload.new }));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deal?.id]);

  // ── Update handler passed to each row — optimistic + upsert ────────────────
  const handleUpdate = useCallback((milestoneKey, patch) => {
    if (readOnly || !supabase || !deal?.id || !orgId) return;
    const existing = milestones[milestoneKey] || {
      organization_id: orgId,
      deal_id: String(deal.id),
      milestone_key: milestoneKey,
      status: 'not_started',
      files: [],
    };
    const next = { ...existing, ...patch };
    // Optimistic UI update first
    setMilestones(prev => ({ ...prev, [milestoneKey]: next }));
    // Fire upsert async
    supabase
      .from('deal_milestones')
      .upsert(
        {
          organization_id: orgId,
          deal_id: String(deal.id),
          milestone_key: milestoneKey,
          status: next.status,
          completed_date: next.completed_date ?? null,
          notes: next.notes ?? null,
          contact_name: next.contact_name ?? null,
          contact_phone: next.contact_phone ?? null,
          contact_email: next.contact_email ?? null,
          contact_company: next.contact_company ?? null,
          files: next.files ?? [],
        },
        { onConflict: 'deal_id,milestone_key' }
      )
      .then(({ error }) => {
        if (error) console.error('[DDTab] upsert milestone failed:', error.message);
      });
  }, [readOnly, deal?.id, orgId, milestones]);

  const completeCount = DD_COLS.filter(c => milestones[c.key]?.status === 'complete').length;

  useEffect(() => {
    onStatusChange?.(completeCount);
  }, [completeCount, onStatusChange]);

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
          <DDTaskRow
            key={col.key}
            col={col}
            readOnly={readOnly}
            milestone={milestones[col.key]}
            onUpdate={(patch) => handleUpdate(col.key, patch)}
          />
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

  // Projected cost of capital. Use estimated hold (deployed → sale) when set,
  // falling back to the full hold period.
  const holdMonths = deal?.holdingMonths || 6;
  const estHoldMonths = getEstimatedHoldMonths(
    deal?.capitalDeployedDate, deal?.estimatedSaleDate, holdMonths
  );
  const projectedPrefFull = amountNum * (ccpPrefReturnPct / 100) * (holdMonths / 12);
  const projectedPref     = amountNum * (ccpPrefReturnPct / 100) * (estHoldMonths / 12);
  const showCcpEst        = !!(deal?.capitalDeployedDate && deal?.estimatedSaleDate)
                            && Math.abs(estHoldMonths - holdMonths) > 0.01;
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
              <span className="font-medium">
                {showCcpEst ? `${formatHoldPeriod(estHoldMonths)} (est. hold)` : `${holdMonths} mo`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">
                Projected pref return ({ccpPrefReturnPct}% × {showCcpEst ? formatHoldPeriod(estHoldMonths) : `${holdMonths} mo`})
                {ccpTranches.length > 0 && <span className="ml-1 text-gray-500" title="Simplified: full allocation × rate × hold period. Tranche-by-tranche accrual in PR 2.">*</span>}
              </span>
              <span className="font-medium">{fmt(Math.round(projectedPref))}</span>
            </div>
            {showCcpEst && (
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">If held full term ({holdMonths} mo)</span>
                <span className="text-gray-400">{fmt(Math.round(projectedPrefFull))}</span>
              </div>
            )}
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

// ── Estimated hold helpers ──────────────────────────────────────────────────
// Returns FRACTIONAL months between Capital Deployed Date and Estimated Sale
// Date — based on a 30-day month so partial months are prorated. e.g. 4 months
// 5 days = 4 + 5/30 = 4.1667 months. Used for cost math.
function getEstimatedHoldMonths(deployedDate, saleDate, fallbackMonths) {
  if (!deployedDate || !saleDate) return fallbackMonths;
  const d = new Date(deployedDate), s = new Date(saleDate);
  if (Number.isNaN(d.getTime()) || Number.isNaN(s.getTime())) return fallbackMonths;
  const days = Math.round((s.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return Math.max(1 / 30, (fallbackMonths || 0));
  return days / 30;
}

// Pretty format "4 months 5 days" given a fractional months value.
// Shared net-profit calculation used by both the header summary bar and the
// OverviewTab. Driving both off this single function guarantees the numbers
// always agree.
function calcDealNetProfit({
  deal, arv, allIn, costs,
  capitalDeployedDate, estimatedSaleDate,
  holdPeriod, monthlyHoldCost,
  selectedScenario, interestRate,
  originationFeeType, originationFeePct, originationFeeFlat,
  servicingFeeType,  servicingFeePct,  servicingFeeFlat,
  loanAmountOverride, profitSharePct,
}) {
  const arvVal = arv ?? deal?.arv ?? 0;
  const activeFinancing = selectedScenario
    ? FINANCING_SCENARIOS.find(s => s.id === selectedScenario)?.financingType
    : deal?.financing;
  const hasFinancing = !!selectedScenario && activeFinancing !== 'Cash';

  const effHoldMonths = getEstimatedHoldMonths(
    capitalDeployedDate, estimatedSaleDate, holdPeriod || deal?.holdingMonths || 4
  );

  // Selling-costs formula matches src/data/deals.js calcNetProfit: 3.5% of ARV + $3,500 flat.
  const sellingCosts = arvVal * ((deal?.sellingCostPct || 3.5) / 100) + 3500;
  const holdingCosts = effHoldMonths * (monthlyHoldCost || deal?.holdingPerMonth || 250);

  let totalCostOfCapital;
  let effectiveLoanAmount = 0;
  let monthlyInterest = 0;
  let originationFee = 0;
  let servicingFee = 0;

  if (selectedScenario === 'hmcb') {
    // HMCB stores its own loan structure in scenarioData.hmcb — use that instead of the generic fields.
    const hmcb = { ...HMCB_DEFAULTS, ...(deal?.scenarioData?.hmcb || {}) };
    const totalLoan       = (hmcb.purchasePrice || 0) + (hmcb.holdbackAmount || 0);
    const fundedAtClosing = hmcb.fundedAtClosing || hmcb.purchasePrice || 0;
    const basisAmount     = hmcb.interestBasis === 'funded' ? fundedAtClosing : totalLoan;
    const monthlyAuto     = basisAmount * ((hmcb.interestRate || 0) / 100) / 12;
    const monthly         = hmcb.monthlyPaymentOverride || monthlyAuto;
    const effOrigFee      = hmcb.originationFeeMode === 'pct'
      ? (hmcb.originationFee / 100) * totalLoan : (hmcb.originationFee || 0);
    const effBrokerFee    = hmcb.brokerFeeMode === 'pct'
      ? (hmcb.brokerFee / 100) * totalLoan : (hmcb.brokerFee || 0);
    const hmcbFees        = effOrigFee + effBrokerFee
      + (hmcb.underwritingFee || 0) + (hmcb.appraisalFee || 0)
      + (hmcb.attDocPrepFee || 0) + (hmcb.servicingFee || 0);
    effectiveLoanAmount   = totalLoan;
    monthlyInterest       = monthly;
    originationFee        = effOrigFee;
    totalCostOfCapital    = (monthly * effHoldMonths) + hmcbFees;
  } else {
    const totalLent = (costs?.mobileHome || 0) + (costs?.land || 0);
    effectiveLoanAmount   = loanAmountOverride || totalLent;
    monthlyInterest       = effectiveLoanAmount * ((interestRate || 0) / 100) / 12;
    originationFee = originationFeeType === 'percentage'
      ? effectiveLoanAmount * ((originationFeePct || 0) / 100)
      : (originationFeeFlat || 0);
    servicingFee = servicingFeeType === 'percentage'
      ? effectiveLoanAmount * ((servicingFeePct || 0) / 100)
      : (servicingFeeFlat || 0);
    const otherFees = Number(deal?.scenarioData?.drawFeeHm || 0)
                    + Number(deal?.scenarioData?.underwritingFee || 0)
                    + Number(deal?.scenarioData?.attorneyDocFee || 0);
    totalCostOfCapital = (monthlyInterest * effHoldMonths) + originationFee + servicingFee + otherFees;
  }

  const profitBeforeShare = arvVal - allIn - sellingCosts - holdingCosts
                          - (hasFinancing ? totalCostOfCapital : 0);
  const profitShareAmount = hasFinancing
    ? profitBeforeShare * ((profitSharePct || 0) / 100)
    : 0;
  const netProfit = profitBeforeShare;

  return {
    netProfit,
    profitBeforeShare,
    profitShareAmount,
    totalCostOfCapital,
    sellingCosts,
    holdingCosts,
    effHoldMonths,
    hasFinancing,
    activeFinancing,
    effectiveLoanAmount,
    monthlyInterest,
    originationFee,
    servicingFee,
  };
}

function formatHoldPeriod(months) {
  if (!Number.isFinite(months) || months <= 0) return '0 days';
  const totalDays = Math.round(months * 30);
  const whole = Math.floor(totalDays / 30);
  const rem = totalDays - whole * 30;
  if (whole === 0) return `${rem} day${rem === 1 ? '' : 's'}`;
  if (rem === 0)   return `${whole} month${whole === 1 ? '' : 's'}`;
  return `${whole} month${whole === 1 ? '' : 's'} ${rem} day${rem === 1 ? '' : 's'}`;
}

// ── Financing scenario types (matching Lovable CRM) ──────────────────────────
const FINANCING_SCENARIOS = [
  {
    id: 'cash', label: 'Cash', financingType: 'Cash', dbType: 'cash',
    description: 'You are funding this deal entirely with your own cash — no lender, no interest, no loan fees. Net profit is not reduced by any cost of capital.',
  },
  {
    id: 'hard-money-loan', label: 'Hard Money Loan', financingType: 'Hard Money Loan', dbType: 'hard_money_loan',
    description: 'A short-term loan from a private lender secured by the property. Interest accrues on the deployed loan amount for the duration of your hold period. Includes origination and servicing fees.',
  },
  {
    id: 'hard-money-land-home', label: 'Hard Money (Land + Home)', financingType: 'Hard Money (Land + Home)', dbType: 'hard_money_land_home',
    description: 'Hard money covering both the land purchase and home cost as a single blended loan. Interest and fees are calculated on the combined land + home amount.',
  },
  {
    id: 'loc', label: 'Line of Credit', financingType: 'Line of Credit', dbType: 'line_of_credit',
    description: 'A revolving credit line you draw from as needed. You pay an annual fee on the credit limit and interest only on the drawn balance. Offers flexibility — draw what you need, when you need it.',
  },
  {
    id: 'profit-split', label: 'Profit Split', financingType: 'Profit Split', dbType: 'profit_split',
    description: 'An investor provides capital in exchange for a percentage of the net profit on this specific deal. No fixed interest payments — the investor gets paid when you get paid.',
  },
  {
    id: 'committed-capital-partner', label: 'Committed Capital Partner (Multi-Deal, Tranched)', financingType: 'Committed Capital Partner', dbType: 'committed_capital_partner',
    description: 'An investor commits capital to one deal at a time with deal-specific terms (tranche amount, preferred return %, profit split %). Each deal gets its own allocation negotiated separately. Interest is based on the amount deployed into this deal only.',
  },
  {
    id: 'pooled-loan', label: 'Pooled Loan (Multi-Deal)', financingType: 'Pooled Loan', dbType: 'pooled_loan',
    description: 'A single loan agreement (e.g. a $500k credit facility) that covers multiple deals simultaneously under fixed terms. Interest accrues on the full pool amount from day one — not just what you\'ve drawn. Monthly interest is prorated to each linked deal by allocation share.',
  },
  {
    id: 'hmcb', label: 'Hard Money – Construction Holdback', financingType: 'Hard Money – Construction Holdback', dbType: 'hard_money_construction_holdback',
    description: 'A private lender loan with two components: purchase funds released at closing, plus a construction holdback released in draws as work is inspected. Interest is interest-only on the funded amount (or full loan, depending on lender). Draws are tracked individually with inspection status.',
  },
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
  const { deals, setDeals, setArchivedDeals, archiveDeal } = useDeals();
  const { profile, activeOrgId, orgSlug, orgIsLendingHub } = useAuth();
  const [agentUsers, setAgentUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('profiles').select('name').eq('role', 'realtor').then(({ data }) => {
      if (data) setAgentUsers(data.map(u => u.name).filter(Boolean));
    });
  }, []);

  useEffect(() => {
    if (!supabase || !activeOrgId) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Try the server API first — uses admin client, bypasses RLS
      if (token) {
        try {
          const res = await fetch('/api/team/members', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { members } = await res.json();
            const users = (members || [])
              .filter(m => m.status !== 'removed')
              .map(m => {
                const p = m.profiles || {};
                const name = p.name
                  || [p.first_name, p.last_name].filter(Boolean).join(' ')
                  || p.email
                  || null;
                return name ? { id: m.user_id, name } : null;
              })
              .filter(Boolean)
              .sort((a, b) => a.name.localeCompare(b.name));
            if (users.length > 0) { setAllUsers(users); return; }
          }
        } catch { /* fall through */ }
      }

      // Fallback: direct Supabase query (may be limited by RLS)
      const { data: mems } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('organization_id', activeOrgId);
      if (!mems?.length) return;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, first_name, last_name, email')
        .in('id', mems.map(m => m.user_id));
      if (profiles) {
        const users = profiles
          .map(p => {
            const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email;
            return name ? { id: p.id, name } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));
        setAllUsers(users);
      }
    })();
  }, [activeOrgId]);

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

  // DD complete count for tab label (updated via onStatusChange callback from DDTab).
  // Starts at 0 and is populated once DDTab loads milestones from Supabase.
  const [ddCompleteCount, setDdCompleteCount] = useState(0);

  // Initial dev tasks — Swanson has 1/38 complete (land cleared)
  const totalDevTasks = DEV_GROUPS.flatMap(g => g.tasks).length;
  const initDev = Array(totalDevTasks).fill(false).map((_, i) =>
    deal?.id === 'deal-020' ? i === 0 : false
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_DEAL_TABS = ['overview', 'events', 'threads', 'details', 'dd', 'dev', 'realized', 'financing'];
  const activeTab = VALID_DEAL_TABS.includes(searchParams.get('dealTab')) ? searchParams.get('dealTab') : 'overview';
  const setActiveTab = (tab) => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('dealTab', tab); return next; }, { replace: true });
  const [costs, setCosts] = useState(initCosts);
  const [notes, setNotes] = useState(deal?.notes || '');
  const [arv,   setArv]   = useState(deal?.arv ?? 0);
  const [listingUrl, setListingUrl] = useState(deal?.listingUrl || '');
  const [devTasks, setDevTasks] = useState(initDev);
  const [realized, setRealized] = useState({});
  const [costSummary, setCostSummary] = useState(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const { hasFlag } = useAuth();
  // CostBreakdownTab is now the default for all orgs.
  // The old per-org feature flag is kept for backward compat but no longer
  // gates the new UI — every subscriber gets the same cost breakdown.
  const costBreakdownV2 = true;
  const financingTabEnabled = hasFlag('deal_page.financing_tab');
  const [pooledLoanLinks, setPooledLoanLinks] = useState([]);
  const [showDeadDealModal, setShowDeadDealModal] = useState(false);
  const DEAL_OVERVIEW_ONLY = new Set(['Contract Signed', 'Due Diligence', 'Development', 'Complete']);
  const currentStageVal = deal?.stage || '';
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
  const [showAddInvestor, setShowAddInvestor]         = useState(false);
  const [showCreateTask, setShowCreateTask]           = useState(false);
  const [showLogCall, setShowLogCall]                 = useState(false);
  const [showSendEmail, setShowSendEmail]             = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [financing, setFinancing] = useState(deal?.financing || '');

  // Deal Evaluation
  const [waterCompany, setWaterCompany] = useState(deal?.waterCompany || '');
  const [sewerCompany, setSewerCompany] = useState(deal?.sewerCompany || '');
  const [electricCompany, setElectricCompany] = useState(deal?.electricCompany || '');
  const [homeModel, setHomeModel] = useState(deal?.homeModel || '');
  // Subdivide / land-clearing flags read from the deal row only. The legacy
  // `subdividable` and `landClearing` columns sit alongside the canonical
  // `tags` array; both are kept in sync by updateDealFlag() below.
  const [subdividable, setSubdividable] = useState(() => {
    if (deal?.subdividable === 'Yes' || deal?.subdividable === 'No') return deal.subdividable;
    return (deal?.tags || []).includes('Subdivide') ? 'Yes' : 'No';
  });
  const [landClearing, setLandClearing] = useState(() => {
    if (deal?.landClearing === 'Yes' || deal?.landClearing === 'No') return deal.landClearing;
    return (deal?.tags || []).includes('Land Clearing') ? 'Yes' : 'No';
  });

  // Persist subdivide / land clearing state so the kanban card reflects it.
  // We update three things in lock-step so isSubdividable()/isLandClearing()
  // always agree: localStorage, deal.{subdividable|landClearing}, and deal.tags.
  // Without this, an earlier 'No' on the legacy column shadowed a freshly
  // toggled-on tag and the badge would not appear on the card.
  const updateDealFlag = ({ tagName, legacyKey, on }) => {
    if (!deal?.id) return;
    const currentTags = Array.isArray(deal.tags) ? deal.tags : [];
    const nextTags = on
      ? (currentTags.includes(tagName) ? currentTags : [...currentTags, tagName])
      : currentTags.filter(t => t !== tagName);
    const updated = {
      ...deal,
      tags: nextTags,
      [legacyKey]: on ? 'Yes' : 'No',
    };
    saveDeal(updated, activeOrgId);
    setDeals(prev => prev.map(d => String(d.id) === String(deal.id) ? updated : d));
  };

  const handleSetSubdividable = (val) => {
    setSubdividable(val);
    updateDealFlag({ tagName: 'Subdivide', legacyKey: 'subdividable', on: val === 'Yes' });
  };

  const handleSetLandClearing = (val) => {
    setLandClearing(val);
    updateDealFlag({ tagName: 'Land Clearing', legacyKey: 'landClearing', on: val === 'Yes' });
  };

  const handleSendToLandAcq = () => {
    if (!deal?.id) return;
    const updated = {
      ...deal,
      pipeline: 'land-acquisition',
      stage: 'Waiting on Contract',
      contractSignedAt: null,
    };
    saveDeal(updated, activeOrgId);
    setDeals(prev => {
      const idx = prev.findIndex(x => String(x.id) === String(updated.id));
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    navigate('/pipelines/land');
  };

  const handleSetStage = async (val) => {
    setStage(val);
    if (!deal?.id) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const isMovingToContractSigned = val === 'Contract Signed';
    if (isMovingToContractSigned && !deal.contractDate) {
      setContractDate(todayStr);
    }
    const updated = {
      ...deal,
      stage: val,
      // When crossing into Deal Overview stages, also flip pipeline so the
      // deal appears on the correct kanban board.
      ...(['Contract Signed', 'Due Diligence', 'Development', 'Complete'].includes(val)
        ? { pipeline: 'deal-overview' }
        : {}),
      ...(isMovingToContractSigned && !deal.contractDate
        ? { contractDate: todayStr }
        : {}),
      ...(isMovingToContractSigned && !deal.contractSignedAt
        ? { contractSignedAt: new Date().toISOString() }
        : {}),
      ...(val !== 'Contract Signed' && !['Due Diligence', 'Development', 'Complete'].includes(val)
        ? { contractSignedAt: null, pipeline: 'land-acquisition' }
        : {}),
    };
    // Optimistic UI: localStorage + context update first.
    saveDeal(updated, activeOrgId);
    setDeals(prev => {
      const idx = prev.findIndex(x => String(x.id) === String(updated.id));
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    notifyPipelineChange(deal, val, { orgId: activeOrgId, userId: profile?.id });
    notifyStageChange(deal, val, { orgId: activeOrgId, userId: profile?.id });
    // Confirm the Supabase write actually committed; warn loudly if RLS
    // silently rejected the update so we don't fail-quiet on next refresh.
    try {
      const { error } = await flushToSupabaseAsync(updated, activeOrgId);
      if (error) {
        console.error('[DealDetail] stage save failed', error);
        alert(`Could not save stage change: ${error.message || error}. Refresh may revert.`);
      }
    } catch (e) {
      console.error('[DealDetail] stage save threw', e);
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

  // ── Realtime: sync remote updates from other users into local state ───────────
  // The DealsContext subscription (subscribeToDeals) already fires on UPDATE events,
  // keeping the `deals` array in context fresh. Here we react to those changes and
  // push updated field values into local state so this page updates without a refresh.
  //
  // CRITICAL: we MUST NOT unconditionally overwrite local state from `remoteDeal` on
  // every context change. Doing so causes a feedback loop:
  //   1. user edits address → setAddress(new) → saveNow saves → setDeals(updated)
  //   2. this effect fires (deals changed) → setAddress(remoteDeal.address)
  //   3. realtime echoes our own write back later, possibly with stale-looking values
  //      from an in-flight intermediate write → setDeals(merged) → this effect fires
  //      → setAddress(stale) → auto-save effect picks up the diff → writes STALE back
  //      to LS + Supabase → field "reverts" some time after a successful edit.
  //
  // Fix: track the previous remote value per field. Only adopt a remote value when
  // the user hasn't diverged from it locally (i.e., currentLocal === lastRemote).
  // This preserves user edits while still letting genuine remote changes propagate.
  const lastRemoteRef = useRef(null);
  useEffect(() => {
    const remoteDeal = deals.find(d => String(d.id) === String(deal.id));
    if (!remoteDeal) return;
    const last = lastRemoteRef.current;
    // On first run, just record — useState initializers already populated local state
    // from the deal prop (which itself was resolved from the freshest available source).
    if (!last) { lastRemoteRef.current = remoteDeal; return; }

    // Sync a field only if (a) remote actually changed since last sync, and
    // (b) local state still matches the previous remote (user hasn't edited).
    const sync = (currentLocal, setter, key, normalize = v => (v ?? '')) => {
      const remoteVal = normalize(remoteDeal[key]);
      const lastVal   = normalize(last[key]);
      if (remoteVal === lastVal) return;                 // remote unchanged → nothing to do
      if (normalize(currentLocal) !== lastVal) return;   // user edited locally → don't clobber
      setter(remoteVal);
    };

    // Stage: special-case to keep the localStorage stage cache in sync too.
    const allStages = [...LAND_ACQ_STAGES, ...DEAL_OVERVIEW_STAGES];
    const remoteStage = remoteDeal.stage;
    if (
      remoteStage && allStages.includes(remoteStage) &&
      remoteStage !== last.stage && stage === last.stage
    ) {
      setStage(remoteStage);
    }

    sync(address,                setAddress,                'address');
    sync(county,                 setCounty,                 'county');
    sync(dealState,              setDealState,              'state');
    sync(zip,                    setZip,                    'zip');
    sync(acreage,                setAcreage,                'acreage', v => (v == null ? '' : String(v)));
    sync(parcelId,               setParcelId,               'parcelId');
    sync(leadSource,             setLeadSource,             'leadSource');
    sync(ownerType,              setOwnerType,              'ownerType');
    sync(utilityScenario,        setUtilityScenario,        'utilityScenario');
    sync(ownerName,              setOwnerName,              'ownerName');
    sync(sellerName,             setSellerName,             'sellerName');
    sync(phone,                  setPhone,                  'phone');
    sync(email,                  setEmail,                  'email');
    sync(investor,               setInvestor,               'investor');
    sync(closingAttorney,        setClosingAttorney,        'closingAttorney');
    sync(closingAttorneyPhone,   setClosingAttorneyPhone,   'closingAttorneyPhone');
    sync(closingAttorneyAddress, setClosingAttorneyAddress, 'closingAttorneyAddress');
    sync(dealOwner,              setDealOwner,              'dealOwner');

    // Date fields: same divergence guard. We still want to allow null (legitimate clear)
    // to propagate, which the generic sync() handles because the null-vs-empty mismatch
    // is normalised away.
    sync(closeDate,    setCloseDate,    'closeDate');
    sync(contractDate, setContractDate, 'contractDate');

    // ARV (numeric — compare without string normalize)
    if (
      remoteDeal.arv != null && remoteDeal.arv !== last.arv &&
      arv === last.arv
    ) setArv(remoteDeal.arv);

    // Financing scenario — keep the previous behaviour but only adopt remote when the
    // user hasn't diverged from the previous remote scenario.
    if (
      remoteDeal.financingScenarioType &&
      remoteDeal.financingScenarioType !== last.financingScenarioType
    ) {
      const byDb = FINANCING_SCENARIOS.find(s => s.dbType === remoteDeal.financingScenarioType);
      if (byDb && (financingScenarioType === last.financingScenarioType)) {
        setSelectedScenario(byDb.id);
        setFinancingScenarioType(remoteDeal.financingScenarioType);
        setFinancing(byDb.financingType);
      }
    } else if (!selectedScenario && !last.financing && remoteDeal.financing) {
      setFinancing(remoteDeal.financing || '');
    }

    lastRemoteRef.current = remoteDeal;
  }, [deals]); // eslint-disable-line react-hooks/exhaustive-deps

  // Financing scenario state — restored from scenarioData if available
  const sd = deal?.scenarioData || {};
  const [selectedScenario, setSelectedScenario] = useState(() => {
    // Prefer the canonical DB enum (financing_scenario_type) — it's the field
    // applyScenario() writes and the source of truth. The legacy `financing`
    // text field is fallback only, and may drift if other code paths overwrite
    // it with stale/legacy values, which used to flip the scenario on refresh.
    if (deal?.financingScenarioType) {
      const byDb = FINANCING_SCENARIOS.find(s => s.dbType === deal.financingScenarioType);
      if (byDb) return byDb.id;
    }
    const f = deal?.financing || '';
    const exact = FINANCING_SCENARIOS.find(s => s.financingType === f);
    if (exact) return exact.id;
    // Legacy display-name fallbacks
    if (f === 'Hard Money') return 'hard-money-loan';
    if (f === 'Cash') return 'cash';
    if (f === 'Line of Credit') return 'loc';
    return '';
  });
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
  const [capitalDeployedDate, setCapitalDeployedDate] = useState(deal?.capitalDeployedDate ?? '');
  const [capitalReturnedDate, setCapitalReturnedDate] = useState(deal?.capitalReturnedDate ?? '');
  const [estimatedSaleDate,   setEstimatedSaleDate]   = useState(deal?.estimatedSaleDate   ?? '');
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
  const [loanAmountOverride, setLoanAmountOverride] = useState(sd.loanAmountOverride ?? null);
  // Payment Due Day — drives schedule/calendar generator (HM Loan, HM L+H, HMCB, LoC).
  const [paymentDueDay, setPaymentDueDay] = useState(sd.paymentDueDay ?? 'same_as_closing');
  // Optional override: anchor the schedule on a user-picked first payment date.
  const [firstPaymentDate, setFirstPaymentDate] = useState(sd.firstPaymentDate ?? null);

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
  // HMCB: loan config stored in deal.scenarioData.hmcb
  const [hmcbData, setHmcbData] = useState(() => ({
    ...HMCB_DEFAULTS,
    ...(deal?.scenarioData?.hmcb || {}),
  }));

  // ── HMCB lender → deal.investor sync (one-way) ──────────────────────────────
  // HMCBPanel's Lender/Investor dropdown writes to scenario_data.hmcb.lenderName.
  // Mirror that into the deal-level `investor` field so the Investor Portal,
  // capital tracking, and payment schedule (which all key off deal.investor)
  // stay in sync.
  //
  // We deliberately DO NOT copy in the reverse direction: legacy `investor`
  // values from previous scenarios (e.g. "Cash" left over from a Cash scenario)
  // would otherwise contaminate the HMCB lender dropdown when switching scenarios.
  useEffect(() => {
    if (selectedScenario !== 'hmcb') return;
    const hmcbLender = (hmcbData?.lenderName || '').trim();
    if (hmcbLender && hmcbLender !== investor) {
      setInvestor(hmcbLender);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario, hmcbData?.lenderName]);

  // New fields added for financing tab redesign
  const [lenderName, setLenderName] = useState(sd.lenderName ?? '');
  const [drawAmount, setDrawAmount] = useState(
    sd.drawAmount != null ? sd.drawAmount : Math.round((sd.creditLimit ?? 0) * (sd.drawPct ?? 0) / 100)
  );
  const [extensionAvailable, setExtensionAvailable] = useState(sd.extensionAvailable ?? false);
  const [extensionFee, setExtensionFee] = useState(sd.extensionFee ?? 0);
  const [extensionMonths, setExtensionMonths] = useState(sd.extensionMonths ?? 0);
  const [drawFeeHm, setDrawFeeHm] = useState(sd.drawFeeHm ?? 0);
  const [underwritingFee, setUnderwritingFee] = useState(sd.underwritingFee ?? 0);
  const [attorneyDocFee, setAttorneyDocFee] = useState(sd.attorneyDocFee ?? 0);
  const [cashSource, setCashSource] = useState(sd.cashSource ?? '');
  const [investorReturnType, setInvestorReturnType] = useState(sd.investorReturnType ?? 'Interest Only');
  const [investorAssignmentStatus, setInvestorAssignmentStatus] = useState(sd.investorAssignmentStatus ?? 'Committed');

  // Load investors from Supabase for Investor Assignment dropdown
  const [supabaseInvestors, setSupabaseInvestors] = useState([]);
  const [showInvestorPicker, setShowInvestorPicker] = useState(false);
  const investorPickerRef = useRef(null);
  useEffect(() => {
    if (!activeOrgId) return;
    fetchAllInvestors(activeOrgId).then(({ investors: inv }) => {
      if (inv?.length) setSupabaseInvestors(inv);
    });
  }, [activeOrgId]);

  // Close investor picker on outside click
  useEffect(() => {
    if (!showInvestorPicker) return;
    function handleClick(e) {
      if (investorPickerRef.current && !investorPickerRef.current.contains(e.target)) {
        setShowInvestorPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showInvestorPicker]);

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
    // When switching TO HMCB and no HMCB lender is set yet, clear the deal
    // investor so the header doesn't keep showing a leftover from a previous
    // scenario (e.g. "Cash"). The user will pick a lender via HMCBPanel and the
    // sync effect will populate `investor` automatically.
    if (scenarioId === 'hmcb' && !(hmcbData?.lenderName || '').trim()) {
      setInvestor('');
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
    // Targeted update — only touch investor fields, never overwrite date columns.
    // Previously this called flushToSupabase({ ...deal, ... }) which spread the full deal
    // object (including closeDate: null) and wiped close_date in Supabase on every mount.
    if (supabase) {
      supabase
        .from('deals')
        .update({ investor_capital_contributed: capital, investor_equity_pct: equity })
        .eq('id', deal.id)
        .then(({ error }) => {
          if (error) console.warn('[DealDetail] hydration investor update failed', error);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save: fires immediately on every field change ───────────────────────
  const autoSaveMounted = useRef(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    if (!autoSaveMounted.current) { autoSaveMounted.current = true; return; }
    if (!deal?.id) return;
    if (!canEdit && !isAgent) return;

    // Always derive financing fields from selectedScenario so the legacy
    // `financing` text column and the canonical `financing_scenario_type` enum
    // can never drift. Without this, any saveDeal call that spreads a stale
    // `deal` prop (e.g. handleSetStage, handleSendToLandAcq) could wipe
    // financingScenarioType back to null and flip the dropdown on refresh.
    const scenarioMeta = selectedScenario
      ? FINANCING_SCENARIOS.find(s => s.id === selectedScenario)
      : null;
    const derivedFinancing             = scenarioMeta?.financingType || financing || '';
    const derivedFinancingScenarioType = scenarioMeta?.dbType        || financingScenarioType || null;

    const updatedDeal = {
      ...deal,
      stage, address, county, state: dealState, zip, acreage,
      ownerName, sellerName, phone, email, investor,
      financing: derivedFinancing,
      notes,
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
      capitalDeployedDate: capitalDeployedDate || null,
      capitalReturnedDate: capitalReturnedDate || null,
      estimatedSaleDate:   estimatedSaleDate   || null,
      financingScenarioType: derivedFinancingScenarioType,
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
        // Hard Money – Construction Holdback
        hmcb: hmcbData,
        // Financing tab redesign fields
        lenderName, drawAmount, extensionAvailable, extensionFee, extensionMonths,
        drawFeeHm, underwritingFee, attorneyDocFee, cashSource,
        investorReturnType, investorAssignmentStatus,
        // Payment Due Day — drives schedule generator
        paymentDueDay,
        firstPaymentDate,
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
    investorCapitalContributed, investorEquityPct, projectedPayoutDate, estimatedSaleDate,
    capitalDeployedDate, capitalReturnedDate,
    loanAmountOverride, investorProfitSplitPct, selectedScenario,
    interestRate, originationFeeType, originationFeePct, originationFeeFlat,
    servicingFeeType, servicingFeeFlat, servicingFeePct, balloonTerm,
    profitSharePct, ltcPct, originationPoints, creditLimit, drawPct, annualFeePct,
    ccpInvestorId, ccpCommitmentId, ccpAllocationAmount,
    ccpPrefReturnPct, ccpProfitSharePct, ccpPrefPaymentTiming,
    ccpPosition, ccpTranches, ccpAllocationId, ccpScheduleId,
    financingScenarioType, hmcbData,
    lenderName, drawAmount, extensionAvailable, extensionFee, extensionMonths,
    drawFeeHm, underwritingFee, attorneyDocFee, cashSource,
    investorReturnType, investorAssignmentStatus,
    paymentDueDay, firstPaymentDate,
  ]);

  // ── Auto-regen payment schedule when paymentDueDay or capitalDeployedDate changes ──
  // Only fires if a schedule already exists for this deal+investor; the first-time
  // generation is still triggered explicitly from PaymentScheduleSection.
  useEffect(() => {
    if (!deal?.id || !activeOrgId) return;
    if (!capitalDeployedDate) return;
    if (!['hard-money-loan', 'hard-money-land-home', 'hmcb', 'loc'].includes(selectedScenario)) return;
    const investorName = investor;
    if (!investorName) return;
    let cancelled = false;
    (async () => {
      const inv = await lookupInvestorByName(activeOrgId, investorName);
      if (cancelled || !inv) return;
      const { count } = await supabase
        .from('investor_payment_schedule')
        .select('id', { count: 'exact', head: true })
        .eq('deal_id', String(deal.id))
        .eq('investor_id', inv.id)
        .is('deleted_at', null);
      if (cancelled || !count) return;
      // Build a deal snapshot with the latest scenarioData so the generator
      // sees the new paymentDueDay value without waiting for context refresh.
      const snapshot = {
        ...deal,
        capitalDeployedDate,
        scenarioData: { ...(deal.scenarioData || {}), paymentDueDay, firstPaymentDate },
        organization_id: activeOrgId,
      };
      await savePaymentSchedule({ deal: snapshot, investor: inv, allocation: null, orgId: activeOrgId });
    })().catch((err) => console.warn('auto-regen schedule failed', err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDueDay, firstPaymentDate, capitalDeployedDate, selectedScenario, deal?.id, activeOrgId, investor]);

  // ── Load pooled loan links for this deal ──────────────────────────────────
  useEffect(() => {
    if (!deal?.id || !activeOrgId) return;
    fetchPooledLoansForDeal(deal.id, activeOrgId).then(links => setPooledLoanLinks(links));
  }, [deal?.id, activeOrgId]);

  // ── Load cost summary when feature flag is on ─────────────────────────────
  useEffect(() => {
    if (!costBreakdownV2 || !deal?.id) return;
    fetchCostSummary(deal.id).then(s => { if (s) setCostSummary(s); });
  }, [costBreakdownV2, deal?.id]);

  // Refresh summary whenever user switches to the cost breakdown tab
  useEffect(() => {
    if (activeTab === 'realized' && costBreakdownV2 && deal?.id) {
      fetchCostSummary(deal.id).then(s => { if (s) setCostSummary(s); });
    }
  }, [activeTab, costBreakdownV2, deal?.id]);

  // Realtime: re-fetch cost summary whenever any cost line for this deal changes
  useEffect(() => {
    if (!costBreakdownV2 || !deal?.id) return;
    const ch = supabase
      .channel(`deal-detail-cost-${deal.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_cost_lines',
          filter: `deal_id=eq.${deal.id}` },
        () => { fetchCostSummary(deal.id).then(s => { if (s) setCostSummary(s); }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [costBreakdownV2, deal?.id]);

  // allIn: when flag on, use total_actual from summary (mirrors estimated when no overrides)
  const allIn = costBreakdownV2 && costSummary
    ? Number(costSummary.total_actual ?? 0)
    : COST_FIELDS.reduce((s, f) => s + (costs[f.key] || 0), 0);

  // Single source of truth — same helper used by OverviewTab so header and
  // overview Net Profit numbers agree by construction.
  const _np = calcDealNetProfit({
    deal, arv, allIn, costs,
    capitalDeployedDate, estimatedSaleDate,
    holdPeriod, monthlyHoldCost,
    selectedScenario, interestRate,
    originationFeeType, originationFeePct, originationFeeFlat,
    servicingFeeType,  servicingFeePct,  servicingFeeFlat,
    loanAmountOverride, profitSharePct,
  });
  const sellingCosts = _np.sellingCosts;
  const holdingCosts = _np.holdingCosts;
  const netProfit    = _np.netProfit;
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

  // Dynamically measure deal header height for the 3-column layout calc
  const dealHeaderRef = useRef(null);
  const [dealHeaderH, setDealHeaderH] = useState(148);
  useEffect(() => {
    const el = dealHeaderRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDealHeaderH(Math.round(entry.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
    <div className="min-h-screen" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div ref={dealHeaderRef} className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
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
          <span className="text-sm text-gray-600 font-medium truncate max-w-[200px] md:max-w-xs">{address}</span>
        </div>

        <div className="flex items-start justify-between mt-3">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[#1a2332]">{address}</h1>
            <GradeBadge grade={deal.grade} />
            {(deal.tags || []).filter(t => t !== 'Subdivide' && t !== 'Land Clearing').map(t => <Tag key={t} type={t}>{t}</Tag>)}
            {!fromInvestorPortal && <>
              <button
                onClick={() => canEdit && handleSetLandClearing(landClearing === 'Yes' ? 'No' : 'Yes')}
                disabled={!canEdit}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors disabled:cursor-default ${
                  landClearing === 'Yes'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : canEdit
                      ? 'bg-gray-100 text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-600'
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
              {canEdit && !isAgent && (
                <SubmitForFundingButton deal={deal} />
              )}
              <button
                onClick={async () => {
                  const next = !(deal?.is_starred ?? false);
                  setDeals(prev => prev.map(d => String(d.id) === String(deal.id) ? { ...d, is_starred: next } : d));
                  const { error } = await supabase.from('deals').update({ is_starred: next }).eq('id', String(deal.id));
                  if (error) {
                    console.error('Star save failed:', error);
                    setDeals(prev => prev.map(d => String(d.id) === String(deal.id) ? { ...d, is_starred: !next } : d));
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${deal?.is_starred ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-500'}`}
              >
                <Star size={18} fill={deal?.is_starred ? 'currentColor' : 'none'} />
              </button>
              {canEdit && !isLandAcq && (
                <button
                  onClick={() => setShowDeadDealModal(true)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <XCircle size={14} /> Dead Deal
                </button>
              )}
              {canEdit && (
                <button
                  onClick={async () => {
                    // Optimistic removal
                    setDeals(prev => prev.filter(d => String(d.id) !== String(deal.id)));
                    const { error } = await archiveDeal({ ...deal, lastStage: stage });
                    if (error) {
                      // Rollback on failure
                      setDeals(prev => [...prev, deal]);
                      return;
                    }
                    const archived = { ...deal, isArchived: true, archivedAt: new Date().toISOString(), lastStage: stage };
                    setArchivedDeals(prev => {
                      const idx = prev.findIndex(d => String(d.id) === String(deal.id));
                      if (idx >= 0) { const next = [...prev]; next[idx] = archived; return next; }
                      return [...prev, archived];
                    });
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
          {!isAgent && <><div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Financing</p>
            {financingTabEnabled
              ? <button
                  onClick={() => setActiveTab('financing')}
                  className="text-sm font-bold text-[#1a2332] hover:text-accent transition-colors text-left"
                >
                  {FINANCING_SCENARIOS.find(s => s.id === selectedScenario)?.label || deal.financing || 'Set Scenario →'}
                </button>
              : <p className="text-sm font-bold text-[#1a2332]">{deal.financing || '—'}</p>
            }
          </div>
          <div className="hidden sm:block w-px h-8 bg-gray-200" />
          <div className="relative" ref={investorPickerRef}>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Investor</p>
            {canEdit
              ? <button
                  onClick={() => setShowInvestorPicker(v => !v)}
                  className="text-sm font-bold text-[#1a2332] hover:text-accent transition-colors text-left flex items-center gap-1"
                >
                  {investor || deal.investor || 'Assign →'}
                  <ChevronDown size={12} className="text-gray-400 mt-0.5" />
                </button>
              : <p className="text-sm font-bold text-[#1a2332]">{investor || deal.investor || '—'}</p>
            }
            {showInvestorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-52 py-1 flex flex-col">
                <button
                  onClick={() => { setShowInvestorPicker(false); setShowAddInvestor(true); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent/5 text-accent font-semibold border-b border-gray-100"
                >
                  + Add New Investor
                </button>
                <div className="overflow-y-auto max-h-48">
                  {(supabaseInvestors.length ? supabaseInvestors : investorList).map(inv => (
                    <button
                      key={inv.id}
                      onClick={() => {
                        setInvestor(inv.name);
                        saveNow?.({ investor: inv.name });
                        setShowInvestorPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 truncate ${investor === inv.name ? 'text-accent font-semibold' : 'text-gray-700'}`}
                    >
                      {inv.name}
                    </button>
                  ))}
                </div>
                {investor && (
                  <button
                    onClick={() => {
                      setInvestor('');
                      saveNow?.({ investor: '' });
                      setShowInvestorPicker(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-500 border-t border-gray-100"
                  >
                    Remove investor
                  </button>
                )}
              </div>
            )}
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

      {/* 3-column HubSpot-style layout */}
      <DealPageLayout
        dealId={deal.id}
        headerHeight={dealHeaderH}
        left={
          <DealLeftColumn
            deal={deal}
            stage={stage} setStage={handleSetStage}
            address={address} setAddress={setAddress}
            county={county} setCounty={setCounty}
            dealState={dealState} setDealState={setDealState}
            zip={zip} setZip={setZip}
            parcelId={parcelId} setParcelId={setParcelId}
            acreage={acreage} setAcreage={setAcreage}
            arv={arv} setArv={setArv}
            costs={costs} setCosts={setCosts}
            ownerName={ownerName} setOwnerName={setOwnerName}
            sellerName={sellerName} setSellerName={setSellerName}
            phone={phone} setPhone={setPhone}
            email={email} setEmail={setEmail}
            leadSource={leadSource} setLeadSource={setLeadSource}
            ownerType={ownerType} setOwnerType={setOwnerType}
            utilityScenario={utilityScenario} setUtilityScenario={setUtilityScenario}
            homeModel={homeModel} setHomeModel={setHomeModel}
            closingAttorney={closingAttorney} setClosingAttorney={setClosingAttorney}
            closingAttorneyPhone={closingAttorneyPhone} setClosingAttorneyPhone={setClosingAttorneyPhone}
            closingAttorneyAddress={closingAttorneyAddress} setClosingAttorneyAddress={setClosingAttorneyAddress}
            closeDate={closeDate} setCloseDate={setCloseDate}
            contractDate={contractDate} setContractDate={setContractDate}
            financing={financing} setFinancing={setFinancing}
            investor={investor} setInvestor={setInvestor}
            onAddInvestor={() => setShowAddInvestor(true)}
            netProfit={netProfit}
            allIn={allIn}
            roi={allIn > 0 ? ((netProfit / allIn) * 100) : 0}
            costSummary={costBreakdownV2 ? costSummary : null}
            onViewCostBreakdown={costBreakdownV2 ? () => setActiveTab('realized') : null}
            readOnly={fromInvestorPortal || (!canEdit && !isAgent)}
            canEdit={canEdit}
            stageOptions={STAGE_OPTIONS}
            LEAD_SOURCE_OPTIONS={LEAD_SOURCE_OPTIONS}
            OWNER_TYPE_OPTIONS={OWNER_TYPE_OPTIONS}
            UTILITY_SCENARIO_OPTIONS={UTILITY_SCENARIO_OPTIONS}
            FINANCING_OPTIONS={FINANCING_OPTIONS}
            COST_FIELDS={COST_FIELDS}
            saveNow={saveNow}
            onOpenMapSearch={() => setShowMapModal(true)}
            investorList={investorList}
            dealOwner={dealOwner} setDealOwner={setDealOwner}
            allUsers={allUsers}
            onCreateTask={() => setShowCreateTask(true)}
            onLogCall={() => setShowLogCall(true)}
            onSendEmail={() => setShowSendEmail(true)}
            onScheduleMeeting={() => setShowScheduleMeeting(true)}
            onApplyFinancing={!fromInvestorPortal && !isAgent && !orgIsLendingHub ? () => navigate('/lending/my-submissions', { state: { prefillLoan: {
              address: deal.address || '',
              purchasePrice: String(costs.land || 0),
              loanAmount: String((costs.mobileHome || 0) + (costs.land || 0)),
              arv: String(arv || deal.arv || 0),
              loanType: 'Land + Home Package',
              propertyType: 'Manufactured Home',
              exitStrategy: 'Sell',
              notes: `Deal ID: ${deal.id}. Financing: ${deal.financing || ''}. Investor: ${investor || ''}.`.trim(),
            }}}) : null}
            onSubmitDeal={!fromInvestorPortal && !isAgent && !orgIsLendingHub ? () => navigate('/lending/my-submissions', { state: { prefillPartner: {
              address: deal.address || '',
              arv: String(arv || deal.arv || 0),
              projectedProfit: String(Math.max(0, Math.round(netProfit))),
              dealType: 'Land + Home Package',
              propertyType: 'Manufactured',
              purchasePrice: String(costs.land || 0),
              repairCosts: String(COST_FIELDS.filter(f => f.key !== 'land').reduce((s, f) => s + (costs[f.key] || 0), 0)),
            }}}) : null}
          />
        }
        middle={
          <DealMiddleColumn
            deal={deal}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabsToShow={isAgent ? ['overview'] : ['overview', 'threads', 'details', 'dd', 'dev', 'realized', ...(financingTabEnabled ? ['financing'] : [])]}
            ddCount={ddCompleteCount}
            ddTotal={DD_COLS.length}
            devCount={devComplete}
            devTotal={devTotal}
            costOverrideCount={costBreakdownV2 && costSummary ? Number(costSummary.override_count ?? 0) : null}
            costLineCount={costBreakdownV2 && costSummary ? Number(costSummary.line_count ?? 0) : null}
          >
            <div className={fromInvestorPortal ? '[&_input]:!border-0 [&_input]:!bg-transparent [&_input]:!shadow-none [&_input]:pointer-events-none [&_select]:!border-0 [&_select]:!bg-transparent [&_select]:!shadow-none [&_select]:pointer-events-none [&_select]:appearance-none [&_textarea]:!border-0 [&_textarea]:!bg-transparent [&_textarea]:!shadow-none [&_textarea]:pointer-events-none [&_textarea]:resize-none' : ''}>
      {/* Tab content */}
        {activeTab === 'overview' && (
          <DealActivityFeed
            deal={deal}
            readOnly={fromInvestorPortal || (!canEdit && !isAgent)}
            currentUser={profile?.name}
            refreshKey={activityRefreshKey}
          />
        )}
        {activeTab === 'threads' && (
          <DealThreads
            deal={deal}
            readOnly={fromInvestorPortal || (!canEdit && !isAgent)}
          />
        )}
        {activeTab === 'details' && (
          <OverviewTab
            deal={deal} costs={costs} setCosts={setCosts} allIn={allIn} notes={notes} setNotes={setNotes}
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
            estimatedSaleDate={estimatedSaleDate} setEstimatedSaleDate={setEstimatedSaleDate}
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
          costBreakdownV2
            ? <CostBreakdownTab
                dealId={deal.id}
                deal={deal}
                arv={arv}
                onArvChange={v => { setArv(v); saveNow({ arv: v }); }}
                onCostSave={async () => {
                  // Immediately re-fetch the canonical summary so the header
                  // "All-In" + Net Profit / ROI numbers update on the same
                  // tick the user hits Enter — don't wait for the realtime
                  // postgres_changes echo, which can lag a second or more on
                  // a busy channel.
                  //
                  // We ALSO push the fresh totals into the DealsContext so
                  // the deal-card view on DealOverview (which reads
                  // `deal.totalActual` / `deal.totalEstimated`) updates on
                  // the same tick. Without this, cards stayed stale until a
                  // hard refresh.
                  const fresh = await fetchCostSummary(deal.id);
                  if (!fresh) return;
                  setCostSummary(fresh);
                  const totalActual    = Number(fresh.total_actual    ?? 0);
                  const totalEstimated = Number(fresh.total_estimated ?? 0);
                  setDeals(prev => prev.map(d =>
                    String(d.id) === String(deal.id)
                      ? { ...d, totalActual, totalEstimated }
                      : d
                  ));
                }}
                readOnly={fromInvestorPortal || !canEdit}
              />
            : <RealizedTab realized={realized} setRealized={setRealized} readOnly={fromInvestorPortal || !canEdit} />
        )}
        {activeTab === 'financing' && financingTabEnabled && pooledLoanLinks.length > 0 && (
          <div className="space-y-3 mb-4">
            {pooledLoanLinks.map(({ loan, allocation }) => {
              if (!loan) return null;
              const allocs = pooledLoanLinks.map(l => ({ ...l.allocation, deal_id: deal.id }));
              const totalAlloc = allocs.reduce((s, a) => s + (parseFloat(a.allocated_amount) || 0), 0);
              const monthly = pooledMonthlyInterest(loan);
              const attrInterest = totalAlloc > 0 ? (parseFloat(allocation.allocated_amount) / totalAlloc) * monthly : 0;
              return (
                <div key={loan.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600"><rect x="2" y="3" width="6" height="18"/><rect x="9" y="3" width="6" height="18"/><rect x="16" y="3" width="6" height="18"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-sidebar">{loan.name}</p>
                        <p className="text-xs text-gray-500">{loan.lender_name || 'Pooled Loan'}{loan.lender_contact_name ? ` · ${loan.lender_contact_name}` : ''}</p>
                      </div>
                    </div>
                    <a href={`/lending/pooled-loans/${loan.id}`} className="text-xs text-purple-600 hover:underline font-medium flex-shrink-0">View Loan →</a>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="bg-white rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400">Allocated</p>
                      <p className="text-sm font-bold text-sidebar">${Number(allocation.allocated_amount || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400">Pool Rate</p>
                      <p className="text-sm font-bold text-sidebar">{((loan.interest_rate || 0) * 100).toFixed(2)}%</p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400">Attributed Interest/mo</p>
                      <p className="text-sm font-bold text-sidebar">${attrInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-400">Profit Participation</p>
                      <p className="text-sm font-bold text-sidebar">{loan.profit_participation_pct || 0}% of net</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Full pool: ${Number(loan.total_pool).toLocaleString()} · Interest accrues on full pool regardless of draws</p>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'financing' && financingTabEnabled && (
          <FinancingScenarioPanel
            deal={deal} costs={costs} arv={arv} allIn={allIn} netProfit={netProfit}
            selectedScenario={selectedScenario} applyScenario={applyScenario}
            lenderName={lenderName} setLenderName={setLenderName}
            interestRate={interestRate} setInterestRate={setInterestRate}
            holdPeriod={holdPeriod} setHoldPeriod={setHoldPeriod}
            loanAmountOverride={loanAmountOverride} setLoanAmountOverride={setLoanAmountOverride}
            originationFeePct={originationFeePct} setOriginationFeePct={setOriginationFeePct}
            servicingFeeFlat={servicingFeeFlat} setServicingFeeFlat={setServicingFeeFlat}
            drawFeeHm={drawFeeHm} setDrawFeeHm={setDrawFeeHm}
            underwritingFee={underwritingFee} setUnderwritingFee={setUnderwritingFee}
            attorneyDocFee={attorneyDocFee} setAttorneyDocFee={setAttorneyDocFee}
            extensionAvailable={extensionAvailable} setExtensionAvailable={setExtensionAvailable}
            extensionFee={extensionFee} setExtensionFee={setExtensionFee}
            extensionMonths={extensionMonths} setExtensionMonths={setExtensionMonths}
            creditLimit={creditLimit} setCreditLimit={setCreditLimit}
            drawAmount={drawAmount} setDrawAmount={setDrawAmount}
            annualFeePct={annualFeePct} setAnnualFeePct={setAnnualFeePct}
            investorProfitSplitPct={investorProfitSplitPct} setInvestorProfitSplitPct={setInvestorProfitSplitPct}
            ccpInvestorId={ccpInvestorId} setCcpInvestorId={setCcpInvestorId}
            ccpCommitmentId={ccpCommitmentId} setCcpCommitmentId={setCcpCommitmentId}
            ccpAllocationAmount={ccpAllocationAmount} setCcpAllocationAmount={setCcpAllocationAmount}
            ccpPrefReturnPct={ccpPrefReturnPct} setCcpPrefReturnPct={setCcpPrefReturnPct}
            ccpProfitSharePct={ccpProfitSharePct} setCcpProfitSharePct={setCcpProfitSharePct}
            ccpPrefPaymentTiming={ccpPrefPaymentTiming} setCcpPrefPaymentTiming={setCcpPrefPaymentTiming}
            ccpPosition={ccpPosition} setCcpPosition={setCcpPosition}
            ccpTranches={ccpTranches} setCcpTranches={setCcpTranches}
            capitalDeployedDate={capitalDeployedDate} setCapitalDeployedDate={setCapitalDeployedDate}
            capitalReturnedDate={capitalReturnedDate} setCapitalReturnedDate={setCapitalReturnedDate}
            estimatedSaleDate={estimatedSaleDate} setEstimatedSaleDate={setEstimatedSaleDate}
            paymentDueDay={paymentDueDay} setPaymentDueDay={setPaymentDueDay}
            firstPaymentDate={firstPaymentDate} setFirstPaymentDate={setFirstPaymentDate}
            cashSource={cashSource} setCashSource={setCashSource}
            investor={investor} setInvestor={setInvestor}
            investorList={supabaseInvestors.length ? supabaseInvestors : investorList}
            onAddInvestor={() => setShowAddInvestor(true)}
            investorCapitalContributed={investorCapitalContributed} setInvestorCapitalContributed={setInvestorCapitalContributed}
            investorEquityPct={investorEquityPct} setInvestorEquityPct={setInvestorEquityPct}
            projectedPayoutDate={projectedPayoutDate} setProjectedPayoutDate={setProjectedPayoutDate}
            investorReturnType={investorReturnType} setInvestorReturnType={setInvestorReturnType}
            investorAssignmentStatus={investorAssignmentStatus} setInvestorAssignmentStatus={setInvestorAssignmentStatus}
            readOnly={fromInvestorPortal || !canEdit}
          />
        )}

        {activeTab === 'financing' && financingTabEnabled && selectedScenario === 'hmcb' && (
          <HMCBPanel
            dealId={deal.id}
            data={hmcbData}
            onChange={setHmcbData}
            readOnly={fromInvestorPortal || !canEdit}
            investorList={supabaseInvestors.length ? supabaseInvestors : investorList}
            onAddInvestor={() => setShowInvestorPicker(true)}
            capitalDeployedDate={capitalDeployedDate}
            estimatedSaleDate={estimatedSaleDate}
            paymentDueDay={paymentDueDay}
            onPaymentDueDayChange={setPaymentDueDay}
            firstPaymentDate={firstPaymentDate}
            onFirstPaymentDateChange={setFirstPaymentDate}
          />
        )}

            </div>
          </DealMiddleColumn>
        }
        right={
          <DealRightColumn
            deal={deal}
            readOnly={fromInvestorPortal || (!canEdit && !isAgent)}
            onCreateTask={() => setShowCreateTask(true)}
          />
        }
      />
    </div>

    {/* Create Task Modal */}
    {showCreateTask && (
      <CreateTaskModal
        defaultDealId={deal.id}
        onClose={() => setShowCreateTask(false)}
        onCreated={async (task, assignedToName, assignedToId) => {
          setShowCreateTask(false);
          // Use deal.id directly — task.deal_id may be null if the DB col isn't returned
          const dealId = task?.deal_id || deal.id;
          const authorName = profile?.name || profile?.first_name || 'Someone';
          const assigneePart = assignedToName ? ` · Assigned to ${assignedToName}` : '';
          const taskTitle = task?.title || 'Untitled task';
          console.log('[DealDetail] onCreated: logging task activity', { dealId, task, activeOrgId });
          await logTaskActivity({
            orgId:      activeOrgId,
            dealId,
            authorId:   profile?.id,
            authorName,
            noteType:   'task',
            body:       `Task created: "${taskTitle}"${assigneePart}`,
          });
          setActivityRefreshKey(k => k + 1);
          // Notify the assignee (skip if they assigned it to themselves)
          if (task && assignedToId && assignedToId !== profile?.id) {
            notifyTaskAssigned(task, assignedToId, assignedToName, deal?.address, { orgId: activeOrgId });
          }
        }}
      />
    )}

    {showSendEmail && (
      <ComposeEmailModal
        contact={{ email: email, fullName: sellerName || ownerName || '' }}
        dealId={deal.id}
        onClose={() => setShowSendEmail(false)}
        onSent={() => setShowSendEmail(false)}
      />
    )}

    {/* Add Investor Modal */}
    {showAddInvestor && (
      <AddInvestorModal
        onClose={() => setShowAddInvestor(false)}
        onSave={async (newInv) => {
          // Save to Supabase so investor appears in the portal
          const { investor: saved } = await upsertInvestor({
            name: newInv.name,
            contact: newInv.contact || null,
            email: newInv.email || null,
            phone: newInv.phone || null,
            type: newInv.type || 'Private Lender',
            standard_terms: newInv.standardTerms || null,
            organization_id: activeOrgId,
          });
          // Refresh Supabase investor list
          fetchAllInvestors(activeOrgId).then(({ investors: inv }) => {
            if (inv?.length) setSupabaseInvestors(inv);
          });
          // Also update localStorage list for fallback
          const updated = addInvestor(newInv, activeOrgId, orgSlug);
          setInvestorList(updated);
          // Assign to this deal
          const name = saved?.name || newInv.name;
          setInvestor(name);
          saveNow?.({ investor: name });
          setShowAddInvestor(false);
        }}
      />
    )}

    {/* Dead Deal confirmation modal */}
    {showDeadDealModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[4000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <XCircle size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mark as Dead Deal?</h3>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{deal.address || 'Untitled deal'}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            This deal will be moved to Archived Deals and flagged as a dead deal. It will be tracked separately in pipeline conversion reporting.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeadDealModal(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const now = new Date().toISOString();
                const deadDeal = {
                  ...deal,
                  stage,
                  deadDeal: true,
                  deadDealDate: now,
                  isArchived: true,
                  archivedAt: now,
                  lastStage: stage,
                };
                saveDeal(deadDeal, activeOrgId);
                // Also call archiveDeal so is_archived=true is set in the DB via the
                // archive_deal RPC. saveDeal intentionally omits is_archived (see
                // dealToRow comment) so without this the deal stays is_archived=false
                // in Supabase and reappears on the next loadAllDeals.
                archiveDeal(deadDeal);
                // Update context immediately so ArchivedDeals page shows it right away
                setDeals(prev => prev.filter(d => String(d.id) !== String(deal.id)));
                setArchivedDeals(prev => {
                  const idx = prev.findIndex(d => String(d.id) === String(deal.id));
                  if (idx >= 0) { const next = [...prev]; next[idx] = deadDeal; return next; }
                  return [...prev, deadDeal];
                });
                try {
                  const lsK = activeOrgId ? `lotline_deals_${activeOrgId}` : 'lotline_custom_deals';
                  const all = JSON.parse(localStorage.getItem(lsK) || '[]');
                  localStorage.setItem(lsK, JSON.stringify(all.filter(d => String(d.id) !== String(deal.id))));
                } catch {}
                setShowDeadDealModal(false);
                navigate('/archived');
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
            >
              Mark as Dead
            </button>
          </div>
        </div>
      </div>
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

// ── Error boundary — catches render crashes and shows the error instead of blank page ──
class DealErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('DealDetail crashed:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-700 mb-2">Something went wrong loading this deal</h2>
            <p className="text-sm text-red-600 font-mono bg-red-100 rounded p-3 break-all">
              {this.state.error?.message || String(this.state.error)}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.history.back(); }}
              className="mt-4 text-sm text-red-600 underline"
            >
              Go back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Outer wrapper — handles loading + deal lookup ─────────────────────────────
export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeOrgId, loading: authLoading } = useAuth();
  const { deals: customDeals, dealsLoading } = useDeals();

  // 1. Live context (always fresh — updated by saveDeal + realtime subscriptions)
  // 2. Org-specific localStorage (updated synchronously on every edit via saveToLS)
  // 3. Navigation state (snapshot at click time — can become stale after edits,
  //    so we use it only as a last resort, e.g. before dealsLoading completes
  //    and LS isn't seeded yet)
  const stateDeal = location.state?.deal;
  const lsKey = activeOrgId ? `lotline_deals_${activeOrgId}` : 'lotline_custom_deals';
  const lsDeals = (() => { try { return JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch { return []; } })();

  const deal = customDeals.find(d => String(d.id) === String(id))
    || lsDeals.find(d => String(d.id) === String(id))
    || (stateDeal && String(stateDeal.id) === String(id) ? stateDeal : null);

  if ((authLoading || dealsLoading) && !deal) {
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
  return (
    <DealErrorBoundary key={deal.id}>
      <DealDetailContent deal={deal} />
    </DealErrorBoundary>
  );
}

