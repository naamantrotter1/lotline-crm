import { MapPin, ExternalLink } from 'lucide-react';

export default function PropertyMap({ address }) {
  if (!address) return null;

  const query = encodeURIComponent(address);
  // Use OpenStreetMap embed (no API key required)
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=-84,25,-75,37&layer=mapnik&marker=${query}`;
  const mapsUrl  = `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <div className="bg-[#1c2130] rounded-2xl border border-white/8 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-gray-400" />
          <span className="text-sm font-semibold text-white">Location</span>
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-accent transition-colors"
        >
          Open in Maps <ExternalLink size={10} />
        </a>
      </div>
      <div className="relative h-44 bg-[#161b22]">
        <iframe
          title="Property location"
          src={`https://maps.google.com/maps?q=${query}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
          className="w-full h-full border-0 opacity-90"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {/* Address label overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-[#1c2130]/80 to-transparent pointer-events-none">
          <p className="text-xs text-white/80 truncate">{address}</p>
        </div>
      </div>
    </div>
  );
}
