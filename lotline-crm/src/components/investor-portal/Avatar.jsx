// Small deterministic-colored avatar — initials in a circle.
// Used in the new InvestorTable rows.

const PALETTE = [
  { bg: 'bg-indigo-100 dark:bg-indigo-500/20', fg: 'text-indigo-700 dark:text-indigo-300' },
  { bg: 'bg-rose-100 dark:bg-rose-500/20',     fg: 'text-rose-700 dark:text-rose-300'     },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/20', fg: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-amber-100 dark:bg-amber-500/20',   fg: 'text-amber-700 dark:text-amber-300'   },
  { bg: 'bg-sky-100 dark:bg-sky-500/20',       fg: 'text-sky-700 dark:text-sky-300'       },
  { bg: 'bg-violet-100 dark:bg-violet-500/20', fg: 'text-violet-700 dark:text-violet-300' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', fg: 'text-fuchsia-700 dark:text-fuchsia-300' },
  { bg: 'bg-teal-100 dark:bg-teal-500/20',     fg: 'text-teal-700 dark:text-teal-300'     },
];

function hashIndex(str, mod) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 32 }) {
  const { bg, fg } = PALETTE[hashIndex(name, PALETTE.length)];
  return (
    <div
      className={`${bg} ${fg} flex items-center justify-center rounded-full font-semibold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initials(name)}
    </div>
  );
}
