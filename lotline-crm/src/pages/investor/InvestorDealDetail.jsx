import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ArrowLeft, Share2, MessageCircle, MapPin } from 'lucide-react';
import {
  fetchMyDeal, fetchDealDistributions, fetchDealPhotos,
  fetchDealMilestones, fetchPinnedUpdate,
} from '../../lib/investorPortalData';
import DealPhotoCarousel from '../../components/investor/DealPhotoCarousel';
import YourPosition      from '../../components/investor/YourPosition';
import DealMetrics       from '../../components/investor/DealMetrics';
import MilestoneTimeline from '../../components/investor/MilestoneTimeline';
import PinnedStatusNote  from '../../components/investor/PinnedStatusNote';
import InlineDocs        from '../../components/investor/InlineDocs';
import AskQuestionModal  from '../../components/investor/AskQuestionModal';

const STAGE_COLORS = {
  'Contract Signed': 'bg-green-500/80',
  'Due Diligence':   'bg-yellow-500/80',
  'Development':     'bg-blue-500/80',
  'Complete':        'bg-purple-500/80',
};

export default function InvestorDealDetail() {
  const { id }       = useParams();
  const { investor } = useOutletContext();

  const [deal, setDeal]               = useState(null);
  const [photos, setPhotos]           = useState([]);
  const [milestones, setMilestones]   = useState([]);
  const [distributions, setDist]      = useState([]);
  const [pinnedUpdate, setPinned]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [askOpen, setAskOpen]         = useState(false);
  const [shareLabel, setShareLabel]   = useState('Share');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMyDeal(id, investor?.name),
      fetchDealDistributions(id),
      fetchDealPhotos(id),
      fetchDealMilestones(id),
      fetchPinnedUpdate(id),
    ]).then(([
      { deal: d },
      { distributions: dist },
      { photos: ph },
      { milestones: ms },
      { update: pinned },
    ]) => {
      setDeal(d);
      setDist((dist ?? []).filter(x => x.investor_id === investor.id));
      setPhotos(ph ?? []);
      setMilestones(ms ?? []);
      setPinned(pinned);
      setLoading(false);
    });
  }, [id, investor?.name]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel('Copied!');
      setTimeout(() => setShareLabel('Share'), 2000);
    } catch {
      setShareLabel('Share');
    }
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="w-full h-64 md:h-80 bg-white/5" />
        <div className="max-w-5xl mx-auto px-4 md:px-8 mt-8 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-52 bg-white/5 rounded-2xl" />
            <div className="h-52 bg-white/5 rounded-2xl" />
          </div>
          <div className="h-28 bg-white/5 rounded-2xl" />
          <div className="h-16 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  /* ─── Not found ─── */
  if (!deal) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-gray-400 text-sm">Deal not found or not accessible.</p>
        <Link to="/investor/deals" className="text-accent text-sm hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={12} /> Back to deals
        </Link>
      </div>
    );
  }

  const totalDistributed = distributions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const stagePill = STAGE_COLORS[deal.stage] ?? 'bg-accent/80';

  return (
    <div className="pb-20 min-h-screen">
      {askOpen && (
        <AskQuestionModal
          deal={deal}
          investor={investor}
          onClose={() => setAskOpen(false)}
        />
      )}

      {/* ── 1. Hero ──────────────────────────────────────────── */}
      <div className="relative">
        <DealPhotoCarousel photos={photos} address={deal.address} />

        {/* Top bar overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 md:px-5 py-3 z-10">
          <Link
            to="/investor/deals"
            className="flex items-center gap-1.5 text-xs text-white/80 bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm transition-all"
          >
            <ArrowLeft size={11} /> Back to deals
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs text-white/80 bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm transition-all"
            >
              <Share2 size={11} /> {shareLabel}
            </button>
            <button
              onClick={() => setAskOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-accent/90 hover:bg-accent px-3 py-1.5 rounded-full transition-all"
            >
              <MessageCircle size={11} /> Ask a question
            </button>
          </div>
        </div>

        {/* Address overlay at bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 py-4 pointer-events-none">
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-white leading-tight drop-shadow-lg">
                {deal.address}
              </h1>
              {(deal.county || deal.state) && (
                <p className="text-xs text-white/60 flex items-center gap-1 mt-0.5">
                  <MapPin size={10} /> {[deal.county, deal.state].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full text-white ${stagePill}`}>
              {deal.stage}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-6 mt-6">

        {/* ── 2. Your Position + Deal Metrics ── */}
        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <YourPosition deal={deal} totalDistributed={totalDistributed} />
          <DealMetrics  deal={deal} />
        </div>

        {/* ── 3. Milestone Timeline ── */}
        <MilestoneTimeline deal={deal} milestones={milestones} />

        {/* ── 4. Pinned Status Note ── */}
        {pinnedUpdate && <PinnedStatusNote update={pinnedUpdate} />}

        {/* ── 8. Inline Documents ── */}
        <InlineDocs dealId={deal.id} investorId={investor?.id} />

        {/* ── 9. Property Details (demoted) ── */}
        {[deal.financing, deal.utility_scenario, deal.home_model, deal.acreage, deal.county].some(Boolean) && (
          <div>
            <h2 className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3">
              Property Details
            </h2>
            <div className="bg-[#1c2130] rounded-2xl border border-white/8 divide-y divide-white/5">
              {[
                { label: 'Financing',        value: deal.financing         },
                { label: 'Utility Scenario', value: deal.utility_scenario  },
                { label: 'Home Model',       value: deal.home_model        },
                { label: 'Acreage',          value: deal.acreage ? `${deal.acreage} acres` : null },
                { label: 'County',           value: deal.county            },
                { label: 'State',            value: deal.state             },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between px-5 py-3 text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-200 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
