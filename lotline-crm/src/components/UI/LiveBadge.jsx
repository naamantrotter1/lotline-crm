/**
 * LiveBadge — shows real-time sync status for pipeline pages.
 *
 * status: 'connecting' | 'live' | 'error' | 'closed' | 'offline'
 *
 * Design: small pill, minimal footprint.
 *   • live       → green dot + "Live"
 *   • connecting → pulsing gray dot + "Syncing…"
 *   • error      → amber dot + "Reconnecting…"
 *   • closed/offline → nothing rendered
 */
export default function LiveBadge({ status }) {
  if (!status || status === 'closed' || status === 'offline') return null;

  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Live
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Reconnecting…
      </span>
    );
  }

  // connecting
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
      Syncing…
    </span>
  );
}
