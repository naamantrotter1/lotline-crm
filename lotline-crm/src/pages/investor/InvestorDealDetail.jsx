import { useEffect, useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, DollarSign, TrendingUp, Image as ImageIcon, X } from 'lucide-react';
import { fetchMyDeal, fetchDealUpdates, fetchDealDistributions } from '../../lib/investorPortalData';

const STAGE_ORDER = ['Contract Signed', 'Due Diligence', 'Development', 'Complete'];

function fmt(n)    { return `$${Math.round(n ?? 0).toLocaleString()}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PipelineProgress({ stage }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center gap-1">
          <div className={`w-full h-2 rounded-full transition-colors ${i <= idx ? 'bg-accent' : 'bg-white/10'}`} />
          <span className={`text-[9px] text-center leading-tight ${i === idx ? 'text-accent font-semibold' : 'text-gray-600'}`}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function Lightbox({ src, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
        <X size={24} />
      </button>
      <img src={src} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

export default function InvestorDealDetail() {
  const { id }           = useParams();
  const { investor }     = useOutletContext();
  const [deal, setDeal]  = useState(null);
  const [updates, setUpdates]   = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!investor) return;
    Promise.all([
      fetchMyDeal(id, investor.name),
      fetchDealUpdates(id),
      fetchDealDistributions(id),
    ]).then(([{ deal: d }, { updates: u }, { distributions: dist }]) => {
      setDeal(d);
      setUpdates(u.filter(upd => upd.visibility === 'investor'));
      setDistributions(dist.filter(dist => dist.investor_id === investor.id));
      setLoading(false);
    });
  }, [id, investor]);

  if (loading) {
    return <div className="p-8"><div className="bg-white/5 rounded-xl h-64 animate-pulse" /></div>;
  }
  if (!deal) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Deal not found or not accessible.</p>
        <Link to="/investor/deals" className="text-accent text-sm hover:underline mt-2 inline-block">← Back to deals</Link>
      </div>
    );
  }

  const totalCost = (deal.land ?? 0) + (deal.mobile_home ?? 0) + (deal.permits ?? 0) +
    (deal.setup ?? 0) + (deal.septic ?? 0) + (deal.well ?? 0) + (deal.electric ?? 0) +
    (deal.hvac ?? 0) + (deal.clear_land ?? 0) + (deal.electric ?? 0) + (deal.water_cost ?? 0);
  const sellingCosts = (deal.arv ?? 0) * 0.045;
  const projectedProfit = (deal.arv ?? 0) - totalCost - sellingCosts;

  const METRICS = [
    { label: 'After-Repair Value', value: fmt(deal.arv),           icon: TrendingUp  },
    { label: 'Capital Deployed',   value: fmt(totalCost),          icon: DollarSign  },
    { label: 'Projected Profit',   value: fmt(projectedProfit),    icon: TrendingUp  },
    { label: 'Projected IRR',      value: deal.projected_irr ? `${deal.projected_irr}%` : '—', icon: TrendingUp },
    { label: 'Expected Close',     value: fmtDate(deal.projected_payout_date ?? deal.close_date), icon: Calendar },
    { label: 'Contract Date',      value: fmtDate(deal.contract_date), icon: Calendar },
  ];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* Back + header */}
      <div>
        <Link to="/investor/deals" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft size={13} /> Back to deals
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">{deal.address}</h1>
            {deal.county && <p className="text-sm text-gray-400 flex items-center gap-1 mt-1"><MapPin size={12} /> {deal.county}, {deal.state}</p>}
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 bg-accent/15 text-accent rounded-full">{deal.stage}</span>
        </div>
      </div>

      {/* Pipeline progress */}
      <div className="bg-[#1c2130] rounded-xl p-5 border border-white/8">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Pipeline Progress</p>
        <PipelineProgress stage={deal.stage} />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {METRICS.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#1c2130] rounded-xl p-4 border border-white/8">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className="text-gray-500" />
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-lg font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Distributions for this deal */}
      {distributions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">Distributions</h2>
          <div className="bg-[#1c2130] rounded-xl border border-white/8 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="border-b border-white/10">
                <tr>
                  {['Date', 'Amount', 'Type', 'Wire Ref'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {distributions.map(d => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 text-gray-300">{fmtDate(d.date)}</td>
                    <td className="px-4 py-3 font-semibold text-green-400">{fmt(d.amount)}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{(d.type ?? '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-gray-500">{d.wire_reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deal update feed */}
      {updates.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">Project Updates</h2>
          <div className="space-y-4">
            {updates.map(u => (
              <div key={u.id} className="bg-[#1c2130] rounded-xl p-5 border border-white/8">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{u.title}</p>
                  <span className="text-[10px] text-gray-500">{fmtDate(u.posted_at)}</span>
                </div>
                {u.body_md && <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{u.body_md}</p>}
                {Array.isArray(u.photos) && u.photos.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {u.photos.map((src, i) => (
                      <button key={i} onClick={() => setLightbox(src)} className="relative w-20 h-20 rounded-lg overflow-hidden bg-white/5 hover:ring-2 ring-accent transition-all">
                        <img src={src} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                          <ImageIcon size={14} className="text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deal details */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">Property Details</h2>
        <div className="bg-[#1c2130] rounded-xl border border-white/8 divide-y divide-white/5">
          {[
            { label: 'Financing',        value: deal.financing },
            { label: 'Utility Scenario', value: deal.utility_scenario },
            { label: 'Home Model',       value: deal.home_model },
            { label: 'Acreage',          value: deal.acreage ? `${deal.acreage} acres` : null },
            { label: 'County',           value: deal.county },
            { label: 'State',            value: deal.state },
          ].filter(r => r.value).map(({ label, value }) => (
            <div key={label} className="flex justify-between px-5 py-3 text-xs">
              <span className="text-gray-500">{label}</span>
              <span className="text-gray-200 font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
