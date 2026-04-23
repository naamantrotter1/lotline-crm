/**
 * JvRecordBanner — shown at top of DealDetail / InvestorDetail / DocumentDetail
 * when the record belongs to a JV partner org (not the user's home org).
 */
import { Building2 } from 'lucide-react';
import { useJv } from '../../lib/JvContext';
import { useAuth } from '../../lib/AuthContext';

/**
 * @param {{ recordOrgId: string }} props
 */
export default function JvRecordBanner({ recordOrgId }) {
  const { activeOrgId } = useAuth();
  const { activeJVs, jvPermissionsFor } = useJv();

  // Only show when the record is from a partner org
  if (!recordOrgId || recordOrgId === activeOrgId) return null;

  const jv = activeJVs.find(j => j.partner_organization_id === recordOrgId);
  if (!jv) return null;

  const partnerName = jv.partner_org?.name || 'JV Partner';
  const perms = jvPermissionsFor(recordOrgId) || {};
  const canEdit = perms['deal.edit'] || perms['investor.edit'];

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Building2 size={14} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Joint Venture — {partnerName}
        </p>
        <p className="text-xs text-amber-600 mt-0.5">
          {canEdit
            ? 'You may view and edit this record. All changes are logged to both organizations.'
            : 'You have read-only access. Changes to this record are not permitted under your JV permissions.'}
        </p>
      </div>
    </div>
  );
}
