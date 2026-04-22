import { useState } from 'react';
import { ChevronLeft, ChevronRight, Camera, X, ZoomIn } from 'lucide-react';

const TYPE_LABELS = { rendering: 'Rendering', site: 'Site', progress: 'Progress', finished: 'Finished' };

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white z-10"
        aria-label="Close"
      >
        <X size={22} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onPrev(); }}
        disabled={index === 0}
        className="absolute left-3 md:left-6 p-3 text-white/60 hover:text-white disabled:opacity-20 transition-opacity"
        aria-label="Previous photo"
      >
        <ChevronLeft size={28} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onNext(); }}
        disabled={index === photos.length - 1}
        className="absolute right-3 md:right-6 p-3 text-white/60 hover:text-white disabled:opacity-20 transition-opacity"
        aria-label="Next photo"
      >
        <ChevronRight size={28} />
      </button>

      <img
        src={photos[index].url}
        alt={photos[index].caption ?? ''}
        className="max-h-[85vh] max-w-[88vw] object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
      />

      {photos[index].caption && (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/80 bg-black/60 px-4 py-1.5 rounded-full whitespace-nowrap max-w-xs truncate">
          {photos[index].caption}
        </p>
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {photos.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function DealPhotoCarousel({ photos = [], address }) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!photos.length) {
    return (
      <div className="w-full h-64 md:h-80 bg-[#0f1117] flex flex-col items-center justify-center gap-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-transparent to-transparent" />
        <Camera size={36} className="text-gray-700" />
        <p className="text-gray-600 text-sm">Property photos coming soon</p>
      </div>
    );
  }

  const prev = () => setCurrent(i => Math.max(0, i - 1));
  const next = () => setCurrent(i => Math.min(photos.length - 1, i + 1));

  return (
    <>
      {lightboxOpen && (
        <Lightbox
          photos={photos}
          index={current}
          onClose={() => setLightboxOpen(false)}
          onPrev={prev}
          onNext={next}
        />
      )}

      <div className="relative w-full h-64 md:h-80 overflow-hidden bg-[#0f1117] group select-none">
        {/* Main image */}
        <img
          src={photos[current].url}
          alt={photos[current].caption ?? address}
          className="w-full h-full object-cover transition-opacity duration-300"
          loading="lazy"
          draggable={false}
        />

        {/* Gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none" />

        {/* Zoom button */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute top-3 right-3 p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
          aria-label="View full size"
        >
          <ZoomIn size={15} />
        </button>

        {/* Type badge */}
        {photos[current].type && (
          <span className="absolute top-3 left-16 md:left-20 text-[10px] font-semibold text-white/70 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
            {TYPE_LABELS[photos[current].type] ?? photos[current].type}
          </span>
        )}

        {/* Nav arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={prev}
              disabled={current === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all disabled:opacity-25 backdrop-blur-sm"
              aria-label="Previous photo"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              disabled={current === photos.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-all disabled:opacity-25 backdrop-blur-sm"
              aria-label="Next photo"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        )}

        {/* Counter */}
        <div className="absolute top-3 left-3 flex items-center gap-1 text-[10px] text-white/70 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
          <Camera size={10} /> {current + 1} / {photos.length}
        </div>
      </div>
    </>
  );
}
