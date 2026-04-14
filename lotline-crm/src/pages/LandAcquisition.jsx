import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, Star, MapPin, Archive, Landmark, Handshake, Zap, Calculator, Clock, FileSignature, FileCheck, User, DollarSign, Calendar, TreePine, SplitSquareHorizontal } from 'lucide-react';
import { LAND_DEALS, calcNetProfit } from '../data/deals';
import { GradeBadge, Tag } from '../components/UI/Badge';

const STAGES = ['New Lead', 'Underwriting', 'Negotiating', 'Waiting on Contract', 'Contract Signed'];

const STAGE_META = {
  'New Lead':              { icon: Zap,           color: '#c2410c', bg: '#fff7ed' },
  'Underwriting':          { icon: Calculator,    color: '#b45309', bg: '#fffbeb' },
  'Negotiating':           { icon: Handshake,     color: '#15803d', bg: '#f0fdf4' },
  'Waiting on Contract':   { icon: FileSignature, color: '#6366f1', bg: '#eef2ff' },
  'Contract Signed':       { icon: FileCheck,     color: '#16a34a', bg: '#dcfce7' },
};

const TAG_STYLES = {
  'Land Clearing': { bg: '#dcfce7', text: '#15803d', icon: TreePine },
  'Subdivide':     { bg: '#fef3c7', text: '#b45309', icon: SplitSquareHorizontal },
};

function isSubdividable(deal) {
  const saved = localStorage.getItem(`lotline_subdivide_${deal.id}`);
  if (saved !== null) return saved === 'Yes';
  return (deal.tags || []).includes('Subdivide') || deal.subdividable === true;
}

function isLandClearing(deal) {
  const saved = localStorage.getItem(`lotline_land_clearing_${deal.id}`);
  if (saved !== null) return saved === 'Yes';
  return (deal.tags || []).includes('Land Clearing') || deal.landClearing === true;
}

function formatCloseDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

const COST_FIELDS = [
  { key: 'land',        label: 'Land' },
  { key: 'mobileHome',  label: 'Mobile Home' },
  { key: 'hudEngineer', label: 'HUD Engineer' },
  { key: 'percTest',    label: 'Perc Test / Permit' },
  { key: 'survey',      label: 'Land Survey' },
  { key: 'footers',     label: 'Footers' },
  { key: 'setup',       label: 'Setup' },
  { key: 'clearLand',   label: 'Clear Land' },
  { key: 'water',       label: 'Water' },
  { key: 'septic',      label: 'Septic' },
  { key: 'electric',    label: 'Electric / Power Pole' },
  { key: 'hvac',        label: 'HVAC' },
  { key: 'underpinning',label: 'Underpinning' },
  { key: 'decks',       label: 'Decks Installed' },
  { key: 'driveway',    label: 'Driveway' },
  { key: 'landscaping', label: 'Landscaping / Final Grading' },
  { key: 'waterSewer',  label: 'Water / Sewer Hook Up' },
  { key: 'mailbox',     label: 'Mailbox' },
  { key: 'gutters',     label: 'Gutters' },
  { key: 'photos',      label: 'Professional Photos' },
  { key: 'mobileTax',   label: 'Mobile Home Tax' },
  { key: 'staging',     label: 'Staging' },
];

const LEAD_SOURCE_OPTIONS = ['Direct Mail', 'Driving for Dollars', 'Wholesaler', 'MLS', 'Referral', 'Cold Call', 'Online/Website', 'FB Market Place', 'Other'];
const OWNER_TYPE_OPTIONS  = ['Owner', 'Wholesaler', 'Realtor'];
const UTILITY_OPTIONS     = ['All Utilities Available', 'Well Needed', 'Septic Needed', 'Well & Septic Needed', 'Existing Well', 'Existing Septic', 'Existing Well & Septic'];
const FINANCING_OPTIONS   = ['Cash', 'Hard Money (Land + Home)', 'Hard Money', 'Line of Credit', 'Conventional'];
const TABS = ['Overview', 'Comms', 'Tasks', 'Comps', 'Expenses', 'Vault', 'Documents'];

function fmt(n) {
  return `$${Math.round(n || 0).toLocaleString()}`;
}

