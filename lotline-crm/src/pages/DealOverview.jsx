import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Star, Search, ClipboardList, Hammer, CheckCircle2,
  Settings, List, Grid3x3, ChevronUp, ChevronDown, X,
  Download, Check, GripVertical, ArrowUpDown, Plus,
  User, Calendar, TreePine, SplitSquareHorizontal,
} from 'lucide-react';
import { calcNetProfit } from '../data/deals';
import { useDeals } from '../lib/DealsContext';
import { saveDeal } from '../lib/dealsSync';
import { useAuth } from '../lib/AuthContext';
import LiveBadge from '../components/UI/LiveBadge';
import { usePermissions } from '../hooks/usePermissions';

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];

const STAGE_META = {
  'Contract Signed': { icon: ClipboardList, color: '#c2410c', bg: '#fff7ed', pill: 'bg-orange-100 text-orange-700' },
  'Due Diligence':   { icon: Search,        color: '#b45309', bg: '#fffbeb', pill: 'bg-yellow-100 text-yellow-700' },
  'Development':     { icon: Hammer,        color: '#15803d', bg: '#f0fdf4', pill: 'bg-green-100 text-green-700' },
  'Complete':        { icon: CheckCircle2,  color: '#6366f1', bg: '#eef2ff', pill: 'bg-indigo-100 text-indigo-700' },
};

const DEAL_FIELDS = [
  { key: 'address',                    label: 'Address',                   type: 'text',     alwaysShow: true },
  // Financial
  { key: 'arv',                        label: 'ARV',                       type: 'currency', group: 'FINANCIAL' },
  { key: 'total_estimated',            label: 'All-In Cost',               type: 'currency', group: 'FINANCIAL' },
  { key: 'net_profit',                 label: 'Net Profit',                type: 'currency', group: 'FINANCIAL' },
  { key: 'net_profit_after_financing', label: 'Net Profit (After Fin.)',   type: 'currency', group: 'FINANCIAL' },
  { key: 'land',                       label: 'Land Cost',                 type: 'currency', group: 'FINANCIAL' },
  { key: 'mobile_home',                label: 'Home Cost',                 type: 'currency', group: 'FINANCIAL' },
  { key: 'holding_months',             label: 'Hold Period (mo)',          type: 'number',   group: 'FINANCIAL' },
  { key: 'holding_per_month',          label: 'Monthly Hold Cost',         type: 'currency', group: 'FINANCIAL' },
  // Property
  { key: 'county',                     label: 'County',                    type: 'text',     group: 'PROPERTY' },
  { key: 'state',                      label: 'State',                     type: 'text',     group: 'PROPERTY' },
  { key: 'acreage',                    label: 'Acreage',                   type: 'number',   group: 'PROPERTY' },
  { key: 'parcel_id',                  label: 'Parcel ID',                 type: 'text',     group: 'PROPERTY' },
  // Deal info
  { key: 'stage',                      label: 'Stage',                     type: 'badge',    group: 'DEAL INFO' },
  { key: 'deal_owner',                 label: 'Deal Owner',                type: 'text',     group: 'DEAL INFO' },
  { key: 'investor',                   label: 'Lender / Investor',         type: 'text',     group: 'DEAL INFO' },
  { key: 'lead_source',                label: 'Lead Source',               type: 'text',     group: 'DEAL INFO' },
  { key: 'financing_scenario_type',    label: 'Financing',                 type: 'text',     group: 'DEAL INFO' },
  { key: 'days_in_stage',              label: 'Days in Stage',             type: 'number',   group: 'DEAL INFO' },
  { key: 'contract_signed_at',         label: 'Contract Date',             type: 'date',     group: 'DEAL INFO' },
];

const DEFAULT_CARD_FIELDS  = ['arv', 'net_profit', 'financing_scenario_type', 'days_in_stage'];
const DEFAULT_LIST_FIELDS  = ['arv', 'total_estimated', 'net_profit', 'land', 'financing_scenario_type', 'days_in_stage'];
const FIELD_GROUPS         = ['FINANCIAL', 'PROPERTY', 'DEAL INFO'];

// ── Utility ───────────────────────────────────────────────────────────────────

