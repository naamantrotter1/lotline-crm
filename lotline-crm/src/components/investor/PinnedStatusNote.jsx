import { Pin } from 'lucide-react';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function PinnedStatusNote({ update }) {
  if (!update) return null;
  return (
    <div className="flex gap-3 bg-accent/8 border border-accent/20 rounded-2xl p-4 md:p-5">
      <div className="flex-shrink-0 mt-0.5">
        <Pin size={14} className="text-accent" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{update.title}</p>
          {update.posted_at && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{fmtDate(update.posted_at)}</span>
          )}
        </div>
        {update.body_md && (
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{update.body_md}</p>
        )}
      </div>
    </div>
  );
}