function calcScore(profitPct, roi, costArvPct) {
  let pm = profitPct >= 40 ? 40 : profitPct >= 30 ? 30 : profitPct >= 20 ? 20 : profitPct >= 10 ? 10 : 0;
  let ro = roi >= 100 ? 30 : roi >= 75 ? 22 : roi >= 50 ? 15 : roi >= 25 ? 8 : 0;
  let ca = costArvPct <= 45 ? 20 : costArvPct <= 55 ? 15 : costArvPct <= 65 ? 10 : costArvPct <= 75 ? 5 : 0;
  const total = pm + ro + ca + 10;
  return { total, grade: total >= 90 ? 'A' : total >= 70 ? 'B' : total >= 50 ? 'C' : 'D', pm, ro, ca };
}

// ── Deal Modal ────────────────────────────────────────────────────────────────
function DealModal({ deal, onClose }) {
  const navigate = useNavigate();
  const [tab,    setTab]    = useState('Overview');
  const [stage,  setStage]  = useState(deal.stage || 'New Lead');

  // Text fields
  const [generalNotes, setGeneralNotes] = useState(deal.generalNotes || '');
  const [address,      setAddress]      = useState(deal.address || '');
  const [parcelId,     setParcelId]     = useState(deal.parcelId || '');
  const [county,       setCounty]       = useState(deal.county || '');
  const [dealState,    setDealState]    = useState(deal.state || '');
  const [zip,          setZip]          = useState(deal.zip || '');
  const [acreage,      setAcreage]      = useState(deal.acreage || '');
  const [ownerName,    setOwnerName]    = useState(deal.ownerName || '');
  const [sellerName,   setSellerName]   = useState(deal.sellerName || '');
  const [phone,        setPhone]        = useState(deal.phone || '');
  const [email,        setEmail]        = useState(deal.email || '');
  const [leadSource,   setLeadSource]   = useState(deal.leadSource || '');
  const [ownerType,    setOwnerType]    = useState(deal.ownerType || 'Owner');
  const [utilityScenario, setUtilityScenario] = useState(deal.utilityScenario || 'All Utilities Available');
  const [homeModel,    setHomeModel]    = useState(deal.homeModel || '');
  const [subdividable, setSubdividable] = useState(deal.subdividable || deal.tags?.includes('Subdivide') || false);
  const [landClearing, setLandClearing] = useState(deal.landClearing || deal.tags?.includes('Land Clearing') || false);
  const [arv,          setArv]          = useState(deal.arv || 0);
  const [compsNotes,   setCompsNotes]   = useState(deal.compsNotes || '');
  const [investor,     setInvestor]     = useState(deal.investor || '');
  const [financing,    setFinancing]    = useState(deal.financing || 'Cash');
  const [holdingMonths,    setHoldingMonths]    = useState(deal.holdingMonths || 4);
  const [holdingPerMonth,  setHoldingPerMonth]  = useState(deal.holdingPerMonth || 250);
  const [capitalDeployed,  setCapitalDeployed]  = useState(deal.capitalDeployedDate || '');
  const [capitalReturned,  setCapitalReturned]  = useState(deal.capitalReturnedDate || '');
  const [investorPaidOut,  setInvestorPaidOut]  = useState(deal.investorPaidOut || false);
  const [ddDeadline,       setDdDeadline]       = useState(deal.ddDeadline || '');
  const [appraisalDate,    setAppraisalDate]    = useState(deal.appraisalDate || '');
  const [finContingency,   setFinContingency]   = useState(deal.financingContingency || '');
  const [closingDate,      setClosingDate]       = useState(deal.closingDate || '');
  const [notes,            setNotes]             = useState(deal.notes || '');

  // Cost fields
  const [costs, setCosts] = useState({
    land:         deal.land         ?? 0,
    mobileHome:   deal.mobileHome   ?? 0,
    hudEngineer:  deal.hudEngineer  ?? 500,
    percTest:     deal.percTest     ?? 2000,
    survey:       deal.survey       ?? 1500,
    footers:      deal.footers      ?? 6000,
    setup:        deal.setup        ?? 9000,
    clearLand:    deal.clearLand    ?? 0,
    water:        deal.water        ?? 0,
    septic:       deal.septic       ?? 0,
    electric:     deal.electric     ?? 0,
    hvac:         deal.hvac         ?? 4500,
    underpinning: deal.underpinning ?? 6000,
    decks:        deal.decks        ?? 3500,
    driveway:     deal.driveway     ?? 1200,
    landscaping:  deal.landscaping  ?? 0,
    waterSewer:   deal.waterSewer   ?? 0,
    mailbox:      deal.mailbox      ?? 170,
    gutters:      deal.gutters      ?? 0,
    photos:       deal.photos       ?? 0,
    mobileTax:    deal.mobileTax    ?? 300,
    staging:      deal.staging      ?? 0,
  });
  const setCost = (key, val) => setCosts(p => ({ ...p, [key]: parseFloat(val) || 0 }));

  // Computed
  const totalBuild    = COST_FIELDS.reduce((s, f) => s + (costs[f.key] || 0), 0);
  const sellingCosts  = (arv || 0) * 0.045 + 4000;
  const holdingCosts  = (holdingMonths || 4) * (holdingPerMonth || 250);
  const netProfit     = (arv || 0) - totalBuild - sellingCosts - holdingCosts;
  const profitPct     = arv > 0 ? netProfit / arv * 100 : 0;
  const roi           = totalBuild > 0 ? netProfit / totalBuild * 100 : 0;
  const annRoi        = holdingMonths > 0 ? roi / holdingMonths * 12 : 0;
  const costArvPct    = arv > 0 ? totalBuild / arv * 100 : 0;
  const score         = calcScore(profitPct, roi, costArvPct);
  const nonLandCosts  = COST_FIELDS.filter(f => f.key !== 'land').reduce((s, f) => s + (costs[f.key] || 0), 0);
  const maxOffer      = (arv || 0) - nonLandCosts - sellingCosts - holdingCosts - (arv || 0) * 0.23;

  const nextStage = STAGES[STAGES.indexOf(stage) + 1] || null;

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400/30';
  const labelCls = 'text-xs text-gray-500 mb-1 block';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center py-8 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: 'calc(100vh - 64px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{address}</h2>
          <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Stage bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <select
            value={stage}
            onChange={e => setStage(e.target.value)}
            className="border-2 border-orange-400 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400/30 bg-white"
          >
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {nextStage && (
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white">
              <ChevronRight size={14} className="text-gray-400" />
              {nextStage}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-gray-800 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {tab !== 'Overview' ? (
            <div className="py-16 text-center text-gray-400 text-sm">{tab} — coming soon</div>
          ) : (
            <>
              {/* General Notes */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">General Notes</p>
                <textarea
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400/30 resize-none"
                />
              </div>

              {/* Property Information */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-800">Property Information</p>
                  <button className="flex items-center gap-1.5 bg-teal-600 text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-teal-700 transition-colors">
                    <MapPin size={11} /> GIS Map
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Address</label>
                    <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Parcel ID</label>
                    <input value={parcelId} onChange={e => setParcelId(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>County</label>
                    <input value={county} onChange={e => setCounty(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input value={dealState} onChange={e => setDealState(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Zip Code</label>
                    <input value={zip} onChange={e => setZip(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Acreage</label>
                    <input value={acreage} onChange={e => setAcreage(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Seller Information */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Seller Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Owner Name</label>
                    <input value={ownerName} onChange={e => setOwnerName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Seller Name</label>
                    <input value={sellerName} onChange={e => setSellerName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Lead Source</label>
                    <select value={leadSource} onChange={e => setLeadSource(e.target.value)} className={inputCls + ' bg-white'}>
                      <option value="">Select source</option>
                      {LEAD_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Owner Type</label>
                    <select value={ownerType} onChange={e => setOwnerType(e.target.value)} className={inputCls + ' bg-white'}>
                      {OWNER_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Deal Evaluation */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Deal Evaluation</p>

                {/* ARV warning */}
                {!arv && zip && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-700">
                    <span className="mt-0.5">⚠️</span>
                    <span>No ARV data for zip code <strong>{zip}</strong>. Please fill in the Estimated ARV manually or add this zip to the ARV Database.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Utility Scenario</label>
                    <select value={utilityScenario} onChange={e => setUtilityScenario(e.target.value)} className={inputCls + ' bg-white'}>
                      {UTILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Manufactured Home Model</label>
                    <select value={homeModel} onChange={e => setHomeModel(e.target.value)} className={inputCls + ' bg-white'}>
                      <option value=""></option>
                      <option value="Clayton">Clayton</option>
                      <option value="Fleetwood">Fleetwood</option>
                      <option value="Champion">Champion</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-5 mb-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={subdividable} onChange={e => setSubdividable(e.target.checked)} className="rounded border-gray-300" />
                    Subdividable
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={landClearing} onChange={e => setLandClearing(e.target.checked)} className="rounded border-gray-300" />
                    Land Clearing
                  </label>
                </div>

                {/* Total Build Cost header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-800">Total Build Cost</span>
                  <span className="text-sm font-bold text-orange-500">{fmt(totalBuild)}</span>
                </div>

                {/* Cost grid — 3 columns */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {COST_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[11px] text-gray-500 mb-1 block leading-tight">{label}</label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <span className="px-2 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                        <input
                          type="number"
                          value={costs[key] || ''}
                          onChange={e => setCost(key, e.target.value)}
                          placeholder="0"
                          className="flex-1 px-2 py-2 text-sm text-gray-800 focus:outline-none w-0 min-w-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* ARV + Potential Profit */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={labelCls}>Estimated ARV</label>
                    <input
                      type="number"
                      value={arv || ''}
                      onChange={e => setArv(parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Potential Profit (Cash)</label>
                    <p className={`text-xl font-bold pt-1.5 ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmt(netProfit)}
                    </p>
                  </div>
                </div>

                {/* Comps Notes */}
                <div className="mb-4">
                  <label className={labelCls}>Comps Notes</label>
                  <textarea
                    value={compsNotes}
                    onChange={e => setCompsNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  />
                </div>

                {/* Financing Scenario box */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Financing Scenario</p>
                  <div className="mb-3">
                    <label className={labelCls}>Investor</label>
                    <input value={investor} onChange={e => setInvestor(e.target.value)} placeholder="e.g. John Smith, Self"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                  </div>
                  <div className="mb-3">
                    <label className={labelCls}>Scenario</label>
                    <select value={financing} onChange={e => setFinancing(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
                      {FINANCING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className={labelCls}>Holding Period (months)</label>
                      <input type="number" value={holdingMonths}
                        onChange={e => setHoldingMonths(parseInt(e.target.value) || 4)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
                    </div>
                    <div>
                      <label className={labelCls}>Monthly Holding Cost</label>
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                        <span className="px-2 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">$</span>
                        <input type="number" value={holdingPerMonth}
                          onChange={e => setHoldingPerMonth(parseInt(e.target.value) || 250)}
                          className="flex-1 px-2 py-2 text-sm focus:outline-none" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capital Required</span>
                      <span className="font-medium">{fmt(totalBuild)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Holding Costs</span>
                      <span className="font-medium">{fmt(holdingCosts)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Selling Costs</span>
                      <span className="font-medium">{fmt(sellingCosts)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-800">Net Profit (Cash)</span>
                      <span className={`font-bold text-base ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(netProfit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Profit Margin</span>
                      <span className="font-medium">{profitPct.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ROI</span>
                      <span className="font-medium">{roi.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Annualized ROI</span>
                      <span className="font-medium">{annRoi.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capital Tracking */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">Capital Tracking</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Capital Deployed Date</label>
                    <input type="date" value={capitalDeployed} onChange={e => setCapitalDeployed(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Capital Returned Date</label>
                    <input type="date" value={capitalReturned} onChange={e => setCapitalReturned(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={investorPaidOut} onChange={e => setInvestorPaidOut(e.target.checked)} className="rounded border-gray-300" />
                  Investor Paid Out
                </label>
              </div>

              {/* Photos */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Photos</p>
                <button className="text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors">+ Add Photos</button>
              </div>

              {/* Deal Score */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">Deal Score</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      score.grade === 'A' ? 'bg-green-100 text-green-700' :
                      score.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                      score.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{score.grade}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{score.total}/100</span>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Profit Margin ({profitPct.toFixed(1)}%)</span>
                    <span className="font-semibold">{score.pm}/40</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ROI ({roi.toFixed(1)}%)</span>
                    <span className="font-semibold">{score.ro}/30</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cost/ARV ({costArvPct.toFixed(1)}%)</span>
                    <span className="font-semibold">{score.ca}/20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Complexity</span>
                    <span className="font-semibold">10/10</span>
                  </div>
                </div>
              </div>

              {/* Milestones */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  <span className="mr-1.5">📅</span>Milestones
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Due Diligence Deadline', val: ddDeadline,    set: setDdDeadline },
                    { label: 'Appraisal Date',          val: appraisalDate, set: setAppraisalDate },
                    { label: 'Financing Contingency',   val: finContingency,set: setFinContingency },
                    { label: 'Closing Date',            val: closingDate,   set: setClosingDate },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className={labelCls}>{label}</label>
                      <input type="date" value={val} onChange={e => set(e.target.value)} className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Deal Calculator */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  <span className="mr-1.5">🧮</span>Deal Calculator
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Dev Cost</p>
                    <p className="font-bold text-gray-800">{fmt(totalBuild + holdingCosts)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Max Offer For Land</p>
                    <p className="font-bold text-orange-500">{fmt(maxOffer)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Projected Profit</p>
                    <p className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(netProfit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">ARV</p>
                    <p className="font-bold text-gray-800">{fmt(arv)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Home Cost</p>
                    <p className="font-bold text-gray-800">{fmt(costs.mobileHome)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">ROI</p>
                    <p className="font-bold text-gray-800">{roi.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Notes</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                />
              </div>

              {/* Footer actions */}
              <div className="pb-2 flex items-center justify-between gap-2">
                <button className="flex items-center gap-2 border border-gray-300 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0">
                  <Archive size={14} />
                  Archive
                </button>
                <div className="flex items-center gap-2">
                  {/* Partner on this deal */}
                  <button
                    onClick={() => {
                      const dealCosts = {
                        land:         String(costs.land         || ''),
                        mobileHome:   String(costs.mobileHome   || ''),
                        hudEngineer:  String(costs.hudEngineer  || ''),
                        percTest:     String(costs.percTest     || ''),
                        survey:       String(costs.survey       || ''),
                        footers:      String(costs.footers      || ''),
                        setup:        String(costs.setup        || ''),
                        clearLand:    String(costs.clearLand    || ''),
                        water:        String(costs.water        || ''),
                        septic:       String(costs.septic       || ''),
                        electric:     String(costs.electric     || ''),
                        hvac:         String(costs.hvac         || ''),
                        underpinning: String(costs.underpinning || ''),
                        decks:        String(costs.decks        || ''),
                        driveway:     String(costs.driveway     || ''),
                        landscaping:  String(costs.landscaping  || ''),
                        waterSewer:   String(costs.waterSewer   || ''),
                        mailbox:      String(costs.mailbox      || ''),
                        gutters:      String(costs.gutters      || ''),
                        photos:       String(costs.photos       || ''),
                        mobileTax:    String(costs.mobileTax    || ''),
                        staging:      String(costs.staging      || ''),
                      };
                      const prefillPartner = {
                        address:          address,
                        propertyType:     'Manufactured',
                        dealType:         'Land + Home Package',
                        arv:              String(arv || ''),
                        projectedProfit:  String(Math.max(0, netProfit) || ''),
                        summary:          notes,
                        costsOpen:        true,
                        costs:            dealCosts,
                      };
                      onClose();
                      navigate('/lending', { state: { prefillPartner } });
                    }}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <Handshake size={14} />
                    Partner on this Deal
                  </button>
                  {/* Request Financing */}
                  <button
                    onClick={() => {
                      const prefillLoan = {
                        address:      address,
                        purchasePrice: String(costs.land || ''),
                        loanAmount:   '',
                        loanType:     'Land + Home Package',
                        propertyType: 'Manufactured Home',
                        arv:          String(arv || ''),
                        creditScore:  '700+',
                        exitStrategy: 'Sell',
                        notes:        notes,
                        costsOpen:    true,
                        costs: {
                          land:         String(costs.land         || ''),
                          mobileHome:   String(costs.mobileHome   || ''),
                          hudEngineer:  String(costs.hudEngineer  || ''),
                          percTest:     String(costs.percTest     || ''),
                          survey:       String(costs.survey       || ''),
                          footers:      String(costs.footers      || ''),
                          setup:        String(costs.setup        || ''),
                          clearLand:    String(costs.clearLand    || ''),
                          water:        String(costs.water        || ''),
                          septic:       String(costs.septic       || ''),
                          electric:     String(costs.electric     || ''),
                          hvac:         String(costs.hvac         || ''),
                          underpinning: String(costs.underpinning || ''),
                          decks:        String(costs.decks        || ''),
                          driveway:     String(costs.driveway     || ''),
                          landscaping:  String(costs.landscaping  || ''),
                          waterSewer:   String(costs.waterSewer   || ''),
                          mailbox:      String(costs.mailbox      || ''),
                          gutters:      String(costs.gutters      || ''),
                          photos:       String(costs.photos       || ''),
                          mobileTax:    String(costs.mobileTax    || ''),
                          staging:      String(costs.staging      || ''),
                        },
                      };
                      onClose();
                      navigate('/lending', { state: { prefillLoan } });
                    }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <Landmark size={14} />
                    Request Financing
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Deal Card ─────────────────────────────────────────────────────────────────
function LandCard({ deal, onClick }) {
  const [starred, setStarred] = useState(false);
  const netProfit    = calcNetProfit(deal);
  const subdivide    = isSubdividable(deal);
  const landClearing = isLandClearing(deal);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3 cursor-pointer hover:shadow-md transition-all group"
    >
      {/* Drag handle + address + star + grade */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex flex-col gap-0.5 mt-1 opacity-30 group-hover:opacity-60 transition-opacity flex-shrink-0">
          {[0,1,2].map(r => (
            <div key={r} className="flex gap-0.5">
              {[0,1].map(c => <div key={c} className="w-1 h-1 rounded-full bg-gray-400" />)}
            </div>
          ))}
        </div>
        <span className="text-sm font-semibold text-gray-900 leading-snug flex-1">{deal.address}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); setStarred(p => !p); }}
            className={`transition-colors ${starred ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>
          {deal.grade && (
            <span className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
              deal.grade === 'A' ? 'bg-green-100 text-green-700' :
              deal.grade === 'B' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>{deal.grade}</span>
          )}
        </div>
      </div>

      {/* Investor + tags */}
      {(deal.investor || subdivide || landClearing) && (
        <div className="flex flex-wrap gap-1.5 mb-2 ml-4">
          {deal.investor && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 font-medium">
              <User size={10} />
              {deal.investor}
            </span>
          )}
          {landClearing && (() => {
            const s = TAG_STYLES['Land Clearing'];
            return (
              <span style={{ backgroundColor: s.bg, color: s.text }}
                className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border border-current/10">
                <TreePine size={10} />
                Land Clearing
              </span>
            );
          })()}
          {subdivide && (() => {
            const s = TAG_STYLES['Subdivide'];
            return (
              <span style={{ backgroundColor: s.bg, color: s.text }}
                className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border border-current/10">
                <SplitSquareHorizontal size={10} />
                Subdivide
              </span>
            );
          })()}
        </div>
      )}

      {/* ARV */}
      <div className="text-xs text-gray-500 ml-4 mb-1">
        ARV: <span className="font-semibold text-gray-800">${(deal.arv || 0).toLocaleString()}</span>
      </div>

      {/* Profit */}
      <div className="flex items-center gap-1 ml-4 mb-2">
        <DollarSign size={11} className={netProfit >= 0 ? 'text-green-600' : 'text-red-500'} />
        <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          ${Math.abs(netProfit).toLocaleString()}
        </span>
        {deal.financing && (
          <span className="text-xs text-gray-400">({deal.financing})</span>
        )}
      </div>

      {/* County */}
      {deal.county && (
        <div className="ml-4 text-xs text-gray-400">{deal.county} County</div>
      )}
    </div>
  );
}

const LS_KEY = 'lotline_custom_deals';

function loadCustomDeals() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandAcquisition() {
  const navigate = useNavigate();
  const location = useLocation();
  const [customDeals, setCustomDeals] = useState(loadCustomDeals);

  // Re-sync whenever we navigate back to this page
  useEffect(() => {
    setCustomDeals(loadCustomDeals());
  }, [location.key]);

  const allDeals = [...LAND_DEALS, ...customDeals];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-sidebar">Land Acquisition</h1>
        <p className="text-sm text-gray-500 mt-1">{allDeals.length} leads across acquisition pipeline</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {STAGES.map(stage => {
          const meta  = STAGE_META[stage];
          const Icon  = meta.icon;
          const deals = allDeals.filter(d => d.stage === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-80">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: meta.bg }}>
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <h3 className="font-semibold text-gray-700 text-sm">{stage}</h3>
                </div>
                <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                  {deals.length}
                </span>
              </div>

              {/* Cards */}
              <div>
                {deals.map(deal => (
                  <LandCard key={deal.id} deal={deal} onClick={() => navigate(`/deal/${deal.id}`)} />
                ))}
                {deals.length === 0 && (
                  <div className="rounded-2xl p-6 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 bg-white/50">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
