/**
 * HomeModelShowcase
 *
 * Investor-facing card that shows the photos, specs, description, and
 * features of the home model selected on the deal. Data source is the
 * same static `/homes/homes.json` catalog used by the operator's Order
 * Home tool (no separate API). Match strategy is forgiving so it works
 * regardless of how the deal's `home_model` field is formatted
 * ("Cavco - Phoenix 32684A", "Phoenix 32684A", "Phoenix 32684A (Cavco)").
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, BedDouble, Bath, Ruler } from 'lucide-react';

// In-memory cache so we only fetch the catalog once per page session.
let HOMES_PROMISE = null;
function loadHomes() {
  if (!HOMES_PROMISE) {
    HOMES_PROMISE = fetch('/homes/homes.json')
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return HOMES_PROMISE;
}

// Strip common decorations to compare model names loosely.
function normalize(name = '') {
  return String(name)
    .replace(/\s*\([^)]*\)\s*/g, ' ')   // drop parenthetical suffixes / codes
    .replace(/^[^-]+-\s*/, '')            // drop a leading "Brand - " prefix
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findHome(homes, dealHomeModel) {
  if (!dealHomeModel) return null;
  const target = normalize(dealHomeModel);
  if (!target) return null;
  // Exact normalized match first, then a substring fallback for either direction.
  return (
    homes.find(h => normalize(h.name) === target) ||
    homes.find(h => normalize(h.name).includes(target)) ||
    homes.find(h => target.includes(normalize(h.name))) ||
    null
  );
}

export default function HomeModelShowcase({ dealHomeModel }) {
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHome(null);
    setActiveIdx(0);
    loadHomes().then(list => {
      if (!active) return;
      setHome(findHome(list || [], dealHomeModel));
      setLoading(false);
    });
    return () => { active = false; };
  }, [dealHomeModel]);

  if (loading || !home) return null;

  const photos = Array.isArray(home.photos) ? home.photos : [];
  const next = () => setActiveIdx(i => (photos.length > 0 ? (i + 1) % photos.length : 0));
  const prev = () => setActiveIdx(i => (photos.length > 0 ? (i - 1 + photos.length) % photos.length : 0));

  return (
    <div className="bg-white dark:bg-[#1c2130] rounded-2xl border border-gray-200 dark:border-white/8 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Home Model
          </p>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-0.5 truncate">
            {home.name}
          </h3>
          {home.brand && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{home.brand}{home.year ? ` · ${home.year}` : ''}</p>
          )}
        </div>
      </div>

      {/* Photo gallery */}
      {photos.length > 0 && (
        <div className="relative bg-gray-100 dark:bg-black/40 aspect-[16/10] overflow-hidden">
          <img
            src={photos[activeIdx]}
            alt={`${home.name} photo ${activeIdx + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm flex items-center justify-center transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                {activeIdx + 1} / {photos.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Specs row */}
      {(home.beds || home.baths || home.sqft) && (
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/8 border-b border-gray-200 dark:border-white/8">
          {home.beds != null && (
            <div className="px-3 py-3 flex flex-col items-center gap-1 text-center">
              <BedDouble size={14} className="text-gray-400 dark:text-gray-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{home.beds}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">{home.beds === 1 ? 'Bed' : 'Beds'}</p>
            </div>
          )}
          {home.baths != null && (
            <div className="px-3 py-3 flex flex-col items-center gap-1 text-center">
              <Bath size={14} className="text-gray-400 dark:text-gray-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{home.baths}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">{home.baths === 1 ? 'Bath' : 'Baths'}</p>
            </div>
          )}
          {home.sqft != null && (
            <div className="px-3 py-3 flex flex-col items-center gap-1 text-center">
              <Ruler size={14} className="text-gray-400 dark:text-gray-500" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{Number(home.sqft).toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">Sq Ft</p>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {home.desc && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{home.desc}</p>
        </div>
      )}

      {/* Features */}
      {Array.isArray(home.features) && home.features.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
            Features
          </p>
          <div className="flex flex-wrap gap-1.5">
            {home.features.map((f, i) => (
              <span
                key={`${f}-${i}`}
                className="text-[11px] text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/8 rounded-full px-2.5 py-1"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