function getFieldValue(deal, key) {
  switch (key) {
    case 'address':                    return deal.address;
    case 'arv':                        return deal.arv ?? null;
    case 'total_estimated':            return deal.totalEstimated ?? null;
    // net_profit = before financing costs; net_profit_after_financing = with CoC deducted
    case 'net_profit':                 return calcNetProfit({ ...deal, financing: null, financingScenarioType: null });
    case 'net_profit_after_financing': return calcNetProfit(deal);
    // Land / home cost: prefer direct column, fall back to cost summary portions
    case 'land':                       return deal.land ?? null;
    case 'mobile_home':                return deal.mobileHome ?? null;
    case 'holding_months':             return deal.holdingMonths ?? null;
    case 'holding_per_month':          return deal.holdingPerMonth ?? null;
    case 'county':                     return deal.county ?? null;
    case 'state':                      return deal.state ?? null;
    case 'acreage':                    return deal.acreage ?? null;
    case 'parcel_id':                  return deal.parcelId ?? null;
    case 'stage':                      return deal.stage ?? null;
    case 'deal_owner':                 return deal.dealOwner ?? null;
    case 'investor':                   return deal.investor ?? null;
    case 'lead_source':                return deal.leadSource ?? null;
    case 'financing_scenario_type':    return snakeToTitle(deal.financingScenarioType || deal.financing || null);
    case 'days_in_stage': {
      const ref = deal.contractSignedAt || deal.createdAt;
      return ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000) : null;
    }
    case 'contract_signed_at':         return deal.contractSignedAt ?? null;
    default:                           return null;
  }
}

