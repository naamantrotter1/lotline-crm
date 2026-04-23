/**
 * JvScopeBanner — amber banner shown below the top bar when JV scope is active.
 * Dismissed per-session (not persisted).
 */
import { useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { useJv } from '../../lib/JvContext';
import { useAuth } from '../../lib/AuthContext';

export default function JvScopeBanner() {
  const { isJvHub, activeJVs, jvScope, setJvScope, jvScopeIsMultiOrg } = useJv();
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!isJvHub || !jvScopeIsMultiOrg || dismissed) return null;

  const { mode, selectedPartnerIds } = jvScope;

  const partnerNames = (() => {
    if (mode === 'all_partners_combining' || mode === 'all_partners_combined') {
      return activeJVs.map(jv => jv.partner_org?.name || 'Partner');
    }
    if (mode === 'all_partners_excluding_own') {
      return activeJVs.map(jv => jv.partner_org?.name || 'Partner');
    }
    return selectedPartnerIds.map(id => {
      const jv = activeJVs.find(j => j.partner_organization_id === id);
      return jv?.partner_org?.name || 'Partner';
    });
  })();

  const orgList = [
    ...(jvScope.includeOwn && mode !== 'all_partners_excluding_own' ? ['LotLine Homes'] : []),
    ...partnerNames,
  ];

  const scopeText = orgList.length === 1
    ? orgList[0]
    : orgList.length <= 3
      ? orgList.join(' + ')
      : `${orgList.slice(0, 2).join(' + ')} + ${orgList.length - 2} more`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-amber-50 border-b border-amber-200 text-amber-800">
      <Building2 size={13} className="flex-shrink-0 text-amber-600" />
      <span>Viewing combined data from <strong>{scopeText}</strong></span>
      <button
        onClick={() => setJvScope({ mode: 'own_only', selectedPartnerIds: [], includeOwn: true })}
        className="ml-1 underline hover:no-underline"
      >
        Change scope
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto text-amber-500 hover:text-amber-700"
        title="Dismiss (scope stays active)"
      >
        <X size={13} />
      </button>
    </div>
  );
}
