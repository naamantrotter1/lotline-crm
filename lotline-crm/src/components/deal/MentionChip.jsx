/**
 * MentionChip
 *
 * Renders a single @mention as a small inline chip. On click opens a mini
 * profile card with the user's name, role, email, and a "View profile" link.
 * On hover shows a subtle orange highlight + tooltip "Mentioned by {author}
 * on {timestamp}" when those props are provided.
 *
 * Props:
 *   userId       (string)  — auth user UUID
 *   displayName  (string)  — name shown in the chip and card
 *   role         (string)  — org role label shown in the card
 *   email        (string)  — email shown in the card
 *   mentionedBy  (string)  — author display name for hover tooltip (optional)
 *   mentionedAt  (string)  — ISO timestamp for hover tooltip (optional)
 */
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function MentionChip({
  userId,
  displayName,
  role,
  email,
  mentionedBy,
  mentionedAt,
}) {
  const [open, setOpen] = useState(false);
  const chipRef         = useRef(null);
  const cardRef         = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        chipRef.current && !chipRef.current.contains(e.target) &&
        cardRef.current && !cardRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const tooltipTitle = [
    mentionedBy && `Mentioned by ${mentionedBy}`,
    mentionedAt && `on ${formatDate(mentionedAt)}`,
  ].filter(Boolean).join(' ');

  return (
    <span className="relative inline-block align-baseline">
      {/* Chip */}
      <button
        ref={chipRef}
        type="button"
        title={tooltipTitle || undefined}
        onClick={() => setOpen(v => !v)}
        className="
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
          bg-accent/10 text-accent text-[12px] font-semibold
          hover:bg-accent/20 transition-colors cursor-pointer
          align-baseline leading-none
        "
      >
        {/* Mini avatar */}
        <span className="
          w-3.5 h-3.5 rounded-full bg-accent/30 flex items-center justify-center
          text-[8px] font-bold text-accent flex-shrink-0
        ">
          {initials(displayName)}
        </span>
        <span>{displayName}</span>
      </button>

      {/* Profile mini-card */}
      {open && (
        <div
          ref={cardRef}
          className="
            absolute z-50 left-0 top-full mt-1.5
            w-56 bg-white rounded-xl shadow-xl border border-gray-100
            p-3 text-left
          "
          style={{ minWidth: '200px' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="
                w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center
                text-[12px] font-bold text-accent flex-shrink-0
              ">
                {initials(displayName)}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-800 leading-tight truncate">
                  {displayName}
                </p>
                {role && (
                  <span className="
                    inline-block text-[10px] font-medium px-1.5 py-0.5 mt-0.5 rounded-full
                    bg-gray-100 text-gray-500 capitalize leading-none
                  ">
                    {role}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5"
            >
              <X size={12} />
            </button>
          </div>

          {/* Email */}
          {email && (
            <p className="text-[11px] text-gray-500 truncate mb-2">
              {email}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
            <a
              href={`/contacts/${userId}`}
              className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
              onClick={() => setOpen(false)}
            >
              View profile
            </a>
            <span className="text-gray-200">·</span>
            <button
              type="button"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setOpen(false)}
            >
              Send DM
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
