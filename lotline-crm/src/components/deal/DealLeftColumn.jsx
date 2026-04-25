/**
 * Left column of the HubSpot-style deal detail layout.
 * "Information" — deal header, quick action row, editable About fields,
 * property quick stats, capital position mini.
 */
import { useState } from 'react';
import {
  MapPin, ChevronDown, ChevronRight,
  Edit3, Check, X, StickyNote, Mail, Phone, CheckSquare,
  CalendarPlus, Layers, Home, DollarSign, TrendingUp,
  MessageSquare,
} from 'lucide-react';

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableField({ label, value, onChange, type = 'text', options, readOnly, mono, prefix }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || '');

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (readOnly) {
    return (
      <div className="py-1.5 flex items-center justify-between border-b border-gray-50 last:border-0">
        <span className="text-[11px] text-gray-400 font-medium w-28 flex-shrink-0">{label}</span>
        <span className={`text-[13px] text-gray-800 font-medium text-right flex-1 ${mono ? 'font-mono' : ''}`}>
          {prefix && value ? prefix : ''}{value || <span className="text-gray-300">—</span>}
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="py-1.5 border-b border-gray-50 last:border-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">{label}</p>
        <div className="flex items-center gap-1">
          {options
            ? (
              <select
                value={draft}
                onChange={e => setDraft(e.target.value)}
                autoFocus
                className="flex-1 text-[13px] text-gray-800 bg-white border border-accent/60 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                className={`flex-1 text-[13px] text-gray-800 bg-white border border-accent/60 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent/20 ${mono ? 'font-mono' : ''}`}
              />
            )
          }
          <button onClick={commit} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check size={13} />
          </button>
          <button onClick={cancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="py-1.5 flex items-center justify-between border-b border-gray-50 last:border-0 group cursor-pointer hover:bg-gray-50/80 rounded px-1 -mx-1 transition-colors"
      onClick={() => { setDraft(value || ''); setEditing(true); }}
    >
      <span className="text-[11px] text-gray-400 font-medium w-28 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className={`text-[13px] text-gray-800 font-medium truncate ${mono ? 'font-mono' : ''}`}>
          {value
            ? <>{prefix || ''}{value}</>
            : <span className="text-gray-300 italic text-[12px]">—</span>
          }
        </span>
        <Edit3 size={11} className="text-gray-300 group-hover:text-accent opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50/60 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</span>
          {badge != null && (
            <span className="text-[10px] font-bold text-accent bg-accent/10 rounded-full px-1.5 py-0.5">{badge}</span>
          )}
        </div>
        {open
          ? <ChevronDown size={13} className="text-gray-300 group-hover:text-gray-500" />
          : <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500" />
        }
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors flex-1 group"
    >
      <div className="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-accent/10 flex items-center justify-center transition-colors">
        <Icon size={14} className="text-gray-500 group-hover:text-accent transition-colors" />
      </div>
      <span className="text-[10px] text-gray-500 font-medium group-hover:text-accent transition-colors whitespace-nowrap">{label}</span>
    </button>
  );
}

// ── Stage badge color map ─────────────────────────────────────────────────────
const STAGE_COLORS = {
  'New Lead':            'bg-gray-100 text-gray-600 border-gray-200',
  'Underwriting':        'bg-blue-50 text-blue-700 border-blue-200',
  'Negotiating':         'bg-amber-50 text-amber-700 border-amber-200',
  'Waiting on Contract': 'bg-orange-50 text-orange-700 border-orange-200',
  'Contract Signed':     'bg-purple-50 text-purple-700 border-purple-200',
  'Due Diligence':       'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Development':         'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Complete':            'bg-green-50 text-green-700 border-green-200',
};

// ── Note compose mini modal ───────────────────────────────────────────────────
function NoteComposer({ dealId, onClose }) {
  const [text, setText] = useState('');
  const save = () => {
    if (!text.trim()) { onClose(); return; }
    const notes = JSON.parse(localStorage.getItem(`lotline_notes_${dealId}`) || '[]');
    notes.unshift({ id: Date.now(), text: text.trim(), createdAt: new Date().toISOString() });
    localStorage.setItem(`lotline_notes_${dealId}`, JSON.stringify(notes));
    onClose();
  };
  return (
    <div className="absolute inset-x-0 top-full z-50 mx-3 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 p-3">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add a note…"
        rows={3}
        className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
        <button onClick={save} className="text-xs text-white bg-accent px-3 py-1.5 rounded-lg hover:bg-accent/90 font-semibold">Save Note</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DealLeftColumn({
  deal,
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
  netProfit,
  allIn,
  roi,
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
  onCreateTask,
  onLogCall,
  onSendEmail,
  onScheduleMeeting,
}) {
  const [showNote, setShowNote]     = useState(false);
  const [stageEditing, setStageEditing] = useState(false);

  const fmt    = n => n == null || isNaN(n) ? '—' : `$${Math.round(n).toLocaleString()}`;
  const fmtPct = n => n == null || isNaN(n) ? '—' : `${Math.round(n)}%`;

  const stageBadge = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col text-sm">

      {/* Deal identity header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="text-[15px] font-bold text-[#1a2332] leading-snug flex-1 min-w-0 line-clamp-2">
            {address || deal.address || 'Untitled Deal'}
          </h2>
          {/* Stage badge / editor */}
          {stageEditing && !readOnly
            ? (
              <select
                value={stage}
                onChange={e => { setStage(e.target.value); setStageEditing(false); }}
                onBlur={() => setStageEditing(false)}
                autoFocus
                className="text-[11px] font-semibold rounded-full px-2 py-0.5 border focus:outline-none bg-white border-accent/60"
              >
                {(stageOptions || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )
            : (
              <button
                onClick={() => !readOnly && setStageEditing(true)}
                className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${stageBadge} ${!readOnly ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
              >
                {stage}
              </button>
            )
          }
        </div>
        {/* Location sub-line */}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
          {county && <span className="flex items-center gap-0.5"><MapPin size={10} />{county}{dealState ? `, ${dealState}` : ''}</span>}
          {acreage && <span className="flex items-center gap-0.5"><Layers size={10} />{acreage} ac</span>}
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
        {[
          { label: 'All-In',    value: fmt(allIn),     color: 'text-[#1a2332]'  },
          { label: 'ARV',       value: fmt(arv),       color: 'text-[#1a2332]'  },
          { label: 'Net Profit',value: fmt(netProfit), color: netProfit > 0 ? 'text-green-600' : netProfit < 0 ? 'text-red-500' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="py-2.5 px-2 text-center">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">{s.label}</p>
            <p className={`text-[13px] font-bold ${s.color} leading-none`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick action row */}
      {!readOnly && (
        <div className="relative flex border-b border-gray-100 flex-shrink-0 px-1 py-1">
          <ActionBtn icon={StickyNote}  label="Note"    onClick={() => setShowNote(n => !n)} />
          <ActionBtn icon={Mail}        label="Email"   onClick={onSendEmail}    />
          <ActionBtn icon={Phone}       label="Call"    onClick={onLogCall}      />
          <ActionBtn icon={CheckSquare} label="Task"    onClick={onCreateTask}   />
          <ActionBtn icon={CalendarPlus}label="Meeting" onClick={onScheduleMeeting} />
          {showNote && (
            <NoteComposer dealId={deal.id} onClose={() => setShowNote(false)} />
          )}
        </div>
      )}

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">

        {/* About */}
        <Section title="About this deal">
          <EditableField label="Address"     value={address}    onChange={v => { setAddress(v);    saveNow({ address: v });    }} readOnly={readOnly} />
          <EditableField label="County"      value={county}     onChange={v => { setCounty(v);     saveNow({ county: v });     }} readOnly={readOnly} />
          <EditableField label="State"       value={dealState}  onChange={v => { setDealState(v);  saveNow({ state: v });      }} readOnly={readOnly} />
          <EditableField label="Zip"         value={zip}        onChange={v => { setZip(v);        saveNow({ zip: v });        }} readOnly={readOnly} />
          <EditableField label="Parcel ID"   value={parcelId}   onChange={v => { setParcelId(v);   saveNow({ parcelId: v });   }} readOnly={readOnly} mono />
          <EditableField label="Acreage"     value={acreage ? String(acreage) : ''} onChange={v => { setAcreage(v); saveNow({ acreage: v }); }} type="number" readOnly={readOnly} />
          <EditableField label="ARV"         value={arv ? String(arv) : ''} onChange={v => { setArv(Number(v)); saveNow({ arv: Number(v) }); }} type="number" prefix="$" readOnly={readOnly} />
          <EditableField label="Lead Source" value={leadSource} onChange={v => { setLeadSource(v); saveNow({ leadSource: v }); }} options={LEAD_SOURCE_OPTIONS} readOnly={readOnly} />
          <EditableField label="Owner Type"  value={ownerType}  onChange={v => { setOwnerType(v);  saveNow({ ownerType: v });  }} options={OWNER_TYPE_OPTIONS} readOnly={readOnly} />
          <EditableField label="Utilities"   value={utilityScenario} onChange={v => { setUtilityScenario(v); saveNow({ utilityScenario: v }); }} options={UTILITY_SCENARIO_OPTIONS} readOnly={readOnly} />
        </Section>

        {/* Seller / Owner */}
        <Section title="Seller / Owner" defaultOpen={false}>
          <EditableField label="Owner Name"  value={ownerName}   onChange={v => { setOwnerName(v);   saveNow({ ownerName: v });   }} readOnly={readOnly} />
          <EditableField label="Seller Name" value={sellerName}  onChange={v => { setSellerName(v);  saveNow({ sellerName: v });  }} readOnly={readOnly} />
          <EditableField label="Phone"       value={phone}       onChange={v => { setPhone(v);       saveNow({ phone: v });       }} type="tel"   readOnly={readOnly} />
          <EditableField label="Email"       value={email}       onChange={v => { setEmail(v);       saveNow({ email: v });       }} type="email" readOnly={readOnly} />
        </Section>

        {/* Financing */}
        <Section title="Financing" defaultOpen={false}>
          <EditableField label="Type"     value={financing} onChange={v => { setFinancing(v); saveNow({ financing: v }); }} options={FINANCING_OPTIONS} readOnly={readOnly} />
          <EditableField label="Investor" value={investor}  onChange={v => { setInvestor(v);  saveNow({ investor: v });  }} readOnly={readOnly} />
        </Section>

        {/* Closing */}
        <Section title="Closing" defaultOpen={false}>
          <EditableField label="Contract Date" value={contractDate}   onChange={v => { setContractDate(v);   saveNow({ contractDate: v });   }} type="date" readOnly={readOnly} />
          <EditableField label="Close Date"    value={closeDate}      onChange={v => { setCloseDate(v);      saveNow({ closeDate: v });      }} type="date" readOnly={readOnly} />
          <EditableField label="Attorney"      value={closingAttorney} onChange={v => { setClosingAttorney(v); saveNow({ closingAttorney: v }); }} readOnly={readOnly} />
        </Section>

        {/* Cost breakdown */}
        <Section title="Cost Breakdown" defaultOpen={false} badge={allIn > 0 ? `$${Math.round(allIn / 1000)}k` : null}>
          <div className="space-y-0">
            {(COST_FIELDS || []).map(f => (
              costs[f.key] > 0 && (
                <div key={f.key} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                  <span className="text-[12px] text-gray-500">{f.label}</span>
                  <span className="text-[12px] font-semibold text-gray-700">{fmt(costs[f.key])}</span>
                </div>
              )
            ))}
            <div className="flex items-center justify-between py-2 border-t border-gray-200 mt-1">
              <span className="text-[12px] font-bold text-gray-700">Total All-In</span>
              <span className="text-[12px] font-bold text-[#1a2332]">{fmt(allIn)}</span>
            </div>
            {arv > 0 && (
              <div className="flex items-center justify-between py-1">
                <span className="text-[12px] text-gray-500">ROI</span>
                <span className={`text-[12px] font-semibold ${roi > 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtPct(roi)}</span>
              </div>
            )}
          </div>
        </Section>

        {/* Map action */}
        {!readOnly && (
          <div className="px-4 py-3">
            <button
              onClick={onOpenMapSearch}
              className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium text-gray-500 border border-gray-200 rounded-lg py-2 hover:border-accent hover:text-accent transition-colors"
            >
              <MapPin size={12} /> View on Map
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