function snakeToTitle(str) {
  if (!str) return str;
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatFieldValue(value, type, { compact = false } = {}) {
  if (value == null || value === '') return '—';
  switch (type) {
    case 'currency': {
      const n = Math.round(Number(value));
      if (compact && Math.abs(n) >= 1000) {
        const k = n / 1000;
        return `$${Math.abs(k) >= 100 ? Math.round(k) : k.toFixed(1)}K`;
      }
      return `$${Math.abs(n).toLocaleString()}`;
    }
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;
    case 'date':
      return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    default:
      return String(value);
  }
}

// ── Card helper functions ─────────────────────────────────────────────────────

const TAG_STYLES = {
  'Land Clearing': { bg: '#dcfce7', text: '#15803d' },
  'Subdivide':     { bg: '#fef3c7', text: '#b45309' },
};

function isSubdividable(deal) {
  if (deal.subdividable === 'No'  || deal.subdividable === false) return false;
  if (deal.subdividable === 'Yes' || deal.subdividable === true)  return true;
  return (deal.tags || []).includes('Subdivide');
}

function isLandClearing(deal) {
  if (deal.landClearing === 'No'  || deal.landClearing === false) return false;
  if (deal.landClearing === 'Yes' || deal.landClearing === true)  return true;
  return (deal.tags || []).includes('Land Clearing');
}

function closingCountdown(dateStr) {
  if (!dateStr) return null;
  const close = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  close.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - close) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d to close`, past: false };
  if (diff === 0) return { label: 'Closes today', past: false };
  return { label: `Day ${diff}`, past: true };
}

function formatCloseDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function loadPref(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({ allDeals, searchParams, setSearchParams }) {
  const filterStage    = searchParams.get('stage')    || '';
  const filterOwner    = searchParams.get('owner')    || '';
  const filterFinancing = searchParams.get('financing') || '';
  const filterLender   = searchParams.get('lender')   || '';
  const filterStarred  = searchParams.get('starred')  === '1';
  const filterSearch   = searchParams.get('q')        || '';

  const setParam = (k, v) => setSearchParams(prev => {
    const n = new URLSearchParams(prev);
    v ? n.set(k, v) : n.delete(k);
    return n;
  });

  const owners    = useMemo(() => [...new Set(allDeals.map(d => d.dealOwner).filter(Boolean))].sort(), [allDeals]);
  const financings = useMemo(() => [...new Set(allDeals.map(d => d.financingScenarioType || d.financing).filter(Boolean))].sort(), [allDeals]);
  const hasFilters = filterStage || filterOwner || filterFinancing || filterLender || filterStarred || filterSearch;

  const clearAll = () => setSearchParams(prev => {
    const n = new URLSearchParams(prev);
    ['stage','owner','financing','lender','starred','q'].forEach(k => n.delete(k));
    return n;
  });

  const pill = 'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium';

  return (
    <div className="flex flex-wrap items-center gap-2 mb-1">
      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search deals…"
          value={filterSearch}
          onChange={e => setParam('q', e.target.value)}
          className="pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#c8613a] w-44 bg-white"
        />
      </div>

      {/* Stage */}
      <select
        value={filterStage}
        onChange={e => setParam('stage', e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c8613a] text-gray-600 bg-white"
      >
        <option value="">All Stages</option>
        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Owner */}
      {owners.length > 0 && (
        <select
          value={filterOwner}
          onChange={e => setParam('owner', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c8613a] text-gray-600 bg-white"
        >
          <option value="">All Owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {/* Financing */}
      {financings.length > 0 && (
        <select
          value={filterFinancing}
          onChange={e => setParam('financing', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c8613a] text-gray-600 bg-white"
        >
          <option value="">All Financing</option>
          {financings.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      )}

      {/* Lender / Investor */}
      <select
        value={filterLender}
        onChange={e => setParam('lender', e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#c8613a] text-gray-600 bg-white"
      >
        <option value="">All Lenders</option>
        <option value="has">Has Lender</option>
        <option value="none">No Lender</option>
      </select>

      {/* Starred */}
      <button
        onClick={() => setParam('starred', filterStarred ? '' : '1')}
        className={`${pill} transition-colors ${
          filterStarred
            ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
            : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
        }`}
      >
        <Star size={11} fill={filterStarred ? 'currentColor' : 'none'} />
        Starred
      </button>

      {/* Active filter pills */}
      {filterStage && (
        <span className={`${pill} bg-orange-50 border-orange-200 text-orange-700`}>
          Stage: {filterStage}
          <button onClick={() => setParam('stage', '')} className="hover:text-orange-900"><X size={10} /></button>
        </span>
      )}
      {filterOwner && (
        <span className={`${pill} bg-blue-50 border-blue-200 text-blue-700`}>
          Owner: {filterOwner}
          <button onClick={() => setParam('owner', '')} className="hover:text-blue-900"><X size={10} /></button>
        </span>
      )}
      {filterFinancing && (
        <span className={`${pill} bg-purple-50 border-purple-200 text-purple-700`}>
          {filterFinancing}
          <button onClick={() => setParam('financing', '')} className="hover:text-purple-900"><X size={10} /></button>
        </span>
      )}

      {hasFilters && (
        <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600 underline ml-1">
          Clear All
        </button>
      )}
    </div>
  );
}

// ── CustomizePanel ─────────────────────────────────────────────────────────────

function CustomizePanel({ currentFields, onApply, onClose, maxFields, isListView }) {
  const [local, setLocal] = useState(currentFields);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const toggle = (key) => {
    if (local.includes(key)) {
      setLocal(prev => prev.filter(k => k !== key));
    } else if (maxFields == null || local.length < maxFields) {
      setLocal(prev => [...prev, key]);
    }
  };

  const handleDragStart = (key) => { dragItem.current = key; };
  const handleDragEnter = (key) => { dragOver.current = key; };
  const handleDragEnd   = () => {
    if (!dragItem.current || !dragOver.current || dragItem.current === dragOver.current) return;
    const items = [...local];
    const from = items.indexOf(dragItem.current);
    const to   = items.indexOf(dragOver.current);
    if (from < 0 || to < 0) return;
    items.splice(to, 0, items.splice(from, 1)[0]);
    setLocal(items);
    dragItem.current = null;
    dragOver.current = null;
  };

  const fieldsByGroup = Object.fromEntries(
    FIELD_GROUPS.map(g => [g, DEAL_FIELDS.filter(f => f.group === g)])
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[360px] bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">Customize {isListView ? 'List' : 'Card'} View</p>
            <p className="text-xs text-gray-400 mt-0.5">Drag to reorder{maxFields ? ` · Max ${maxFields} fields` : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
        </div>

        {/* Selected chips (draggable) */}
        {local.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Selected ({local.length}{maxFields ? `/${maxFields}` : ''})
            </p>
            <div className="space-y-1.5">
              {local.map(key => {
                const f = DEAL_FIELDS.find(x => x.key === key);
                if (!f) return null;
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => handleDragStart(key)}
                    onDragEnter={() => handleDragEnter(key)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing select-none"
                  >
                    <GripVertical size={13} className="text-gray-300 flex-shrink-0" />
                    <span className="text-sm flex-1 text-gray-700">{f.label}</span>
                    <button
                      onClick={() => toggle(key)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    ><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available fields */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          {FIELD_GROUPS.map(group => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {fieldsByGroup[group].map(field => {
                  const selected = local.includes(field.key);
                  const disabled = !selected && maxFields != null && local.length >= maxFields;
                  return (
                    <label
                      key={field.key}
                      onClick={() => !disabled && toggle(field.key)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors select-none ${
                        selected   ? 'bg-[#c8613a]/8 text-gray-800 cursor-pointer' :
                        disabled   ? 'opacity-35 cursor-not-allowed' :
                                     'hover:bg-gray-50 text-gray-600 cursor-pointer'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'bg-[#c8613a] border-[#c8613a]' : 'border-gray-300 bg-white'
                      }`}>
                        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                      <span className="text-sm">{field.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-4 border-t border-gray-100">
          <button
            onClick={() => setLocal(isListView ? DEFAULT_LIST_FIELDS : DEFAULT_CARD_FIELDS)}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Reset to Default
          </button>
          <button
            onClick={() => onApply(local)}
            className="bg-[#c8613a] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#b8552f] transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DealCard ──────────────────────────────────────────────────────────────────

function DealCard({ deal, cardFields, onClick, onStar, selected, onToggleSelect, isAgent }) {
  const [starred, setStarred] = useState(deal.is_starred ?? false);
  const netProfit    = calcNetProfit(deal);
  const closing      = closingCountdown(deal.closeDate);
  const subdivide    = isSubdividable(deal);
  const landClearing = isLandClearing(deal);

  useEffect(() => { setStarred(deal.is_starred ?? false); }, [deal.is_starred]);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 shadow-sm border mb-3 cursor-pointer hover:shadow-md transition-all group relative ${
        selected ? 'border-[#c8613a] ring-1 ring-[#c8613a]/40' : 'border-gray-100'
      }`}
    >
      {/* Checkbox — always visible when selected, hover otherwise */}
      <div
        className={`absolute top-3.5 left-3 z-10 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={e => { e.stopPropagation(); onToggleSelect(deal.id); }}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
          selected ? 'bg-[#c8613a] border-[#c8613a]' : 'bg-white border-gray-300 hover:border-[#c8613a]'
        }`}>
          {selected && <Check size={9} className="text-white" strokeWidth={3} />}
        </div>
      </div>

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
            onClick={e => { e.stopPropagation(); const n = !starred; setStarred(n); onStar?.(deal.id, n); }}
            className={`transition-colors ${starred ? 'text-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>


      {/* Closing date + countdown */}
      {(deal.closeDate || closing) && (
        <div className="flex items-center justify-between ml-4 mb-1">
          {deal.closeDate ? (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={10} className="text-orange-400" />
              {formatCloseDate(deal.closeDate)}
            </span>
          ) : <span />}
          {closing && (
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
              closing.past ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>{closing.label}</span>
          )}
        </div>
      )}

      {/* Custom fields strip */}
      {cardFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2 pt-2 border-t border-gray-100 ml-4">
          {cardFields.map(key => {
            const field = DEAL_FIELDS.find(f => f.key === key);
            if (!field) return null;
            const value = getFieldValue(deal, key);
            const isNeg = field.type === 'currency' && typeof value === 'number' && value < 0;
            return (
              <div key={key} className="min-w-0">
                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide truncate leading-tight">
                  {field.label}
                </div>
                <div className={`text-[11px] font-bold leading-tight line-clamp-2 ${isNeg ? 'text-red-500' : 'text-gray-700'}`}>
                  {key === 'days_in_stage' && value != null
                    ? `Day ${value}`
                    : formatFieldValue(value, field.type, { compact: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ListView ──────────────────────────────────────────────────────────────────

function ListView({ deals, listFields, sort, onSort, selectedIds, onToggleSelect, onToggleAll, navigate }) {
  // columns = address (sticky) + stage (always in list) + selected fields minus address/stage
  const columns = useMemo(() => {
    const extra = listFields
      .filter(k => k !== 'address' && k !== 'stage')
      .map(k => DEAL_FIELDS.find(f => f.key === k))
      .filter(Boolean);
    return [
      DEAL_FIELDS.find(f => f.key === 'address'),
      DEAL_FIELDS.find(f => f.key === 'stage'),
      ...extra,
    ].filter(Boolean);
  }, [listFields]);

  const allChecked = deals.length > 0 && deals.every(d => selectedIds.has(d.id));
  const someChecked = deals.some(d => selectedIds.has(d.id));

  // Footer aggregates
  const aggregates = useMemo(() => {
    const result = {};
    columns.forEach(col => {
      const vals = deals.map(d => getFieldValue(d, col.key)).filter(v => v != null && !isNaN(Number(v)));
      if (col.type === 'currency' || col.type === 'number') {
        const nums = vals.map(Number);
        result[col.key] = {
          sum: nums.reduce((a, b) => a + b, 0),
          avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
        };
      }
    });
    return result;
  }, [deals, columns]);

  const SortIcon = ({ colKey }) => {
    if (sort.key !== colKey) return <ArrowUpDown size={10} className="text-gray-300 ml-0.5" />;
    return sort.dir === 'asc'
      ? <ChevronUp size={11} className="text-[#c8613a] ml-0.5" />
      : <ChevronDown size={11} className="text-[#c8613a] ml-0.5" />;
  };

  return (
    <div className="rounded-xl border border-gray-200 overflow-auto bg-white" style={{ maxHeight: 'calc(100vh - 250px)' }}>
      <table className="w-full border-collapse" style={{ minWidth: `${100 + columns.length * 130}px` }}>
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b-2 border-gray-200">
            {/* Checkbox col */}
            <th className="sticky left-0 z-20 bg-white w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                onChange={() => onToggleAll(deals)}
                className="rounded cursor-pointer accent-[#c8613a]"
              />
            </th>
            {columns.map((col, i) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 py-3 whitespace-nowrap cursor-pointer hover:text-gray-800 select-none ${
                  i === 0 ? 'sticky left-10 z-20 bg-white border-r border-gray-100 min-w-[200px]' : 'min-w-[120px]'
                }`}
              >
                <span className="flex items-center gap-0.5">
                  {col.label}
                  <SortIcon colKey={col.key} />
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {deals.map((deal, rowIdx) => (
            <tr
              key={deal.id}
              onClick={() => navigate(`/deal/${deal.id}`, { state: { pipeline: 'deal-overview', deal } })}
              className={`border-b border-gray-100 cursor-pointer transition-colors group ${
                selectedIds.has(deal.id) ? 'bg-orange-50/60' : rowIdx % 2 === 0 ? 'bg-white hover:bg-orange-50/30' : 'bg-gray-50/30 hover:bg-orange-50/30'
              }`}
            >
              <td
                className="sticky left-0 z-10 bg-inherit px-3 py-3"
                onClick={e => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(deal.id)}
                  onChange={() => onToggleSelect(deal.id)}
                  className="rounded cursor-pointer accent-[#c8613a]"
                />
              </td>
              {columns.map((col, i) => {
                const value = getFieldValue(deal, col.key);
                const isNeg = col.type === 'currency' && typeof value === 'number' && value < 0;
                return (
                  <td
                    key={col.key}
                    className={`px-3 py-3 text-sm whitespace-nowrap ${
                      i === 0 ? 'sticky left-10 z-10 bg-inherit font-semibold text-gray-900 border-r border-gray-100' : ''
                    } ${isNeg ? 'text-red-500 font-semibold' : i > 0 ? 'text-gray-700' : ''}`}
                  >
                    {col.type === 'badge' ? (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STAGE_META[value]?.pill || 'bg-gray-100 text-gray-600'}`}>
                        {value || '—'}
                      </span>
                    ) : col.key === 'days_in_stage' && value != null ? (
                      `Day ${value}`
                    ) : (
                      formatFieldValue(value, col.type)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        {/* Footer totals */}
        <tfoot className="sticky bottom-0 z-10 border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td className="sticky left-0 z-20 bg-gray-50 px-3 py-2.5" />
            {columns.map((col, i) => {
              const agg = aggregates[col.key];
              if (i === 0) {
                return (
                  <td key={col.key} className="sticky left-10 z-20 bg-gray-50 px-3 py-2.5 border-r border-gray-200">
                    <span className="text-[11px] font-semibold text-gray-600">{deals.length} deal{deals.length !== 1 ? 's' : ''}</span>
                  </td>
                );
              }
              if (agg) {
                return (
                  <td key={col.key} className="px-3 py-2.5">
                    <div className="text-[11px] font-semibold text-gray-700">
                      {formatFieldValue(agg.sum, col.type)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      avg {formatFieldValue(Math.round(agg.avg), col.type)}
                    </div>
                  </td>
                );
              }
              return <td key={col.key} className="px-3 py-2.5" />;
            })}
          </tr>
        </tfoot>
      </table>

      {deals.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">No deals match your filters</div>
      )}
    </div>
  );
}

// ── SelectionBar ──────────────────────────────────────────────────────────────

function SelectionBar({ count, onClear, onExport }) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-full px-5 py-3 shadow-2xl flex items-center gap-4 whitespace-nowrap">
      <span className="text-sm font-semibold">{count} deal{count !== 1 ? 's' : ''} selected</span>
      <button onClick={onClear} className="text-xs text-gray-400 hover:text-white transition-colors">Clear</button>
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 bg-[#c8613a] text-white text-sm font-semibold px-3 py-1.5 rounded-full hover:bg-[#b8552f] transition-colors"
      >
        <Download size={13} />
        Export
      </button>
    </div>
  );
}

// ── ExportModal ───────────────────────────────────────────────────────────────

function ExportModal({ selectedDeals, onClose }) {
  const [format, setFormat] = useState('xlsx');
  const [exportKeys, setExportKeys] = useState(
    DEAL_FIELDS.filter(f => !['net_profit_after_financing','parcel_id','lead_source','mobile_home','holding_per_month'].includes(f.key)).map(f => f.key)
  );
  const today = new Date().toISOString().split('T')[0];
  const [filename, setFilename] = useState(`LotLine_Deals_${today}`);
  const [exporting, setExporting] = useState(false);

  const toggleKey = (key) => setExportKeys(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  );

  const buildRows = (fields) => selectedDeals.map(deal =>
    fields.map(f => {
      const val = getFieldValue(deal, f.key);
      if (val == null) return '';
      if (f.type === 'currency') return Math.round(Number(val));
      if (f.type === 'date')     return new Date(val).toLocaleDateString('en-US');
      if (f.key === 'days_in_stage' && val != null) return `Day ${val}`;
      return String(val);
    })
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const fields  = DEAL_FIELDS.filter(f => exportKeys.includes(f.key));
      const headers = fields.map(f => f.label);
      const rows    = buildRows(fields);

      if (format === 'csv') {
        const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
        URL.revokeObjectURL(url);

      } else if (format === 'xlsx') {
        const { utils, writeFile } = await import('xlsx');
        const wsData = [headers, ...rows];
        const ws = utils.aoa_to_sheet(wsData);
        // Bold header row
        headers.forEach((_, ci) => {
          const cell = ws[utils.encode_cell({ r: 0, c: ci })];
          if (cell) { cell.s = { font: { bold: true } }; }
        });
        // Auto column widths
        ws['!cols'] = headers.map((h, ci) => ({
          wch: Math.max(h.length, ...rows.map(r => String(r[ci] ?? '').length)) + 2,
        }));
        // Freeze top row
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Deals');
        writeFile(wb, `${filename}.xlsx`);

      } else if (format === 'pdf') {
        const { jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('LotLine Deals Export', 14, 14);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(`${selectedDeals.length} deals · ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`, 14, 20);
        autoTable(doc, {
          head:       [headers],
          body:       rows,
          startY:     26,
          styles:     { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [200, 97, 58], fontStyle: 'bold', textColor: 255 },
          alternateRowStyles: { fillColor: [250, 248, 245] },
        });
        doc.save(`${filename}.pdf`);
      }
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-gray-100 z-10">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">Export {selectedDeals.length} Deal{selectedDeals.length !== 1 ? 's' : ''}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Format */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Format</p>
            <div className="space-y-1.5">
              {[['csv', 'CSV (comma-separated)'], ['xlsx', 'Excel (.xlsx)'], ['pdf', 'PDF (table format)']].map(([val, label]) => (
                <label key={val} className="flex items-center gap-2.5 py-1 cursor-pointer">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      format === val ? 'border-[#c8613a]' : 'border-gray-300'
                    }`}
                    onClick={() => setFormat(val)}
                  >
                    {format === val && <div className="w-2 h-2 rounded-full bg-[#c8613a]" />}
                  </div>
                  <span className="text-sm text-gray-700">{label}</span>
                  {val === 'xlsx' && <span className="text-[10px] bg-[#c8613a]/10 text-[#c8613a] font-semibold px-1.5 py-0.5 rounded">default</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Fields to include</p>
              <div className="flex gap-2">
                <button onClick={() => setExportKeys(DEAL_FIELDS.map(f => f.key))} className="text-xs text-[#c8613a] underline">All</button>
                <button onClick={() => setExportKeys([])} className="text-xs text-gray-400 underline">None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {DEAL_FIELDS.map(f => (
                <label key={f.key} className="flex items-center gap-2 py-1 cursor-pointer">
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      exportKeys.includes(f.key) ? 'bg-[#c8613a] border-[#c8613a]' : 'border-gray-300 bg-white'
                    }`}
                    onClick={() => toggleKey(f.key)}
                  >
                    {exportKeys.includes(f.key) && <Check size={9} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-xs text-gray-700">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filename */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">File name</p>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#c8613a]">
              <input
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
              <span className="text-xs text-gray-400 pr-3">.{format}</span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            onClick={handleExport}
            disabled={exporting || exportKeys.length === 0}
            className="flex items-center gap-2 bg-[#c8613a] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#b8552f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {exporting ? 'Preparing…' : 'Download Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DealOverview (main) ───────────────────────────────────────────────────────

export default function DealOverview() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { deals: rawDeals, setDeals, realtimeStatus } = useDeals();
  const { isAgent } = usePermissions();
  const { activeOrgId, session } = useAuth();
  const userId = session?.user?.id;

  const view = searchParams.get('view') || 'card';
  const setView = (v) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('view', v); return n; });

  const filterStage    = searchParams.get('stage')    || '';
  const filterOwner    = searchParams.get('owner')    || '';
  const filterFinancing = searchParams.get('financing') || '';
  const filterLender   = searchParams.get('lender')   || '';
  const filterStarred  = searchParams.get('starred')  === '1';
  const filterSearch   = searchParams.get('q')        || '';

  // Field preferences (per-user in localStorage)
  const cardPrefKey = userId ? `deal_card_fields_${userId}` : null;
  const listPrefKey = userId ? `deal_list_fields_${userId}` : null;

  const [cardFields, setCardFields] = useState(() => loadPref(cardPrefKey, DEFAULT_CARD_FIELDS));
  const [listFields, setListFields] = useState(() => loadPref(listPrefKey, DEFAULT_LIST_FIELDS));

  const [showCustomize, setShowCustomize] = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [showExport, setShowExport]       = useState(false);
  const [sort, setSort]                   = useState({ key: null, dir: null });

  // Save prefs when userId becomes available (e.g. after login)
  useEffect(() => {
    if (!userId) return;
    const saved = loadPref(`deal_card_fields_${userId}`, null);
    if (saved) setCardFields(saved);
  }, [userId]);

  const handleStar = (id, val) => {
    setDeals(prev => prev.map(d => String(d.id) === String(id) ? { ...d, is_starred: val } : d));
    const deal = rawDeals.find(d => String(d.id) === String(id));
    if (deal) saveDeal({ ...deal, is_starred: val }, activeOrgId);
  };

  const allDeals = useMemo(() =>
    rawDeals.filter(d => STAGES.includes(d.stage) && !d.isArchived),
    [rawDeals]
  );

  const filteredDeals = useMemo(() => allDeals.filter(deal => {
    if (filterStage && deal.stage !== filterStage)                          return false;
    if (filterOwner && deal.dealOwner !== filterOwner)                      return false;
    if (filterFinancing && (deal.financingScenarioType || deal.financing) !== filterFinancing) return false;
    if (filterLender && !deal.investor)                                      return false;
    if (filterStarred && !deal.is_starred)                                  return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (![deal.address, deal.county, deal.state, deal.dealOwner].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [allDeals, filterStage, filterOwner, filterFinancing, filterLender, filterStarred, filterSearch]);

  const sortedDeals = useMemo(() => {
    if (!sort.key || !sort.dir) return filteredDeals;
    return [...filteredDeals].sort((a, b) => {
      const av = getFieldValue(a, sort.key);
      const bv = getFieldValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filteredDeals, sort]);

  const handleSort = (key) => setSort(prev => {
    if (prev.key !== key)     return { key, dir: 'asc' };
    if (prev.dir === 'asc')   return { key, dir: 'desc' };
    return { key: null, dir: null };
  });

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = (deals) => {
    const allSel = deals.every(d => selectedIds.has(d.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      deals.forEach(d => allSel ? next.delete(d.id) : next.add(d.id));
      return next;
    });
  };

  const applyCardFields = (fields) => {
    setCardFields(fields);
    if (cardPrefKey) savePref(cardPrefKey, fields);
    setShowCustomize(false);
  };

  const applyListFields = (fields) => {
    setListFields(fields);
    if (listPrefKey) savePref(listPrefKey, fields);
    setShowCustomize(false);
  };

  const selectedDeals = useMemo(() =>
    filteredDeals.filter(d => selectedIds.has(d.id)),
    [filteredDeals, selectedIds]
  );

  const btnCls = 'flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors bg-white text-gray-700';

  return (
    <div className="space-y-4 pb-20">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-sidebar">Deal Overview</h1>
            <LiveBadge status={realtimeStatus} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {filteredDeals.length === allDeals.length
              ? `${allDeals.length} active deal${allDeals.length !== 1 ? 's' : ''}`
              : `${filteredDeals.length} of ${allDeals.length} deals`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowCustomize(true)} className={btnCls}>
            <Settings size={14} /> Customize
          </button>
          <button onClick={() => setView(view === 'list' ? 'card' : 'list')} className={btnCls}>
            {view === 'list' ? <Grid3x3 size={14} /> : <List size={14} />}
            {view === 'list' ? 'Card View' : 'List View'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar allDeals={allDeals} searchParams={searchParams} setSearchParams={setSearchParams} />

      {/* Select-all link when in card view with selections */}
      {selectedIds.size > 0 && view === 'card' && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{selectedIds.size} selected</span>
          <button
            onClick={() => toggleAll(filteredDeals)}
            className="text-[#c8613a] underline"
          >
            {filteredDeals.every(d => selectedIds.has(d.id)) ? 'Deselect all' : `Select all ${filteredDeals.length}`}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="underline">Clear</button>
        </div>
      )}

      {/* Card view — Kanban */}
      {view === 'card' && (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 300px)' }}>
          {STAGES.map(stage => {
            const deals = filteredDeals
              .filter(d => d.stage === stage)
              .sort((a, b) => {
                if (!a.closeDate && !b.closeDate) return 0;
                if (!a.closeDate) return 1;
                if (!b.closeDate) return -1;
                return new Date(a.closeDate) - new Date(b.closeDate);
              });
            return (
              <div key={stage} className="flex-shrink-0 w-[82vw] sm:w-80">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-semibold text-gray-700 text-sm">{stage}</h3>
                  <span className="bg-gray-800 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center">
                    {deals.length}
                  </span>
                </div>
                <div>
                  {deals.map(deal => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      cardFields={cardFields}
                      onClick={() => navigate(`/deal/${deal.id}`, { state: { pipeline: 'deal-overview', deal } })}
                      onStar={handleStar}
                      selected={selectedIds.has(deal.id)}
                      onToggleSelect={toggleSelect}
                      isAgent={isAgent}
                    />
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
      )}

      {/* List view */}
      {view === 'list' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {selectedIds.size > 0 && (
                <>
                  <span>{selectedIds.size} selected</span>
                  <button onClick={() => toggleAll(sortedDeals)} className="text-[#c8613a] underline">
                    {sortedDeals.every(d => selectedIds.has(d.id)) ? 'Deselect all' : `Select all ${sortedDeals.length}`}
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="underline">Clear</button>
                </>
              )}
            </div>
          </div>
          <ListView
            deals={sortedDeals}
            listFields={listFields}
            sort={sort}
            onSort={handleSort}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            navigate={navigate}
            isAgent={isAgent}
          />
        </div>
      )}

      {/* Floating selection bar */}
      <SelectionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onExport={() => setShowExport(true)}
      />

      {/* Customize panel */}
      {showCustomize && (
        <CustomizePanel
          currentFields={view === 'list' ? listFields : cardFields}
          onApply={view === 'list' ? applyListFields : applyCardFields}
          onClose={() => setShowCustomize(false)}
          maxFields={view === 'list' ? 12 : null}
          isListView={view === 'list'}
        />
      )}

      {/* Export modal */}
      {showExport && (
        <ExportModal
          selectedDeals={selectedDeals.length > 0 ? selectedDeals : filteredDeals}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
