/**
 * Left column of the HubSpot-style deal detail layout.
 * "Information" — deal header, quick actions, editable About fields,
 * property stats, capital position mini.
 */
import { useState } from 'react';
import {
  MapPin, Phone, Mail, User, Building, Calendar, FileText,
  Layers, Zap, Droplets, Home, ChevronDown, ChevronRight,
  Edit3, Check, X, ExternalLink,
} from 'lucide-react';
import { GradeBadge } from '../UI/Badge';

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableField({ label, value, onChange, type = 'text', options, readOnly, mono }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value || '');
    setEditing(false);
  };

  if (readOnly) {
    return (
      <div className="py-1.5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
        <p className={`text-sm text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>{value || <span className="text-gray-300 italic">—</span>}</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="py-1.5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
        <div className="flex items-center gap-1">
          {options
            ? (
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                autoFocus
                className="flex-1 text-sm text-gray-800 bg-white border border-accent/60 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option value="">— Select —</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )
            : (
              <input
                type={type}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                autoFocus
                className={`flex-1 text-sm text-gray-800 bg-white border border-accent/60 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/30 ${mono ? 'font-mono' : ''}`}
              />
            )
          }
          <button onClick={commit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
          <button onClick={cancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="py-1.5 group relative cursor-pointer rounded-lg px-1 -mx-1 hover:bg-gray-50 transition-colors"
      onClick={() => { setDraft(value || ''); setEditing(true); }}
    >
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <div className="flex items-center justify-between">
        <p className={`text-sm text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>
          {value || <span className="text-gray-300 italic">—</span>}
        </p>
        <Edit3 size={12} className="text-gray-300 group-hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Deal stage badge ──────────────────────────────────────────────────────────
const STAGE_COLORS = {
  'New Lead':            'bg-gray-100 text-gray-600',
  'Underwriting':        'bg-blue-50 text-blue-700',
  'Negotiating':         'bg-amber-50 text-amber-700',
  'Waiting on Contract': 'bg-orange-50 text-orange-700',
  'Contract Signed':     'bg-purple-50 text-purple-700',
  'Due Diligence':       'bg-indigo-50 text-indigo-700',
  'Development':         'bg-cyan-50 text-cyan-700',
  'Complete':            'bg-green-50 text-green-700',
};

export default function DealLeftColumn({
  deal,
  // editable fields
  stage, setStage,
  address, setAddress,
  county, setCounty,
  dealState, setDealState,
  zip, setZip,
  parcelId, setParcelId,
  acreage, setAcreage,
  arv, setArv,
  costs, setCosts,
  ownerName, setOwnerName,
  sellerName, setSellerName,
  phone, setPhone,
  email, setEmail,
  leadSource, setLeadSource,
  ownerType, setOwnerType,
  utilityScenario, setUtilityScenario,
  homeModel, setHomeModel,
  closingAttorney, setClosingAttorney,
  closeDate, setCloseDate,
  contractDate, setContractDate,
  financing, setFinancing,
  investor, setInvestor,
  // computed
  netProfit,
  allIn,
  roi,
  // config
  readOnly,
  canEdit,
  stageOptions,
  LEAD_SOURCE_OPTIONS,
  OWNER_TYPE_OPTIONS,
  UTILITY_SCENARIO_OPTIONS,
  FINANCING_OPTIONS,
  COST_FIELDS,
  saveNow,
  onOpenMapSearch,
  investorList,
}) {
  const stageBadge = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600';

  const fmt = (n) => n == null || isNaN(n) ? '—' : `$${Math.round(n).toLocaleString()}`;
  const fmtPct = (n) => n == null || isNaN(n) ? '—' : `${Math.round(n)}%`;

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">
      {/* Deal name + stage */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="text-base font-bold text-[#1a2332] leading-snug flex-1 min-w-0">
            {deal.address || 'Untitled Deal'}
          </h2>
          <span className={`flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${stageBadge}`}>
            {stage}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {deal.acreage && <span className="flex items-center gap-1"><Layers size={11} />{deal.acreage} ac</span>}
          {deal.county && <span className="flex items-center gap-1"><MapPin size={11} />{deal.county}, {deal.state || dealState}</span>}
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 border-b border-gray-100">
        {[
          { label: 'All-In', value: fmt(allIn) },
          { label: 'ARV',    value: fmt(arv) },
          { label: 'Net',    value: fmt(netProfit), positive: netProfit > 0 },
        ].map(stat => (
          <div key={stat.label} className="py-2.5 px-3 text-center border-r border-gray-100 last:border-r-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{stat.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${stat.positive != null ? (stat.positive ? 'text-green-600' : 'text-red-500') : 'text-[#1a2332]'}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="flex-1">

        {/* About */}
        <Section title="About this deal">
          <EditableField label="Address" value={address} onChange={v => { setAddress(v); saveNow({ address: v }); }} readOnly={readOnly} />
          <EditableField label="County" value={county} onChange={v => { setCounty(v); saveNow({ county: v }); }} readOnly={readOnly} />
          <EditableField label="State" value={dealState} onChange={v => { setDealState(v); saveNow({ state: v }); }} readOnly={readOnly} />
          <EditableField label="Zip" value={zip} onChange={v => { setZip(v); saveNow({ zip: v }); }} readOnly={readOnly} />
          <EditableField label="Parcel ID" value={parcelId} onChange={v => { setParcelId(v); saveNow({ parcelId: v }); }} readOnly={readOnly} mono />
          <EditableField label="Acreage" value={acreage ? String(acreage) : ''} onChange={v => { setAcreage(v); saveNow({ acreage: v }); }} type="number" readOnly={readOnly} />
          <EditableField label="ARV" value={arv ? String(arv) : ''} onChange={v => { setArv(Number(v)); saveNow({ arv: Number(v) }); }} type="number" readOnly={readOnly} />
          <EditableField label="Lead Source" value={leadSource} onChange={v => { setLeadSource(v); saveNow({ leadSource: v }); }} options={LEAD_SOURCE_OPTIONS} readOnly={readOnly} />
          <EditableField label="Owner Type" value={ownerType} onChange={v => { setOwnerType(v); saveNow({ ownerType: v }); }} options={OWNER_TYPE_OPTIONS} readOnly={readOnly} />
          <EditableField label="Utilities" value={utilityScenario} onChange={v => { setUtilityScenario(v); saveNow({ utilityScenario: v }); }} options={UTILITY_SCENARIO_OPTIONS} readOnly={readOnly} />
        </Section>

        {/* Contacts */}
        <Section title="Seller / Owner">
          <EditableField label="Owner Name" value={ownerName} onChange={v => { setOwnerName(v); saveNow({ ownerName: v }); }} readOnly={readOnly} />
          <EditableField label="Seller Name" value={sellerName} onChange={v => { setSellerName(v); saveNow({ sellerName: v }); }} readOnly={readOnly} />
          <EditableField label="Phone" value={phone} onChange={v => { setPhone(v); saveNow({ phone: v }); }} type="tel" readOnly={readOnly} />
          <EditableField label="Email" value={email} onChange={v => { setEmail(v); saveNow({ email: v }); }} type="email" readOnly={readOnly} />
        </Section>

        {/* Financing */}
        <Section title="Financing" defaultOpen={false}>
          <EditableField label="Financing Type" value={financing} onChange={v => { setFinancing(v); saveNow({ financing: v }); }} options={FINANCING_OPTIONS} readOnly={readOnly} />
          <EditableField label="Investor / Lender" value={investor} onChange={v => { setInvestor(v); saveNow({ investor: v }); }} readOnly={readOnly} />
        </Section>

        {/* Closing */}
        <Section title="Closing" defaultOpen={false}>
          <EditableField label="Contract Date" value={contractDate} onChange={v => { setContractDate(v); saveNow({ contractDate: v }); }} type="date" readOnly={readOnly} />
          <EditableField label="Close Date" value={closeDate} onChange={v => { setCloseDate(v); saveNow({ closeDate: v }); }} type="date" readOnly={readOnly} />
          <EditableField label="Closing Attorney" value={closingAttorney} onChange={v => { setClosingAttorney(v); saveNow({ closingAttorney: v }); }} readOnly={readOnly} />
        </Section>

        {/* Cost breakdown mini */}
        <Section title="Cost Breakdown" defaultOpen={false}>
          <div className="space-y-0">
            {COST_FIELDS.map(f => (
              <div key={f.key} className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-500">{f.label}</span>
                <span className="text-xs font-semibold text-gray-800">{fmt(costs[f.key])}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-1.5 border-t border-gray-100 mt-1">
              <span className="text-xs font-bold text-gray-700">Total All-In</span>
              <span className="text-xs font-bold text-[#1a2332]">{fmt(allIn)}</span>
            </div>
          </div>
        </Section>

        {/* Property actions */}
        {!readOnly && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={onOpenMapSearch}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-accent border border-accent/30 rounded-lg py-2 hover:bg-accent/5 transition-colors"
            >
              <MapPin size={13} /> View on Map
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
