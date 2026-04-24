/**
 * JvScopeSwitcher — dropdown in the top bar for LotLine Homes (hub) users only.
 * Appears when the current org has ≥1 active JV partner.
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { useJv } from '../../lib/JvContext';

export default function JvScopeSwitcher() {
  const { isJvHub, activeJVs, jvScope, setJvScope } = useJv();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Only render for hub with active partners
  if (!isJvHub || activeJVs.length === 0) return null;

  const partnerOrgs = activeJVs.map(jv => ({
    id:   jv.partner_organization_id,
    name: jv.partner_org?.name || 'Partner',
  }));

  function label() {
    const { mode, selectedPartnerIds } = jvScope;
    if (mode === 'own_only') return 'My org only';
    if (mode === 'all_partners_combined')  return 'All partners';
    if (mode === 'single_partner' && selectedPartnerIds.length === 1) {
      const p = partnerOrgs.find(o => o.id === selectedPartnerIds[0]);
      return p?.name || 'Partner';
    }
    return 'My org only';
  }

  const isActive = jvScope.mode !== 'own_only';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
          isActive
            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Building2 size={12} />
        <span>{label()}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Data scope
          </p>

          {/* My org only */}
          <Option
            active={jvScope.mode === 'own_only'}
            onClick={() => { setJvScope({ mode: 'own_only', selectedPartnerIds: [], includeOwn: true }); setOpen(false); }}
            label="My org only"
            sub="No partner data"
          />

          {/* Per-partner options */}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <p className="px-3 pt-0.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              JV Partners
            </p>
            {partnerOrgs.map(p => {
              const isActive = jvScope.mode === 'single_partner' && jvScope.selectedPartnerIds[0] === p.id;
              return (
                <Option
                  key={p.id}
                  active={isActive}
                  onClick={() => { setJvScope({ mode: 'single_partner', selectedPartnerIds: [p.id], includeOwn: true }); setOpen(false); }}
                  label={p.name}
                />
              );
            })}
            {partnerOrgs.length > 1 && (
              <Option
                active={jvScope.mode === 'all_partners_combined'}
                onClick={() => { setJvScope({ mode: 'all_partners_combined', selectedPartnerIds: [], includeOwn: true }); setOpen(false); }}
                label="All partners"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Option({ active, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
    >
      <div className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
        {active && <Check size={12} className="text-accent" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${active ? 'text-accent' : 'text-gray-700'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </button>
  );
}
