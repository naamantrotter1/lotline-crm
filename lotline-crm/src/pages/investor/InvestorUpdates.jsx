import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, Image as ImageIcon, X } from 'lucide-react';
import { fetchMyDealUpdates } from '../../lib/investorPortalData';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function Lightbox({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
        <X size={24} />
      </button>
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

export default function InvestorUpdates() {
  const { investor }         = useOutletContext();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!investor) return;
    fetchMyDealUpdates(investor.name).then(({ updates: u }) => {
      setUpdates(u);
      setLoading(false);
    });
  }, [investor]);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-white">Project Updates</h1>
        <p className="text-sm text-gray-400 mt-0.5">{updates.length} update{updates.length !== 1 ? 's' : ''} across your deals</p>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="bg-white/5 rounded-xl h-32 animate-pulse" />)}</div>
      ) : updates.length === 0 ? (
        <div className="bg-[#1c2130] rounded-xl p-12 text-center border border-white/8">
          <Bell size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">No updates yet. Check back soon.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
          <div className="space-y-6 pl-10">
            {updates.map(u => (
              <div key={u.id} className="relative">
                {/* Dot */}
                <div className="absolute -left-[26px] top-2 w-3 h-3 rounded-full bg-accent ring-2 ring-[#0f1117]" />
                <div className="bg-[#1c2130] rounded-xl p-5 border border-white/8">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{u.title}</p>
                      <p className="text-[10px] text-accent mt-0.5">{u.deals?.address}</p>
                    </div>
                    <span className="text-[10px] text-gray-500 flex-shrink-0 mt-0.5">{fmtDate(u.posted_at)}</span>
                  </div>
                  {u.body_md && (
                    <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{u.body_md}</p>
                  )}
                  {Array.isArray(u.photos) && u.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {u.photos.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setLightbox(src)}
                          className="relative w-24 h-24 rounded-lg overflow-hidden bg-white/5 hover:ring-2 ring-accent transition-all"
                        >
                          <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
