/**
 * Left column of the HubSpot-style deal detail layout.
 * "Information" — deal header, quick action row, editable About fields,
 * property quick stats, capital position mini.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, ChevronDown, ChevronRight,
  Edit3, Check, X, StickyNote, Mail, Phone, CheckSquare,
  CalendarPlus, Layers, Settings2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import CustomizeRecordDrawer from './CustomizeRecordDrawer';

// ── Default section definitions ───────────────────────────────────────────────
const DEFAULT_SECTIONS = [
  { key: 'about',          label: 'About this deal', visible: true, order: 0 },
  { key: 'seller',         label: 'Seller / Owner',  visible: true, order: 1 },
  { key: 'financing',      label: 'Financing',       visible: true, order: 2 },
  { key: 'closing',        label: 'Closing',         visible: true, order: 3 },
];

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableField({ label, value, onChange, type = 'text', options, readOnly, mono, prefix }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || '');

  const commit = () => { onChange(draft); setEditing(false); };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (readOnly) {
    return (
      <div className="py-1.5 flex items-start justify-between border-b border-gray-50 last:border-0">
        <span className="text-[11px] text-gray-400 font-medium w-28 flex-shrink-0 pt-0.5">{label}</span>
        <span className={`text-[13px] text-gray-800 font-medium text-right flex-1 min-w-0 break-words ${mono ? 'font-mono' : ''}`}>
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
      className="py-1.5 flex items-start justify-between border-b border-gray-50 last:border-0 group cursor-pointer hover:bg-gray-50/80 rounded px-1 -mx-1 transition-colors"
      onClick={() => { setDraft(value || ''); setEditing(true); }}
    >
      <span className="text-[11px] text-gray-400 font-medium w-28 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex items-start gap-1.5 flex-1 justify-end min-w-0">
        <span className={`text-[13px] text-gray-800 font-medium break-words text-right min-w-0 ${mono ? 'font-mono' : ''}`}>
          {value
            ? <>{prefix || ''}{value}</>
            : <span className="text-gray-300 italic text-[12px]">—</span>
          }
        </span>
        <Edit3 size={11} className="text-gray-300 group-hover:text-accent opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity mt-0.5" />
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, defaultOpen = true, children, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionId = `section-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={sectionId}
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
      {open && <div id={sectionId} className="px-4 pb-3">{children}</div>}
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

// Default stage probabilities (overridden by org settings from stage_probabilities table)
const DEFAULT_PROBABILITIES = {
  'New Lead':            5,
  'Underwriting':        15,
  'Negotiating':         30,
  'Waiting on Contract': 50,
  'Contract Signed':     75,
  'Due Diligence':       80,
  'Development':         90,
  'Complete':            100,
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

// ── Supabase persistence for section layout ───────────────────────────────────
const ENTITY   = 'deal';
const COL_KEY  = 'left';

async function loadSectionPrefs(userId, orgId) {
  if (!supabase || !userId || !orgId) return null;
  const { data } = await supabase
    .from('record_layout_preferences')
    .select('sections')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .eq('entity', ENTITY)
    .eq('column_key', COL_KEY)
    .maybeSingle();
  return data?.sections ?? null;
}

async function saveSectionPrefs(userId, orgId, sections) {
  if (!supabase || !userId || !orgId) return;
  await supabase
    .from('record_layout_preferences')
    .upsert(
      { user_id: userId, organization_id: orgId, entity: ENTITY, column_key: COL_KEY, sections },
      { onConflict: 'user_id,organization_id,entity,column_key' }
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
  closingAttorneyPhone, setClosingAttorneyPhone,
  closingAttorneyAddress, setClosingAttorneyAddress,
  closeDate, setCloseDate,
  contractDate, setContractDate,
  financing, setFinancing,
  investor, setInvestor,
  investorList,
  onAddInvestor,
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
  const { profile, activeOrgId } = useAuth();
  const [showNote, setShowNote]         = useState(false);
  const [stageEditing, setStageEditing] = useState(false);
  const [stageProbability, setStageProbability] = useState(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [sections, setSections]         = useState(DEFAULT_SECTIONS);

  // Load saved section order/visibility on mount
  useEffect(() => {
    if (!profile?.id || !activeOrgId) return;
    loadSectionPrefs(profile.id, activeOrgId).then(saved => {
      if (!saved || !Array.isArray(saved) || saved.length === 0) return;
      // Merge saved with defaults to handle new sections added after initial save
      const savedMap = Object.fromEntries(saved.map(s => [s.key, s]));
      const merged = DEFAULT_SECTIONS.map(def => savedMap[def.key]
        ? { ...def, visible: savedMap[def.key].visible, order: savedMap[def.key].order }
        : def
      ).sort((a, b) => a.order - b.order);
      setSections(merged);
    });
  }, [profile?.id, activeOrgId]);

  const handleSaveLayout = useCallback(async (newSections) => {
    setSaving(true);
    await saveSectionPrefs(profile?.id, activeOrgId, newSections);
    setSaving(false);
    setCustomizeOpen(false);
  }, [profile?.id, activeOrgId]);

  const handleResetLayout = useCallback(() => {
    setSections(DEFAULT_SECTIONS);
    saveSectionPrefs(profile?.id, activeOrgId, DEFAULT_SECTIONS);
  }, [profile?.id, activeOrgId]);

  const fmt    = n => n == null || isNaN(n) ? '—' : `$${Math.round(n).toLocaleString()}`;
  const fmtPct = n => n == null || isNaN(n) ? '—' : `${Math.round(n)}%`;

  const stageBadge = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600 border-gray-200';
  const probability = stageProbability ?? DEFAULT_PROBABILITIES[stage] ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col text-sm relative">

      {/* Customize drawer overlay */}
      {customizeOpen && (
        <CustomizeRecordDrawer
          sections={sections}
          onChange={setSections}
          onSave={handleSaveLayout}
          onReset={handleResetLayout}
          onClose={() => setCustomizeOpen(false)}
          saving={saving}
        />
      )}

      {/* Deal identity header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="text-[15px] font-bold text-[#1a2332] leading-snug flex-1 min-w-0 line-clamp-2">
            {address || deal.address || 'Untitled Deal'}
          </h2>
          {/* Customize button */}
          <button
            onClick={() => setCustomizeOpen(true)}
            title="Customize sections"
            className="p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <Settings2 size={13} />
          </button>

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
        <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap mt-0.5">
          {county && <span className="flex items-center gap-0.5"><MapPin size={10} />{county}{dealState ? `, ${dealState}` : ''}</span>}
          {acreage && <span className="flex items-center gap-0.5"><Layers size={10} />{acreage} ac</span>}
        </div>

        {/* Win probability bar */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Win Probability</span>
            <span className="text-[11px] font-bold text-gray-600">{probability}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${probability}%`,
                background: probability >= 75 ? '#22c55e' : probability >= 40 ? '#f59e0b' : '#6b7280',
              }}
            />
          </div>
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

      {/* Sections — rendered in user-configured order */}
      <div className="flex-1 overflow-y-auto">

        {sections
          .filter(s => s.visible)
          .sort((a, b) => a.order - b.order)
          .map(s => {
            if (s.key === 'about') return (
              <Section key="about" title="About this deal">
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
            );
            if (s.key === 'seller') return (
              <Section key="seller" title="Seller / Owner" defaultOpen={false}>
                <EditableField label="Owner Name"  value={ownerName}   onChange={v => { setOwnerName(v);   saveNow({ ownerName: v });   }} readOnly={readOnly} />
                <EditableField label="Seller Name" value={sellerName}  onChange={v => { setSellerName(v);  saveNow({ sellerName: v });  }} readOnly={readOnly} />
                <EditableField label="Phone"       value={phone}       onChange={v => { setPhone(v);       saveNow({ phone: v });       }} type="tel"   readOnly={readOnly} />
                <EditableField label="Email"       value={email}       onChange={v => { setEmail(v);       saveNow({ email: v });       }} type="email" readOnly={readOnly} />
              </Section>
            );
            if (s.key === 'financing') return (
              <Section key="financing" title="Financing" defaultOpen={false}>
                <EditableField label="Type"     value={financing} onChange={v => { setFinancing(v); saveNow({ financing: v }); }} options={FINANCING_OPTIONS} readOnly={readOnly} />
                <EditableField label="Investor" value={investor}  onChange={v => { setInvestor(v);  saveNow({ investor: v });  }} readOnly={readOnly} />
              </Section>
            );
            if (s.key === 'closing') return (
              <Section key="closing" title="Closing" defaultOpen={false}>
                {/* Investor — custom row with + Add Investor button */}
                <div className="py-1.5 border-b border-gray-50">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] text-gray-400 font-medium">Investor</span>
                    {!readOnly && onAddInvestor && (
                      <button onClick={onAddInvestor} className="text-[10px] text-accent hover:text-accent/80 font-medium">+ Add</button>
                    )}
                  </div>
                  {readOnly ? (
                    <p className="text-[13px] font-medium text-gray-800">{investor || <span className="text-gray-300">—</span>}</p>
                  ) : (
                    <select
                      value={investor}
                      onChange={e => { setInvestor(e.target.value); saveNow({ investor: e.target.value }); }}
                      className="w-full text-[13px] font-medium text-gray-800 bg-transparent border-0 outline-none p-0 cursor-pointer"
                    >
                      <option value="">— Select investor —</option>
                      {(investorList || []).map(inv => (
                        <option key={inv.id} value={inv.name}>{inv.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <EditableField label="Attorney"      value={closingAttorney}        onChange={v => { setClosingAttorney(v);        saveNow({ closingAttorney: v });        }} readOnly={readOnly} />
                <EditableField label="Atty Phone"    value={closingAttorneyPhone}   onChange={v => { setClosingAttorneyPhone(v);   saveNow({ closingAttorneyPhone: v });   }} type="tel" readOnly={readOnly} />
                <EditableField label="Atty Address"  value={closingAttorneyAddress} onChange={v => { setClosingAttorneyAddress(v); saveNow({ closingAttorneyAddress: v }); }} readOnly={readOnly} />
                <EditableField label="Close Date"    value={closeDate}              onChange={v => { setCloseDate(v);              saveNow({ closeDate: v });              }} type="date" readOnly={readOnly} />
                <EditableField label="Contract Signed" value={contractDate}         onChange={v => { setContractDate(v);           saveNow({ contractDate: v });           }} type="date" readOnly={readOnly} />
              </Section>
            );
            return null;
          })
        }

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
