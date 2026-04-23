/**
 * OrgChip — small org identity pill shown on data rows when JV scope > 1 org.
 * Own org: accent-colored. Partner orgs: neutral gray.
 */
export default function OrgChip({ orgId, orgName, activeOrgId, size = 'sm' }) {
  const isOwn = orgId === activeOrgId;
  const label = orgName || '—';
  const initials = label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (size === 'xs') {
    return (
      <span
        title={label}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
          isOwn
            ? 'bg-accent/10 text-accent border border-accent/20'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
        }`}
      >
        <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
          isOwn ? 'bg-accent/20' : 'bg-gray-200'
        }`}>
          {initials[0]}
        </span>
        <span className="max-w-[80px] truncate">{label}</span>
      </span>
    );
  }

  // size = 'sm' (default)
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
        isOwn
          ? 'bg-accent/10 text-accent border border-accent/20'
          : 'bg-gray-100 text-gray-500 border border-gray-200'
      }`}
    >
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
        isOwn ? 'bg-accent/20 text-accent' : 'bg-gray-300 text-gray-600'
      }`}>
        {initials[0]}
      </span>
      <span className="max-w-[100px] truncate">{label}</span>
    </span>
  );
}
