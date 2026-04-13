import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, Archive, ChevronRight, MapPin, ExternalLink,
  CheckSquare, Square, FileText, Upload, AlertCircle, Check,
  ChevronDown, User, Calendar, Building, Phone, Mail
} from 'lucide-react';
import { DEAL_OVERVIEW_DEALS, LAND_DEALS, calcNetProfit } from '../data/deals';
import { HOME_MODELS } from '../data/homeModels';
import { COUNTY_DATA } from '../data/counties';
import { GradeBadge, Tag } from '../components/UI/Badge';

// ── DD tasks ─────────────────────────────────────────────────────────────────
const DD_TASKS = [
  'Perk Test',
  'Confirm Zoning',
  'Confirm Sewer',
  'Confirm Water',
  'Confirm Driveway',
  'Confirm Flood Plain',
  'Request Title Work',
  'Request Survey',
  'Request Insurance Quote',
  'Make Site Plan',
  'Confirm MH Installer Accessibility',
  'Confirm Permit Process',
  'Home Ordered',
  'Building Permit Submitted',
  'Septic Permit Submitted',
  'Well Permit Submitted',
];

// ── Development task groups ───────────────────────────────────────────────────
const DEV_GROUPS = [
  { name: 'Land Clearing', tasks: ['Land cleared'] },
  { name: 'Permits', tasks: ['Permits submitted', 'Permits approved'] },
  { name: 'Mobile Home Order', tasks: ['Order mobile home', 'MH ordered'] },
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
  { key: 'underpinning', label: 'Underpinning' },
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
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium text-gray-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function SelectRow({ label, value, onChange, options }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 max-w-[180px]"
      >
        <option value="">— Select —</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function InputRow({ label, value, onChange, type = 'text', mono }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0 mr-3">{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={`text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 max-w-[200px] w-full text-right ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

const LEAD_SOURCE_OPTIONS = ['Direct Mail', 'Driving for Dollars', 'Wholesaler', 'MLS', 'Referral', 'Cold Call', 'Online/Website', 'FB Market Place', 'Other'];
const OWNER_TYPE_OPTIONS = ['Owner', 'Wholesaler', 'Realtor'];
const UTILITY_SCENARIO_OPTIONS = ['All Utilities Available', 'Well Needed', 'Septic Needed', 'Well & Septic Needed', 'Existing Well', 'Existing Septic', 'Existing Well & Septic'];
const STAGE_OPTIONS = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];
const FINANCING_OPTIONS = ['Hard Money (Land + Home)', 'Hard Money', 'Cash', 'Line of Credit', 'Conventional'];

// ── Tab: Overview ─────────────────────────────────────────────────────────────
function OverviewTab({
  deal, costs, setCosts, notes, setNotes,
  address, setAddress, county, setCounty, dealState, setDealState, zip, setZip, acreage, setAcreage,
  sellerName, setSellerName, ownerName, setOwnerName, investor, setInvestor, financing, setFinancing,
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
  selectedScenario, applyScenario,
  ltcPct, setLtcPct,
  originationPoints, setOriginationPoints,
  creditLimit, setCreditLimit,
  drawPct, setDrawPct,
  annualFeePct, setAnnualFeePct,
  investorProfitSplitPct, setInvestorProfitSplitPct,
}) {
  const activeFinancing = selectedScenario
    ? FINANCING_SCENARIOS.find(s => s.id === selectedScenario)?.financingType
    : deal.financing;
  const allIn = COST_FIELDS.reduce((s, f) => s + (costs[f.key] || 0), 0);
  const sellingCosts = (deal.arv || 0) * 0.045 + 4000;
  const holdingCosts = (deal.holdingMonths || 4) * (deal.holdingPerMonth || 250);
  const netProfit = (deal.arv || 0) - allIn - sellingCosts - holdingCosts;
  const roi = allIn > 0 ? ((netProfit / allIn) * 100).toFixed(1) : '0.0';

  // Financing calculations
  const totalLent = (costs.mobileHome || 0) + (costs.land || 0);
  const monthlyInterest = totalLent * (interestRate / 100) / 12;
  const originationFee = originationFeeType === 'percentage'
    ? totalLent * (originationFeePct / 100)
    : originationFeeFlat;
  const servicingFee = servicingFeeType === 'percentage'
    ? totalLent * (servicingFeePct / 100)
    : servicingFeeFlat;
  const totalCostOfCapital = (monthlyInterest * holdPeriod) + originationFee + servicingFee;
  const profitShareAmount = netProfit * (profitSharePct / 100);

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 space-y-5 min-w-0">

        {/* Notes */}
        <div>
          <SectionHeader>General Notes</SectionHeader>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes about this deal..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
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
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-1">
            <InputRow label="Parcel ID" value={parcelId} onChange={setParcelId} mono />
            <InputRow label="Address" value={address} onChange={setAddress} />
            <InputRow label="County" value={county} onChange={setCounty} />
            <InputRow label="State" value={dealState} onChange={setDealState} />
            <InputRow label="Zip Code" value={zip} onChange={setZip} />
            <InputRow label="Acreage" value={acreage} onChange={setAcreage} type="number" />
            <div className="py-2">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <MapPin size={12} /> Open in Maps <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* Seller Information */}
        <div>
          <SectionHeader>Seller Information</SectionHeader>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-1">
            <InputRow label="Seller Name" value={sellerName} onChange={setSellerName} />
            <InputRow label="Owner Name" value={ownerName} onChange={setOwnerName} />
            <SelectRow label="Lead Source" value={leadSource} onChange={setLeadSource} options={LEAD_SOURCE_OPTIONS} />
            <SelectRow label="Seller Type" value={ownerType} onChange={setOwnerType} options={OWNER_TYPE_OPTIONS} />
          </div>
        </div>

        {/* Deal Evaluation */}
        <div>
          <SectionHeader>Deal Evaluation</SectionHeader>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-1">
            <SelectRow label="Utility Scenario" value={utilityScenario} onChange={setUtilityScenario} options={UTILITY_SCENARIO_OPTIONS} />
            <InputRow label="Water" value={waterCompany} onChange={setWaterCompany} />
            <InputRow label="Sewer" value={sewerCompany} onChange={setSewerCompany} />
            <InputRow label="Electric" value={electricCompany} onChange={setElectricCompany} />
            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">Home Model</span>
              <select
                value={homeModel || ''}
                onChange={e => {
                  const selected = HOME_MODELS.find(m => `${m.manufacturer} - ${m.model}` === e.target.value);
                  setHomeModel(e.target.value);
                  if (selected) setCosts(prev => ({ ...prev, mobileHome: selected.price }));
                }}
                className="text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 max-w-[220px]"
              >
                <option value="">— Select Model —</option>
                {HOME_MODELS.map(m => (
                  <option key={m.id} value={`${m.manufacturer} - ${m.model}`}>
                    {m.manufacturer} – {m.model} ({m.beds}bd/{m.baths}ba, {m.sqft} sqft) — ${m.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <SelectRow label="Subdividable" value={subdividable} onChange={setSubdividable} options={['Yes', 'No']} />
            <SelectRow label="Land Clearing" value={landClearing} onChange={setLandClearing} options={['Yes', 'No']} />
          </div>
        </div>

        {/* Cost Breakdown */}
        <div>
          <SectionHeader>Cost Breakdown</SectionHeader>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {COST_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs text-gray-500 w-40">{label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      value={costs[key] || ''}
                      onChange={e => setCosts(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#1a2332] text-white px-4 py-2.5 flex justify-between">
              <span className="text-sm font-semibold">Total Build Cost</span>
              <span className="text-sm font-bold">${allIn.toLocaleString()}</span>
            </div>
          </div>

          {/* Profit summary under costs */}
          <div className="mt-3 bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Estimated ARV</span>
              <span className="font-medium text-gray-800">${(deal.arv || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Selling Costs (4.5% + $4,000)</span>
              <span className="font-medium text-red-500">-${Math.round(sellingCosts).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Holding Costs ({deal.holdingMonths || 4} mo × ${deal.holdingPerMonth || 250}/mo)</span>
              <span className="font-medium text-red-500">-${holdingCosts.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-gray-200 pt-1.5">
              <span className="font-semibold text-gray-700">Net Profit ({deal.financing})</span>
              <span className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                ${Math.round(netProfit).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">ROI</span>
              <span className={`font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{roi}%</span>
            </div>
          </div>
        </div>

        {/* Closing Details */}
        <div>
          <SectionHeader>Closing Details</SectionHeader>
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-1">
            <InputRow label="Investor" value={investor} onChange={setInvestor} />
            <InputRow label="Closing Attorney" value={closingAttorney} onChange={setClosingAttorney} />
            <InputRow label="Attorney Phone" value={closingAttorneyPhone} onChange={setClosingAttorneyPhone} />
            <InputRow label="Attorney Address" value={closingAttorneyAddress} onChange={setClosingAttorneyAddress} />
            <InputRow label="Closing Date" value={closeDate} onChange={setCloseDate} type="date" />
            <InputRow label="Contract Date" value={contractDate} onChange={setContractDate} type="date" />
          </div>
        </div>

        {/* Financing Scenario */}
        <div>
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

          {/* ── Hard Money Loan ─────────────────────────────── */}
          {activeFinancing === 'Hard Money Loan' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Loan Terms</p>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-500">LTC % (Loan-to-Cost)</span>
                  <input type="number" value={ltcPct} onChange={e => setLtcPct(Number(e.target.value) || 0)}
                    className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-500">Loan Amount</span>
                  <span className="font-medium text-accent">${Math.round(allIn * ltcPct / 100).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-500">Annual Interest Rate (%)</span>
                  <input type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value) || 0)}
                    className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-500">Monthly Interest Payment</span>
                  <span className="font-medium text-gray-800">${Math.round(allIn * ltcPct / 100 * interestRate / 100 / 12).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                  <span className="text-gray-500">Origination Points (%)</span>
                  <input type="number" value={originationPoints} onChange={e => setOriginationPoints(Number(e.target.value) || 0)}
                    className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
                </div>
                <div className="flex justify-between items-center py-1.5 text-xs">
                  <span className="text-gray-500">Loan Term (months)</span>
                  <input type="number" value={balloonTerm} onChange={e => setBalloonTerm(Number(e.target.value) || 0)}
                    className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
                </div>
              </div>
            </div>
          )}

          {/* ── Hard Money (Land + Home) ─────────────────────── */}
          {activeFinancing === 'Hard Money (Land + Home)' && (
            <div className="space-y-4">

              {/* Loan Amount */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Loan Amount</p>
                <div className="space-y-0">
                  <div className="flex justify-between py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Cost of Manufactured Home</span>
                    <span className="font-medium text-gray-800">${(costs.mobileHome || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Cost of Land</span>
                    <span className="font-medium text-gray-800">${(costs.land || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-xs font-semibold">
                    <span className="text-gray-700">Total Amount Lent</span>
                    <span className="text-accent">${totalLent.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Interest */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Interest</p>
                <div className="space-y-0">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Annual Interest Rate (%)</span>
                    <input
                      type="number"
                      value={interestRate}
                      onChange={e => setInterestRate(Number(e.target.value) || 0)}
                      className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">Monthly Interest Payment</span>
                    <span className="font-medium text-gray-800">${Math.round(monthlyInterest).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Origination Fee */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Origination Fee</p>
                  <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setOriginationFeeType('percentage')}
                      className={`px-2.5 py-1 transition-colors ${originationFeeType === 'percentage' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      % of Total
                    </button>
                    <button
                      onClick={() => setOriginationFeeType('flat')}
                      className={`px-2.5 py-1 transition-colors ${originationFeeType === 'flat' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      Flat $
                    </button>
                  </div>
                </div>
                <div className="space-y-0">
                  {originationFeeType === 'percentage' ? (
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                      <span className="text-gray-500">Fee Percentage (%)</span>
                      <input
                        type="number"
                        value={originationFeePct}
                        onChange={e => setOriginationFeePct(Number(e.target.value) || 0)}
                        className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                      <span className="text-gray-500">Flat Amount ($)</span>
                      <input
                        type="number"
                        value={originationFeeFlat}
                        onChange={e => setOriginationFeeFlat(Number(e.target.value) || 0)}
                        className="w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">Calculated Fee</span>
                    <span className="font-medium text-gray-800">${Math.round(originationFee).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Servicing Fee */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicing Fee</p>
                  <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setServicingFeeType('percentage')}
                      className={`px-2.5 py-1 transition-colors ${servicingFeeType === 'percentage' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      % of Total
                    </button>
                    <button
                      onClick={() => setServicingFeeType('flat')}
                      className={`px-2.5 py-1 transition-colors ${servicingFeeType === 'flat' ? 'bg-accent text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                      Flat $
                    </button>
                  </div>
                </div>
                <div className="space-y-0">
                  {servicingFeeType === 'percentage' ? (
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                      <span className="text-gray-500">Fee Percentage (%)</span>
                      <input
                        type="number"
                        value={servicingFeePct}
                        onChange={e => setServicingFeePct(Number(e.target.value) || 0)}
                        className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  ) : (
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                      <span className="text-gray-500">Flat Amount ($)</span>
                      <input
                        type="number"
                        value={servicingFeeFlat}
                        onChange={e => setServicingFeeFlat(Number(e.target.value) || 0)}
                        className="w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">Calculated Fee</span>
                    <span className="font-medium text-gray-800">${Math.round(servicingFee).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Profit Share */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Profit Share</p>
                <div className="space-y-0">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Profit Share (%)</span>
                    <input
                      type="number"
                      value={profitSharePct}
                      onChange={e => setProfitSharePct(Number(e.target.value) || 0)}
                      className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">Profit Share Amount</span>
                    <span className="font-medium text-gray-800">${Math.round(profitShareAmount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Balloon Term & Hold Period */}
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Terms & Hold Period</p>
                <div className="space-y-0">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Balloon Payment Term (months)</span>
                    <input
                      type="number"
                      value={balloonTerm}
                      onChange={e => setBalloonTerm(Number(e.target.value) || 0)}
                      className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Hold Period (months)</span>
                    <input
                      type="number"
                      value={holdPeriod}
                      onChange={e => setHoldPeriod(Number(e.target.value) || 0)}
                      className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1.5 text-xs">
                    <span className="text-gray-500">Monthly Holding Costs ($)</span>
                    <input
                      type="number"
                      value={monthlyHoldCost}
                      onChange={e => setMonthlyHoldCost(Number(e.target.value) || 0)}
                      className="w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[#1a2332] rounded-xl px-4 py-3 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-300 mb-2">Cost of Capital Summary</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Total Amount Lent</span>
                    <span className="font-medium">${totalLent.toLocaleString()}</span>
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
                <div className="space-y-0">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">Capital Deployed Date</span>
                    <input
                      type="date"
                      value={capitalDeployedDate}
                      onChange={e => setCapitalDeployedDate(e.target.value)}
                      className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                  <div className="flex justify-between items-center py-1.5 text-xs">
                    <span className="text-gray-500">Capital Returned Date</span>
                    <input
                      type="date"
                      value={capitalReturnedDate}
                      onChange={e => setCapitalReturnedDate(e.target.value)}
                      className="text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── Line of Credit ──────────────────────────────── */}
          {activeFinancing === 'Line of Credit' && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line of Credit Terms</p>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                <span className="text-gray-500">Credit Limit ($)</span>
                <input type="number" value={creditLimit} onChange={e => setCreditLimit(Number(e.target.value) || 0)}
                  className="w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                <span className="text-gray-500">Draw % (of Credit Limit)</span>
                <input type="number" value={drawPct} onChange={e => setDrawPct(Number(e.target.value) || 0)}
                  className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-50 text-xs">
                <span className="text-gray-500">Draw Amount</span>
                <span className="font-medium text-accent">${Math.round(creditLimit * drawPct / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                <span className="text-gray-500">Annual Interest Rate (%)</span>
                <input type="number" value={interestRate} onChange={e => setInterestRate(Number(e.target.value) || 0)}
                  className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
              </div>
              <div className="flex justify-between items-center py-1.5 text-xs">
                <span className="text-gray-500">Annual Fee (%)</span>
                <input type="number" value={annualFeePct} onChange={e => setAnnualFeePct(Number(e.target.value) || 0)}
                  className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
              </div>
            </div>
          )}

          {/* ── Profit Split ─────────────────────────────────── */}
          {activeFinancing === 'Profit Split' && (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Profit Split Terms</p>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
                <span className="text-gray-500">Investor Profit Split (%)</span>
                <input type="number" value={investorProfitSplitPct} onChange={e => setInvestorProfitSplitPct(Number(e.target.value) || 0)}
                  className="w-20 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30" />
              </div>
              <div className="flex justify-between py-1.5 text-xs">
                <span className="text-gray-500">Investor Split Amount</span>
                <span className="font-medium text-accent">${Math.round(netProfit * investorProfitSplitPct / 100).toLocaleString()}</span>
              </div>
            </div>
          )}

        </div>

        {/* Scenario Comparison */}
        <div>
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
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right sidebar — documents */}
      <div className="w-64 flex-shrink-0 space-y-4">
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
      </div>
    </div>
  );
}

// ── Tab: Due Diligence ────────────────────────────────────────────────────────
function DDTab({ deal, ddTasks, setDdTasks }) {
  const complete = ddTasks.filter(Boolean).length;
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1a2332]">Due Diligence Tasks</h3>
        <span className="text-sm text-gray-500">{complete} / {DD_TASKS.length} Complete</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        {DD_TASKS.map((task, i) => (
          <div
            key={task}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => setDdTasks(prev => { const n = [...prev]; n[i] = !n[i]; return n; })}
          >
            {ddTasks[i]
              ? <CheckSquare size={18} className="text-green-500 flex-shrink-0" />
              : <Square size={18} className="text-gray-300 flex-shrink-0" />
            }
            <span className={`text-sm ${ddTasks[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task}</span>
            {ddTasks[i] && <span className="ml-auto text-xs text-green-500 font-medium">Complete</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-green-700">Progress</span>
          <span className="text-sm font-bold text-green-700">{complete}/{DD_TASKS.length}</span>
        </div>
        <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${(complete / DD_TASKS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Tab: Development ──────────────────────────────────────────────────────────
function DevTab({ devTasks, setDevTasks }) {
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
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setDevTasks(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; })}
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
function RealizedTab({ realized, setRealized }) {
  const total = COST_FIELDS.reduce((s, f) => s + (realized[f.key] || 0), 0);
  return (
    <div className="max-w-lg">
      <h3 className="font-semibold text-[#1a2332] mb-4">Realized Expenses</h3>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {COST_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-gray-500 w-40">{label}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">$</span>
                <input
                  type="number"
                  value={realized[key] || ''}
                  onChange={e => setRealized(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-28 text-right text-xs font-medium text-gray-800 bg-gray-50 border border-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#1a2332] text-white px-4 py-2.5 flex justify-between">
          <span className="text-sm font-semibold">Total Realized</span>
          <span className="text-sm font-bold">${total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Financing scenario types (matching Lovable CRM) ──────────────────────────
const FINANCING_SCENARIOS = [
  { id: 'cash',                label: 'Cash',                    financingType: 'Cash' },
  { id: 'hard-money-loan',     label: 'Hard Money Loan',         financingType: 'Hard Money Loan' },
  { id: 'hard-money-land-home',label: 'Hard Money (Land + Home)',financingType: 'Hard Money (Land + Home)' },
  { id: 'loc',                 label: 'Line of Credit',          financingType: 'Line of Credit' },
  { id: 'profit-split',        label: 'Profit Split',            financingType: 'Profit Split' },
];

// ── Per-investor default terms ────────────────────────────────────────────────
function getDefaultRate(investor) {
  if (investor === 'Atium Build Group LLC') return 13;
  if (investor === 'Louis Isom') return 13;
  if (investor === 'Blue Bay Capital') return 14;
  if (investor === 'Windstone') return 14;
  return 12;
}

// ── Main DealDetail ───────────────────────────────────────────────────────────
export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const deal = [...DEAL_OVERVIEW_DEALS, ...LAND_DEALS].find(d => d.id === id);

  // Initial costs from deal data
  const initCosts = {};
  COST_FIELDS.forEach(f => { initCosts[f.key] = deal?.[f.key] || 0; });

  // Initial DD tasks — seed from ddTasksCompleted array on the deal
  const completedSet = new Set(deal?.ddTasksCompleted || []);
  const initDD = DD_TASKS.map(task => completedSet.has(task));

  // Initial dev tasks — Swanson has 1/38 complete (land cleared)
  const totalDevTasks = DEV_GROUPS.flatMap(g => g.tasks).length;
  const initDev = Array(totalDevTasks).fill(false).map((_, i) =>
    deal?.id === 'deal-020' ? i === 0 : false
  );

  const [activeTab, setActiveTab] = useState('overview');
  const [costs, setCosts] = useState(initCosts);
  const [notes, setNotes] = useState(deal?.notes || '');
  const [ddTasks, setDdTasks] = useState(initDD);
  const [devTasks, setDevTasks] = useState(initDev);
  const [realized, setRealized] = useState({});
  const [starred, setStarred] = useState(false);
  const [stage, setStage] = useState(deal?.stage || 'Contract Signed');
  const [leadSource, setLeadSource] = useState(deal?.leadSource || '');
  const [ownerType, setOwnerType] = useState(deal?.ownerType || '');
  const [utilityScenario, setUtilityScenario] = useState(deal?.utilityScenario || '');

  // Property Information
  const [address, setAddress] = useState(deal?.address || '');
  const [county, setCounty] = useState(deal?.county || '');
  const [dealState, setDealState] = useState(deal?.state || '');
  const [zip, setZip] = useState(deal?.zip || '');
  const [acreage, setAcreage] = useState(deal?.acreage?.toString() || '');

  // Seller Information
  const [sellerName, setSellerName] = useState(deal?.sellerName || '');
  const [ownerName, setOwnerName] = useState(deal?.ownerName || '');
  const [investor, setInvestor] = useState(deal?.investor || '');
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
  const [landClearing, setLandClearing] = useState((deal?.tags || []).includes('Land Clearing') ? 'Yes' : 'No');

  // Persist subdivide state so the kanban card reflects it
  const handleSetSubdividable = (val) => {
    setSubdividable(val);
    if (deal?.id) localStorage.setItem(`lotline_subdivide_${deal.id}`, val);
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

  // Financing scenario state
  const [selectedScenario, setSelectedScenario] = useState('');
  const [interestRate, setInterestRate] = useState(getDefaultRate(deal?.investor));
  const [originationFeeType, setOriginationFeeType] = useState('percentage');
  const [originationFeePct, setOriginationFeePct] = useState(
    deal?.investor === 'Louis Isom' || deal?.investor === 'Blue Bay Capital' || deal?.investor === 'Windstone' ? 3 : 0
  );
  const [originationFeeFlat, setOriginationFeeFlat] = useState(0);
  const [servicingFeeType, setServicingFeeType] = useState('flat');
  const [servicingFeeFlat, setServicingFeeFlat] = useState(deal?.investor === 'Louis Isom' ? 750 : 0);
  const [servicingFeePct, setServicingFeePct] = useState(0);
  const [balloonTerm, setBalloonTerm] = useState(12);
  const [holdPeriod, setHoldPeriod] = useState(deal?.holdingMonths || 6);
  const [monthlyHoldCost, setMonthlyHoldCost] = useState(deal?.holdingPerMonth || 250);
  const [profitSharePct, setProfitSharePct] = useState(deal?.investor === 'Atium Build Group LLC' ? 5 : 0);
  const [capitalDeployedDate, setCapitalDeployedDate] = useState('');
  const [capitalReturnedDate, setCapitalReturnedDate] = useState('');

  // Hard Money Loan specific
  const [ltcPct, setLtcPct] = useState(0);
  const [originationPoints, setOriginationPoints] = useState(0);
  // Line of Credit specific
  const [creditLimit, setCreditLimit] = useState(0);
  const [drawPct, setDrawPct] = useState(0);
  const [annualFeePct, setAnnualFeePct] = useState(0);
  // Profit Split specific
  const [investorProfitSplitPct, setInvestorProfitSplitPct] = useState(0);

  function applyScenario(scenarioId) {
    setSelectedScenario(scenarioId);
  }

  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">Deal not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-accent underline text-sm">Go Back</button>
      </div>
    );
  }

  const allIn = COST_FIELDS.reduce((s, f) => s + (costs[f.key] || 0), 0);
  const sellingCosts = (deal.arv || 0) * 0.045 + 4000;
  const holdingCosts = (deal.holdingMonths || 4) * (deal.holdingPerMonth || 250);
  const netProfit = (deal.arv || 0) - allIn - sellingCosts - holdingCosts;
  const ddComplete = ddTasks.filter(Boolean).length;
  const devComplete = devTasks.filter(Boolean).length;
  const devTotal = DEV_GROUPS.flatMap(g => g.tasks).length;

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'dd', label: `Due Diligence (${ddComplete}/${DD_TASKS.length})` },
    { key: 'dev', label: `Development (${devComplete}/${devTotal})` },
    { key: 'realized', label: 'Realized Expenses' },
  ];

  const STAGE_ORDER = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];
  const currentStageIdx = STAGE_ORDER.indexOf(stage);
  const nextStage = STAGE_ORDER[currentStageIdx + 1];

  return (
    <div className="min-h-screen" style={{ background: '#f5f3ee' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Pipeline
          </button>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-sm text-gray-400">Deal Overview</span>
          <ChevronRight size={14} className="text-gray-300" />
          <span className="text-sm text-gray-600 font-medium truncate max-w-xs">{deal.address}</span>
        </div>

        <div className="flex items-start justify-between mt-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1a2332]">{deal.address}</h1>
            <GradeBadge grade={deal.grade} />
            {(deal.tags || []).map(t => <Tag key={t} type={t}>{t}</Tag>)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStarred(s => !s)}
              className={`p-2 rounded-lg transition-colors ${starred ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-500'}`}
            >
              <Star size={18} fill={starred ? 'currentColor' : 'none'} />
            </button>
            <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
              <Archive size={14} /> Archive
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">ARV</p>
            <p className="text-sm font-bold text-[#1a2332]">${(deal.arv || 0).toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Net Profit</p>
            <p className={`text-sm font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              ${Math.round(netProfit).toLocaleString()}
            </p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Financing</p>
            <p className="text-sm font-bold text-[#1a2332]">{deal.financing}</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Investor</p>
            <p className="text-sm font-bold text-[#1a2332]">{deal.investor || 'TBD'}</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Stage</p>
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="text-sm font-semibold text-[#1a2332] bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {nextStage && (
            <div className="ml-auto">
              <button
                onClick={() => setStage(nextStage)}
                className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
              >
                → {nextStage}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
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
      <div className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            deal={deal} costs={costs} setCosts={setCosts} notes={notes} setNotes={setNotes}
            address={address} setAddress={setAddress} county={county} setCounty={setCounty}
            dealState={dealState} setDealState={setDealState} zip={zip} setZip={setZip}
            acreage={acreage} setAcreage={setAcreage}
            sellerName={sellerName} setSellerName={setSellerName}
            ownerName={ownerName} setOwnerName={setOwnerName}
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
            landClearing={landClearing} setLandClearing={setLandClearing}
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
            selectedScenario={selectedScenario} applyScenario={applyScenario}
            ltcPct={ltcPct} setLtcPct={setLtcPct}
            originationPoints={originationPoints} setOriginationPoints={setOriginationPoints}
            creditLimit={creditLimit} setCreditLimit={setCreditLimit}
            drawPct={drawPct} setDrawPct={setDrawPct}
            annualFeePct={annualFeePct} setAnnualFeePct={setAnnualFeePct}
            investorProfitSplitPct={investorProfitSplitPct} setInvestorProfitSplitPct={setInvestorProfitSplitPct}
          />
        )}
        {activeTab === 'dd' && (
          <DDTab deal={deal} ddTasks={ddTasks} setDdTasks={setDdTasks} />
        )}
        {activeTab === 'dev' && (
          <DevTab devTasks={devTasks} setDevTasks={setDevTasks} />
        )}
        {activeTab === 'realized' && (
          <RealizedTab realized={realized} setRealized={setRealized} />
        )}
      </div>
    </div>
  );
}
